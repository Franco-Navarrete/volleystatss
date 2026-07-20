/**
 * Player analytics — helpers puros para el panel /jugadora/$id.
 * No agregan state ni side effects; sólo consumen matches + teams.
 */
import {
  computeMatchStats,
  computeReceptionStats,
  isAttackType,
  type AttackDirection,
  type Match,
  type MatchEvent,
  type Player,
  type PointEvent,
  type SettingEvent,
  type AttackAttemptEvent,
  type Team,
} from "./volley-store";
import {
  computeHistoricalStats,
  mvpScore,
  type PlayerAggregate,
} from "./historical-stats";

/* ============= Timeframes ============= */

export type Timeframe = "all" | "season" | "last10" | "last5" | "last1";

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  all: "Toda la carrera",
  season: "Temporada actual",
  last10: "Últimos 10 partidos",
  last5: "Últimos 5 partidos",
  last1: "Último partido",
};

export const TIMEFRAMES: Timeframe[] = ["all", "season", "last10", "last5", "last1"];

/** Devuelve los partidos finished filtrados y ordenados nuevos→viejos según el timeframe.
 *  Sólo mira los partidos donde participó la jugadora (si se pasa playerId). */
export function applyTimeframe(
  matches: Match[],
  timeframe: Timeframe,
  playerId?: string,
): Match[] {
  const finished = matches.filter((m) => m.status === "finished");
  const relevant = playerId
    ? finished.filter((m) => playerParticipated(m, playerId))
    : finished;
  const sorted = [...relevant].sort((a, b) => b.scheduledAt - a.scheduledAt);
  const now = Date.now();
  const yearAgo = now - 365 * 24 * 3600 * 1000;
  switch (timeframe) {
    case "all":
      return sorted;
    case "season":
      return sorted.filter((m) => m.scheduledAt >= yearAgo);
    case "last10":
      return sorted.slice(0, 10);
    case "last5":
      return sorted.slice(0, 5);
    case "last1":
      return sorted.slice(0, 1);
  }
}

function playerParticipated(match: Match, playerId: string): boolean {
  for (const ev of match.events) {
    if ("kind" in ev) {
      if ((ev as any).playerId === playerId) return true;
      if ((ev as any).setterId === playerId) return true;
      if ((ev as any).attackerId === playerId) return true;
    } else if (ev.playerId === playerId) {
      return true;
    }
  }
  // También si está en el lineup titular
  return (
    match.startingLineupA.includes(playerId) ||
    match.startingLineupB.includes(playerId)
  );
}

/* ============= Contexto comparativo ============= */

export interface ContextMetric {
  key: string;
  label: string;
  value: number;
  teamAvg: number;
  leagueAvg: number;
  suffix?: string;
  /** Formatea el número para mostrar. */
  format?: (n: number) => string;
}

export interface PlayerContext {
  agg?: PlayerAggregate;
  teamPeers: PlayerAggregate[];
  leaguePeers: PlayerAggregate[];
  positionPeers: PlayerAggregate[];
  metrics: ContextMetric[];
}

function avg<T>(arr: T[], pick: (t: T) => number): number {
  const play = arr.filter((a) => (a as any).matchesPlayed > 0);
  if (play.length === 0) return 0;
  return play.reduce((s, a) => s + pick(a), 0) / play.length;
}

