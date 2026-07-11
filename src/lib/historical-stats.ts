import {
  computeMatchStats,
  computeReceptionStats,
  type Match,
  type Player,
  type PlayerStat,
  type Team,
} from "./volley-store";


const MVP_WEIGHTS = { attack: 1, block: 1.2, ace: 1.5, unforcedError: -0.5 };
export const mvpScore = (p: Pick<PlayerStat, "attack" | "block" | "ace" | "unforcedError">) =>
  p.attack * MVP_WEIGHTS.attack +
  p.block * MVP_WEIGHTS.block +
  p.ace * MVP_WEIGHTS.ace +
  p.unforcedError * MVP_WEIGHTS.unforcedError;

export interface MatchPerformance {
  matchId: string;
  date: number;
  opponentTeamId: string;
  opponentName: string;
  points: number; // attack + block + ace
  attack: number;
  counterAttack: number;
  rotationAttack: number;
  block: number;
  ace: number;
  serveError: number;
  attackError: number;
  blockError: number;
  unforcedError: number;
  wasMvp: boolean;
}

export interface PlayerRecord {
  matchId: string;
  date: number;
  opponentName: string;
  value: number;
}

export interface PlayerAggregate {
  player: Player;
  team: Team;
  matchesPlayed: number;
  totals: {
    points: number;
    attack: number;
    counterAttack: number;
    rotationAttack: number;
    block: number;
    ace: number;
    serveError: number;
    attackError: number;
    blockError: number;
    unforcedError: number;
    mvp: number;
    receptionPositive: number;
    receptionNeutral: number;
    receptionNegative: number;
    receptionTotal: number;
  };
  averages: {
    points: number;
    attack: number;
    block: number;
    ace: number;
    /** (pos - neg) / total * 100, all-time. */
    receptionEfficiency: number;
  };
  records: {
    points: PlayerRecord | null;
    block: PlayerRecord | null;
    ace: PlayerRecord | null;
  };
  /** Most recent first, up to 5. */
  lastMatches: MatchPerformance[];
  /** All performances, most recent first. */
  allPerformances: MatchPerformance[];
}


function emptyAgg(player: Player, team: Team): PlayerAggregate {
  return {
    player,
    team,
    matchesPlayed: 0,
    totals: {
      points: 0, attack: 0, counterAttack: 0, rotationAttack: 0,
      block: 0, ace: 0, serveError: 0, attackError: 0, blockError: 0, unforcedError: 0, mvp: 0,
      receptionPositive: 0, receptionNeutral: 0, receptionNegative: 0, receptionTotal: 0,
    },
    averages: { points: 0, attack: 0, block: 0, ace: 0, receptionEfficiency: 0 },
    records: { points: null, block: null, ace: null },
    lastMatches: [],
    allPerformances: [],
  };
}


/** Build all-time per-player aggregates from finished matches. */
export function computeHistoricalStats(matches: Match[], teams: Team[]): PlayerAggregate[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerToTeam = new Map<string, Team>();
  const playerById = new Map<string, Player>();
  for (const t of teams) {
    for (const p of t.players) {
      playerToTeam.set(p.id, t);
      playerById.set(p.id, p);
    }
  }

  const aggs = new Map<string, PlayerAggregate>();
  const ensure = (playerId: string): PlayerAggregate | null => {
    const existing = aggs.get(playerId);
    if (existing) return existing;
    const player = playerById.get(playerId);
    const team = playerToTeam.get(playerId);
    if (!player || !team) return null;
    const a = emptyAgg(player, team);
    aggs.set(playerId, a);
    return a;
  };

  const finished = matches.filter((m) => m.status === "finished");
  // Sort oldest -> newest so lastMatches reversal at the end is cheap
  const sorted = [...finished].sort((a, b) => a.scheduledAt - b.scheduledAt);

  for (const match of sorted) {
    const teamA = teamById.get(match.teamAId);
    const teamB = teamById.get(match.teamBId);
    if (!teamA || !teamB) continue;

    const stats = computeMatchStats(match);

    // Determine MVP of this match (highest mvpScore among players who scored anything)
    let mvpId: string | null = null;
    let mvpVal = -Infinity;
    for (const p of stats.players.values()) {
      const score = mvpScore(p);
      if (score > mvpVal && (p.attack + p.block + p.ace) > 0) {
        mvpVal = score;
        mvpId = p.playerId;
      }
    }

    for (const ps of stats.players.values()) {
      const team = playerToTeam.get(ps.playerId);
      if (!team) continue;
      const isTeamA = team.id === match.teamAId;
      const opponent = isTeamA ? teamB : teamA;
      const agg = ensure(ps.playerId);
      if (!agg) continue;

      const points = ps.attack + ps.block + ps.ace;
      const wasMvp = ps.playerId === mvpId;

      const perf: MatchPerformance = {
        matchId: match.id,
        date: match.scheduledAt,
        opponentTeamId: opponent.id,
        opponentName: opponent.name,
        points,
        attack: ps.attack,
        counterAttack: ps.counterAttack,
        rotationAttack: ps.rotationAttack,
        block: ps.block,
        ace: ps.ace,
        serveError: ps.serveError,
        attackError: ps.attackError,
        unforcedError: ps.unforcedError,
        wasMvp,
      };

      agg.allPerformances.push(perf);
      agg.matchesPlayed++;
      agg.totals.points += points;
      agg.totals.attack += ps.attack;
      agg.totals.counterAttack += ps.counterAttack;
      agg.totals.rotationAttack += ps.rotationAttack;
      agg.totals.block += ps.block;
      agg.totals.ace += ps.ace;
      agg.totals.serveError += ps.serveError;
      agg.totals.attackError += ps.attackError;
      agg.totals.unforcedError += ps.unforcedError;
      if (wasMvp) agg.totals.mvp++;

      const updateRecord = (
        key: "points" | "block" | "ace",
        value: number,
      ) => {
        if (value <= 0) return;
        const cur = agg.records[key];
        if (!cur || value > cur.value) {
          agg.records[key] = {
            matchId: match.id, date: match.scheduledAt,
            opponentName: opponent.name, value,
          };
        }
      };
      updateRecord("points", points);
      updateRecord("block", ps.block);
      updateRecord("ace", ps.ace);
    }

    // Reception aggregates for this match
    const recMap = computeReceptionStats(match.events);
    for (const rec of recMap.values()) {
      const agg = ensure(rec.playerId);
      if (!agg) continue;
      agg.totals.receptionPositive += rec.positive;
      agg.totals.receptionNeutral += rec.neutral;
      agg.totals.receptionNegative += rec.negative;
      agg.totals.receptionTotal += rec.total;
    }
  }

  for (const agg of aggs.values()) {
    const mp = agg.matchesPlayed || 1;
    const recTot = agg.totals.receptionTotal;
    agg.averages = {
      points: agg.totals.points / mp,
      attack: agg.totals.attack / mp,
      block: agg.totals.block / mp,
      ace: agg.totals.ace / mp,
      receptionEfficiency: recTot > 0
        ? ((agg.totals.receptionPositive - agg.totals.receptionNegative) / recTot) * 100
        : 0,
    };
    // Most recent first
    agg.allPerformances.reverse();
    agg.lastMatches = agg.allPerformances.slice(0, 5);
  }


  return [...aggs.values()];
}

