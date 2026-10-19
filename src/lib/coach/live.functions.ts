import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sportingTeam, validateLiveMatch, NO_LIVE_PERMISSIONS, type LiveSession, type LiveSnapshot, type LiveNote, type LivePermissions, type ScoutingMode } from "./live-contract";
import type { Match, Team } from "@/lib/volley-store";

const matchInput = z.object({ matchId: z.string().min(1).max(200) });

async function permissionsFor(context: { supabase: any; userId: string }, matchId: string): Promise<LivePermissions> {
  const { data, error } = await context.supabase.rpc("live_match_permissions", { _match: matchId, _user: context.userId });
  if (error || !data) return NO_LIVE_PERMISSIONS;
  return data as unknown as LivePermissions;
}

export const readLiveSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.parse(input))
  .handler(async ({ data, context }): Promise<{ session: LiveSession | null; notes: LiveNote[]; canActivate: boolean; canWrite: boolean; mode: ScoutingMode; permissions: LivePermissions }> => {
    const [{ data: row, error }, { data: admin }] = await Promise.all([
      context.supabase.from("live_match_sessions").select("*").eq("match_id", data.matchId).maybeSingle(),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (error) throw new Error("No se pudo consultar el partido en vivo.");
    if (!row) return { session: null, notes: [], canActivate: !!admin, canWrite: false, mode: "individual", permissions: NO_LIVE_PERMISSIONS };
    const [{ data: notes, error: noteError }, permissions] = await Promise.all([
      context.supabase.from("live_match_notes").select("id,body,context,status,author_id,created_at").eq("match_id", data.matchId).order("created_at", { ascending: false }).limit(100),
      permissionsFor(context, data.matchId),
    ]);
    if (noteError) throw new Error("No se pudieron consultar las observaciones.");
    const session = row as unknown as LiveSession;
    return { session, notes: (notes ?? []) as unknown as LiveNote[], canActivate: !!admin, canWrite: permissions.can_record_events, mode: session.scouting_mode ?? "individual", permissions };
  });

const participantInput = z.object({
  userId: z.string().uuid(),
  can_record_events: z.boolean().optional(),
  can_edit_events: z.boolean().optional(),
  can_view_live_stats: z.boolean().optional(),
  can_create_observations: z.boolean().optional(),
  can_manage_match: z.boolean().optional(),
});

/** Existing JSON copies cannot prove authorship. Only an administrator may activate and assign a writer. */
export const activateLiveSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.extend({
    scorerId: z.string().uuid().optional(), sourceUserId: z.string().uuid().optional(),
    mode: z.enum(["individual", "shared"]).optional(),
    participants: z.array(participantInput).max(20).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !admin) throw new Error("Solo un administrador puede habilitar y asignar la carga compartida.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deleted, error: deletionError } = await supabaseAdmin.from("match_deletions").select("match_id").eq("match_id", data.matchId).maybeSingle();
    if (deletionError || deleted) throw new Error("El partido no está disponible.");
    const { data: existing } = await context.supabase.from("live_match_sessions").select("match_id").eq("match_id", data.matchId).maybeSingle();
    if (existing) return { ok: true };
    // Administrator explicitly chooses the stored source. Never accept a client-supplied match/roster.
    const sourceId = data.sourceUserId ?? context.userId;
    const { data: source, error } = await supabaseAdmin.from("app_state").select("data").eq("user_id", sourceId).maybeSingle();
    if (error || !source) throw new Error("No se encontró la copia guardada del partido. Guardalo antes de habilitarlo.");
    const state = source.data as unknown as { matches?: Match[]; teams?: Team[] };
    const match = state.matches?.find((m) => m.id === data.matchId);
    if (!match || match.status === "finished") throw new Error("Solo se pueden habilitar partidos activos guardados; los históricos no se modifican.");
    const teamA = state.teams?.find((t) => t.id === match.teamAId);
    const teamB = state.teams?.find((t) => t.id === match.teamBId);
    if (!teamA || !teamB) throw new Error("Faltan los equipos en la copia guardada.");
    const scorerId = data.scorerId ?? context.userId;
    const staffIds = [scorerId, ...(data.participants ?? []).map((p) => p.userId)].filter((id) => id !== context.userId);
    if (staffIds.length) {
      const { data: roles, error: staffError } = await supabaseAdmin.from("user_roles").select("user_id").in("user_id", staffIds).in("role", ["admin", "planillero", "entrenador"]);
      if (staffError) throw new Error("No se pudieron validar los participantes.");
      const allowed = new Set((roles ?? []).map((r) => r.user_id));
      if (staffIds.some((id) => !allowed.has(id))) throw new Error("Hay usuarios no habilitados para participar del scouting.");
    }
    const snapshot: LiveSnapshot = { match, teamA: sportingTeam(teamA), teamB: sportingTeam(teamB) };
    snapshot.match = validateLiveMatch(match, snapshot);
    const mode: ScoutingMode = data.mode ?? "shared";
    const { error: insertError } = await supabaseAdmin.from("live_match_sessions").insert({ match_id: match.id, scorer_id: scorerId, team_a_id: match.teamAId, team_b_id: match.teamBId, scouting_mode: mode, snapshot: snapshot as unknown as never });
    if (insertError && insertError.code !== "23505") throw new Error("No se pudo habilitar la sesión.");
    if (data.participants?.length) {
      const rows = data.participants.filter((p) => p.userId !== scorerId).map((p) => ({
        match_id: match.id, user_id: p.userId, assigned_by: context.userId,
        can_record_events: !!p.can_record_events, can_edit_events: !!p.can_edit_events,
        can_view_live_stats: p.can_view_live_stats ?? true, can_create_observations: p.can_create_observations ?? true,
        can_manage_match: !!p.can_manage_match,
      }));
      if (rows.length) {
        const { error: partError } = await supabaseAdmin.from("live_match_participants").upsert(rows);
        if (partError) throw new Error("No se pudieron asignar los participantes.");
      }
    }
    return { ok: true };
  });

/** Manage participants of an active session: admins, or the scorer/manager of the session. */
export const assignLiveParticipant = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.extend({ participant: participantInput, remove: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const permissions = await permissionsFor(context, data.matchId);
    if (!permissions.can_manage_match) throw new Error("No tenés permiso para gestionar los participantes de este partido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.remove) {
      const { error } = await supabaseAdmin.from("live_match_participants").delete().eq("match_id", data.matchId).eq("user_id", data.participant.userId);
      if (error) throw new Error("No se pudo quitar el participante.");
      return { ok: true };
    }
    const { data: roles, error: roleError } = await supabaseAdmin.from("user_roles").select("user_id").eq("user_id", data.participant.userId).in("role", ["admin", "planillero", "entrenador"]);
    if (roleError || !roles?.length) throw new Error("El usuario no está habilitado para participar del scouting.");
    const p = data.participant;
    const { error } = await supabaseAdmin.from("live_match_participants").upsert({
      match_id: data.matchId, user_id: p.userId, assigned_by: context.userId,
      can_record_events: !!p.can_record_events, can_edit_events: !!p.can_edit_events,
      can_view_live_stats: p.can_view_live_stats ?? true, can_create_observations: p.can_create_observations ?? true,
      can_manage_match: !!p.can_manage_match,
    });
    if (error) throw new Error("No se pudo asignar el participante.");
    return { ok: true };
  });

export const commitLiveSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.extend({ operationId: z.string().uuid(), expectedVersion: z.number().int().positive(), match: z.unknown() }).parse(input))
  .handler(async ({ data, context }): Promise<{ version: number; updatedAt: string; duplicate: boolean }> => {
    const { data: row, error } = await context.supabase.from("live_match_sessions").select("*").eq("match_id", data.matchId).maybeSingle();
    if (error || !row) throw new Error("No tenés permiso de carga para este partido.");
    const permissions = await permissionsFor(context, data.matchId);
    if (row.scorer_id !== context.userId && !permissions.can_record_events) throw new Error("No tenés permiso de carga para este partido.");
    const previous = row.snapshot as unknown as LiveSnapshot;
    const match = validateLiveMatch(data.match, previous);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error: commitError } = await supabaseAdmin.rpc("commit_live_match", {
      _match: data.matchId, _actor: context.userId, _operation: data.operationId, _expected: data.expectedVersion,
      _snapshot: { ...previous, match } as unknown as never,
    });
    if (commitError) {
      if (commitError.message.includes("live_version_conflict")) throw new Error("CONFLICT: otra pantalla confirmó una versión más reciente. Recuperá el partido antes de continuar.");
      throw new Error("No se pudo confirmar la acción. Se conservará pendiente para reintentar.");
    }
    return result as unknown as { version: number; updatedAt: string; duplicate: boolean };
  });