export function computePlayerContext(
  matches: Match[],
  teams: Team[],
  playerId: string,
): PlayerContext {
  const allAggs = computeHistoricalStats(matches, teams);
  const agg = allAggs.find((a) => a.player.id === playerId);
  const teamPeers = agg
    ? allAggs.filter((a) => a.team.id === agg.team.id && a.player.id !== playerId)
    : [];
  const leagueId = agg?.team.leagueId;
  const leagueTeamIds = leagueId
    ? new Set(teams.filter((t) => t.leagueId === leagueId).map((t) => t.id))
    : new Set<string>();
  const leaguePeers = leagueId
    ? allAggs.filter(
        (a) => leagueTeamIds.has(a.team.id) && a.player.id !== playerId,
      )
    : [];
  const positionPeers = agg?.player.position
    ? allAggs.filter(
        (a) =>
          a.player.position === agg.player.position && a.player.id !== playerId,
      )
    : [];

  const metrics: ContextMetric[] = [];
  if (agg) {
    const attackTotal =
      agg.totals.attack + agg.totals.counterAttack + agg.totals.rotationAttack;
    const attackErrorTotal = agg.totals.attackError;
    const kills = attackTotal;
    const attackEff =
      attackTotal + attackErrorTotal > 0
        ? ((kills - attackErrorTotal) / (attackTotal + attackErrorTotal)) * 100
        : 0;

    const push = (
      key: string,
      label: string,
      value: number,
      pick: (a: PlayerAggregate) => number,
      suffix?: string,
      format?: (n: number) => string,
    ) => {
      metrics.push({
        key,
        label,
        value,
        teamAvg: avg(teamPeers, pick),
        leagueAvg: avg(leaguePeers, pick),
        suffix,
        format,
      });
    };
    push("points", "Puntos", agg.totals.points, (a) => a.totals.points);
    push("attack", "Ataques", attackTotal, (a) =>
      a.totals.attack + a.totals.counterAttack + a.totals.rotationAttack,
    );
    push(
      "reception",
      "Recepción %",
      agg.averages.receptionEfficiency,
      (a) => a.averages.receptionEfficiency,
      "%",
      (n) => `${n.toFixed(0)}%`,
    );
    push("serve", "Aces", agg.totals.ace, (a) => a.totals.ace);
    push("block", "Bloqueos", agg.totals.block, (a) => a.totals.block);
    push(
      "efficiency",
      "Eficiencia atq",
      attackEff,
      (a) => {
        const at = a.totals.attack + a.totals.counterAttack + a.totals.rotationAttack;
        const ae = a.totals.attackError;
        return at + ae > 0 ? ((at - ae) / (at + ae)) * 100 : 0;
      },
      "%",
      (n) => `${n.toFixed(0)}%`,
    );
    push(
      "mvp",
      "Rendimiento (MVP/PJ)",
      agg.matchesPlayed > 0 ? agg.totals.mvp / agg.matchesPlayed : 0,
      (a) => (a.matchesPlayed > 0 ? a.totals.mvp / a.matchesPlayed : 0),
      "",
      (n) => n.toFixed(2),
    );
  }
  return { agg, teamPeers, leaguePeers, positionPeers, metrics };
}

/* ============= Radar (0-100 normalizado) ============= */

export interface RadarDatum {
  axis: string;
  player: number;
  team: number;
  league: number;
}

export function computeRadar(ctx: PlayerContext): RadarDatum[] {
  const { agg, teamPeers, leaguePeers } = ctx;
  if (!agg) return [];
  const teamAvg = (pick: (a: PlayerAggregate) => number) => avg(teamPeers, pick);
  const leagueAvg = (pick: (a: PlayerAggregate) => number) => avg(leaguePeers, pick);
  const norm = (v: number, max: number) =>
    max > 0 ? Math.min(100, Math.round((v / max) * 100)) : 0;

  const pts = agg.averages.points;
  const atk = agg.averages.attack;
  const blk = agg.averages.block;
  const ace = agg.averages.ace;
  const rec = agg.averages.receptionEfficiency;

  // Max de referencia = max entre yo, team y league averages (para escalar)
  const scale = (v: number, tAvg: number, lAvg: number) => {
    const m = Math.max(v, tAvg, lAvg, 1);
    return norm(v, m * 1.2);
  };

  const rows: RadarDatum[] = [
    {
      axis: "Ataque",
      player: scale(atk, teamAvg((a) => a.averages.attack), leagueAvg((a) => a.averages.attack)),
      team: scale(teamAvg((a) => a.averages.attack), teamAvg((a) => a.averages.attack), leagueAvg((a) => a.averages.attack)),
      league: scale(leagueAvg((a) => a.averages.attack), teamAvg((a) => a.averages.attack), leagueAvg((a) => a.averages.attack)),
    },
    {
      axis: "Recepción",
      player: Math.max(0, Math.min(100, rec)),
      team: Math.max(0, Math.min(100, teamAvg((a) => a.averages.receptionEfficiency))),
      league: Math.max(0, Math.min(100, leagueAvg((a) => a.averages.receptionEfficiency))),
    },
    {
      axis: "Saque",
      player: scale(ace, teamAvg((a) => a.averages.ace), leagueAvg((a) => a.averages.ace)),
      team: scale(teamAvg((a) => a.averages.ace), teamAvg((a) => a.averages.ace), leagueAvg((a) => a.averages.ace)),
      league: scale(leagueAvg((a) => a.averages.ace), teamAvg((a) => a.averages.ace), leagueAvg((a) => a.averages.ace)),
    },
    {
      axis: "Bloqueo",
      player: scale(blk, teamAvg((a) => a.averages.block), leagueAvg((a) => a.averages.block)),
      team: scale(teamAvg((a) => a.averages.block), teamAvg((a) => a.averages.block), leagueAvg((a) => a.averages.block)),
      league: scale(leagueAvg((a) => a.averages.block), teamAvg((a) => a.averages.block), leagueAvg((a) => a.averages.block)),
    },
    {
      axis: "Rendimiento",
      player: scale(pts, teamAvg((a) => a.averages.points), leagueAvg((a) => a.averages.points)),
      team: scale(teamAvg((a) => a.averages.points), teamAvg((a) => a.averages.points), leagueAvg((a) => a.averages.points)),
      league: scale(leagueAvg((a) => a.averages.points), teamAvg((a) => a.averages.points), leagueAvg((a) => a.averages.points)),
    },
  ];
  return rows;
}

