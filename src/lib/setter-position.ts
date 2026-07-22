// Análisis por POSICIÓN DE LA ARMADORA (A1..A6).
// A diferencia de la rotación del equipo (R1..R6), aquí siempre representamos
// la zona (1..6) que ocupa la armadora en la formación efectiva en el instante
// del rally. Se calcula proyectando la rotación sobre la posición inicial de
// la armadora dentro del starting lineup de cada set.

import type { Match, PointEvent, Team } from "./volley-store";

export type SetterZone = 1 | 2 | 3 | 4 | 5 | 6;
export const SETTER_ZONES: SetterZone[] = [1, 2, 3, 4, 5, 6];
export const SETTER_ZONE_LABEL: Record<SetterZone, string> = {
  1: "A1", 2: "A2", 3: "A3", 4: "A4", 5: "A5", 6: "A6",
};

export interface SetterBucket {
  /** 1..6 (Zx que ocupa la armadora). */
  zone: SetterZone;
  pf: number;
  pc: number;
}

export interface SideSetterStats {
  buckets: SetterBucket[]; // longitud 6
  current: SetterZone;
  rallies: number;
}

export interface SetSetterStats {
  setNumber: number;
  A: SideSetterStats;
  B: SideSetterStats;
}

function emptySide(): SideSetterStats {
  return {
    buckets: SETTER_ZONES.map((z) => ({ zone: z, pf: 0, pc: 0 })),
    current: 2,
    rallies: 0,
  };
}

/** Índice (0..5) en el startingLineup del jugador con rol armador. Fallback: 1 (Z2). */
function initialSetterIndex(lineup: string[], team: Team): number {
  const idx = lineup.findIndex(
    (pid) => team.players.find((p) => p.id === pid)?.position === "armador",
  );
  return idx >= 0 ? idx : 1;
}

/**
 * Dado el índice inicial de la armadora y el índice de rotación acumulado
 * (0 = arranque del set), devuelve la zona (1..6) que ocupa.
 * Rotación horaria: Z2 → Z1 → Z6 → Z5 → Z4 → Z3 → Z2.
 */
export function setterZoneFromRotation(
  initialIdx: number,
  rotationIndex: number,
): SetterZone {
  const zoneIdx = ((initialIdx - rotationIndex) % 6 + 6) % 6;
  return (zoneIdx + 1) as SetterZone;
}

function lineupForSet(match: Match, setNumber: number, side: "A" | "B"): string[] {
  return (
    match.lineupsBySet?.[setNumber]?.[side] ??
    (side === "A" ? match.startingLineupA : match.startingLineupB)
  );
}

/**
 * Igual que `computeRotationStats` pero agrupado por zona de la armadora.
 * Reutiliza la misma proyección de rotaciones sobre los eventos de punto.
 */
export function computeSetterPositionStats(
  match: Match,
  teamA: Team,
  teamB: Team,
): SetSetterStats[] {
  const result: SetSetterStats[] = [];
  const points: PointEvent[] = match.events.filter(
    (e): e is PointEvent => !("kind" in e),
  );
  const initial = match.initialServingSide;
  const setNumbers = new Set<number>([1]);
  for (const p of points) setNumbers.add(p.setNumber);
  for (const s of match.sets) setNumbers.add(s.number);
  const sortedSets = [...setNumbers].sort((a, b) => a - b);

  for (const setNum of sortedSets) {
    const setPoints = points
      .filter((p) => p.setNumber === setNum)
      .sort((a, b) => a.timestamp - b.timestamp);
    const A = emptySide();
    const B = emptySide();
    const setterA0 = initialSetterIndex(lineupForSet(match, setNum, "A"), teamA);
    const setterB0 = initialSetterIndex(lineupForSet(match, setNum, "B"), teamB);
    A.current = setterZoneFromRotation(setterA0, 0);
    B.current = setterZoneFromRotation(setterB0, 0);

    let serving: "A" | "B" =
      setNum % 2 === 1 ? initial : initial === "A" ? "B" : "A";
    let rotA = 0;
    let rotB = 0;
    for (const ev of setPoints) {
      const winner = ev.scoringSide;
      const loser = winner === "A" ? "B" : "A";
      const zA = setterZoneFromRotation(setterA0, rotA);
      const zB = setterZoneFromRotation(setterB0, rotB);
      const winZone = winner === "A" ? zA : zB;
      const losZone = loser === "A" ? zA : zB;
      const winSide = winner === "A" ? A : B;
      const losSide = loser === "A" ? A : B;
      winSide.buckets[winZone - 1].pf++;
      losSide.buckets[losZone - 1].pc++;
      A.rallies++;
      B.rallies++;
      if (winner !== serving) {
        if (winner === "A") rotA = (rotA + 1) % 6;
        else rotB = (rotB + 1) % 6;
        serving = winner;
      }
    }
    A.current = setterZoneFromRotation(setterA0, rotA);
    B.current = setterZoneFromRotation(setterB0, rotB);
    result.push({ setNumber: setNum, A, B });
  }
  return result;
}

