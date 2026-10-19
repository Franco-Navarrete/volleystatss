import { z } from "zod";
import { replayMatch, type Match, type Team } from "@/lib/volley-store";

const id = z.string().min(1).max(200);
const side = z.enum(["A", "B"]);
const base = z.object({ id, setNumber: z.number().int().min(1).max(99), timestamp: z.number().finite().nonnegative() });
const direction = z.number().int().min(1).max(9).optional();
const attack = { attackZone: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).optional(), attackDirection: direction, attackSubzone: z.enum(["a", "b", "c", "d"]).optional(), rivalBlockerId: id.optional() };
const point = base.extend({ scoringSide: side, playerSide: side.nullable(), playerId: id.nullable(), type: z.enum(["attack", "block", "ace", "counter_attack", "rotation_attack", "opponent_error", "opponent_rotation_error", "serve_error", "unforced_error", "rotation_error", "attack_error", "block_error"]), ...attack }).passthrough();
const event = z.union([
  point,
  base.extend({ kind: z.literal("reception"), side, playerId: id, rating: z.enum(["double_positive", "positive", "neutral", "negative", "double_negative", "overpass"]) }),
  base.extend({ kind: z.literal("setting"), side, setterId: id, quality: z.enum(["++", "+", "!", "-", "="]), attackZone: z.enum(["z4", "z3", "z2", "pipe", "back1", "back5", "back"]), attackerId: id.optional(), attackResult: z.enum(["point", "continuity", "error", "blocked"]).optional(), attackDirection: direction }).passthrough(),
  base.extend({ kind: z.literal("attackAttempt"), side, playerId: id.nullable(), isCounter: z.boolean().optional(), ...attack }).passthrough(),
  base.extend({ kind: z.literal("defense"), side, playerId: id, rating: z.enum(["excellent", "positive", "controlled", "weak", "error", "neutral"]) }),
  base.extend({ kind: z.literal("sub"), side, playerInId: id, playerOutId: id }),
  base.extend({ kind: z.literal("libero"), side, action: z.enum(["in", "out", "auto_out"]), liberoId: id, replacedId: id, source: z.literal("auto").optional() }),
  base.extend({ kind: z.literal("timeout"), side }),
  base.extend({ kind: z.literal("sanction"), side, playerId: id.nullable(), sanction: z.enum(["yellow", "red", "yellow_red", "red_expulsion"]) }),
  base.extend({ kind: z.literal("lineupOverride"), side, lineup: z.array(id).length(6) }),
]);
export const liveMatchSchema = z.object({
  id, teamAId: id, teamBId: id, startingLineupA: z.array(id).max(6), startingLineupB: z.array(id).max(6),
  onCourtA: z.array(id).max(6), onCourtB: z.array(id).max(6), status: z.enum(["scheduled", "live", "finished"]),
  currentSet: z.number().int().min(1), setsToWin: z.number().int().min(1).max(5), pointsPerSet: z.number().int().min(1).max(100),
  sets: z.array(z.object({ number: z.number().int().min(1), scoreA: z.number().int().nonnegative(), scoreB: z.number().int().nonnegative(), finished: z.boolean() })).max(99),
  events: z.array(event).max(20000), servingSide: side, initialServingSide: side,
  scheduledAt: z.number().finite(), createdAt: z.number().finite(),
}).passthrough();

export interface LiveSnapshot { match: Match; teamA: Team; teamB: Team }
export interface LiveSession { match_id: string; scorer_id: string; version: number; updated_at: string; snapshot: LiveSnapshot }
export interface LiveNote { id: string; body: string; context: { set?: number; rotation?: number; playerId?: string; rallyId?: string; videoSec?: number }; status: "new" | "read" | "resolved"; author_id: string; created_at: string }

/** Only sporting identity is shared; never birth dates, measurements or user metadata. */
export function sportingTeam(team: Team): Team {
  return { id: team.id, name: team.name, shortName: team.shortName, color: team.color, logoUrl: team.logoUrl,
    players: team.players.map((p) => ({ id: p.id, name: p.name, number: p.number, position: p.position })) };
}

export function validateLiveMatch(input: unknown, previous: LiveSnapshot): Match {
  const parsed = liveMatchSchema.parse(input) as Match;
  if (parsed.id !== previous.match.id || parsed.teamAId !== previous.teamA.id || parsed.teamBId !== previous.teamB.id) throw new Error("El partido no coincide con la sesión.");
  const seen = new Set<string>();
  const roster = { A: new Set(previous.teamA.players.map((p) => p.id)), B: new Set(previous.teamB.players.map((p) => p.id)) };
  for (const ev of parsed.events) {
    if (seen.has(ev.id)) throw new Error("La acción está duplicada.");
    seen.add(ev.id);
    const evSide = "side" in ev ? ev.side : ev.playerSide;
    const playerIds = "setterId" in ev ? [ev.setterId, ev.attackerId] : "playerInId" in ev ? [ev.playerInId, ev.playerOutId] : "liberoId" in ev ? [ev.liberoId, ev.replacedId] : "lineup" in ev ? ev.lineup : "playerId" in ev ? [ev.playerId] : [];
    if (evSide && playerIds.some((p) => p && !roster[evSide].has(p))) throw new Error("La jugadora no pertenece al equipo del partido.");
  }
  for (const s of ["A", "B"] as const) {
    const lineup = s === "A" ? parsed.startingLineupA : parsed.startingLineupB;
    if (lineup.some((p) => !roster[s].has(p))) throw new Error("Formación ajena al equipo.");
  }
  const derived = replayMatch(parsed);
  return { ...parsed, ...derived, status: previous.match.status === "finished" || parsed.status === "finished" ? "finished" : derived.status };
}