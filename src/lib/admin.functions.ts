import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const passwordSchema = z.string().min(8).max(72);
const uuidSchema = z.string().uuid();
const extraRoleSchema = z.enum(["entrenador", "planillero"]).nullable();
export type ExtraRole = "entrenador" | "planillero";

type AuthCtx = { supabase: SupabaseClient<Database>; userId: string };

async function assertAdmin(ctx: AuthCtx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error("No se pudo verificar permisos.");
  if (!data) throw new Error("Solo administradores.");
}

// ---------- Lectura: lista de usuarios con permisos y accesos ----------

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profilesRes, rolesRes, permsRes, accessRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("user_permissions").select("user_id, can_create_matches, can_manage_teams"),
      supabaseAdmin.from("user_league_access").select("user_id, league_id"),
    ]);

    if (profilesRes.error) throw profilesRes.error;

    const admins = new Set((rolesRes.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const permsByUser = new Map((permsRes.data ?? []).map((p) => [p.user_id, p]));
    const accessByUser = new Map<string, string[]>();
    for (const row of accessRes.data ?? []) {
      const arr = accessByUser.get(row.user_id) ?? [];
      arr.push(row.league_id);
      accessByUser.set(row.user_id, arr);
    }

    return (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      createdAt: p.created_at,
      isAdmin: admins.has(p.id),
      canCreateMatches: permsByUser.get(p.id)?.can_create_matches ?? false,
      canManageTeams: permsByUser.get(p.id)?.can_manage_teams ?? false,
      leagueIds: accessByUser.get(p.id) ?? [],
    }));
  });

// ---------- Crear usuario ----------

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; leagueIds: string[]; canCreateMatches: boolean }) =>
    z
      .object({
        email: emailSchema,
        password: passwordSchema,
        leagueIds: z.array(uuidSchema).max(200),
        canCreateMatches: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "No se pudo crear el usuario.");
    }
    const newUserId = created.data.user.id;

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, email: data.email });
    if (profileErr) throw profileErr;

    const { error: permErr } = await supabaseAdmin
      .from("user_permissions")
      .upsert({ user_id: newUserId, can_create_matches: data.canCreateMatches, can_manage_teams: false });
    if (permErr) throw permErr;

    if (data.leagueIds.length > 0) {
      const rows = data.leagueIds.map((lid) => ({
        user_id: newUserId,
        league_id: lid,
        granted_by: context.userId,
      }));
      const { error: accessErr } = await supabaseAdmin.from("user_league_access").insert(rows);
      if (accessErr) throw accessErr;
    }

    return { id: newUserId };
  });

// ---------- Eliminar usuario ----------

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("No podés eliminar tu propio usuario.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Actualizar permisos ----------

export const adminSetPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; canCreateMatches: boolean }) =>
    z.object({ userId: uuidSchema, canCreateMatches: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_permissions")
      .upsert({ user_id: data.userId, can_create_matches: data.canCreateMatches });
    if (error) throw error;
    return { ok: true };
  });

// ---------- Actualizar acceso a ligas ----------

export const adminSetLeagueAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; leagueIds: string[] }) =>
    z.object({ userId: uuidSchema, leagueIds: z.array(uuidSchema).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Borra todos y reinserta — atomicidad aceptable para un panel admin pequeño.
    const { error: delErr } = await supabaseAdmin
      .from("user_league_access")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw delErr;

    if (data.leagueIds.length > 0) {
      const rows = data.leagueIds.map((lid) => ({
        user_id: data.userId,
        league_id: lid,
        granted_by: context.userId,
      }));
      const { error: insErr } = await supabaseAdmin.from("user_league_access").insert(rows);
      if (insErr) throw insErr;
    }

    return { ok: true };
  });

// ---------- Asignar / quitar rol admin ----------

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; isAdmin: boolean }) =>
    z.object({ userId: uuidSchema, isAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && !data.isAdmin) {
      throw new Error("No podés quitarte tu propio rol de admin.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw error;
    }
    return { ok: true };
  });

// ---------- Ligas compartidas ----------

export const adminListLeagues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("leagues")
      .select("id, name, season, color, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const adminCreateLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; season?: string; color?: string }) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        season: z.string().trim().max(40).optional(),
        color: z.string().trim().max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("leagues")
      .insert({
        name: data.name,
        season: data.season || null,
        color: data.color || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const adminDeleteLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leagueId: string }) => z.object({ leagueId: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leagues").delete().eq("id", data.leagueId);
    if (error) throw error;
    return { ok: true };
  });