/* ============= Evolución ============= */

export interface EvolutionPoint {
  matchId: string;
  date: number;
  label: string;
  opponentName: string;
  points: number;
  attacks: number;
  attackEff: number;
  receptionEff: number;
  aces: number;
  blocks: number;
}

export function computePlayerEvolution(
  matches: Match[],
  playerId: string,
): EvolutionPoint[] {
  const finished = matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const rows: EvolutionPoint[] = [];
  for (const m of finished) {
    const stats = computeMatchStats(m);
    const ps = stats.players.get(playerId);
    if (!ps) continue;
    const recMap = computeReceptionStats(m.events);
    const rec = recMap.get(playerId);
    const attacks = ps.attack; // kills en el modelo
    const errs = ps.attackError;
    const eff = attacks + errs > 0 ? ((attacks - errs) / (attacks + errs)) * 100 : 0;
    rows.push({
      matchId: m.id,
      date: m.scheduledAt,
      label: new Date(m.scheduledAt).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
      }),
      opponentName: "",
      points: ps.attack + ps.block + ps.ace,
      attacks,
      attackEff: Math.round(eff),
      receptionEff: rec ? Math.round(rec.efficiency) : 0,
      aces: ps.ace,
      blocks: ps.block,
    });
  }
  return rows;
}

/* ============= Heatmap 3×3 de ataque (direction 1..9) ============= */

export interface HeatmapCell {
  zone: AttackDirection;
  attempts: number;
  kills: number;
  errors: number;
  successRate: number; // %
}

export function computeAttackHeatmap(
  matches: Match[],
  playerId: string,
): HeatmapCell[] {
  const cells: HeatmapCell[] = Array.from({ length: 9 }, (_, i) => ({
    zone: (i + 1) as AttackDirection,
    attempts: 0,
    kills: 0,
    errors: 0,
    successRate: 0,
  }));
  for (const m of matches) {
    for (const ev of m.events) {
      if ("kind" in ev) {
        if (ev.kind === "attackAttempt" && ev.playerId === playerId && ev.attackDirection) {
          cells[ev.attackDirection - 1].attempts++;
        } else if (
          ev.kind === "setting" &&
          ev.attackerId === playerId &&
          ev.attackDirection
        ) {
          const c = cells[ev.attackDirection - 1];
          c.attempts++;
          if (ev.attackResult === "point") c.kills++;
          if (ev.attackResult === "error" || ev.attackResult === "blocked")
            c.errors++;
        }
      } else if (ev.playerId === playerId && isAttackType(ev.type) && ev.attackDirection) {
        const c = cells[ev.attackDirection - 1];
        c.attempts++;
        c.kills++;
      } else if (
        ev.playerId === playerId &&
        ev.type === "attack_error" &&
        ev.attackDirection
      ) {
        const c = cells[ev.attackDirection - 1];
        c.attempts++;
        c.errors++;
      }
    }
  }
  for (const c of cells) {
    c.successRate = c.attempts > 0 ? Math.round((c.kills / c.attempts) * 100) : 0;
  }
  return cells;
}

/* ============= Estadísticas por rotación (P1..P6) ============= */

