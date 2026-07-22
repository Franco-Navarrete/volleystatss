import {
  type Match,
  type PointEvent,
  type SettingEvent,
  type SettingAttackZone,
  type AttackDirection,
  type Team,
  isAttackType,
} from "./volley-store";
import { buildSetterZoneLookup, type SetterZone } from "./setter-position";


/** Zonas de origen de ataque (formato oficial). */
export type OriginZone = 1 | 2 | 3 | 4 | 5 | 6;
export const ORIGIN_ZONES: OriginZone[] = [4, 3, 2, 5, 6, 1];
export const ORIGIN_ZONE_LABEL: Record<OriginZone, string> = {
  4: "Zona 4",
  3: "Zona 3",
  2: "Zona 2",
  5: "Zaguero 5",
  6: "Zaguero 6",
  1: "Zaguero 1",
};

/** Mapea zona del setting-event a zona oficial 1..6. */
export function settingZoneToOrigin(z: SettingAttackZone): OriginZone | null {
  switch (z) {
    case "z2": return 2;
    case "z3": return 3;
    case "z4": return 4;
    case "pipe": return 6;
    case "back1": return 1;
    case "back5": return 5;
    case "back": return 6;
    default: return null;
  }
}

export interface ZoneBucket {
  count: number;
  positives: number;   // punto
  neutrals: number;    // continuidad / bloqueado (sigue jugada)
  negatives: number;   // error propio
}

function emptyBucket(): ZoneBucket {
  return { count: 0, positives: 0, neutrals: 0, negatives: 0 };
}

/** Un ataque enriquecido con rotación al momento y metadatos filtrables. */
export interface EnrichedAttack {
  side: "A" | "B";
  playerId: string | null;
  origin: OriginZone | null;
  direction: AttackDirection | null;
  result: "positive" | "neutral" | "negative";
  setNumber: number;
  rotation: number; // 1..6 (rotación del equipo atacante)
  setterZone: SetterZone | null; // 1..6 (posición de la armadora del equipo atacante)
  timestamp: number;
}


/**
 * Recorre los eventos del partido y devuelve la lista de ataques enriquecidos
 * con la rotación (1..6) del equipo atacante al momento del rally.
 */
export function buildEnrichedAttacks(
  match: Match,
  teamA?: Team,
  teamB?: Team,
): EnrichedAttack[] {
  const events = [...match.events].sort((a, b) => a.timestamp - b.timestamp);
  const initial = match.initialServingSide;
  const out: EnrichedAttack[] = [];
  const setterLookup =
    teamA && teamB ? buildSetterZoneLookup(match, teamA, teamB) : null;


  // Estado por set: rotación 0..5 y equipo que saca.
  let currentSet = -1;
  let rotA = 0;
  let rotB = 0;
  let serving: "A" | "B" = initial;

  const setStateFor = (setNum: number) => {
    if (setNum !== currentSet) {
      currentSet = setNum;
      rotA = 0;
      rotB = 0;
      serving = setNum % 2 === 1 ? initial : initial === "A" ? "B" : "A";
    }
  };

  for (const ev of events) {
    if (!("setNumber" in ev)) continue;
    setStateFor(ev.setNumber);

    if ("kind" in ev && ev.kind === "setting") {
      const se = ev as SettingEvent;
      const origin = settingZoneToOrigin(se.attackZone);
      const result: EnrichedAttack["result"] =
        se.attackResult === "point"
          ? "positive"
          : se.attackResult === "error"
          ? "negative"
          : se.attackResult === "blocked" || se.attackResult === "continuity"
          ? "neutral"
          : "neutral";
      out.push({
        side: se.side,
        playerId: se.attackerId ?? null,
        origin,
        direction: (se.attackDirection ?? null) as AttackDirection | null,
        result,
        setNumber: se.setNumber,
        rotation: (se.side === "A" ? rotA : rotB) + 1,
        timestamp: se.timestamp,
      });
    } else if (!("kind" in ev)) {
      // PointEvent: si no hubo setting-event asociado pero tiene attackZone,
      // registramos el ataque igual (evita perder datos del flujo rápido).
      const pe = ev as PointEvent;
      if (pe.playerSide && (isAttackType(pe.type) || pe.type === "attack_error")) {
        // Sólo si hay attackZone real y NO existe ya un setting-event en la
        // misma marca temporal (mismo rally) para evitar duplicar.
        const near = out.find(
          (a) => Math.abs(a.timestamp - pe.timestamp) < 1500 && a.side === pe.playerSide,
        );
        if (!near && pe.attackZone !== undefined) {
          const origin = pe.attackZone as OriginZone;
          out.push({
            side: pe.playerSide,
            playerId: pe.playerId,
            origin,
            direction: (pe.attackDirection ?? null) as AttackDirection | null,
            result: pe.type === "attack_error" ? "negative" : "positive",
            setNumber: pe.setNumber,
            rotation: (pe.playerSide === "A" ? rotA : rotB) + 1,
            timestamp: pe.timestamp,
          });
        }
      }

      // Rotación: aplica reglas estándar (rota el equipo que quita saque).
      const winner = pe.scoringSide;
      if (winner !== serving) {
        if (winner === "A") rotA = (rotA + 1) % 6;
        else rotB = (rotB + 1) % 6;
        serving = winner;
      }
    }
  }

  return out;
}

