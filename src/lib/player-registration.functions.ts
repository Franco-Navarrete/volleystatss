import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const uuidSchema = z.string().uuid();
const positionSchema = z.enum(["punta", "central", "opuesto", "armador", "libero", "universal"]);

function createPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const getPublicRegistrationTeam = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => z.object({ token: uuidSchema }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows, error } = await createPublicClient().rpc("get_player_registration_team", {
      _token: data.token,
    });
    if (error) throw new Error("No se pudo verificar el enlace.");
    const team = rows?.[0];
    if (!team) return null;
    return {
      id: team.team_id,
      name: team.team_name,
      shortName: team.team_short_name,
      logoUrl: team.team_logo_url,
      color: team.team_color,
      clubName: team.club_name,
    };
  });

export const submitPublicPlayerRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: {
    token: string;
    name: string;
    number: number;
    position: string;
    birthDate: string;
  }) => z.object({
    token: uuidSchema,
    name: z.string().trim().min(2).max(80),
    number: z.number().int().min(0).max(99),
    position: positionSchema,
    birthDate: z.string().date(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { data: playerId, error } = await createPublicClient().rpc("submit_player_registration", {
      _token: data.token,
      _name: data.name,
      _number: data.number,
      _position: data.position,
      _birth_date: data.birthDate,
    });
    if (error) {
      if (error.message.includes("ocupado")) throw new Error("Ese número de camiseta ya está ocupado en el equipo.");
      if (error.message.includes("desactivado")) throw new Error("Este enlace ya no está disponible.");
      throw new Error("No se pudo completar la inscripción. Revisá los datos e intentá nuevamente.");
    }
    return { ok: true, playerId };
  });

export const getTeamRegistrationLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => z.object({ teamId: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed, error: permissionError } = await context.supabase.rpc("can_manage_assigned_team", {
      _user_id: context.userId,
      _team_id: data.teamId,
    });
    if (permissionError || !allowed) throw new Error("No tenés permisos para administrar este equipo.");
    const { data: link, error } = await context.supabase
      .from("player_registration_links")
      .select("token, active, updated_at")
      .eq("team_id", data.teamId)
      .maybeSingle();
    if (error) throw error;
    return link ? { token: link.token, active: link.active, updatedAt: link.updated_at } : null;
  });

export const createOrRenewTeamRegistrationLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string }) => z.object({ teamId: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("can_manage_assigned_team", {
      _user_id: context.userId,
      _team_id: data.teamId,
    });
    if (!allowed) throw new Error("No tenés permisos para administrar este equipo.");
    const token = crypto.randomUUID();
    const { error } = await context.supabase.from("player_registration_links").upsert({
      team_id: data.teamId,
      token,
      active: true,
      created_by: context.userId,
    }, { onConflict: "team_id" });
    if (error) throw error;
    return { token, active: true };
  });

export const setTeamRegistrationLinkActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { teamId: string; active: boolean }) =>
    z.object({ teamId: uuidSchema, active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("can_manage_assigned_team", {
      _user_id: context.userId,
      _team_id: data.teamId,
    });
    if (!allowed) throw new Error("No tenés permisos para administrar este equipo.");
    const { error, count } = await context.supabase
      .from("player_registration_links")
      .update({ active: data.active }, { count: "exact" })
      .eq("team_id", data.teamId);
    if (error) throw error;
    if (!count) throw new Error("Primero generá un enlace de inscripción.");
    return { ok: true };
  });

export const adminListTeamAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [teams, assigned] = await Promise.all([
      supabaseAdmin.from("teams").select("id, name, short_name, club").order("name"),
      supabaseAdmin.from("team_coaches").select("team_id").eq("user_id", data.userId),
    ]);
    if (teams.error) throw teams.error;
    if (assigned.error) throw assigned.error;
    const assignedIds = new Set((assigned.data ?? []).map((row) => row.team_id));
    return (teams.data ?? []).map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.short_name,
      club: team.club,
      assigned: assignedIds.has(team.id),
    }));
  });

export const adminSetTeamAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; teamIds: string[] }) =>
    z.object({ userId: uuidSchema, teamIds: z.array(uuidSchema).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.userId)
      .eq("role", "entrenador")
      .maybeSingle();
    if (roleError) throw roleError;
    const { error: deleteError } = await supabaseAdmin.from("team_coaches").delete().eq("user_id", data.userId);
    if (deleteError) throw deleteError;
    if (data.teamIds.length) {
      const { error } = await supabaseAdmin.from("team_coaches").insert(
        data.teamIds.map((teamId) => ({ team_id: teamId, user_id: data.userId, assigned_by: context.userId })),
      );
      if (error) throw error;
    }
    return { ok: true };
  });