const noteContext = z.object({ set: z.number().int().min(1).max(99).optional(), rotation: z.number().int().min(1).max(6).optional(), playerId: z.string().min(1).max(200).optional(), rallyId: z.string().min(1).max(200).optional(), videoSec: z.number().nonnegative().optional() });
export const addLiveNote = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.extend({ id: z.string().uuid(), body: z.string().trim().min(1).max(2000), context: noteContext }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("live_match_sessions").select("scorer_id,snapshot").eq("match_id", data.matchId).maybeSingle();
    if (!row) throw new Error("El partido no está disponible.");
    const permissions = await permissionsFor(context, data.matchId);
    if (row.scorer_id !== context.userId && !permissions.can_create_observations) throw new Error("No tenés permiso para agregar observaciones en este partido.");
    const snap = row.snapshot as unknown as LiveSnapshot;
    if (data.context.playerId && ![...snap.teamA.players, ...snap.teamB.players].some((p) => p.id === data.context.playerId)) throw new Error("Jugadora ajena al partido.");
    if (data.context.rallyId && !snap.match.events.some((e) => e.id === data.context.rallyId)) throw new Error("La acción vinculada no está confirmada.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("live_match_notes").insert({ id: data.id, match_id: data.matchId, author_id: context.userId, body: data.body, context: data.context });
    if (error && error.code !== "23505") throw new Error("No se pudo guardar la observación.");
    return { ok: true };
  });

export const markLiveNote = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["new", "read", "resolved"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: note, error } = await context.supabase.from("live_match_notes").select("id").eq("id", data.id).maybeSingle();
    if (error || !note) throw new Error("Observación no disponible.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin.rpc("set_live_note_status", { _note: data.id, _actor: context.userId, _status: data.status });
    if (updateError) throw new Error("No se pudo cambiar el estado.");
    return { ok: true };
  });
