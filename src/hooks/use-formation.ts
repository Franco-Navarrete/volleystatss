import { useMemo } from "react";
import type { Match, Team } from "@/lib/volley-store";
import {
  getRotationFromCourt,
  inferLineupFromPlayers,
  resolveFormation,
  type ResolvedFormation,
} from "@/lib/formations/engine";
import type { TacticalSystem } from "@/lib/formations/types";

/**
 * Devuelve la formación de recepción resuelta para un equipo en su rotación actual.
 * Retorna `null` si no se puede determinar (sin armadora en cancha).
 */
export function useFormation(
  match: Match | undefined | null,
  team: Team | undefined | null,
  side: "A" | "B",
  system: TacticalSystem = "5-1",
): ResolvedFormation | null {
  return useMemo(() => {
    if (!match || !team) return null;
    const onCourt = side === "A" ? match.onCourtA : match.onCourtB;
    if (!onCourt || onCourt.length === 0) return null;
    const lineup = inferLineupFromPlayers(team.players, onCourt);
    const rotation = getRotationFromCourt(onCourt, lineup.setter);
    if (!rotation) return null;
    return resolveFormation({ system, rotation, lineup });
  }, [match, team, side, system]);
}
