import type { PlayerAggregate } from "./historical-stats";

export interface AwardWeights {
  /** Minimum matches played to qualify (anti-oneshot). */
  minMatches: number;
  /** Generic offensive components used across positions. */
  attack: number;
  block: number;
  ace: number;
  mvp: number;
  /** Reception efficiency weight (líbero / receivers). */
  reception: number;
  /** Penalty multiplier for unforced errors. */
  errorPenalty: number;
}

export const DEFAULT_WEIGHTS: AwardWeights = {
  minMatches: 2,
  attack: 1,
  block: 1.2,
  ace: 1.5,
  mvp: 3,
  reception: 0.3,
  errorPenalty: 0.5,
};

export interface AwardPick {
  aggregate: PlayerAggregate;
  score: number;
  detail: string;
}

const recScore = (a: PlayerAggregate) =>
  a.totals.receptionTotal > 0 ? a.averages.receptionEfficiency : 0;

const offScore = (a: PlayerAggregate, w: AwardWeights) =>
  a.totals.attack * w.attack +
  a.totals.block * w.block +
  a.totals.ace * w.ace +
  a.totals.mvp * w.mvp -
  a.totals.unforcedError * w.errorPenalty;

function scoreFor(
  position: "armador" | "punta" | "central" | "opuesto" | "libero",
  a: PlayerAggregate,
  w: AwardWeights,
): number {
  switch (position) {
    case "armador":
      // Armadora: pondera MVP del equipo + eficiencia ofensiva del equipo (proxy: aces + asists no existen)
      return a.totals.mvp * w.mvp * 2 + a.totals.ace * w.ace + a.totals.attack * (w.attack * 0.3);
    case "punta":
      return (
        a.totals.attack * w.attack +
        a.totals.counterAttack * (w.attack * 0.8) +
        a.totals.ace * w.ace +
        recScore(a) * (w.reception * 0.4)
      );
    case "central":
      return a.totals.block * w.block + a.totals.attack * (w.attack * 0.6) + a.totals.mvp * w.mvp;
    case "opuesto":
      return a.totals.points * w.attack + a.totals.counterAttack * (w.attack * 0.8) + a.totals.ace * w.ace;
    case "libero":
      return (
        a.totals.receptionPositive * 2 +
        recScore(a) * w.reception * 2 -
        a.totals.receptionNegative * 0.5
      );
  }
}

function pick(
  aggs: PlayerAggregate[],
  position: "armador" | "punta" | "central" | "opuesto" | "libero",
  w: AwardWeights,
  n: number,
): AwardPick[] {
  const eligible = aggs.filter(
    (a) => a.player.position === position && a.matchesPlayed >= w.minMatches,
  );
  return eligible
    .map((a) => ({
      aggregate: a,
      score: scoreFor(position, a, w),
      detail: positionDetail(position, a),
    }))
    .filter((p) => p.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, n);
}

function positionDetail(
  pos: "armador" | "punta" | "central" | "opuesto" | "libero",
  a: PlayerAggregate,
): string {
  switch (pos) {
    case "armador":
      return `${a.totals.mvp} MVP · ${a.totals.ace} aces · ${a.matchesPlayed} PJ`;
    case "punta":
      return `${a.totals.attack} ATK · ${a.totals.counterAttack} CTR · ${a.totals.ace} ACE`;
    case "central":
      return `${a.totals.block} BLK · ${a.totals.attack} ATK · ${a.totals.mvp} MVP`;
    case "opuesto":
      return `${a.totals.points} pts · ${a.totals.counterAttack} CTR · ${a.totals.ace} ACE`;
    case "libero":
      return `${a.averages.receptionEfficiency.toFixed(0)}% · ${a.totals.receptionTotal} rec.`;
  }
}

export interface IdealTeam {
  armador: AwardPick | null;
  puntas: AwardPick[];
  centrales: AwardPick[];
  opuesto: AwardPick | null;
  libero: AwardPick | null;
}

export interface RallyAwards {
  ideal: IdealTeam;
  mvp: AwardPick | null;
  bestAttacker: AwardPick | null;
  bestBlocker: AwardPick | null;
  bestServer: AwardPick | null;
  bestReceiver: AwardPick | null;
  topScorer: AwardPick | null;
  revelation: AwardPick | null;
}

export function computeAwards(
  aggs: PlayerAggregate[],
  weights: AwardWeights = DEFAULT_WEIGHTS,
): RallyAwards {
  const top = <K extends keyof PlayerAggregate["totals"]>(
    key: K,
    minMatches = weights.minMatches,
  ): AwardPick | null => {
    const eligible = aggs.filter((a) => a.matchesPlayed >= minMatches);
    const sorted = [...eligible].sort(
      (x, y) => (y.totals[key] as number) - (x.totals[key] as number),
    );
    const winner = sorted[0];
    if (!winner || (winner.totals[key] as number) <= 0) return null;
    return {
      aggregate: winner,
      score: winner.totals[key] as number,
      detail: `${winner.totals[key]} ${labelForKey(key)}`,
    };
  };

  const mvp = (() => {
    const eligible = aggs.filter((a) => a.matchesPlayed >= weights.minMatches);
    const sorted = [...eligible].sort(
      (x, y) => offScore(y, weights) - offScore(x, weights),
    );
    const winner = sorted[0];
    if (!winner || offScore(winner, weights) <= 0) return null;
    return {
      aggregate: winner,
      score: offScore(winner, weights),
      detail: `${winner.totals.mvp} MVP · ${winner.totals.points} pts`,
    };
  })();

  const bestReceiver = (() => {
    const eligible = aggs.filter(
      (a) => a.matchesPlayed >= weights.minMatches && a.totals.receptionTotal >= 10,
    );
    const sorted = [...eligible].sort(
      (x, y) => y.averages.receptionEfficiency - x.averages.receptionEfficiency,
    );
    const winner = sorted[0];
    if (!winner) return null;
    return {
      aggregate: winner,
      score: winner.averages.receptionEfficiency,
      detail: `${winner.averages.receptionEfficiency.toFixed(0)}% · ${winner.totals.receptionTotal} rec.`,
    };
  })();

  const revelation = (() => {
    // Heuristic: high points-per-match in their first matches.
    const eligible = aggs.filter(
      (a) => a.matchesPlayed >= 1 && a.matchesPlayed <= Math.max(3, weights.minMatches),
    );
    const sorted = [...eligible].sort((x, y) => y.averages.points - x.averages.points);
    const winner = sorted[0];
    if (!winner || winner.averages.points <= 0) return null;
    return {
      aggregate: winner,
      score: winner.averages.points,
      detail: `${winner.averages.points.toFixed(1)} pts/PJ · ${winner.matchesPlayed} PJ`,
    };
  })();

  return {
    ideal: {
      armador: pick(aggs, "armador", weights, 1)[0] ?? null,
      puntas: pick(aggs, "punta", weights, 2),
      centrales: pick(aggs, "central", weights, 2),
      opuesto: pick(aggs, "opuesto", weights, 1)[0] ?? null,
      libero: pick(aggs, "libero", weights, 1)[0] ?? null,
    },
    mvp,
    bestAttacker: top("attack"),
    bestBlocker: top("block"),
    bestServer: top("ace"),
    bestReceiver,
    topScorer: top("points"),
    revelation,
  };
}

function labelForKey(key: string): string {
  switch (key) {
    case "attack": return "ataques";
    case "block": return "bloqueos";
    case "ace": return "aces";
    case "points": return "puntos";
    default: return "";
  }
}