export type RankingMetric =
  | "points"
  | "attack"
  | "counterAttack"
  | "block"
  | "ace"
  | "mvp"
  | "avgPoints"
  | "receptionEfficiency";


export interface RankingMetricDef {
  key: RankingMetric;
  label: string;
  shortLabel: string;
  /** Minimum matches to qualify (used for averages). */
  minMatches?: number;
  /** Format value for display. */
  format: (a: PlayerAggregate) => string;
  /** Numeric value used to sort. */
  value: (a: PlayerAggregate) => number;
  /** Optional custom qualification predicate (defaults to value > 0). */
  qualifies?: (a: PlayerAggregate) => boolean;
}


export const RANKING_METRICS: RankingMetricDef[] = [
  {
    key: "points", label: "Máximas anotadoras", shortLabel: "Puntos",
    format: (a) => `${a.totals.points}`,
    value: (a) => a.totals.points,
  },
  {
    key: "attack", label: "Mejores atacantes", shortLabel: "Ataques",
    format: (a) => `${a.totals.attack}`,
    value: (a) => a.totals.attack,
  },
  {
    key: "counterAttack", label: "Mejores contraatacantes", shortLabel: "Contraataques",
    format: (a) => `${a.totals.counterAttack}`,
    value: (a) => a.totals.counterAttack,
  },
  {
    key: "block", label: "Mejores bloqueadoras", shortLabel: "Bloqueos",
    format: (a) => `${a.totals.block}`,
    value: (a) => a.totals.block,
  },
  {
    key: "ace", label: "Mejores sacadoras", shortLabel: "Aces",
    format: (a) => `${a.totals.ace}`,
    value: (a) => a.totals.ace,
  },
  {
    key: "mvp", label: "Más MVP", shortLabel: "MVP",
    format: (a) => `${a.totals.mvp}`,
    value: (a) => a.totals.mvp,
  },
  {
    key: "avgPoints", label: "Mejor promedio de puntos", shortLabel: "Prom.",
    minMatches: 3,
    format: (a) => a.averages.points.toFixed(1),
    value: (a) => a.averages.points,
  },
  {
    key: "receptionEfficiency", label: "Mejor % de recepción", shortLabel: "% Recep.",
    format: (a) => `${a.averages.receptionEfficiency.toFixed(0)}%`,
    value: (a) => a.averages.receptionEfficiency,
    qualifies: (a) => a.totals.receptionTotal > 0,
  },
];

export function rankBy(
  aggs: PlayerAggregate[],
  metric: RankingMetricDef,
  limit = 10,
): PlayerAggregate[] {
  const min = metric.minMatches ?? 0;
  const qualifies = metric.qualifies ?? ((a: PlayerAggregate) => metric.value(a) > 0);
  return aggs
    .filter((a) => a.matchesPlayed >= min && qualifies(a))
    .sort((x, y) => metric.value(y) - metric.value(x))
    .slice(0, limit);
}

