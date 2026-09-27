import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Carrera de la cuenta que inició sesión (solo sus propios datos). */
export const getMyCareer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { computeCareerForUser } = await import("./player-career.server");
    return computeCareerForUser(await admin(), context.userId);
  });

function ageOf(birth: string | null) {
  if (!birth) return null;
  const b = new Date(birth); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

/** Perfil público: solo existe si la jugadora lo activó. Nunca devuelve edad exacta, fecha ni email. */
export const getPublicPlayer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ alias: z.string().regex(/^[a-z0-9-]{3,40}$/) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: p } = await db.from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, bio, height_cm, dominant_hand, birth_date, visibility, show_stats, show_club")
      .eq("alias", data.alias).maybeSingle();
    if (!p || p.visibility !== "public") return null;
    const { computeCareerForUser } = await import("./player-career.server");
    const career = p.show_stats ? await computeCareerForUser(db, p.user_id) : null;
    const age = ageOf(p.birth_date);
    const { data: main } = await db.from("players").select("number, position").eq("user_id", p.user_id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return {
      name: `${p.first_name} ${p.last_name}`.trim(),
      photoUrl: p.photo_url as string | null,
      bio: p.bio as string | null,
      heightCm: p.height_cm as number | null,
      hand: p.dominant_hand as string | null,
      isMinor: age != null && age < 18,
      number: (main?.number ?? null) as number | null,
      position: (main?.position ?? null) as string | null,
      career: career && {
        ...career,
        teams: p.show_club ? career.teams : [],
        performances: career.performances.slice(0, 10),
      },
    };
  });

/** Vista administrativa del perfil deportivo de un PLAYER (con o sin cuenta).
 *  Permitido a administradores y a quien gestiona el equipo de esa jugadora. */
export const getPlayerProfileForStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ playerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: p } = await db.from("players").select("id, team_id, name, number, position, photo_url, user_id, birth_date").eq("id", data.playerId).maybeSingle();
    if (!p) throw new Error("Jugadora no encontrada.");
    const { data: u } = await context.supabase.auth.getUser();
    let allowed = u?.user?.email === "franco.e.navarrete@gmail.com";
    if (!allowed) { const { data: r } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }); allowed = !!r; }
    if (!allowed) { const { data: r } = await context.supabase.rpc("can_manage_assigned_team", { _user_id: context.userId, _team_id: p.team_id }); allowed = !!r; }
    if (!allowed) throw new Error("No tenés permiso para ver esta jugadora.");
    const [{ data: team }, { data: inv }, prof] = await Promise.all([
      db.from("teams").select("id, name, category, gender, club, clubs(name), leagues(name, season)").eq("id", p.team_id).maybeSingle(),
      db.from("team_invitations").select("token").eq("player_id", p.id).eq("status", "pending").gt("expires_at", new Date().toISOString()).limit(1).maybeSingle(),
      p.user_id ? db.from("player_profiles").select("first_name, last_name, photo_url, alias, visibility").eq("user_id", p.user_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const { computeCareerForPlayer } = await import("./player-career.server");
    const career = await computeCareerForPlayer(db, p.id);
    const pr = (prof as any).data;
    return {
      id: p.id as string, teamId: p.team_id as string,
      name: (pr ? `${pr.first_name} ${pr.last_name}`.trim() : "") || (p.name as string),
      number: p.number as number, position: (p.position ?? null) as string | null,
      photoUrl: (p.photo_url ?? pr?.photo_url ?? null) as string | null,
      teamName: (team?.name ?? "") as string, category: (team?.category ?? null) as string | null, gender: (team?.gender ?? null) as string | null,
      club: ((team as any)?.clubs?.name ?? team?.club ?? null) as string | null,
      season: ((team as any)?.leagues?.season ?? null) as string | null,
      status: (p.user_id ? "linked" : inv ? "invited" : "none") as "linked" | "invited" | "none",
      inviteToken: (inv?.token ?? null) as string | null,
      publicAlias: pr?.visibility === "public" ? (pr.alias as string | null) : null,
      career,
    };
  });
