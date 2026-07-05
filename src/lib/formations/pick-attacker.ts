import type { ResolvedFormation } from "./engine";
import type { SettingAttackZone } from "@/lib/volley-store";
import type { TacticalRole } from "./types";

/**
 * Devuelve el playerId sugerido para atacar desde la zona indicada, en la
 * rotación actual. El usuario puede sobreescribir manualmente.
 *
 * - z4    → punta delantera (outside_front)
 * - z3    → central delantera (middle_front)
 * - z2    → opuesta / armador si delantera (opposite)
 * - pipe  → punta zaguera (outside_back) / P6
 * - back1 → jugador en P1 (índice 0 del onCourt)
 * - back5 → jugador en P5 (índice 4 del onCourt)
 */
export function pickAttackerByZone(
  formation: ResolvedFormation | null,
  onCourt: string[],
  zone: SettingAttackZone,
): string | null {
  if (!formation) return byIndexFallback(onCourt, zone);
  const byRole = (role: TacticalRole) =>
    formation.slots.find((s) => s.role === role)?.playerId ?? null;

  switch (zone) {
    case "z4":
      return byRole("outside_front") ?? formation.frontRow[0]?.playerId ?? null;
    case "z3":
      return byRole("middle_front") ?? formation.frontRow[1]?.playerId ?? null;
    case "z2":
      return byRole("opposite") ?? formation.frontRow[2]?.playerId ?? null;
    case "pipe":
      return byRole("outside_back") ?? onCourt[5] ?? null;
    case "back1":
      return onCourt[0] ?? null;
    case "back5":
      return onCourt[4] ?? null;
    case "back":
      return onCourt[5] ?? null;
  }
}

function byIndexFallback(onCourt: string[], zone: SettingAttackZone): string | null {
  // Índices en onCourt: [P1, P2, P3, P4, P5, P6]
  switch (zone) {
    case "z4": return onCourt[3] ?? null;
    case "z3": return onCourt[2] ?? null;
    case "z2": return onCourt[1] ?? null;
    case "pipe": return onCourt[5] ?? null;
    case "back1": return onCourt[0] ?? null;
    case "back5": return onCourt[4] ?? null;
    case "back": return onCourt[5] ?? null;
  }
}