export function bestSetterZone(stats: SideSetterStats): SetterBucket | null {
  const played = stats.buckets.filter((b) => b.pf + b.pc > 0);
  if (played.length === 0) return null;
  return [...played].sort((a, b) => b.pf - b.pc - (a.pf - a.pc))[0];
}
export function worstSetterZone(stats: SideSetterStats): SetterBucket | null {
  const played = stats.buckets.filter((b) => b.pf + b.pc > 0);
  if (played.length === 0) return null;
  return [...played].sort((a, b) => a.pf - a.pc - (b.pf - b.pc))[0];
}

/**
 * Helper para consumidores (heatmap, distribución, insights) que necesiten
 * saber la zona de la armadora al momento de un evento por timestamp.
 * Devuelve una función que dado (side, timestamp) retorna la SetterZone.
 */
export function buildSetterZoneLookup(match: Match, teamA: Team, teamB: Team) {
  const events = [...match.events]
    .filter((e): e is PointEvent => !("kind" in e))
    .sort((a, b) => a.timestamp - b.timestamp);
  const initial = match.initialServingSide;

  // Estado por set: (currentSet, rotA, rotB, serving, setterA0, setterB0).
  interface Snap { rotA: number; rotB: number; serving: "A" | "B"; setterA0: number; setterB0: number; setNumber: number; }
  const snaps: { t: number; snap: Snap }[] = [];

  let currentSet = -1;
  let rotA = 0, rotB = 0;
  let serving: "A" | "B" = initial;
  let setterA0 = 1, setterB0 = 1;

  const initSet = (setNum: number) => {
    currentSet = setNum;
    rotA = 0; rotB = 0;
    serving = setNum % 2 === 1 ? initial : initial === "A" ? "B" : "A";
    setterA0 = initialSetterIndex(lineupForSet(match, setNum, "A"), teamA);
    setterB0 = initialSetterIndex(lineupForSet(match, setNum, "B"), teamB);
  };

  for (const ev of events) {
    if (ev.setNumber !== currentSet) initSet(ev.setNumber);
    // Snapshot BEFORE aplicar rotación de este rally: durante el rally la
    // armadora estaba en la zona previa.
    snaps.push({ t: ev.timestamp, snap: { rotA, rotB, serving, setterA0, setterB0, setNumber: currentSet } });
    if (ev.scoringSide !== serving) {
      if (ev.scoringSide === "A") rotA = (rotA + 1) % 6;
      else rotB = (rotB + 1) % 6;
      serving = ev.scoringSide;
    }
  }

  // Snapshot final (por si consultan timestamp posterior al último punto).
  const finalSnap: Snap = { rotA, rotB, serving, setterA0, setterB0, setNumber: currentSet };

  return function lookup(side: "A" | "B", timestamp: number, setNumber?: number): SetterZone {
    // Busca el snapshot cuyo timestamp sea >= timestamp del ataque
    // (ataque suele venir DENTRO del mismo rally que el punto). Si no,
    // usa el más cercano hacia adelante.
    let snap: Snap = finalSnap;
    for (const s of snaps) {
      if (s.t >= timestamp) { snap = s.snap; break; }
    }
    if (setNumber !== undefined && snap.setNumber !== setNumber) {
      // Fallback: primera aparición del set solicitado.
      const first = snaps.find((s) => s.snap.setNumber === setNumber);
      if (first) snap = first.snap;
    }
    return side === "A"
      ? setterZoneFromRotation(snap.setterA0, snap.rotA)
      : setterZoneFromRotation(snap.setterB0, snap.rotB);
  };
}
