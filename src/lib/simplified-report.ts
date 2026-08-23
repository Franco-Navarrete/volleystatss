import {
  computeMatchStats,
  computeReceptionStats,
  getSetDuration,
  setsWon,
  type Match,
  type PlayerStat,
  type PointEvent,
  type ReceptionStat,
  type Team,
} from "@/lib/volley-store";
import { computeRotationStats, type RotationBucket } from "@/lib/rotation-stats";
import {
  computeSetterPositionStats,
  SETTER_ZONE_LABEL,
  type SetterZone,
} from "@/lib/setter-position";
import { computeSetterDistribution, getSettingEvents } from "@/lib/setting-stats";
import { generateInsights } from "@/lib/coach/insights";

/**
 * Motor de datos del "Reporte simplificado".
 *
 * REGLA CLAVE: no inventa nada. Todos los valores derivan de los eventos ya
 * registrados en el partido. Cuando una métrica no tiene ningún dato cargado,
 * se devuelve `null` para que el PDF oculte la sección o muestre "Sin datos".
 */

export type Side = "A" | "B";

export interface SetRow {
  number: number;
  scoreA: number;
  scoreB: number;
  finished: boolean;
  winner: Side | null;
  durationMs: number | null;
}

export interface ServeBlock {
  serves: number;
  aces: number;
  errors: number;
  pointsWhileServing: number;
  efficiency: number; // (aces - errores) / saques * 100
}

export interface ReceptionBlock {
  total: number;
  positivePct: number;
  perfectPct: number;
  errors: number;
}

export interface AttackBlock {
  attempts: number;
  points: number;
  errors: number;
  blocked: number;
  efficiency: number; // (puntos - errores - bloqueados) / intentos * 100
  effectiveness: number; // puntos / intentos * 100
}

export interface BlockBlock {
  points: number;
  errors: number;
  received: number;
}

export interface RotationRow {
  rotation: number;
  pf: number;
  pc: number;
  diff: number;
}

export interface SetterRotationRow {
  zone: SetterZone;
  label: string; // A1..A6
  pf: number;
  pc: number;
  diff: number;
  rallies: number;
  /** % de rallies ganados con la armadora en esa zona. */
  winPct: number;
}

export interface SetterBlock {
  name: string | null;
  rows: SetterRotationRow[];
  best: SetterRotationRow | null;
  worst: SetterRotationRow | null;
  /** Datos de armado detallado (si se cargaron eventos de armado). */
  sets: number;
  efficiencyPct: number | null;
  positivePct: number | null;
  conclusion: string;
}

export interface PlayerLine {
  playerId: string;
  label: string;
  value: number;
  detail?: string;
}


