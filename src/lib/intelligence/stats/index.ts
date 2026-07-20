// Rally Intelligence — capa de agregación que traduce datos del volley-store
// al formato consumido por los motores de insights.

import {
  computeMatchStats,
  computeReceptionStats,
  type Match,
  type PlayerStat,
  type ReceptionStat,
  type TeamStat,
} from "@/lib/volley-store";
import { computeRotationStats, type SetRotationStats } from "@/lib/rotation-stats";

export interface IntelligenceMatchStats {
  matchId: string;
  teamId: string;
  side: "A" | "B";
  opponentTeamId: string;
  team: TeamStat | null;
  opponent: TeamStat | null;
  players: PlayerStat[];
  reception: ReceptionStat[];
  rotations: SetRotationStats[];
}

/**
 * Construye el snapshot analítico de un partido para el equipo indicado.
 * No calcula insights: solo aplana y agrupa datos ya disponibles.
 */
export function buildMatchIntelligenceStats(
  match: Match,
  side: "A" | "B",
): IntelligenceMatchStats {
  const teamId = side === "A" ? match.teamAId : match.teamBId;
  const opponentTeamId = side === "A" ? match.teamBId : match.teamAId;
  const { players, teams } = computeMatchStats(match);
  const rec = computeReceptionStats(match.events, side);
  return {
    matchId: match.id,
    teamId,
    side,
    opponentTeamId,
    team: teams.get(teamId) ?? null,
    opponent: teams.get(opponentTeamId) ?? null,
    players: [...players.values()],
    reception: [...rec.values()],
    rotations: computeRotationStats(match),
  };
}
