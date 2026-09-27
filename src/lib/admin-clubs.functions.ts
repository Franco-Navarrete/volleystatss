import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE = 24;

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data: user } = await ctx.supabase.auth.getUser();
  if (user?.user?.email === "franco.e.navarrete@gmail.com") return;
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error("No se pudo verificar permisos.");
  if (!data) throw new Error("Solo administradores.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const pageInput = z.object({ search: z.string().max(80).default(""), page: z.number().int().min(0).max(10000).default(0) });

export const adminListClubs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pageInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db.rpc("admin_club_directory", { _search: data.search.trim(), _limit: PAGE, _offset: data.page * PAGE });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    return { rows: list.map((r) => ({ ...r, categories: Number(r.categories), players: Number(r.players), coaches: Number(r.coaches), planilleros: Number(r.planilleros), pending: Number(r.pending) })), total: Number(list[0]?.total_count ?? 0), pageSize: PAGE };
  });

export const adminGetClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: club, error } = await db.from("clubs").select("id, name, logo_url, city, province, country, primary_color, owner_id, created_at").eq("id", data.clubId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!club) throw new Error("Club no encontrado.");
    const [{ data: teams }, { data: summary }] = await Promise.all([
      db.from("teams").select("id, name, short_name, gender, category, logo_url, color").eq("club_id", data.clubId).order("name"),
      db.rpc("admin_club_directory", { _search: club.name, _limit: 100, _offset: 0 }),
    ]);
    const ids = (teams ?? []).map((t: any) => t.id);
    const [{ data: pl }, { data: mem }] = ids.length
      ? await Promise.all([
          db.from("players").select("team_id").in("team_id", ids),
          db.from("team_members").select("team_id").in("team_id", ids).eq("status", "pending"),
        ])
      : [{ data: [] }, { data: [] }];
    const count = (arr: any[] | null, id: string) => (arr ?? []).filter((r) => r.team_id === id).length;
    const s = ((summary ?? []) as any[]).find((r) => r.id === club.id);
    return {
      club,
      stats: { categories: ids.length, players: Number(s?.players ?? 0), coaches: Number(s?.coaches ?? 0), planilleros: Number(s?.planilleros ?? 0) },
      categories: (teams ?? []).map((t: any) => ({ ...t, players: count(pl, t.id), pending: count(mem, t.id) })),
    };
  });

export const adminListClubUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pageInput.extend({ clubId: z.string().uuid(), kind: z.enum(["", "coach", "planillero", "player"]).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db.rpc("admin_club_users", { _club: data.clubId, _kind: data.kind, _search: data.search.trim(), _limit: 50, _offset: data.page * 50 });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    return { rows: list, total: Number(list[0]?.total_count ?? 0), pageSize: 50 };
  });

export const adminListCategoryPlayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ teamId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db.from("players").select("id, name, number, position, photo_url, user_id").eq("team_id", data.teamId).order("number");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((p: any) => ({ id: p.id, name: p.name, number: p.number, position: p.position ?? undefined, photoUrl: p.photo_url ?? undefined, hasAccount: !!p.user_id }));
  });

export const adminRemoveFromClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clubId: z.string().uuid(), userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: teams } = await db.from("teams").select("id").eq("club_id", data.clubId);
    const ids = (teams ?? []).map((t: any) => t.id);
    if (ids.length) {
      // Only memberships are removed; the global account is never deleted.
      await db.from("team_members").delete().eq("user_id", data.userId).in("team_id", ids);
      await db.from("team_coaches").delete().eq("user_id", data.userId).in("team_id", ids);
    }
    return { ok: true };
  });

export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pageInput.extend({
    role: z.enum(["", "admin", "entrenador", "planillero", "analyst", "player"]).default(""),
    clubId: z.string().uuid().nullable().default(null),
    status: z.enum(["", "active", "pending"]).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: rows, error } = await db.rpc("admin_user_search", { _search: data.search.trim(), _role: data.role, _club: data.clubId, _status: data.status, _limit: 50, _offset: data.page * 50 });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    return { rows: list, total: Number(list[0]?.total_count ?? 0), pageSize: 50 };
  });
