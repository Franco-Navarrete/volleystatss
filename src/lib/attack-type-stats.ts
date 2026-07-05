import type { Match, PointEvent, SettingEvent, SettingQuality, AttackAttemptEvent } from "@/lib/volley-store";
import { isAttackType } from "@/lib/volley-store";
import {
  type AttackType,
  ALL_ATTACK_TYPES,
  ATTACK_TYPE_LABEL,
} from "@/lib/formations/attack-types";

export interface AttackTypeEffectivenessRow {
  type: AttackType | "unclassified";
  label: string;
  attempts: number;
  kills: number;
  errors: number;
  /** (kills − errors) / (kills + errors). Los ataques neutros no afectan. */
  effectiveness: number;
  killPct: number; // kills / attempts
}

function isAttackPoint(ev: PointEvent): boolean {
  return isAttackType(ev.type) || ev.type === "attack_error";
}

function isAttackAttempt(ev: any): ev is AttackAttemptEvent {
  return ev && "kind" in ev && ev.kind === "attackAttempt";
}

function eff(kills: number, errors: number): number {
  const denom = kills + errors;
  return denom ? (kills - errors) / denom : 0;
}

function getRows(match: Match, side?: "A" | "B"): AttackTypeEffectivenessRow[] {
  const buckets = new Map<
    AttackType | "unclassified",
    { attempts: number; kills: number; errors: number }
  >();

  for (const ev of match.events) {
    if (isAttackAttempt(ev)) {
      if (side && ev.side !== side) continue;
      const key = (ev.attackType ?? "unclassified") as AttackType | "unclassified";
      const b = buckets.get(key) ?? { attempts: 0, kills: 0, errors: 0 };
      b.attempts++;
      buckets.set(key, b);
      continue;
    }
    if ("kind" in ev) continue;
    if (!isAttackPoint(ev)) continue;
    if (side && ev.playerSide !== side) continue;
    const key = (ev.attackType ?? "unclassified") as AttackType | "unclassified";
    const b = buckets.get(key) ?? { attempts: 0, kills: 0, errors: 0 };
    b.attempts++;
    if (ev.type === "attack_error") b.errors++;
    else b.kills++;
    buckets.set(key, b);
  }

  const rows: AttackTypeEffectivenessRow[] = [];
  for (const t of ALL_ATTACK_TYPES) {
    const b = buckets.get(t);
    if (!b) continue;
    rows.push({
      type: t,
      label: ATTACK_TYPE_LABEL[t],
      attempts: b.attempts,
      kills: b.kills,
      errors: b.errors,
      effectiveness: eff(b.kills, b.errors),
      killPct: b.attempts ? b.kills / b.attempts : 0,
    });
  }
  const unc = buckets.get("unclassified");
  if (unc) {
    rows.push({
      type: "unclassified",
      label: "Sin clasificar",
      attempts: unc.attempts,
      kills: unc.kills,
      errors: unc.errors,
      effectiveness: eff(unc.kills, unc.errors),
      killPct: unc.attempts ? unc.kills / unc.attempts : 0,
    });
  }
  return rows.sort((a, b) => b.attempts - a.attempts);
}

/** Efectividad por tipo (todo el partido o por equipo). */
export function attackTypeEffectiveness(match: Match, side?: "A" | "B") {
  return getRows(match, side);
}

/** Distribución porcentual de tipos de ataque para un equipo. */
export function attackTypeDistribution(match: Match, side: "A" | "B") {
  const rows = getRows(match, side);
  const total = rows.reduce((acc, r) => acc + r.attempts, 0);
  return rows.map((r) => ({ ...r, share: total ? r.attempts / total : 0 }));
}

/** Cruce tipo de ataque × rotación (1..6) para un equipo. */
export function attackTypeByRotation(match: Match, side: "A" | "B") {
  const matrix = new Map<AttackType | "unclassified", Map<number, number>>();
  for (const ev of match.events) {
    if ("kind" in ev) continue;
    if (!isAttackPoint(ev)) continue;
    if (ev.playerSide !== side) continue;
    const rot = inferRotationAtEvent(match, ev, side);
    if (!rot) continue;
    const key = (ev.attackType ?? "unclassified") as AttackType | "unclassified";
    const inner = matrix.get(key) ?? new Map<number, number>();
    inner.set(rot, (inner.get(rot) ?? 0) + 1);
    matrix.set(key, inner);
  }
  return matrix;
}