export interface PlayerRotationBucket {
  rotation: number; // 1..6
  points: number;
  attacks: number;
  attackErrors: number;
  blocks: number;
  aces: number;
  receptionPos: number;
  receptionTotal: number;
}

/**
 * Rotación del equipo de la jugadora al momento de cada evento.
 * Determinamos la rotación calculando la posición inicial + rotaciones aplicadas al equipo.
 */
export function computePlayerRotations(
  matches: Match[],
  playerId: string,
): PlayerRotationBucket[] {
  const buckets: PlayerRotationBucket[] = Array.from({ length: 6 }, (_, i) => ({
    rotation: i + 1,
    points: 0,
    attacks: 0,
    attackErrors: 0,
    blocks: 0,
    aces: 0,
    receptionPos: 0,
    receptionTotal: 0,
  }));

  for (const match of matches) {
    // Determinar side del jugador
    let side: "A" | "B" | null = null;
    if (match.startingLineupA.includes(playerId)) side = "A";
    else if (match.startingLineupB.includes(playerId)) side = "B";
    else continue;

    const points = match.events.filter(
      (e): e is PointEvent => !("kind" in e),
    );
    const setNumbers = new Set<number>([1]);
    for (const p of points) setNumbers.add(p.setNumber);

    for (const setNum of setNumbers) {
      const setEvents = match.events
        .filter((e) => "setNumber" in e && e.setNumber === setNum)
        .sort((a, b) => a.timestamp - b.timestamp);

      let rotA = 0;
      let rotB = 0;
      let serving: "A" | "B" =
        setNum % 2 === 1
          ? match.initialServingSide
          : match.initialServingSide === "A"
            ? "B"
            : "A";

      for (const ev of setEvents) {
        const myRot = side === "A" ? rotA : rotB;
        const rotBucket = buckets[myRot];

        if ("kind" in ev) {
          if (ev.kind === "reception" && ev.playerId === playerId) {
            rotBucket.receptionTotal++;
            if (ev.rating === "double_positive" || ev.rating === "positive")
              rotBucket.receptionPos++;
          } else if (
            ev.kind === "attackAttempt" &&
            ev.playerId === playerId
          ) {
            rotBucket.attacks++;
          }
        } else {
          const isMine = ev.playerId === playerId && ev.playerSide === side;
          if (isMine) {
            if (isAttackType(ev.type)) {
              rotBucket.attacks++;
              rotBucket.points++;
            } else if (ev.type === "block") {
              rotBucket.blocks++;
              rotBucket.points++;
            } else if (ev.type === "ace") {
              rotBucket.aces++;
              rotBucket.points++;
            } else if (ev.type === "attack_error") {
              rotBucket.attackErrors++;
            }
          }
          // Aplicar rotación después del punto
          const winner = ev.scoringSide;
          if (winner !== serving) {
            if (winner === "A") rotA = (rotA + 1) % 6;
            else rotB = (rotB + 1) % 6;
            serving = winner;
          }
        }
      }
    }
  }
  return buckets;
}

/* ============= Rendimiento por armador ============= */

export interface SetterPerformance {
  setterId: string;
  setterName: string;
  attempts: number;
  points: number;
  errors: number;
  efficiency: number; // %
}

export function computeByAttackSetter(
  matches: Match[],
  teams: Team[],
  playerId: string,
): SetterPerformance[] {
  const playerById = new Map<string, Player>();
  for (const t of teams) for (const p of t.players) playerById.set(p.id, p);
  const map = new Map<string, SetterPerformance>();
  for (const m of matches) {
    for (const ev of m.events) {
      if (!("kind" in ev) || ev.kind !== "setting") continue;
      const s = ev as SettingEvent;
      if (s.attackerId !== playerId) continue;
      const key = s.setterId;
      const cur = map.get(key) ?? {
        setterId: key,
        setterName: playerById.get(key)?.name ?? "—",
        attempts: 0,
        points: 0,
        errors: 0,
        efficiency: 0,
      };
      cur.attempts++;
      if (s.attackResult === "point") cur.points++;
      if (s.attackResult === "error" || s.attackResult === "blocked")
        cur.errors++;
      map.set(key, cur);
    }
  }
  const rows = [...map.values()];
  for (const r of rows) {
    r.efficiency =
      r.attempts > 0
        ? Math.round(((r.points - r.errors) / r.attempts) * 100)
        : 0;
  }
  return rows.sort((a, b) => b.attempts - a.attempts);
}

