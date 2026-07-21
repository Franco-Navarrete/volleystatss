import type { Match, Team } from "@/lib/volley-store";

/**
 * Formación efectiva actualmente en cancha. Es la ÚNICA fuente de verdad
 * para Coach Mode: refleja rotaciones, cambios, sustituciones e ingreso/salida
 * del líbero. El array está ordenado por índice de posición:
 *   [Z1, Z2, Z3, Z4, Z5, Z6].
 */
export function getEffectiveOnCourt(match: Match, side: "A" | "B"): string[] {
  return side === "A" ? match.onCourtA : match.onCourtB;
}

/** Mapa Zona (1..6) → índice en `onCourt`. */
export const ZONE_INDEX: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
};

/**
 * Devuelve el `playerId` que ocupa una zona (1..6) del lado indicado.
 * Retorna `null` si la zona está vacía (rotura de datos).
 */
export function playerAtZone(
  match: Match,
  side: "A" | "B",
  zone: 1 | 2 | 3 | 4 | 5 | 6,
): string | null {
  const arr = getEffectiveOnCourt(match, side);
  return arr[ZONE_INDEX[zone]] ?? null;
}

/** Info visible del jugador para mostrar en el panel. */
export function playerLabel(team: Team, playerId: string | null | undefined): string {
  if (!playerId) return "—";
  const p = team.players.find((x) => x.id === playerId);
  if (!p) return "?";
  return `#${p.number} ${p.name.split(" ")[0]}`;
}
