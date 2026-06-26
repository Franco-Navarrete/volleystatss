import type { PlayerPosition } from "@/lib/volley-store";

/**
 * Tipos de ataque del modo Entrenador.
 *
 * El catálogo se filtra automáticamente según:
 *   - rol de la atacante (central vs extremo vs líbero/armadora)
 *   - si está en cancha delantera o zaguera
 *
 * Pensado para tablet: pocas opciones por contexto, etiquetas cortas.
 */
export type AttackType =
  // Centrales delanteras
  | "first_tempo"
  | "slide"
  | "tense_middle"
  // Extremos delanteros (punta / opuesto / armadora)
  | "high_outside"
  | "tense_outside"
  | "high_opposite"
  | "tense_opposite"
  | "second_tempo"
  // Cualquier delantera
  | "combo"
  // Zagueros
  | "pipe"
  | "back_right"
  | "back_left"
  | "back_tense";

export interface AttackTypeOption {
  id: AttackType;
  /** Etiqueta corta para el botón grande. */
  shortLabel: string;
  /** Descripción usada en stats. */
  label: string;
  /** Pista de zona asociada (sólo informativo). */
  zoneHint?: string;
}

export const ATTACK_TYPE_LABEL: Record<AttackType, string> = {
  first_tempo: "1er tiempo",
  slide: "Corrida",
  tense_middle: "Tensa central",
  high_outside: "Bola alta z4",
  tense_outside: "Tensa z4",
  high_opposite: "Bola alta z2",
  tense_opposite: "Tensa z2",
  second_tempo: "2do tiempo",
  combo: "Combinación",
  pipe: "Pipe",
  back_right: "Z1 (zaguero derecho)",
  back_left: "Z5 (zaguero izquierdo)",
  back_tense: "Zaguero tenso",
};

export const ATTACK_TYPE_SHORT: Record<AttackType, string> = {
  first_tempo: "1er T",
  slide: "Corrida",
  tense_middle: "Tensa C",
  high_outside: "Alta Z4",
  tense_outside: "Tensa Z4",
  high_opposite: "Alta Z2",
  tense_opposite: "Tensa Z2",
  second_tempo: "2do T",
  combo: "Combo",
  pipe: "Pipe",
  back_right: "Z1",
  back_left: "Z5",
  back_tense: "Zag tenso",
};

const CENTRAL_FRONT: AttackType[] = ["first_tempo", "slide", "tense_middle", "combo"];
const EXTREME_FRONT: AttackType[] = [
  "high_outside",
  "tense_outside",
  "high_opposite",
  "tense_opposite",
  "second_tempo",
  "combo",
];
const BACK_ROW: AttackType[] = ["pipe", "back_right", "back_left", "back_tense"];

/**
 * Devuelve los tipos de ataque permitidos para esta jugadora en este momento.
 */
export function getAttackTypeOptions(opts: {
  position?: PlayerPosition;
  isBackRow: boolean;
}): AttackTypeOption[] {
  const { position, isBackRow } = opts;
  if (isBackRow) return BACK_ROW.map(toOption);
  // Delanteros
  if (position === "central") return CENTRAL_FRONT.map(toOption);
  // punta, opuesto, armador (raro) → extremos
  return EXTREME_FRONT.map(toOption);
}

function toOption(id: AttackType): AttackTypeOption {
  return {
    id,
    shortLabel: ATTACK_TYPE_SHORT[id],
    label: ATTACK_TYPE_LABEL[id],
  };
}

export const ALL_ATTACK_TYPES: AttackType[] = [
  "first_tempo",
  "slide",
  "tense_middle",
  "high_outside",
  "tense_outside",
  "high_opposite",
  "tense_opposite",
  "second_tempo",
  "combo",
  "pipe",
  "back_right",
  "back_left",
  "back_tense",
];