/* ============= Tendencias ============= */

export interface TrendRow {
  key: string;
  label: string;
  recent: number;
  historical: number;
  delta: number;
  suffix?: string;
}

export function computePlayerTrends(
  matches: Match[],
  playerId: string,
): TrendRow[] {
  const finished = matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.scheduledAt - a.scheduledAt);
  if (finished.length < 3) return [];
  const recent = finished.slice(0, Math.min(5, finished.length));
  const older = finished.slice(recent.length);
  const perf = (m: Match) => {
    const ps = computeMatchStats(m).players.get(playerId);
    if (!ps) return null;
    const rec = computeReceptionStats(m.events).get(playerId);
    return {
      points: ps.attack + ps.block + ps.ace,
      attacks: ps.attack,
      aces: ps.ace,
      blocks: ps.block,
      recEff: rec?.efficiency ?? 0,
      recTotal: rec?.total ?? 0,
    };
  };
  const avgOf = (list: Match[], pick: (p: NonNullable<ReturnType<typeof perf>>) => number) => {
    const perfs = list.map(perf).filter(Boolean) as NonNullable<
      ReturnType<typeof perf>
    >[];
    if (perfs.length === 0) return 0;
    return perfs.reduce((s, p) => s + pick(p), 0) / perfs.length;
  };
  const mk = (key: string, label: string, pick: (p: NonNullable<ReturnType<typeof perf>>) => number, suffix = ""): TrendRow => {
    const r = avgOf(recent, pick);
    const h = avgOf(older.length ? older : recent, pick);
    return { key, label, recent: r, historical: h, delta: r - h, suffix };
  };
  return [
    mk("points", "Puntos/PJ", (p) => p.points),
    mk("attacks", "Ataques/PJ", (p) => p.attacks),
    mk("aces", "Aces/PJ", (p) => p.aces),
    mk("blocks", "Bloqueos/PJ", (p) => p.blocks),
    mk("recEff", "Recepción %", (p) => p.recEff, "%"),
  ];
}

/* ============= Timeline último partido ============= */

export interface TimelineEntry {
  id: string;
  set: number;
  scoreA: number;
  scoreB: number;
  label: string;
  detail?: string;
  tone: "positive" | "negative" | "neutral";
}

const POINT_TYPE_LABEL_ES: Record<string, string> = {
  attack: "Ataque",
  rotation_attack: "Ataque de rotación",
  counter_attack: "Contraataque",
  block: "Bloqueo",
  ace: "Ace",
  serve_error: "Error de saque",
  attack_error: "Error de ataque",
  block_error: "Error de bloqueo",
  unforced_error: "Error no forzado",
};

export function computeLastMatchTimeline(
  matches: Match[],
  playerId: string,
): { match?: Match; entries: TimelineEntry[] } {
  const finished = matches
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.scheduledAt - a.scheduledAt);
  const match = finished.find((m) => playerParticipated(m, playerId));
  if (!match) return { entries: [] };
  let side: "A" | "B" | null = null;
  if (match.startingLineupA.includes(playerId)) side = "A";
  else if (match.startingLineupB.includes(playerId)) side = "B";
  const entries: TimelineEntry[] = [];
  const ordered = [...match.events].sort((a, b) => a.timestamp - b.timestamp);
  let scoreA = 0;
  let scoreB = 0;
  let currentSet = 1;
  for (const ev of ordered) {
    const setNum = "setNumber" in ev ? ev.setNumber : currentSet;
    if (setNum !== currentSet) {
      currentSet = setNum;
      scoreA = 0;
      scoreB = 0;
    }
    if (!("kind" in ev)) {
      if (ev.scoringSide === "A") scoreA++;
      else scoreB++;
      if (ev.playerId === playerId) {
        const isErr = /error/.test(ev.type);
        entries.push({
          id: ev.id,
          set: setNum,
          scoreA,
          scoreB,
          label: POINT_TYPE_LABEL_ES[ev.type] ?? ev.type,
          tone: isErr ? "negative" : "positive",
        });
      }
    } else if (ev.kind === "reception" && ev.playerId === playerId) {
      const tone: TimelineEntry["tone"] =
        ev.rating === "double_positive" || ev.rating === "positive"
          ? "positive"
          : ev.rating === "double_negative" || ev.rating === "overpass"
            ? "negative"
            : "neutral";
      entries.push({
        id: ev.id,
        set: setNum,
        scoreA,
        scoreB,
        label: "Recepción",
        detail: ev.rating,
        tone,
      });
    } else if (ev.kind === "attackAttempt" && ev.playerId === playerId) {
      entries.push({
        id: ev.id,
        set: setNum,
        scoreA,
        scoreB,
        label: "Ataque (continuidad)",
        tone: "neutral",
      });
    }
  }
  return { match, entries };
}

