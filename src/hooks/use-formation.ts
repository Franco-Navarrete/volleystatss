import { useMemo } from "react";
import type { Match, Team } from "@/lib/volley-store";
import {
  getRotationFromCourt,
  inferLineupFromPlayers,
  resolveFormation,
  type FormationPhase,
  type ResolvedFormation,
} from "@/lib/formations/engine";
import type { TacticalSystem } from "@/lib/formations/types";

/**
 * Devuelve la formación resuelta para un equipo en su rotación actual.
 * `phase` define qué plantilla usar:
 *   - "reception" → formación en W para recibir el saque
 *   - "attack"    → formación natural de ataque (opp@2 / mid@3 / out@4)
 * Retorna `null` si no se puede determinar (sin armadora en cancha).
 */
export function useFormation(
  match: Match | undefined | null,
  team: Team | undefined | null,
  side: "A" | "B",
  system: TacticalSystem = "5-1",
  phase: FormationPhase = "attack",
): ResolvedFormation | null {
  return useMemo(() => {
    if (!match || !team) return null;
    const onCourt = side === "A" ? match.onCourtA : match.onCourtB;
    if (!onCourt || onCourt.length === 0) return null;
    const lineup = inferLineupFromPlayers(team.players, onCourt);
    const rotation = getRotationFromCourt(onCourt, lineup.setter);
    if (!rotation) return null;
    return resolveFormation({ system, rotation, lineup, phase, onCourt });
  }, [match, team, side, system, phase]);
}
