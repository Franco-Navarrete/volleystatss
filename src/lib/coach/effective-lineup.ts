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

/**
 * Encuentra al armador en la formación efectiva del lado indicado.
 * Busca al jugador con `position === "armador"` entre los 6 en cancha.
 * Fallback: jugador en Z2 (posición base del armador en primera línea).
 */
export function findSetterOnCourt(match: Match, team: Team, side: "A" | "B"): string | null {
  const onCourt = getEffectiveOnCourt(match, side);
  const setter = onCourt.find((pid) => {
    const p = team.players.find((x) => x.id === pid);
    return p?.position === "armador";
  });
  return setter ?? playerAtZone(match, side, 2);
}

/** Distribución del armado (tecla 1..5) → zona de ataque del atacante. */
export const SET_DISTRIBUTION_TO_ZONE: Record<1 | 2 | 3 | 4 | 5, 1 | 2 | 3 | 4 | 6> = {
  1: 4, // Z4
  2: 3, // Z3
  3: 2, // Z2
  4: 6, // Pipe
  5: 1, // Zaguero Z1
};

export const SET_DISTRIBUTION_LABEL: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Z4", 2: "Z3", 3: "Z2", 4: "Pipe", 5: "Z1",
};
