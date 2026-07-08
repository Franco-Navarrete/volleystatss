import type { PlayerPosition } from "@/lib/volley-store";

/**
 * Tipos de ataque del modo Entrenador.
 *
 * Catálogo nuevo (2026): se determina automáticamente por rol de la jugadora
 * + fila (delantero/zaguero) al momento del ataque.
 *
 *   Punta delantero (Z4):    JATU · Alta · Media · Emergencia
 *   Punta zaguero (Z6):      Pipe · Emergencia
 *   Central delantero (Z3):  1er tiempo · Corta atrás · V · Emergencia
 *   Opuesto delantero (Z2):  Alta · Media · Emergencia
 *   Opuesto zaguero (Z1):    Zaguero · Emergencia
 *   Otros (armador / líbero / central zaguero): Emergencia
 */
export type AttackType =
  // Punta delantero
  | "jatu"
  | "alta_z4"
  | "media_z4"
  // Punta zaguero
  | "pipe"
  // Central delantero
  | "primer_tiempo"
  | "corta_atras"
  | "v"
  // Opuesto delantero
  | "alta_z2"
  | "media_z2"
  // Opuesto zaguero
  | "zaguero_z1"
  // Cualquier rol
  | "emergencia";

export interface AttackTypeOption {
  id: AttackType;
  /** Etiqueta corta para el botón grande. */
  shortLabel: string;
  /** Descripción usada en stats. */
  label: string;
}

export const ATTACK_TYPE_LABEL: Record<AttackType, string> = {
  jatu: "JATU",
  alta_z4: "Alta Z4",
  media_z4: "Media Z4",
  pipe: "Pipe",
  primer_tiempo: "1er tiempo",
  corta_atras: "Corta atrás",
  v: "V",
  alta_z2: "Alta Z2",
  media_z2: "Media Z2",
  zaguero_z1: "Zaguero Z1",
  emergencia: "Emergencia",
};

export const ATTACK_TYPE_SHORT: Record<AttackType, string> = {
  jatu: "JATU",
  alta_z4: "Alta",
  media_z4: "Media",
  pipe: "Pipe",
  primer_tiempo: "1er T",
  corta_atras: "Corta atrás",
  v: "V",
  alta_z2: "Alta",
  media_z2: "Media",
  zaguero_z1: "Zaguero",
  emergencia: "Emergencia",
};

/**
 * Etiquetas de tipos de ataque legacy (catálogo viejo). Se usan sólo para
 * renderizar eventos históricos guardados antes del cambio de catálogo.
 */
export const LEGACY_ATTACK_TYPE_LABEL: Record<string, string> = {
  first_tempo: "1er tiempo Z3",
  slide: "Corrida Z2",
  tense_middle: "Tensa central Z3",
  high_outside: "Bola alta Z4",
  tense_outside: "Tensa Z4",
  high_opposite: "Bola alta Z2",
  tense_opposite: "Tensa Z2",
  second_tempo: "2do tiempo",
  combo: "Combinación",
  back_right: "Z1 (zaguero derecho)",
  back_left: "Z5 (zaguero izquierdo)",
  back_tense: "Zaguero tenso",
};

/** Label robusto: sirve tanto para ids nuevos como legacy. */
export function getAttackTypeLabel(id: string): string {
  return (
    (ATTACK_TYPE_LABEL as Record<string, string>)[id] ??
    LEGACY_ATTACK_TYPE_LABEL[id] ??
    id
  );
}

const PUNTA_FRONT: AttackType[] = ["jatu", "alta_z4", "media_z4", "emergencia"];
const PUNTA_BACK: AttackType[] = ["pipe", "emergencia"];
const CENTRAL_FRONT: AttackType[] = ["primer_tiempo", "corta_atras", "v", "emergencia"];
const OPUESTO_FRONT: AttackType[] = ["alta_z2", "media_z2", "emergencia"];
const OPUESTO_BACK: AttackType[] = ["zaguero_z1", "emergencia"];
const FALLBACK: AttackType[] = ["emergencia"];

/**
 * Devuelve los tipos de ataque permitidos para esta jugadora en este momento,
 * filtrados por rol y fila (delantero/zaguero).
 */
export function getAttackTypeOptions(opts: {
  position?: PlayerPosition;
  isBackRow: boolean;
}): AttackTypeOption[] {
  const { position, isBackRow } = opts;
  if (position === "punta") {
    return (isBackRow ? PUNTA_BACK : PUNTA_FRONT).map(toOption);
  }
  if (position === "central") {
    // El central zaguero raramente ataca (suele estar reemplazado por líbero).
    return (isBackRow ? FALLBACK : CENTRAL_FRONT).map(toOption);
  }
  if (position === "opuesto") {
    return (isBackRow ? OPUESTO_BACK : OPUESTO_FRONT).map(toOption);
  }
  // armador, líbero, sin posición → emergencia
  return FALLBACK.map(toOption);
}

function toOption(id: AttackType): AttackTypeOption {
  return {
    id,
    shortLabel: ATTACK_TYPE_SHORT[id],
    label: ATTACK_TYPE_LABEL[id],
  };
}

export const ALL_ATTACK_TYPES: AttackType[] = [
  "jatu",
  "alta_z4",
  "media_z4",
  "pipe",
  "primer_tiempo",
  "corta_atras",
  "v",
  "alta_z2",
  "media_z2",
  "zaguero_z1",
  "emergencia",
];
