import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sportingTeam, validateLiveMatch, type LiveSession, type LiveSnapshot, type LiveNote } from "./live-contract";
import type { Match, Team } from "@/lib/volley-store";

const matchInput = z.object({ matchId: z.string().min(1).max(200) });

export const readLiveSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.parse(input))
  .handler(async ({ data, context }): Promise<{ session: LiveSession | null; notes: LiveNote[]; canActivate: boolean; canWrite: boolean }> => {
    const [{ data: row, error }, { data: admin }] = await Promise.all([
      context.supabase.from("live_match_sessions").select("*").eq("match_id", data.matchId).maybeSingle(),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (error) throw new Error("No se pudo consultar el partido en vivo.");
    if (!row) return { session: null, notes: [], canActivate: !!admin, canWrite: false };
    const { data: notes, error: noteError } = await context.supabase.from("live_match_notes").select("id,body,context,status,author_id,created_at").eq("match_id", data.matchId).order("created_at", { ascending: false }).limit(100);
    if (noteError) throw new Error("No se pudieron consultar las observaciones.");
    return { session: row as unknown as LiveSession, notes: (notes ?? []) as unknown as LiveNote[], canActivate: !!admin, canWrite: row.scorer_id === context.userId };
  });

/** Existing JSON copies cannot prove authorship. Only an administrator may activate and assign a writer. */
export const activateLiveSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.extend({ scorerId: z.string().uuid().optional(), sourceUserId: z.string().uuid().optional() }).parse(input))
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
    if (scorerId !== context.userId) {
      const { data: roles, error: scorerError } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", scorerId).in("role", ["admin", "planillero", "entrenador"]);
      if (scorerError || !roles?.length) throw new Error("El usuario no está habilitado para recibir permiso explícito de carga.");
    }
    const snapshot: LiveSnapshot = { match, teamA: sportingTeam(teamA), teamB: sportingTeam(teamB) };
    snapshot.match = validateLiveMatch(match, snapshot);
    const { error: insertError } = await supabaseAdmin.from("live_match_sessions").insert({ match_id: match.id, scorer_id: scorerId, team_a_id: match.teamAId, team_b_id: match.teamBId, snapshot: snapshot as unknown as never });
    if (insertError && insertError.code !== "23505") throw new Error("No se pudo habilitar la sesión.");
    return { ok: true };
  });

export const commitLiveSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => matchInput.extend({ operationId: z.string().uuid(), expectedVersion: z.number().int().positive(), match: z.unknown() }).parse(input))
  .handler(async ({ data, context }): Promise<{ version: number; updatedAt: string; duplicate: boolean }> => {
    const { data: row, error } = await context.supabase.from("live_match_sessions").select("*").eq("match_id", data.matchId).maybeSingle();
    if (error || !row || row.scorer_id !== context.userId) throw new Error("No tenés permiso de carga para este partido.");
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
    if (!row || row.scorer_id !== context.userId) throw new Error("Solo el estadista asignado puede agregar observaciones.");
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