/** Cruce calidad de armado × tipo × resultado. */
export function attackTypeBySetterQuality(match: Match) {
  // Empareja cada SettingEvent con el PointEvent inmediatamente posterior del mismo
  // lado. Si la calidad ya viene en el SettingEvent y el PointEvent tiene attackType,
  // se acumula.
  const result = new Map<
    SettingQuality,
    Map<AttackType | "unclassified", { attempts: number; kills: number; errors: number }>
  >();

  const evs = match.events;
  for (let i = 0; i < evs.length; i++) {
    const ev = evs[i];
    if (!("kind" in ev) || ev.kind !== "setting") continue;
    const setEv = ev as SettingEvent;
    // Encuentra el siguiente PointEvent de ataque del mismo lado.
    let point: PointEvent | null = null;
    for (let j = i + 1; j < evs.length; j++) {
      const next = evs[j];
      if ("kind" in next) continue;
      const pe = next as PointEvent;
      if (!isAttackPoint(pe)) continue;
      if (pe.playerSide !== setEv.side) continue;
      point = pe;
      break;
    }
    if (!point) continue;
    const type = (point.attackType ?? setEv.attackType ?? "unclassified") as
      | AttackType
      | "unclassified";
    const inner = result.get(setEv.quality) ?? new Map();
    const b = inner.get(type) ?? { attempts: 0, kills: 0, errors: 0 };
    b.attempts++;
    if (point.type === "attack_error") b.errors++;
    else b.kills++;
    inner.set(type, b);
    result.set(setEv.quality, inner);
  }
  return result;
}

/** Tipos de ataque más usados y efectividad por jugadora. */
export function attackTypeByPlayer(match: Match, playerId: string): AttackTypeEffectivenessRow[] {
  const buckets = new Map<
    AttackType | "unclassified",
    { attempts: number; kills: number; errors: number }
  >();
  for (const ev of match.events) {
    if (isAttackAttempt(ev)) {
      if (ev.playerId !== playerId) continue;
      const key = (ev.attackType ?? "unclassified") as AttackType | "unclassified";
      const b = buckets.get(key) ?? { attempts: 0, kills: 0, errors: 0 };
      b.attempts++;
      buckets.set(key, b);
      continue;
    }
    if ("kind" in ev) continue;
    if (!isAttackPoint(ev)) continue;
    if (ev.playerId !== playerId) continue;
    const key = (ev.attackType ?? "unclassified") as AttackType | "unclassified";
    const b = buckets.get(key) ?? { attempts: 0, kills: 0, errors: 0 };
    b.attempts++;
    if (ev.type === "attack_error") b.errors++;
    else b.kills++;
    buckets.set(key, b);
  }
  const rows: AttackTypeEffectivenessRow[] = [];
  for (const [key, b] of buckets.entries()) {
    rows.push({
      type: key,
      label: key === "unclassified" ? "Sin clasificar" : ATTACK_TYPE_LABEL[key],
      attempts: b.attempts,
      kills: b.kills,
      errors: b.errors,
      effectiveness: eff(b.kills, b.errors),
      killPct: b.attempts ? b.kills / b.attempts : 0,
    });
  }
  return rows.sort((a, b) => b.attempts - a.attempts);
}

/**
 * Reconstruye la rotación (posición de la armadora 1..6) al momento del evento.
 * Usa el orden de cancha del equipo replayed al inicio del set y rota cada vez
 * que ese equipo gana el saque tras venir de saque rival.
 */
function inferRotationAtEvent(
  match: Match,
  ev: PointEvent,
  side: "A" | "B"
): number | null {
  // Simplificación: usamos la rotación inicial del set + nº de side-outs ganados
  // por este equipo hasta el evento.
  // Para no replicar lógica de replay, calculamos sobre los eventos previos.
  const setEvs = match.events.filter(
    (e) => "kind" in e ? false : (e as PointEvent).setNumber === ev.setNumber
  ) as PointEvent[];
  // setStarting lineup index for setter: requires team data, no disponible acá.
  // Aproximamos con un contador: rotación = 1 + (sideOuts mod 6).
  let sideOuts = 0;
  let prevServing: "A" | "B" | null = null;
  for (const e of setEvs) {
    if (e.id === ev.id) break;
    const serving = serverFromEvents(e);
    if (prevServing && serving !== prevServing && serving === side) {
      sideOuts++;
    }
    prevServing = serving;
  }
  return ((sideOuts % 6) + 1) as number;
}

function serverFromEvents(ev: PointEvent): "A" | "B" {
  return ev.scoringSide;
}
