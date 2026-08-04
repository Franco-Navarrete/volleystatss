import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const emailSchema = z.string().trim().toLowerCase().email().max(255);
const passwordSchema = z.string().min(8).max(72);
const uuidSchema = z.string().uuid();

export type ExtraRole = "entrenador" | "planillero" | "analyst";

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
    const extraRolesByUser = new Map<string, ExtraRole[]>();
    for (const r of rolesRes.data ?? []) {
      if (r.role === "entrenador" || r.role === "planillero" || r.role === "analyst") {
        const arr = extraRolesByUser.get(r.user_id) ?? [];
        arr.push(r.role as ExtraRole);
        extraRolesByUser.set(r.user_id, arr);
      }
    }
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
      extraRoles: extraRolesByUser.get(p.id) ?? [],
      canCreateMatches: permsByUser.get(p.id)?.can_create_matches ?? false,
      canManageTeams: permsByUser.get(p.id)?.can_manage_teams ?? false,
      leagueIds: accessByUser.get(p.id) ?? [],
    }));
  });

// ---------- Crear usuario ----------

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    email: string;
    password: string;
    leagueIds: string[];
    canCreateMatches: boolean;
    extraRoles?: ExtraRole[];
  }) =>
    z
      .object({
        email: emailSchema,
        password: passwordSchema,
        leagueIds: z.array(uuidSchema).max(200),
        canCreateMatches: z.boolean(),
        extraRoles: z.array(z.enum(["entrenador", "planillero", "analyst"])).max(3).optional().default([]),
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
    let newUserId: string;
    if (created.error || !created.data.user) {
      const errMsg = created.error?.message ?? "";
      const errCode = (created.error as { code?: string } | null)?.code;
      const alreadyExists =
        errCode === "email_exists" ||
        errCode === "user_already_exists" ||
        /already been registered|already registered|already exists/i.test(errMsg);
      if (alreadyExists) {
        // Look up existing user by email and reuse it (update password + permissions).
        const { data: existing, error: lookupErr } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", data.email)
          .maybeSingle();
        let existingId = existing?.id as string | undefined;
        if (!existingId) {
          // Fallback: paginate auth users to find by email.
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
          existingId = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase())?.id;
        }
        if (lookupErr || !existingId) {
          throw new Error("Ya existe un usuario con ese email, pero no se pudo recuperar. Editalo desde la lista.");
        }
        const { error: pwUpdErr } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password: data.password,
          email_confirm: true,
        });
        if (pwUpdErr) throw new Error(pwUpdErr.message);
        newUserId = existingId;
      } else if (created.error?.name === "AuthWeakPasswordError" || errCode === "weak_password") {
        throw new Error("La contraseña es demasiado débil o conocida. Elegí una más segura (mezclá mayúsculas, números y símbolos).");
      } else {
        throw new Error(errMsg || "No se pudo crear el usuario.");
      }
    } else {
      newUserId = created.data.user.id;
    }


    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, email: data.email });
    if (profileErr) throw profileErr;

    // Se eliminó la tabla admin_user_passwords por motivos de seguridad.
    // No guardamos contraseñas en texto plano.

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

    const uniqueExtra = Array.from(new Set(data.extraRoles ?? []));
    if (uniqueExtra.length > 0) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(uniqueExtra.map((role) => ({ user_id: newUserId, role: role as any })));
      if (roleErr) throw roleErr;
    }

    return { id: newUserId };
  });

// ---------- Asignar / quitar rol extra (entrenador / planillero) ----------

export const adminSetExtraRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; roles: ExtraRole[] }) =>
    z
      .object({
        userId: uuidSchema,
        roles: z.array(z.enum(["entrenador", "planillero", "analyst"])).max(3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Borra los roles no-admin existentes
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["entrenador", "planillero", "analyst"]);
    if (delErr) throw delErr;

    const unique = Array.from(new Set(data.roles));
    if (unique.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(unique.map((role) => ({ user_id: data.userId, role: role as any })));
      if (insErr) throw insErr;
    }
    return { ok: true };
  });

// ---------- Cambiar contraseña ----------

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) =>
    z.object({ userId: uuidSchema, password: passwordSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) {
      if (error.name === "AuthWeakPasswordError" || (error as { code?: string }).code === "weak_password") {
        throw new Error("La contraseña es demasiado débil o conocida. Elegí una más segura (mezclá mayúsculas, números y símbolos).");
      }
      throw error;
    }
    // No guardamos la contraseña en la base de datos pública.
    return { ok: true };
  });

// ---------- Ver contraseña asignada por admin ----------

export const adminGetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: uuidSchema }).parse(input))
  .handler(async () => {
    // Ya no se permite recuperar contraseñas por seguridad.
    return null;
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