/* ============= Patrones de juego ============= */

export interface PatternInsight {
  text: string;
  tone: "positive" | "negative" | "neutral";
}

export function computePlayerPatterns(
  matches: Match[],
  teams: Team[],
  playerId: string,
): PatternInsight[] {
  const out: PatternInsight[] = [];
  // Ataques por zona destino
  const heatmap = computeAttackHeatmap(matches, playerId);
  const totalAtk = heatmap.reduce((s, c) => s + c.attempts, 0);
  if (totalAtk >= 5) {
    const sorted = [...heatmap].sort((a, b) => b.attempts - a.attempts);
    const top = sorted[0];
    if (top.attempts > 0) {
      const pct = Math.round((top.attempts / totalAtk) * 100);
      out.push({
        text: `El ${pct}% de sus ataques se dirigen a la zona ${top.zone} de la cancha rival.`,
        tone: "neutral",
      });
    }
    const bestSuccess = [...heatmap]
      .filter((c) => c.attempts >= 3)
      .sort((a, b) => b.successRate - a.successRate)[0];
    if (bestSuccess && bestSuccess.successRate >= 60) {
      out.push({
        text: `Su zona más efectiva es la ${bestSuccess.zone} (${bestSuccess.successRate}% de éxito).`,
        tone: "positive",
      });
    }
  }
  // Recepción
  const recAll = new Map<string, number>();
  let recTotal = 0;
  let recPos = 0;
  for (const m of matches) {
    for (const ev of m.events) {
      if ("kind" in ev && ev.kind === "reception" && ev.playerId === playerId) {
        recTotal++;
        if (ev.rating === "double_positive" || ev.rating === "positive") recPos++;
        recAll.set(ev.rating, (recAll.get(ev.rating) ?? 0) + 1);
      }
    }
  }
  if (recTotal >= 10) {
    const pct = Math.round((recPos / recTotal) * 100);
    out.push({
      text: `Su recepción positiva (# + +) es del ${pct}% sobre ${recTotal} recepciones.`,
      tone: pct >= 55 ? "positive" : pct <= 35 ? "negative" : "neutral",
    });
  }
  // Contraataque vs rotación
  let counters = 0;
  let rots = 0;
  for (const m of matches) {
    for (const ev of m.events) {
      if (!("kind" in ev) && ev.playerId === playerId) {
        if (ev.type === "counter_attack") counters++;
        if (ev.type === "rotation_attack") rots++;
      }
    }
  }
  if (counters + rots >= 5) {
    if (counters > rots * 1.3) {
      out.push({ text: `Obtiene más puntos en contraataque (${counters}) que en ataque de rotación (${rots}).`, tone: "positive" });
    } else if (rots > counters * 1.3) {
      out.push({ text: `Rinde mejor en ataque de rotación (${rots}) que en contraataque (${counters}).`, tone: "neutral" });
    }
  }
  // Rotación más productiva
  const rotBuckets = computePlayerRotations(matches, playerId);
  const bestRot = [...rotBuckets].sort((a, b) => b.points - a.points)[0];
  if (bestRot && bestRot.points >= 3) {
    out.push({
      text: `Genera más puntos en la rotación P${bestRot.rotation} (${bestRot.points} pts).`,
      tone: "positive",
    });
  }
  // Armado rápido: éxito con calidad "++"
  let quickAttempts = 0;
  let quickPoints = 0;
  for (const m of matches) {
    for (const ev of m.events) {
      if ("kind" in ev && ev.kind === "setting" && ev.attackerId === playerId && ev.quality === "++") {
        quickAttempts++;
        if (ev.attackResult === "point") quickPoints++;
      }
    }
  }
  if (quickAttempts >= 5) {
    const pct = Math.round((quickPoints / quickAttempts) * 100);
    out.push({
      text: `Con armado perfecto (++) convierte el ${pct}% de sus ataques (${quickPoints}/${quickAttempts}).`,
      tone: pct >= 60 ? "positive" : "neutral",
    });
  }
  return out;
}

