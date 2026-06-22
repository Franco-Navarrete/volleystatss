import type { Match, MatchEvent, PointEvent } from "./volley-store";

export interface RotationBucket {
  /** 1..6 */
  rotation: number;
  pf: number;
  pc: number;
}

export interface SideRotationStats {
  buckets: RotationBucket[]; // length 6
  current: number; // 1..6, the rotation as of the last rally of this set
  rallies: number;
}

export interface SetRotationStats {
  setNumber: number;
  A: SideRotationStats;
  B: SideRotationStats;
}

function emptySide(): SideRotationStats {
  return {
    buckets: Array.from({ length: 6 }, (_, i) => ({ rotation: i + 1, pf: 0, pc: 0 })),
    current: 1,
    rallies: 0,
  };
}

/**
 * Compute per-set, per-side rotation stats (points-for / points-against)
 * derived from the match's point event sequence. Rotation is calculated,
 * never stored. Rotation index advances clockwise (R1 → R2 → … → R6 → R1)
 * each time that side wins a rally while the opponent was serving.
 */
export function computeRotationStats(match: Match): SetRotationStats[] {
  const result: SetRotationStats[] = [];
  // Group point events by set, in chronological order
  const points: PointEvent[] = match.events.filter(
    (e): e is PointEvent => !("kind" in e),
  );
  // Replicate first-server alternation logic from replayMatch
  const initial = match.initialServingSide;
  // Determine sets present (at least 1)
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
    let serving: "A" | "B" =
      setNum % 2 === 1 ? initial : initial === "A" ? "B" : "A";
    let rotA = 0; // 0..5
    let rotB = 0;
    for (const ev of setPoints) {
      // Attribute the rally to each side's CURRENT rotation
      const winner = ev.scoringSide;
      const loser = winner === "A" ? "B" : "A";
      const winSide = winner === "A" ? A : B;
      const losSide = loser === "A" ? A : B;
      const winRot = winner === "A" ? rotA : rotB;
      const losRot = loser === "A" ? rotA : rotB;
      winSide.buckets[winRot].pf++;
      losSide.buckets[losRot].pc++;
      A.rallies = winner === "A" || loser === "A" ? A.rallies + 1 : A.rallies;
      B.rallies = winner === "B" || loser === "B" ? B.rallies + 1 : B.rallies;
      // Then, rotate if scoring side wasn't serving
      if (winner !== serving) {
        if (winner === "A") rotA = (rotA + 1) % 6;
        else rotB = (rotB + 1) % 6;
        serving = winner;
      }
    }
    A.current = rotA + 1;
    B.current = rotB + 1;
    result.push({ setNumber: setNum, A, B });
  }
  return result;
}

export function bestRotation(stats: SideRotationStats): RotationBucket | null {
  const played = stats.buckets.filter((b) => b.pf + b.pc > 0);
  if (played.length === 0) return null;
  return [...played].sort((a, b) => b.pf - b.pc - (a.pf - a.pc))[0];
}

export function worstRotation(stats: SideRotationStats): RotationBucket | null {
  const played = stats.buckets.filter((b) => b.pf + b.pc > 0);
  if (played.length === 0) return null;
  return [...played].sort((a, b) => a.pf - a.pc - (b.pf - b.pc))[0];
}