export interface HeatmapFilters {
  setNumber?: number | "all";
  rotation?: number | "all";
  playerId?: string | "all";
}

export interface HeatmapAgg {
  origin: Record<OriginZone, ZoneBucket>;
  destination: Record<number, ZoneBucket>; // 1..9
  total: number;
  positives: number;
  neutrals: number;
  negatives: number;
  topZone: OriginZone | null;
  topZonePct: number;
}

function emptyAgg(): HeatmapAgg {
  const origin = {} as Record<OriginZone, ZoneBucket>;
  (ORIGIN_ZONES as OriginZone[]).forEach((z) => (origin[z] = emptyBucket()));
  const destination = {} as Record<number, ZoneBucket>;
  for (let i = 1 as number; i <= 9; i++) destination[i] = emptyBucket();
  return {
    origin,
    destination,
    total: 0,
    positives: 0,
    neutrals: 0,
    negatives: 0,
    topZone: null,
    topZonePct: 0,
  };
}

export function aggregateAttacks(
  attacks: EnrichedAttack[],
  side: "A" | "B",
  filters: HeatmapFilters = {},
): HeatmapAgg {
  const agg = emptyAgg();
  for (const a of attacks) {
    if (a.side !== side) continue;
    if (filters.setNumber !== undefined && filters.setNumber !== "all" && a.setNumber !== filters.setNumber) continue;
    if (filters.rotation !== undefined && filters.rotation !== "all" && a.rotation !== filters.rotation) continue;
    if (filters.playerId !== undefined && filters.playerId !== "all" && a.playerId !== filters.playerId) continue;

    if (a.origin) {
      const b = agg.origin[a.origin];
      b.count++;
      if (a.result === "positive") b.positives++;
      else if (a.result === "neutral") b.neutrals++;
      else b.negatives++;
    }
    if (a.direction) {
      const d = agg.destination[a.direction];
      d.count++;
      if (a.result === "positive") d.positives++;
      else if (a.result === "neutral") d.neutrals++;
      else d.negatives++;
    }
    agg.total++;
    if (a.result === "positive") agg.positives++;
    else if (a.result === "neutral") agg.neutrals++;
    else agg.negatives++;
  }

  // Top zone
  let top: OriginZone | null = null;
  let topCount = -1;
  for (const z of ORIGIN_ZONES) {
    if (agg.origin[z].count > topCount) {
      topCount = agg.origin[z].count;
      top = z;
    }
  }
  agg.topZone = topCount > 0 ? top : null;
  agg.topZonePct = agg.total > 0 && topCount > 0 ? Math.round((topCount / agg.total) * 100) : 0;
  return agg;
}