export interface SimplifiedReport {
  meta: {
    teamAName: string;
    teamBName: string;
    dateLabel: string;
    timeLabel: string | null;
    fileDate: string;
    competition: string | null;
    category: string | null;
    venue: string | null;
    statusLabel: "PARTIDO FINALIZADO" | "PARTIDO EN VIVO" | "PARTIDO PROGRAMADO";
    live: boolean;
  };
  score: { a: number; b: number };
  sets: SetRow[];
  duration: { totalMs: number; perSet: { number: number; ms: number }[] } | null;
  momentum: {
    points: { index: number; delta: number; setNumber: number }[];
    conclusion: string;
  } | null;
  streaks: { A: number; B: number } | null;
  rotations: { A: RotationRow[]; B: RotationRow[] } | null;
  setter: SetterBlock | null;
  serve: { A: ServeBlock; B: ServeBlock } | null;
  reception: { A: ReceptionBlock | null; B: ReceptionBlock | null } | null;
  attack: { A: AttackBlock | null; B: AttackBlock | null } | null;
  block: { A: BlockBlock; B: BlockBlock } | null;
  players: {
    topAttack: PlayerLine[];
    topBlock: PlayerLine[];
    topServe: PlayerLine[];
    topReception: PlayerLine[];
    mvp: (PlayerLine & { attackPoints: number; blocks: number; aces: number }) | null;
  };
  tactical: { situation: string[]; recommendations: string[] };
  summary: { tone: "good" | "bad" | "warn"; text: string }[];
}

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fileDate(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Secuencia de saque por rally, replicando la alternancia oficial. */
function serveSequence(match: Match) {
  const points = match.events.filter((e): e is PointEvent => !("kind" in e));
  const bySet = new Map<number, PointEvent[]>();
  for (const p of points) {
    const arr = bySet.get(p.setNumber) ?? [];
    arr.push(p);
    bySet.set(p.setNumber, arr);
  }
  const out: { serving: Side; ev: PointEvent }[] = [];
  for (const [setNum, evs] of [...bySet.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...evs].sort((a, b) => a.timestamp - b.timestamp);
    let serving: Side =
      setNum % 2 === 1 ? match.initialServingSide : match.initialServingSide === "A" ? "B" : "A";
    for (const ev of sorted) {
      out.push({ serving, ev });
      if (ev.scoringSide !== serving) serving = ev.scoringSide;
    }
  }
  return out;
}

function receptionBlock(map: Map<string, ReceptionStat>): ReceptionBlock | null {
  const rows = [...map.values()];
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (total === 0) return null;
  const perfect = rows.reduce((s, r) => s + r.doublePositive, 0);
  const positive = rows.reduce((s, r) => s + r.positive, 0);
  const errors = rows.reduce((s, r) => s + r.doubleNegative + r.overpass, 0);
  return {
    total,
    positivePct: pct(perfect + positive, total),
    perfectPct: pct(perfect, total),
    errors,
  };
}

function attackBlock(match: Match, side: Side): AttackBlock | null {
  const rival: Side = side === "A" ? "B" : "A";
  let points = 0;
  let errors = 0;
  let neutral = 0;
  let blocked = 0;
  for (const ev of match.events) {
    if ("kind" in ev) {
      if (ev.kind === "attackAttempt" && ev.side === side) neutral++;
      continue;
    }
    if ((ev.type === "attack" || ev.type === "counter_attack" || ev.type === "rotation_attack") && ev.scoringSide === side) points++;
    if (ev.type === "attack_error" && ev.playerSide === side) errors++;
    if (ev.type === "block" && ev.scoringSide === rival) blocked++;
  }
  const attempts = points + errors + neutral + blocked;
  if (attempts === 0) return null;
  return {
    attempts,
    points,
    errors,
    blocked,
    efficiency: pct(points - errors - blocked, attempts),
    effectiveness: pct(points, attempts),
  };
}

function maxStreak(points: PointEvent[], side: Side) {
  let best = 0;
  let cur = 0;
  for (const p of points) {
    if (p.scoringSide === side) {
      cur++;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  return best;
}

function enrich(team: Team, map: Map<string, PlayerStat>): PlayerStat[] {
  return [...map.values()]
    .map((p) => {
      const tp = team.players.find((x) => x.id === p.playerId);
      if (!tp) return null;
      return { ...p, name: tp.name, number: tp.number };
    })
    .filter(Boolean) as PlayerStat[];
}

const nameOf = (p: PlayerStat) => `#${p.number} ${p.name}`;

export function buildSimplifiedReport(
  match: Match,
  teamA: Team,
  teamB: Team,
  opts: { competition?: string | null; ownSide?: Side } = {},
): SimplifiedReport {
  const ownSide: Side = opts.ownSide ?? "A";
  const stats = computeMatchStats(match);
  const won = setsWon(match);
  const points = match.events.filter((e): e is PointEvent => !("kind" in e));

  // ── Sets ───────────────────────────────────────────────
  const sets: SetRow[] = match.sets
    .filter((s) => s.scoreA > 0 || s.scoreB > 0 || s.finished || s.number === match.currentSet)
    .map((s) => ({
      number: s.number,
      scoreA: s.scoreA,
      scoreB: s.scoreB,
      finished: s.finished,
      winner: s.finished ? (s.scoreA > s.scoreB ? "A" : "B") : null,
      durationMs: getSetDuration(match, s.number) ?? null,
    }));

  const durSets = sets.filter((s) => s.durationMs && s.durationMs > 0);
  const duration =
    durSets.length > 0
      ? {
          totalMs: durSets.reduce((sum, s) => sum + (s.durationMs ?? 0), 0),
          perSet: durSets.map((s) => ({ number: s.number, ms: s.durationMs! })),
        }
      : null;

  // ── Momentum (diferencial acumulado por set, sobre puntos reales) ──
  let momentum: SimplifiedReport["momentum"] = null;
  if (points.length > 0) {
    const line: { index: number; delta: number; setNumber: number }[] = [];
    let a = 0;
    let b = 0;
    let currentSet = points[0].setNumber;
    points.forEach((p, i) => {
      if (p.setNumber !== currentSet) {
        currentSet = p.setNumber;
        a = 0;
        b = 0;
      }
      if (p.scoringSide === "A") a++;
      else b++;
      line.push({ index: i, delta: a - b, setNumber: p.setNumber });
    });
    const tail = points.slice(-15);
    const tailA = tail.filter((p) => p.scoringSide === "A").length;
    const tailB = tail.length - tailA;
    const leader = tailA === tailB ? null : tailA > tailB ? teamA.name : teamB.name;
    momentum = {
      points: line,
      conclusion: leader
        ? `Momentum: ${leader} cerró con tendencia positiva (${Math.max(tailA, tailB)}-${Math.min(tailA, tailB)} en los últimos ${tail.length} rallies).`
        : `Momentum: parejo en los últimos ${tail.length} rallies (${tailA}-${tailB}).`,
    };
  }

  const streaks =
    points.length > 0 ? { A: maxStreak(points, "A"), B: maxStreak(points, "B") } : null;

  // ── Rotaciones (suma de todos los sets) ───────────────
  const rotStats = computeRotationStats(match);
  const sumSide = (side: Side): RotationRow[] => {
    const acc: RotationBucket[] = Array.from({ length: 6 }, (_, i) => ({ rotation: i + 1, pf: 0, pc: 0 }));
    for (const s of rotStats) {
      for (const b of s[side].buckets) {
        acc[b.rotation - 1].pf += b.pf;
        acc[b.rotation - 1].pc += b.pc;
      }
    }
    return acc.map((b) => ({ ...b, diff: b.pf - b.pc }));
  };
  const rotA = sumSide("A");
  const rotB = sumSide("B");
  const rotations = rotA.some((r) => r.pf + r.pc > 0) ? { A: rotA, B: rotB } : null;

  // ── Saque ─────────────────────────────────────────────
  const seq = serveSequence(match);
  const serveFor = (side: Side): ServeBlock => {
    const mine = seq.filter((r) => r.serving === side);
    const aces = mine.filter((r) => r.ev.type === "ace" && r.ev.scoringSide === side).length;
    const errors = mine.filter((r) => r.ev.type === "serve_error" && r.ev.playerSide === side).length;
    const pointsWhileServing = mine.filter((r) => r.ev.scoringSide === side).length;
    return {
      serves: mine.length,
      aces,
      errors,
      pointsWhileServing,
      efficiency: pct(aces - errors, mine.length),
    };
  };
  const serve = seq.length > 0 ? { A: serveFor("A"), B: serveFor("B") } : null;

  // ── Recepción ─────────────────────────────────────────
  const recA = receptionBlock(computeReceptionStats(match.events, "A"));
  const recB = receptionBlock(computeReceptionStats(match.events, "B"));
  const reception = recA || recB ? { A: recA, B: recB } : null;

  // ── Ataque ────────────────────────────────────────────
  const atkA = attackBlock(match, "A");
  const atkB = attackBlock(match, "B");
  const attack = atkA || atkB ? { A: atkA, B: atkB } : null;

  // ── Bloqueo ───────────────────────────────────────────
  const tA = stats.teams.get(match.teamAId);
  const tB = stats.teams.get(match.teamBId);
  const blkA: BlockBlock = { points: tA?.block ?? 0, errors: tA?.blockErrors ?? 0, received: tB?.block ?? 0 };
  const blkB: BlockBlock = { points: tB?.block ?? 0, errors: tB?.blockErrors ?? 0, received: tA?.block ?? 0 };
  const block = blkA.points + blkB.points + blkA.errors + blkB.errors > 0 ? { A: blkA, B: blkB } : null;

  // ── Jugadores ─────────────────────────────────────────
  const ownTeam = ownSide === "A" ? teamA : teamB;
  const ownStats = enrich(ownTeam, stats.players);
  const recMap = computeReceptionStats(match.events, ownSide);
  const topAttack = ownStats
    .filter((p) => p.attack > 0)
    .sort((x, z) => z.attack - x.attack)
    .slice(0, 5)
    .map((p) => ({ playerId: p.playerId, label: nameOf(p), value: p.attack }));
  const topBlock = ownStats
    .filter((p) => p.block > 0)
    .sort((x, z) => z.block - x.block)
    .slice(0, 5)
    .map((p) => ({ playerId: p.playerId, label: nameOf(p), value: p.block }));
  const topServe = ownStats
    .filter((p) => p.ace > 0)
    .sort((x, z) => z.ace - x.ace)
    .slice(0, 5)
    .map((p) => ({ playerId: p.playerId, label: nameOf(p), value: p.ace }));
  const topReception = [...recMap.values()]
    .filter((r) => r.total >= 3)
    .sort((x, z) => z.positivity - x.positivity)
    .slice(0, 5)
    .map((r) => {
      const tp = ownTeam.players.find((p) => p.id === r.playerId);
      return {
        playerId: r.playerId,
        label: tp ? `#${tp.number} ${tp.name}` : "s/d",
        value: Math.round(r.positivity),
        detail: `${r.total} recepciones`,
      };
    })
    .filter((r) => r.label !== "s/d");

  const mvpCandidate = [...ownStats].sort(
    (x, z) =>
      z.attack + z.block * 1.2 + z.ace * 1.5 - z.unforcedError * 0.5 -
      (x.attack + x.block * 1.2 + x.ace * 1.5 - x.unforcedError * 0.5),
  )[0];
  const mvp =
    mvpCandidate && mvpCandidate.total > 0
      ? {
          playerId: mvpCandidate.playerId,
          label: nameOf(mvpCandidate),
          value: mvpCandidate.total,
          attackPoints: mvpCandidate.attack,
          blocks: mvpCandidate.block,
          aces: mvpCandidate.ace,
        }
      : null;

  // ── Análisis táctico (motor existente) ────────────────
  const insights = generateInsights({ match, teamA, teamB, ownSide });
  const situation = insights.alerts.slice(0, 4).map((a) => `${a.title}. ${a.detail}`);
  const recommendations = insights.recommendations.slice(0, 4).map((r) => `${r.title}. ${r.detail}`);

  // ── Resumen automático ────────────────────────────────
  const summary: SimplifiedReport["summary"] = [];
  const ownRot = ownSide === "A" ? rotA : rotB;
  const played = ownRot.filter((r) => r.pf + r.pc > 0);
  if (played.length > 0) {
    const best = [...played].sort((x, z) => z.diff - x.diff)[0];
    const worst = [...played].sort((x, z) => x.diff - z.diff)[0];
    if (best.diff > 0) summary.push({ tone: "good", text: `Fortaleza: rotación R${best.rotation} con ${best.diff > 0 ? "+" : ""}${best.diff} de diferencia.` });
    if (worst.diff < 0) summary.push({ tone: "bad", text: `Debilidad: rotación R${worst.rotation} con ${worst.diff} de diferencia.` });
  }
  const ownAtk = ownSide === "A" ? atkA : atkB;
  if (ownAtk) {
    if (ownAtk.effectiveness >= 40)
      summary.push({ tone: "good", text: `Fortaleza: ataque con ${ownAtk.effectiveness.toFixed(0)}% de efectividad (${ownAtk.points}/${ownAtk.attempts}).` });
    else summary.push({ tone: "warn", text: `A mejorar: efectividad de ataque ${ownAtk.effectiveness.toFixed(0)}% (${ownAtk.points}/${ownAtk.attempts}).` });
  }
  const ownServe = serve ? serve[ownSide] : null;
  if (ownServe) {
    if (ownServe.errors > ownServe.aces)
      summary.push({ tone: "bad", text: `Debilidad: ${ownServe.errors} errores de saque frente a ${ownServe.aces} aces.` });
    else if (ownServe.aces > 0)
      summary.push({ tone: "good", text: `Fortaleza: ${ownServe.aces} aces con ${ownServe.errors} errores de saque.` });
  }
  const ownRec = ownSide === "A" ? recA : recB;
  if (ownRec) {
    if (ownRec.positivePct >= 55)
      summary.push({ tone: "good", text: `Fortaleza: recepción positiva ${ownRec.positivePct.toFixed(0)}% sobre ${ownRec.total} recepciones.` });
    else summary.push({ tone: "warn", text: `A mejorar: recepción positiva ${ownRec.positivePct.toFixed(0)}% sobre ${ownRec.total} recepciones.` });
  }
  const ownBlk = ownSide === "A" ? blkA : blkB;
  if (block && ownBlk.points > 0)
    summary.push({ tone: "good", text: `Bloqueo: ${ownBlk.points} puntos directos y ${ownBlk.errors} errores.` });

  const when = match.scheduledAt || match.createdAt;

  return {
    meta: {
      teamAName: teamA.name,
      teamBName: teamB.name,
      dateLabel: fmtDate(when),
      timeLabel: when ? new Date(when).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null,
      fileDate: fileDate(when),
      competition: opts.competition ?? null,
      category: match.category ?? null,
      venue: match.venue ?? null,
      statusLabel:
        match.status === "finished"
          ? "PARTIDO FINALIZADO"
          : match.status === "live"
          ? "PARTIDO EN VIVO"
          : "PARTIDO PROGRAMADO",
      live: match.status !== "finished",
    },
    score: { a: won.a, b: won.b },
    sets,
    duration,
    momentum,
    streaks,
    rotations,
    serve,
    reception,
    attack,
    block,
    players: { topAttack, topBlock, topServe, topReception, mvp },
    tactical: { situation, recommendations },
    summary: summary.slice(0, 5),
  };
}
