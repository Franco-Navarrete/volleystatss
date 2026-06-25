import type {
  Match,
  MatchEvent,
  SettingEvent,
  SettingQuality,
  SettingAttackZone,
  SettingAttackResult,
} from "./volley-store";
import {
  SETTING_QUALITIES,
  SETTING_ATTACK_ZONES,
} from "./volley-store";

const ATTACK_RESULTS: SettingAttackResult[] = ["point", "continuity", "error", "blocked"];

export function isSettingEvent(e: MatchEvent): e is SettingEvent {
  return "kind" in e && e.kind === "setting";
}

export function getSettingEvents(
  match: Match,
  side?: "A" | "B",
  setNumber?: number
): SettingEvent[] {
  return match.events.filter((e): e is SettingEvent => {
    if (!isSettingEvent(e)) return false;
    if (side && e.side !== side) return false;
    if (setNumber !== undefined && e.setNumber !== setNumber) return false;
    return true;
  });
}

export interface SetterDistribution {
  setterId: string;
  total: number;
  byZone: Record<SettingAttackZone, number>;
  byQuality: Record<SettingQuality, number>;
  byResult: Record<SettingAttackResult, number>;
  /** Eficiencia ofensiva = (puntos - errores - bloqueados) / total. */
  efficiency: number;
  /** % de armados con calidad ++ o +. */
  positiveRate: number;
}

const zeroZone = (): Record<SettingAttackZone, number> =>
  Object.fromEntries(SETTING_ATTACK_ZONES.map((z) => [z, 0])) as Record<SettingAttackZone, number>;
const zeroQuality = (): Record<SettingQuality, number> =>
  Object.fromEntries(SETTING_QUALITIES.map((q) => [q, 0])) as Record<SettingQuality, number>;
const zeroResult = (): Record<SettingAttackResult, number> =>
  Object.fromEntries(ATTACK_RESULTS.map((r) => [r, 0])) as Record<SettingAttackResult, number>;

export function computeSetterDistribution(
  events: SettingEvent[]
): Map<string, SetterDistribution> {
  const out = new Map<string, SetterDistribution>();
  for (const ev of events) {
    let s = out.get(ev.setterId);
    if (!s) {
      s = {
        setterId: ev.setterId,
        total: 0,
        byZone: zeroZone(),
        byQuality: zeroQuality(),
        byResult: zeroResult(),
        efficiency: 0,
        positiveRate: 0,
      };
      out.set(ev.setterId, s);
    }
    s.total++;
    s.byZone[ev.attackZone]++;
    s.byQuality[ev.quality]++;
    if (ev.attackResult) s.byResult[ev.attackResult]++;
  }
  for (const s of out.values()) {
    const goodAttack = s.byResult.point;
    const badAttack = s.byResult.error + s.byResult.blocked;
    s.efficiency = s.total > 0 ? (goodAttack - badAttack) / s.total : 0;
    const positives = s.byQuality["++"] + s.byQuality["+"];
    s.positiveRate = s.total > 0 ? positives / s.total : 0;
  }
  return out;
}

/** Matriz recepción → calidad de armado. */
export function computeReceptionToSetting(
  events: SettingEvent[]
): Record<SettingQuality, Record<SettingQuality, number>> {
  const out: Record<SettingQuality, Record<SettingQuality, number>> =
    Object.fromEntries(SETTING_QUALITIES.map((q) => [q, zeroQuality()])) as Record<
      SettingQuality,
      Record<SettingQuality, number>
    >;
  for (const ev of events) {
    if (!ev.receptionQuality) continue;
    out[ev.receptionQuality][ev.quality]++;
  }
  return out;
}

/** Matriz calidad de armado → resultado de ataque. */
export function computeSettingToAttack(
  events: SettingEvent[]
): Record<SettingQuality, Record<SettingAttackResult, number>> {
  const out: Record<SettingQuality, Record<SettingAttackResult, number>> =
    Object.fromEntries(SETTING_QUALITIES.map((q) => [q, zeroResult()])) as Record<
      SettingQuality,
      Record<SettingAttackResult, number>
    >;
  for (const ev of events) {
    if (ev.attackResult) out[ev.quality][ev.attackResult]++;
  }
  return out;
}

export function topSetter(events: SettingEvent[]): { setterId: string; total: number; share: number } | null {
  if (events.length === 0) return null;
  const tally = new Map<string, number>();
  for (const ev of events) tally.set(ev.setterId, (tally.get(ev.setterId) ?? 0) + 1);
  let bestId = "";
  let bestN = 0;
  for (const [id, n] of tally) {
    if (n > bestN) {
      bestN = n;
      bestId = id;
    }
  }
  return { setterId: bestId, total: bestN, share: bestN / events.length };
}

/** Tendencia: con recepción "mala" (- o =), zona con mayor distribución. */
export function trendAfterBadReception(
  events: SettingEvent[]
): { zone: SettingAttackZone; rate: number } | null {
  const filtered = events.filter((e) => e.receptionQuality === "-" || e.receptionQuality === "=");
  if (filtered.length === 0) return null;
  const tally = zeroZone();
  for (const ev of filtered) tally[ev.attackZone]++;
  let bestZone: SettingAttackZone = "z4";
  let bestN = -1;
  for (const z of SETTING_ATTACK_ZONES) {
    if (tally[z] > bestN) {
      bestN = tally[z];
      bestZone = z;
    }
  }
  return { zone: bestZone, rate: bestN / filtered.length };
}

/**
 * Combinación más eficiente: (recepción, armado, resultado=punto) con mayor frecuencia.
 */
export function bestCombo(
  events: SettingEvent[]
): { reception: SettingQuality; setting: SettingQuality; rate: number; count: number } | null {
  const buckets = new Map<string, { reception: SettingQuality; setting: SettingQuality; points: number; total: number }>();
  for (const ev of events) {
    if (!ev.receptionQuality) continue;
    const key = `${ev.receptionQuality}|${ev.quality}`;
    let b = buckets.get(key);
    if (!b) {
      b = { reception: ev.receptionQuality, setting: ev.quality, points: 0, total: 0 };
      buckets.set(key, b);
    }
    b.total++;
    if (ev.attackResult === "point") b.points++;
  }
  let best: { reception: SettingQuality; setting: SettingQuality; rate: number; count: number } | null = null;
  for (const b of buckets.values()) {
    if (b.total < 3) continue; // umbral mínimo
    const rate = b.points / b.total;
    if (!best || rate > best.rate) {
      best = { reception: b.reception, setting: b.setting, rate, count: b.total };
    }
  }
  return best;
}
