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