/* ============= Insights automáticos vs equipo/liga ============= */

export function computePlayerInsights(ctx: PlayerContext): PatternInsight[] {
  const { agg, teamPeers, leaguePeers } = ctx;
  if (!agg) return [];
  const out: PatternInsight[] = [];
  // Máximo anotador del equipo
  const bestPts = [...teamPeers].sort((a, b) => b.totals.points - a.totals.points)[0];
  if (!bestPts || agg.totals.points >= bestPts.totals.points) {
    if (agg.totals.points > 0)
      out.push({ text: "Máxima anotadora del equipo.", tone: "positive" });
  }
  // Ataque > promedio liga
  const leagueAtkAvg = avg(leaguePeers, (a) => a.averages.attack);
  if (agg.averages.attack > leagueAtkAvg * 1.1 && agg.matchesPlayed >= 2)
    out.push({ text: "Ataque superior al promedio de la liga.", tone: "positive" });
  if (agg.averages.attack < leagueAtkAvg * 0.7 && agg.matchesPlayed >= 2 && leagueAtkAvg > 0)
    out.push({ text: "Ataque por debajo del promedio de la liga.", tone: "negative" });
  // Recepción positiva
  if (agg.averages.receptionEfficiency >= 60)
    out.push({ text: "Excelente porcentaje de recepción positiva.", tone: "positive" });
  // Bloqueo bajo
  const leagueBlkAvg = avg(leaguePeers, (a) => a.averages.block);
  if (agg.averages.block < leagueBlkAvg * 0.5 && leagueBlkAvg > 0.3)
    out.push({ text: "Baja participación en bloqueo respecto de la liga.", tone: "negative" });
  // Contraataque alto
  if (agg.totals.counterAttack > agg.totals.rotationAttack * 1.3 && agg.totals.counterAttack >= 3)
    out.push({ text: "Excelente rendimiento en contraataque.", tone: "positive" });
  // MVP recurrente
  if (agg.totals.mvp >= 2)
    out.push({ text: `Elegida MVP en ${agg.totals.mvp} partidos.`, tone: "positive" });
  // Jugadora más eficiente
  const teamEffs = teamPeers.map((p) => ({
    id: p.player.id,
    eff: (() => {
      const at = p.totals.attack + p.totals.counterAttack + p.totals.rotationAttack;
      const ae = p.totals.attackError;
      return at + ae > 0 ? (at - ae) / (at + ae) : 0;
    })(),
  }));
  const at = agg.totals.attack + agg.totals.counterAttack + agg.totals.rotationAttack;
  const ae = agg.totals.attackError;
  const myEff = at + ae > 0 ? (at - ae) / (at + ae) : 0;
  const bestPeerEff = teamEffs.reduce((m, x) => (x.eff > m ? x.eff : m), 0);
  if (myEff > 0.4 && myEff >= bestPeerEff && at >= 5)
    out.push({ text: "Jugadora más eficiente del equipo.", tone: "positive" });
  return out;
}

/* ============= Indicador de performance por comparación ============= */

export type PerfLevel = "excellent" | "good" | "regular" | "low";

export function perfLevel(value: number, benchmark: number): PerfLevel {
  if (benchmark <= 0) return value > 0 ? "good" : "regular";
  const ratio = value / benchmark;
  if (ratio >= 1.3) return "excellent";
  if (ratio >= 1.05) return "good";
  if (ratio >= 0.85) return "regular";
  return "low";
}

export const PERF_META: Record<PerfLevel, { emoji: string; color: string; label: string }> = {
  excellent: { emoji: "🟢", color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10", label: "Excelente" },
  good: { emoji: "🟡", color: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10", label: "Bueno" },
  regular: { emoji: "🟠", color: "text-orange-400 border-orange-500/40 bg-orange-500/10", label: "Regular" },
  low: { emoji: "🔴", color: "text-rose-400 border-rose-500/40 bg-rose-500/10", label: "Bajo" },
};
