// Rally Intelligence — construye un análisis rico y accionable de un partido.
// Se apoya en las agregaciones existentes (computeMatchStats, computeSetStats,
// computeReceptionStats, computeRotationStats, buildEnrichedAttacks) para
// producir la estructura que consume el nuevo informe visual.

import {
  computeMatchStats,
  computeReceptionStats,
  computeSetStats,
  matchGender,
  type Match,
  type Player,
  type PlayerStat,
  type ReceptionStat,
  type Team,
  type TeamStat,
} from "@/lib/volley-store";
import { computeRotationStats } from "@/lib/rotation-stats";
import { buildEnrichedAttacks, ORIGIN_ZONES, type OriginZone } from "@/lib/attack-heatmap";
import { mvpScore } from "@/lib/historical-stats";

// ---------------- Tipos públicos ----------------

export type Trend = "up" | "down" | "flat";
export type Importance = "baja" | "media" | "alta" | "muy_alta";

export interface EvidenceMetric {
  label: string;
  value: string;
}
export interface Evidence {
  metrics: EvidenceMetric[];
  comparisonLabel?: string;
  comparisonDelta?: number; // porcentual respecto al promedio
  trend?: Trend;
}

export interface StrengthCard {
  id: string;
  title: string;
  category: string;
  importance: Importance;
  confidence: number; // 0-100
  evidence: Evidence;
  conclusion: string;
}
export interface WeaknessCard extends StrengthCard {
  impact: Importance;
  consequence: string;
}

export type IndexStatus = "excellent" | "good" | "regular" | "low" | "critical";

export interface RallyIndexItem {
  key: string;
  label: string;
  score: number;
  detail: string;
  /** 0–100 — cuánto pesa este fundamento en el resultado (aprox.). */
  impact?: number;
  /** 0–100 — confianza según volumen de muestras. */
  confidence?: number;
  /** Delta vs promedio de la temporada (puntos). */
  seasonDelta?: number;
  trend?: Trend;
  status?: IndexStatus;
}

export interface RallyIndex {
  overall: number;
  breakdown: RallyIndexItem[];
}

export interface TimelineEvent {
  setNumber: number;
  scoreFor: number;
  scoreAgainst: number;
  kind: "run" | "opp_run" | "timeout" | "lead_change" | "peak" | "drop";
  title: string;
  detail: string;
}

export interface ImpactSlice {
  key: string;
  label: string;
  impact: number; // porcentaje 0–100
  color: string;
}

export interface CoachInsights {
  whyResult: string;
  keyDecisionThatWorked: string;
  decisionToReconsider: string;
  fundamentalDrivingResult: string;
}

export interface DashboardData {
  scoreline: string;
  result: "victoria" | "derrota" | "empate";
  opponent: string;
  date: string;
  competition?: string;
  durationMin: number | null;
  rallyIndex: number;
  topStrength: string;
  topWeakness: string;
  awards: {
    mvp?: { name: string; number: number; playerId: string; detail: string };
    bestAttacker?: { name: string; number: number; playerId: string; detail: string };
    bestReceiver?: { name: string; number: number; playerId: string; detail: string };
    bestServer?: { name: string; number: number; playerId: string; detail: string };
    mostEfficient?: { name: string; number: number; playerId: string; detail: string };
  };
}

export interface SetTrendPoint {
  setNumber: number;
  scoreFor: number;
  scoreAgainst: number;
  attackEff: number;
  receptionEff: number;
  serveErrors: number;
  attackErrors: number;
}

export interface ZoneUsage {
  zone: OriginZone;
  label: string;
  count: number;
  pct: number;
  points: number;
  errors: number;
  eff: number;
}

export interface Priority {
  id: string;
  level: Importance;
  title: string;
  reason: string;
}

export interface TrainingBlock {
  minutes: number;
  focus: string;
  drills: string[];
  reason: string;
}
export interface TrainingPlan {
  totalMinutes: number;
  blocks: TrainingBlock[];
}

export interface Risk {
  title: string;
  detail: string;
  level: Importance;
}

export interface Prediction {
  premise: string;
  outcome: string;
}

export interface Recommendation {
  horizon: "inmediata" | "mediano_plazo" | "estrategica";
  text: string;
}

export interface MatchAnalysis {
  version: 1;
  matchId: string;
  side: "A" | "B";
  teamName: string;
  opponentName: string;
  dashboard: DashboardData;
  /** Resumen breve (3–5 líneas) generado programáticamente como fallback previo al IA. */
  analystSummary: string;
  rallyIndex: RallyIndex;
  strengths: StrengthCard[];
  weaknesses: WeaknessCard[];
  setTrends: SetTrendPoint[];
  attackZones: ZoneUsage[];
  playerRadar: Array<{ name: string; attack: number; block: number; ace: number; reception: number; discipline: number }>;
  priorities: Priority[];
  trainingPlan: TrainingPlan;
  risks: Risk[];
  predictions: Prediction[];
  coachQuestions: string[];
  recommendations: Recommendation[];
  comparison: {
    label: string;
    rows: Array<{ metric: string; current: number; reference: number; delta: number; trend: Trend }>;
  };
  /** Distribución del impacto de cada fundamento en el resultado (%). */
  impactBreakdown: ImpactSlice[];
  /** Radar comparativo team vs rival vs promedio temporada. */
  radarCompare: Array<{
    axis: string;
    equipo: number;
    rival: number;
    temporada: number;
  }>;
  /** Eventos destacados del partido en orden cronológico. */
  timeline: TimelineEvent[];
  /** Insights sintetizados para el cuerpo técnico. */
  coachInsights: CoachInsights;
}

// ---------------- Utilidades ----------------

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const round = (n: number, d = 0) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

function importanceFromScore(s: number): Importance {
  if (s >= 85) return "muy_alta";
  if (s >= 70) return "alta";
  if (s >= 50) return "media";
  return "baja";
}

function trendFromDelta(delta: number): Trend {
  if (delta > 1.5) return "up";
  if (delta < -1.5) return "down";
  return "flat";
}

// ---------------- Builder principal ----------------

export interface AnalysisContext {
  match: Match;
  side: "A" | "B";
  teams: Team[];
  players: Player[];
  /** Partidos previos del mismo equipo para comparación de temporada. */
  history?: Match[];
}

export function buildMatchAnalysis(ctx: AnalysisContext): MatchAnalysis {
  const { match, side, teams, players, history = [] } = ctx;
  const teamId = side === "A" ? match.teamAId : match.teamBId;
  const oppId = side === "A" ? match.teamBId : match.teamAId;
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));

  const teamName = teamById.get(teamId)?.name ?? "Equipo";
  const opponentName = teamById.get(oppId)?.name ?? "Rival";

  const { players: pStats, teams: tStats } = computeMatchStats(match);
  const teamStat = tStats.get(teamId) ?? emptyTeam(teamId);
  const oppStat = tStats.get(oppId) ?? emptyTeam(oppId);
  const teamPlayers: PlayerStat[] = [...pStats.values()].map((p) => enrichPlayer(p, playerById));

  const reception = [...computeReceptionStats(match.events, side).values()].map((r) => ({
    ...r,
    _player: playerById.get(r.playerId),
  }));

  // ---- marcador y resultado ----
  let setsFor = 0;
  let setsAgainst = 0;
  const setScores: SetTrendPoint[] = [];
  for (const s of match.sets) {
    const scoreFor = side === "A" ? s.scoreA : s.scoreB;
    const scoreAgainst = side === "A" ? s.scoreB : s.scoreA;
    if (scoreFor > scoreAgainst) setsFor++; else if (scoreAgainst > scoreFor) setsAgainst++;

    const { players: sp, teams: st } = computeSetStats(match, s.number);
    const setTeamStat = st.get(teamId);
    const setPlayers = [...sp.values()];
    const setAttackAttempts = (setTeamStat?.attack ?? 0) + (setTeamStat?.attackErrors ?? 0);
    const setAttackEff = pct(setTeamStat?.attack ?? 0, setAttackAttempts);
    const setRec = [...computeReceptionStats(match.events.filter((e) => "setNumber" in e && e.setNumber === s.number), side).values()];
    const recTotal = setRec.reduce((a, r) => a + r.total, 0);
    const recWeighted = setRec.reduce((a, r) => a + r.doublePositive * 4 + r.positive * 3 + r.neutral * 2 + r.negative * 1 + r.doubleNegative * 0 + r.overpass * -1, 0);
    const recEff = recTotal > 0 ? (recWeighted / (recTotal * 4)) * 100 : 0;
    setScores.push({
      setNumber: s.number,
      scoreFor,
      scoreAgainst,
      attackEff: round(setAttackEff, 1),
      receptionEff: round(clamp(recEff), 1),
      serveErrors: setTeamStat?.serveErrors ?? 0,
      attackErrors: setTeamStat?.attackErrors ?? 0,
    });
    void setPlayers;
  }
  const result: DashboardData["result"] = setsFor > setsAgainst ? "victoria" : setsAgainst > setsFor ? "derrota" : "empate";

  // ---- duración ----
  const times = match.events.map((e) => e.timestamp).filter(Boolean);
  const durationMin = times.length >= 2 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : null;

  // ---- Rally Index ----
  const attackAttempts = teamStat.attack + teamStat.attackErrors;
  const attackEff = pct(teamStat.attack, attackAttempts);
  const oppAttackAttempts = oppStat.attack + oppStat.attackErrors;
  const oppAttackEff = pct(oppStat.attack, oppAttackAttempts);

  const recTotal = reception.reduce((a, r) => a + r.total, 0);
  const recWeighted = reception.reduce((a, r) => a + r.doublePositive * 4 + r.positive * 3 + r.neutral * 2 + r.negative * 1 + r.doubleNegative * 0 + r.overpass * -1, 0);
  const recEff = recTotal > 0 ? clamp((recWeighted / (recTotal * 4)) * 100) : 0;
  const recPositivity = recTotal > 0 ? pct(reception.reduce((a, r) => a + r.doublePositive + r.positive, 0), recTotal) : 0;

  const serveAces = teamStat.ace;
  const serveErrors = teamStat.serveErrors;
  const serveScore = clamp(50 + (serveAces - serveErrors) * 6);

  const blockScore = clamp(40 + teamStat.block * 6 - teamStat.blockErrors * 4);

  const unforced = teamStat.unforcedErrors + teamStat.attackErrors + teamStat.blockErrors + teamStat.serveErrors;
  const totalPointsFor = teamStat.total;
  const disciplineScore = clamp(100 - (unforced / Math.max(totalPointsFor, 1)) * 60);

  const rotationStats = computeRotationStats(match);
  const rotBuckets = rotationStats.flatMap((rs) => (side === "A" ? rs.A : rs.B).buckets);
  const rotDelta = rotBuckets.reduce((a, b) => a + (b.pf - b.pc), 0);
  const rotPlayed = rotBuckets.reduce((a, b) => a + b.pf + b.pc, 0);
  const rotationScore = clamp(50 + (rotDelta / Math.max(rotPlayed, 1)) * 200);

  const counterAttack = teamStat.counterAttack;
  const rotationAttack = teamStat.rotationAttack;
  const k1Score = clamp((recPositivity * 0.6) + (rotationAttack / Math.max(recTotal, 1)) * 60);
  const k2Score = clamp(30 + counterAttack * 5 + teamStat.block * 3);

  const defenseScore = clamp(40 + counterAttack * 4 + teamStat.block * 3 - oppStat.attack * 0.5);
  const transitionScore = clamp((k2Score + defenseScore) / 2);
  const regularity = clamp(100 - stddev(setScores.map((s) => s.attackEff)) * 2);

  const rawBreakdown: Array<Omit<RallyIndexItem, "impact" | "status">> = [
    { key: "attack", label: "Ataque", score: round(attackEff * 1.2), detail: `${round(attackEff, 1)}% eficacia (${teamStat.attack}/${attackAttempts})`, confidence: clamp(40 + attackAttempts * 2) },
    { key: "reception", label: "Recepción", score: round(recEff), detail: `${round(recEff, 1)}% eficiencia · ${round(recPositivity, 1)}% #+`, confidence: clamp(40 + recTotal * 2) },
    { key: "serve", label: "Saque", score: round(serveScore), detail: `${serveAces} aces / ${serveErrors} errores`, confidence: 85 },
    { key: "block", label: "Bloqueo", score: round(blockScore), detail: `${teamStat.block} bloqueos / ${teamStat.blockErrors} errores`, confidence: 80 },
    { key: "defense", label: "Defensa", score: round(defenseScore), detail: `${counterAttack} contraataques`, confidence: 70 },
    { key: "transition", label: "Transición", score: round(transitionScore), detail: "Promedio defensa+K2", confidence: 70 },
    { key: "k1", label: "K1 (side-out)", score: round(k1Score), detail: `${round(recPositivity, 1)}% #+ y ${rotationAttack} puntos de rotación`, confidence: clamp(50 + recTotal) },
    { key: "k2", label: "K2 (contraataque)", score: round(k2Score), detail: `${counterAttack} contraataques + ${teamStat.block} bloqueos`, confidence: 70 },
    { key: "regularity", label: "Regularidad", score: round(regularity), detail: "Estabilidad de ataque set a set", confidence: 60 },
    { key: "discipline", label: "Disciplina", score: round(disciplineScore), detail: `${unforced} errores no forzados totales`, confidence: 90 },
  ];
  const IMPACT_WEIGHTS: Record<string, number> = {
    attack: 25, reception: 22, k1: 12, k2: 8, serve: 8, block: 7, defense: 8, transition: 5, regularity: 3, discipline: 2,
  };
  const breakdown: RallyIndexItem[] = rawBreakdown.map((r) => {
    const score = clamp(round(r.score));
    return { ...r, score, impact: IMPACT_WEIGHTS[r.key] ?? 5, status: statusFromScore(score) };
  });
  const overall = round(breakdown.reduce((a, b) => a + b.score, 0) / breakdown.length);
  const rallyIndex: RallyIndex = { overall, breakdown };

  // ---- Premios ----
  const mvp = teamPlayers.slice().sort((a, b) => mvpScore(b) - mvpScore(a))[0];
  const bestAttacker = teamPlayers
    .filter((p) => p.attack + p.attackError >= 4)
    .sort((a, b) => pct(b.attack, b.attack + b.attackError) - pct(a.attack, a.attack + a.attackError))[0];
  const bestReceiver = reception
    .filter((r) => r.total >= 4)
    .sort((a, b) => b.efficiency - a.efficiency)[0];
  const bestServer = teamPlayers.slice().sort((a, b) => (b.ace - b.serveError) - (a.ace - a.serveError))[0];
  const mostEfficient = teamPlayers
    .filter((p) => p.total >= 3)
    .sort((a, b) => (b.attack + b.block + b.ace - b.unforcedError) - (a.attack + a.block + a.ace - a.unforcedError))[0];

  const asAward = (p?: PlayerStat, detail = "") =>
    p ? { name: p.name || `#${p.number}`, number: p.number, playerId: p.playerId, detail } : undefined;
  const asReceptionAward = (r?: (typeof reception)[number], detail = "") => {
    if (!r) return undefined;
    const p = playerById.get(r.playerId);
    return { name: p?.name ?? "Jugadora", number: p?.number ?? 0, playerId: r.playerId, detail };
  };

  // ---- Fortalezas / Debilidades ----
  const strengths: StrengthCard[] = [];
  const weaknesses: WeaknessCard[] = [];

  // Ataque
  if (attackEff >= 45 && attackAttempts >= 15) {
    strengths.push({
      id: "attack-eff",
      title: "Eficacia ofensiva superior",
      category: "Ataque",
      importance: importanceFromScore(attackEff * 1.6),
      confidence: clamp(75 + attackAttempts, 0, 99),
      evidence: {
        metrics: [
          { label: "Eficacia", value: `${round(attackEff, 1)}%` },
          { label: "Puntos", value: String(teamStat.attack) },
          { label: "Errores", value: String(teamStat.attackErrors) },
        ],
        comparisonLabel: "vs rival",
        comparisonDelta: round(attackEff - oppAttackEff, 1),
        trend: trendFromDelta(attackEff - oppAttackEff),
      },
      conclusion: "El ataque fue un factor decisivo del rendimiento del equipo.",
    });
  } else if (attackAttempts >= 15 && attackEff < 30) {
    weaknesses.push({
      id: "attack-eff-low",
      title: "Ataque poco resolutivo",
      category: "Ataque",
      importance: "alta",
      confidence: clamp(70 + attackAttempts, 0, 99),
      impact: "alta",
      evidence: {
        metrics: [
          { label: "Eficacia", value: `${round(attackEff, 1)}%` },
          { label: "Intentos", value: String(attackAttempts) },
          { label: "Errores", value: String(teamStat.attackErrors) },
        ],
        comparisonLabel: "vs rival",
        comparisonDelta: round(attackEff - oppAttackEff, 1),
        trend: trendFromDelta(attackEff - oppAttackEff),
      },
      consequence: "El rival puede sostener el partido si no aumenta la efectividad ofensiva.",
      conclusion: "Trabajar remate contra bloqueo alto y variantes tácticas.",
    });
  }

  // Recepción
  if (recTotal >= 10) {
    if (recEff >= 65) {
      strengths.push({
        id: "reception-solid",
        title: "Recepción sólida",
        category: "Recepción",
        importance: importanceFromScore(recEff),
        confidence: clamp(70 + recTotal, 0, 99),
        evidence: {
          metrics: [
            { label: "Eficiencia", value: `${round(recEff, 1)}%` },
            { label: "# + +", value: `${round(recPositivity, 1)}%` },
            { label: "Total", value: String(recTotal) },
          ],
        },
        conclusion: "Base K1 confiable, permite armado ofensivo variado.",
      });
    } else if (recEff < 45) {
      weaknesses.push({
        id: "reception-weak",
        title: "Recepción inestable bajo saque presionado",
        category: "Recepción",
        importance: "alta",
        impact: "muy_alta",
        confidence: clamp(70 + recTotal, 0, 99),
        evidence: {
          metrics: [
            { label: "Eficiencia", value: `${round(recEff, 1)}%` },
            { label: "# + +", value: `${round(recPositivity, 1)}%` },
            { label: "≠ (punto rival)", value: String(reception.reduce((a, r) => a + r.overpass, 0)) },
          ],
        },
        consequence: "Compromete el juego rápido y facilita el bloqueo rival.",
        conclusion: "Priorizar recepción con desplazamiento y saques flotados en el próximo entrenamiento.",
      });
    }
  }

  // Saque
  const serveDelta = serveAces - serveErrors;
  if (serveDelta >= 3) {
    strengths.push({
      id: "serve-agressive",
      title: "Saque agresivo con saldo positivo",
      category: "Saque",
      importance: "media",
      confidence: 85,
      evidence: {
        metrics: [
          { label: "Aces", value: String(serveAces) },
          { label: "Errores", value: String(serveErrors) },
          { label: "Saldo", value: `${serveDelta >= 0 ? "+" : ""}${serveDelta}` },
        ],
      },
      conclusion: "Aporta puntos gratis y rompe la recepción rival.",
    });
  } else if (serveErrors >= 6 && serveErrors > serveAces * 2) {
    weaknesses.push({
      id: "serve-errors",
      title: "Exceso de errores de saque",
      category: "Saque",
      importance: "alta",
      impact: "alta",
      confidence: 90,
      evidence: {
        metrics: [
          { label: "Errores", value: String(serveErrors) },
          { label: "Aces", value: String(serveAces) },
        ],
      },
      consequence: "Regala puntos y reduce la presión sobre la recepción rival.",
      conclusion: "Reducir riesgo en momentos clave (finales de set y cambios de saque).",
    });
  }

  // Bloqueo
  if (teamStat.block >= 5) {
    strengths.push({
      id: "block-wall",
      title: "Bloqueo eficaz",
      category: "Bloqueo",
      importance: "media",
      confidence: 80,
      evidence: {
        metrics: [
          { label: "Puntos de bloqueo", value: String(teamStat.block) },
          { label: "Errores", value: String(teamStat.blockErrors) },
        ],
      },
      conclusion: "Cambio de saque frecuente y freno al ataque rival.",
    });
  }

  // Distribución de ataque por zona
  const attacks = buildEnrichedAttacks(match).filter((a) => a.side === side);
  const zoneCounts = new Map<OriginZone, { count: number; points: number; errors: number }>();
  for (const z of ORIGIN_ZONES) zoneCounts.set(z, { count: 0, points: 0, errors: 0 });
  for (const a of attacks) {
    if (!a.origin) continue;
    const b = zoneCounts.get(a.origin)!;
    b.count++;
    if (a.result === "positive") b.points++;
    else if (a.result === "negative") b.errors++;
  }
  const totalAttacksZones = attacks.filter((a) => a.origin).length;
  const attackZones: ZoneUsage[] = ORIGIN_ZONES.map((z) => {
    const b = zoneCounts.get(z)!;
    return {
      zone: z,
      label: zoneLabel(z),
      count: b.count,
      pct: round(pct(b.count, totalAttacksZones), 1),
      points: b.points,
      errors: b.errors,
      eff: round(pct(b.points, b.count), 1),
    };
  });
  const topZone = [...attackZones].sort((a, b) => b.count - a.count)[0];
  if (topZone && topZone.pct >= 45) {
    weaknesses.push({
      id: "attack-dependency",
      title: `Dependencia ofensiva de ${topZone.label}`,
      category: "Distribución",
      importance: "alta",
      impact: "alta",
      confidence: 88,
      evidence: {
        metrics: [
          { label: "Ataques por zona", value: `${topZone.pct}%` },
          { label: "Puntos", value: String(topZone.points) },
          { label: "Errores", value: String(topZone.errors) },
        ],
      },
      consequence: "Rivales con buen bloqueo pueden neutralizar gran parte del ataque.",
      conclusion: "Aumentar el volumen por centrales y zaguero para diversificar.",
    });
  }

  // Rotaciones críticas
  for (const rs of rotationStats) {
    const buckets = (side === "A" ? rs.A : rs.B).buckets;
    for (const b of buckets) {
      const played = b.pf + b.pc;
      const delta = b.pf - b.pc;
      if (played < 4) continue;
      if (delta <= -3) {
        weaknesses.push({
          id: `rot-${rs.setNumber}-${b.rotation}`,
          title: `Rotación ${b.rotation} negativa (Set ${rs.setNumber})`,
          category: "Rotación",
          importance: "media",
          impact: "media",
          confidence: 82,
          evidence: {
            metrics: [
              { label: "PF", value: String(b.pf) },
              { label: "PC", value: String(b.pc) },
              { label: "Δ", value: String(delta) },
            ],
          },
          consequence: "Se pierde ventaja o se cede momento del set en esa rotación.",
          conclusion: "Revisar side-out y ubicación defensiva en esa rotación.",
        });
      } else if (delta >= 3) {
        strengths.push({
          id: `rot-${rs.setNumber}-${b.rotation}-plus`,
          title: `Rotación ${b.rotation} dominante (Set ${rs.setNumber})`,
          category: "Rotación",
          importance: "media",
          confidence: 80,
          evidence: {
            metrics: [
              { label: "PF", value: String(b.pf) },
              { label: "PC", value: String(b.pc) },
              { label: "Δ", value: `+${delta}` },
            ],
          },
          conclusion: "Rotación de referencia para cerrar sets.",
        });
      }
    }
  }

  strengths.sort((a, b) => IMP_RANK[b.importance] - IMP_RANK[a.importance]);
  weaknesses.sort((a, b) => IMP_RANK[b.impact] - IMP_RANK[a.impact]);

  // ---- Prioridades ----
  const priorities: Priority[] = weaknesses.slice(0, 5).map((w) => ({
    id: w.id,
    level: w.impact,
    title: w.title,
    reason: w.consequence,
  }));

  // ---- Plan de entrenamiento ----
  const plan = buildTrainingPlan(weaknesses);

  // ---- Riesgos ----
  const risks: Risk[] = [];
  const attackByPlayer = teamPlayers
    .filter((p) => p.attack + p.attackError >= 3)
    .sort((a, b) => b.attack + b.attackError - (a.attack + a.attackError));
  const topAttackerLoad = attackByPlayer[0];
  const totalAtkAttempts = teamPlayers.reduce((a, p) => a + p.attack + p.attackError, 0);
  if (topAttackerLoad && totalAtkAttempts > 0) {
    const load = pct(topAttackerLoad.attack + topAttackerLoad.attackError, totalAtkAttempts);
    if (load >= 40) {
      risks.push({
        title: `Dependencia ofensiva de #${topAttackerLoad.number}`,
        detail: `${round(load, 1)}% del volumen ofensivo pasa por ${topAttackerLoad.name}.`,
        level: "alta",
      });
    }
  }
  const centrals = teamPlayers.filter((p) => playerById.get(p.playerId)?.position === "central");
  const centralAttacks = centrals.reduce((a, p) => a + p.attack + p.attackError, 0);
  if (totalAtkAttempts > 20 && pct(centralAttacks, totalAtkAttempts) < 12) {
    risks.push({
      title: "Baja participación de centrales",
      detail: `Solo ${round(pct(centralAttacks, totalAtkAttempts), 1)}% del ataque pasa por centrales.`,
      level: "media",
    });
  }
  if (unforced / Math.max(totalPointsFor, 1) >= 0.35) {
    risks.push({
      title: "Muchos errores propios en momentos decisivos",
      detail: `${unforced} errores no forzados sobre ${totalPointsFor} puntos anotados.`,
      level: "muy_alta",
    });
  }
  if (recEff < 45 && recTotal >= 10) {
    risks.push({
      title: "Recepción inestable ante saques fuertes",
      detail: `Eficiencia de ${round(recEff, 1)}% deja al armador sin opciones rápidas.`,
      level: "alta",
    });
  }

  // ---- Predicciones ----
  const predictions: Prediction[] = [];
  if (topZone && topZone.pct >= 45) {
    predictions.push({
      premise: `Si se mantiene el ${topZone.pct}% de ataques por ${topZone.label}...`,
      outcome: "los próximos rivales tenderán a doblar bloqueo sobre esa zona.",
    });
  }
  if (serveErrors >= 6) {
    predictions.push({
      premise: "Si se reducen los errores de saque a la mitad...",
      outcome: "el equipo ganaría entre 3 y 5 puntos adicionales por partido según la tendencia actual.",
    });
  }
  if (rotationScore < 45) {
    predictions.push({
      premise: "Si no se resuelven las rotaciones deficitarias...",
      outcome: "el equipo seguirá perdiendo tramos clave de los sets aunque el resto de fundamentos mejore.",
    });
  }

  // ---- Preguntas para el entrenador ----
  const coachQuestions: string[] = [];
  if (centralAttacks / Math.max(totalAtkAttempts, 1) < 0.15) coachQuestions.push("¿Por qué los centrales recibieron tan pocos armados?");
  if (recEff < 55 && recTotal >= 10) coachQuestions.push("¿La baja recepción fue causada por el saque rival o por errores propios?");
  if (rotationScore < 50) coachQuestions.push("¿Conviene modificar la rotación inicial para el próximo partido?");
  if (topAttackerLoad && pct(topAttackerLoad.attack + topAttackerLoad.attackError, totalAtkAttempts) >= 40)
    coachQuestions.push(`¿Cómo repartir la carga ofensiva de #${topAttackerLoad.number} sin perder eficacia?`);
  if (serveErrors > serveAces * 2 && serveErrors >= 5) coachQuestions.push("¿Estamos arriesgando demasiado en el saque en momentos decisivos?");

  // ---- Recomendaciones ----
  const recommendations: Recommendation[] = [];
  weaknesses.slice(0, 2).forEach((w) => recommendations.push({ horizon: "inmediata", text: `${w.title}: ${w.conclusion}` }));
  if (rotationScore < 50) recommendations.push({ horizon: "mediano_plazo", text: "Trabajar variantes de rotación inicial y responsabilidades de defensa por zona." });
  if (recEff < 55) recommendations.push({ horizon: "mediano_plazo", text: "Bloques de recepción bajo presión (saques flotados/potentes) al menos dos veces por semana." });
  recommendations.push({ horizon: "estrategica", text: "Consolidar identidad ofensiva balanceando puntas, centrales y zagueros para reducir dependencia de una sola zona." });

  // ---- Radar comparativo entre jugadoras (top 5) ----
  const playerRadar = teamPlayers
    .slice()
    .sort((a, b) => mvpScore(b) - mvpScore(a))
    .slice(0, 5)
    .map((p) => {
      const attempts = p.attack + p.attackError;
      const recStat = reception.find((r) => r.playerId === p.playerId);
      return {
        name: `#${p.number} ${(p.name || "").split(" ")[0]}`,
        attack: round(clamp(pct(p.attack, attempts) * 1.4)),
        block: round(clamp(p.block * 15)),
        ace: round(clamp(p.ace * 20)),
        reception: round(recStat ? clamp(recStat.efficiency) : 0),
        discipline: round(clamp(100 - p.unforcedError * 15 - p.attackError * 8)),
      };
    });

  // ---- Comparación vs promedio propio (últimos partidos) ----
  const comparison = buildSeasonComparison({
    teamId,
    match,
    history,
    current: {
      attackEff: round(attackEff, 1),
      recEff: round(recEff, 1),
      aces: serveAces,
      serveErrors,
      blocks: teamStat.block,
      unforced,
    },
  });

  // ---- Dashboard ----
  const scoreline = `${setsFor}–${setsAgainst} (${match.sets.map((s) => (side === "A" ? `${s.scoreA}-${s.scoreB}` : `${s.scoreB}-${s.scoreA}`)).join(" · ")})`;
  const gender = matchGender(match, teamById);

  const dashboard: DashboardData = {
    scoreline,
    result,
    opponent: opponentName,
    date: new Date(match.scheduledAt).toLocaleDateString(),
    competition: gender ? `Categoría ${gender === "F" ? "Femenina" : "Masculina"}` : undefined,
    durationMin,
    rallyIndex: overall,
    topStrength: strengths[0]?.title ?? "Rendimiento parejo entre fundamentos",
    topWeakness: weaknesses[0]?.title ?? "Sin debilidades destacadas",
    awards: {
      mvp: mvp && asAward(mvp, `${mvp.attack} atk · ${mvp.block} blk · ${mvp.ace} ace`),
      bestAttacker: bestAttacker && asAward(bestAttacker, `${round(pct(bestAttacker.attack, bestAttacker.attack + bestAttacker.attackError), 1)}% eficacia`),
      bestReceiver: asReceptionAward(bestReceiver, bestReceiver ? `${round(bestReceiver.efficiency, 1)}% eficiencia` : ""),
      bestServer: bestServer && asAward(bestServer, `${bestServer.ace} aces / ${bestServer.serveError} err`),
      mostEfficient: mostEfficient && asAward(mostEfficient, `${mostEfficient.attack + mostEfficient.block + mostEfficient.ace} puntos, ${mostEfficient.unforcedError} err`),
    },
  };

  // ---- Deltas de temporada por fundamento (usando comparison ya calculado) ----
  const findRow = (needle: string) => comparison.rows.find((r) => r.metric.toLowerCase().includes(needle));
  const atkRow = findRow("ataque");
  const recRow = findRow("recepción");
  const aceRow = findRow("aces");
  const seRow = findRow("saque");
  const blkRow = findRow("bloqueo");
  const applyDelta = (key: string, delta?: number) => {
    if (delta === undefined) return;
    const item = breakdown.find((b) => b.key === key);
    if (!item) return;
    item.seasonDelta = round(delta, 1);
    item.trend = trendFromDelta(delta);
  };
  applyDelta("attack", atkRow?.delta);
  applyDelta("reception", recRow?.delta);
  applyDelta("serve", (aceRow?.delta ?? 0) - (seRow?.delta ?? 0));
  applyDelta("block", blkRow?.delta);

  // ---- Impact breakdown (pareto simple) ----
  const IMPACT_COLORS: Record<string, string> = {
    attack: "#6366f1", reception: "#10b981", k1: "#14b8a6", k2: "#f59e0b",
    serve: "#ef4444", block: "#8b5cf6", defense: "#0ea5e9", transition: "#a855f7",
    regularity: "#64748b", discipline: "#f43f5e",
  };
  // Impacto ponderado por peso base y por qué tan lejos está del ideal (100).
  const impactRaw = breakdown.map((b) => ({
    key: b.key,
    label: b.label,
    weight: (b.impact ?? 5) * (result === "victoria" ? (b.score / 100) : ((100 - b.score) / 100)),
  }));
  const impactSum = impactRaw.reduce((a, r) => a + r.weight, 0) || 1;
  const impactBreakdown: ImpactSlice[] = impactRaw
    .map((r) => ({ key: r.key, label: r.label, impact: round((r.weight / impactSum) * 100, 1), color: IMPACT_COLORS[r.key] ?? "#94a3b8" }))
    .sort((a, b) => b.impact - a.impact);

  // ---- Radar comparativo team vs rival vs temporada ----
  const oppAttackEffScore = clamp(oppAttackEff * 1.2);
  const oppServeScore = clamp(50 + (oppStat.ace - oppStat.serveErrors) * 6);
  const oppBlockScore = clamp(40 + oppStat.block * 6 - oppStat.blockErrors * 4);
  const oppUnforced = oppStat.unforcedErrors + oppStat.attackErrors + oppStat.blockErrors + oppStat.serveErrors;
  const oppDiscipline = clamp(100 - (oppUnforced / Math.max(oppStat.total, 1)) * 60);
  const oppDefense = clamp(40 + oppStat.counterAttack * 4 + oppStat.block * 3 - teamStat.attack * 0.5);
  const seasonAvgFor = (key: "attack" | "reception" | "serve" | "block") => {
    const it = breakdown.find((b) => b.key === key);
    if (!it) return 0;
    return clamp(round(it.score - (it.seasonDelta ?? 0)));
  };
  const radarCompare: MatchAnalysis["radarCompare"] = [
    { axis: "Ataque",     equipo: breakdown.find((b) => b.key === "attack")!.score,     rival: round(oppAttackEffScore), temporada: seasonAvgFor("attack") },
    { axis: "Recepción",  equipo: breakdown.find((b) => b.key === "reception")!.score,  rival: 50, temporada: seasonAvgFor("reception") },
    { axis: "Saque",      equipo: breakdown.find((b) => b.key === "serve")!.score,      rival: round(oppServeScore), temporada: seasonAvgFor("serve") },
    { axis: "Bloqueo",    equipo: breakdown.find((b) => b.key === "block")!.score,      rival: round(oppBlockScore), temporada: seasonAvgFor("block") },
    { axis: "Defensa",    equipo: breakdown.find((b) => b.key === "defense")!.score,    rival: round(oppDefense), temporada: breakdown.find((b) => b.key === "defense")!.score },
    { axis: "Disciplina", equipo: breakdown.find((b) => b.key === "discipline")!.score, rival: round(oppDiscipline), temporada: breakdown.find((b) => b.key === "discipline")!.score },
  ];

  // ---- Timeline ----
  const timeline = buildTimeline(match, side);

  // ---- Coach insights (rule-based) ----
  const topWkn = weaknesses[0];
  const topStr = strengths[0];
  const worstFund = [...breakdown].sort((a, b) => a.score - b.score)[0];
  const bestFund = [...breakdown].sort((a, b) => b.score - a.score)[0];
  const coachInsights: CoachInsights = {
    whyResult:
      result === "victoria"
        ? `Ganamos apoyados en ${bestFund.label.toLowerCase()} (${bestFund.score}/100)${topStr ? ` y en ${topStr.title.toLowerCase()}` : ""}, con un índice global de ${overall}/100.`
        : result === "derrota"
        ? `Perdimos principalmente por ${worstFund.label.toLowerCase()} (${worstFund.score}/100)${topWkn ? `, expresado en ${topWkn.title.toLowerCase()}` : ""}. El índice global fue ${overall}/100.`
        : `Partido parejo (índice ${overall}/100). El desenlace se explica por la falta de diferencias claras en fundamentos clave.`,
    keyDecisionThatWorked: topStr ? `${topStr.title} — ${topStr.conclusion}` : "Sin decisiones tácticas decisivas identificadas.",
    decisionToReconsider: topWkn ? `${topWkn.title} — ${topWkn.conclusion}` : "Sin decisiones tácticas negativas identificadas.",
    fundamentalDrivingResult: impactBreakdown[0] ? `${impactBreakdown[0].label} (${impactBreakdown[0].impact}% del impacto)` : "Sin patrón dominante",
  };

  // ---- Resumen del analista (fallback previo a la IA) ----
  const analystSummary = buildAnalystSummary({
    teamName, opponentName, result, overall, breakdown, topStr, topWkn, worstFund, bestFund,
  });

  return {
    version: 1,
    matchId: match.id,
    side,
    teamName,
    opponentName,
    dashboard,
    analystSummary,
    rallyIndex,
    strengths,
    weaknesses,
    setTrends: setScores,
    attackZones,
    playerRadar,
    priorities,
    trainingPlan: plan,
    risks,
    predictions,
    coachQuestions,
    recommendations,
    comparison,
    impactBreakdown,
    radarCompare,
    timeline,
    coachInsights,
  };
}

function statusFromScore(s: number): IndexStatus {
  if (s >= 80) return "excellent";
  if (s >= 65) return "good";
  if (s >= 50) return "regular";
  if (s >= 35) return "low";
  return "critical";
}

function buildTimeline(match: Match, side: "A" | "B"): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const s of match.sets) {
    const setEvents = match.events
      .filter((e) => "setNumber" in e && e.setNumber === s.number)
      .sort((a, b) => a.timestamp - b.timestamp);
    let scoreFor = 0, scoreAgainst = 0;
    let run: { who: "us" | "them"; length: number; startFor: number; startAgainst: number } | null = null;
    let lastLeader: "us" | "them" | "tie" = "tie";
    for (const ev of setEvents) {
      if (!("scoringSide" in ev)) {
        if ("kind" in ev && ev.kind === "timeout" && ev.side === side) {
          out.push({
            setNumber: s.number, scoreFor, scoreAgainst,
            kind: "timeout", title: `Tiempo muerto propio`,
            detail: `Set ${s.number} · ${scoreFor}-${scoreAgainst}`,
          });
        }
        continue;
      }
      const who: "us" | "them" = (ev.scoringSide === side) ? "us" : "them";
      if (who === "us") scoreFor++; else scoreAgainst++;
      // rachas
      if (!run || run.who !== who) {
        if (run && run.length >= 3) {
          out.push({
            setNumber: s.number, scoreFor: run.startFor, scoreAgainst: run.startAgainst,
            kind: run.who === "us" ? "run" : "opp_run",
            title: run.who === "us" ? `Racha propia +${run.length}` : `Racha rival +${run.length}`,
            detail: `Set ${s.number} · cerró en ${scoreFor}-${scoreAgainst}`,
          });
        }
        run = { who, length: 1, startFor: scoreFor - (who === "us" ? 1 : 0), startAgainst: scoreAgainst - (who === "them" ? 1 : 0) };
      } else {
        run.length++;
      }
      // cambios de liderazgo
      const leader: "us" | "them" | "tie" = scoreFor > scoreAgainst ? "us" : scoreAgainst > scoreFor ? "them" : "tie";
      if (leader !== "tie" && lastLeader !== "tie" && leader !== lastLeader) {
        out.push({
          setNumber: s.number, scoreFor, scoreAgainst, kind: "lead_change",
          title: leader === "us" ? "Recuperamos la ventaja" : "El rival tomó ventaja",
          detail: `Set ${s.number} · ${scoreFor}-${scoreAgainst}`,
        });
      }
      lastLeader = leader;
    }
    if (run && run.length >= 3) {
      out.push({
        setNumber: s.number, scoreFor: run.startFor, scoreAgainst: run.startAgainst,
        kind: run.who === "us" ? "run" : "opp_run",
        title: run.who === "us" ? `Racha propia +${run.length}` : `Racha rival +${run.length}`,
        detail: `Set ${s.number} · cerró en ${scoreFor}-${scoreAgainst}`,
      });
    }
  }
  return out.slice(0, 20);
}

function buildAnalystSummary(input: {
  teamName: string;
  opponentName: string;
  result: "victoria" | "derrota" | "empate";
  overall: number;
  breakdown: RallyIndexItem[];
  topStr?: StrengthCard;
  topWkn?: WeaknessCard;
  worstFund: RallyIndexItem;
  bestFund: RallyIndexItem;
}): string {
  const { teamName, opponentName, result, overall, topStr, topWkn, worstFund, bestFund } = input;
  const verbo = result === "victoria" ? "ganó" : result === "derrota" ? "perdió" : "empató";
  const l1 = `${teamName} ${verbo} frente a ${opponentName} con un índice Rally global de ${overall}/100.`;
  const l2 = result === "derrota"
    ? `El resultado se explica principalmente por ${worstFund.label.toLowerCase()} (${worstFund.score}/100)${topWkn ? `, expresado en ${topWkn.title.toLowerCase()}` : ""}.`
    : result === "victoria"
    ? `La victoria se apoyó en ${bestFund.label.toLowerCase()} (${bestFund.score}/100)${topStr ? ` y en ${topStr.title.toLowerCase()}` : ""}.`
    : `No hubo diferencias claras entre los fundamentos de ambos equipos.`;
  const l3 = topWkn
    ? `Como contracara, ${topWkn.title.toLowerCase()} limitó la construcción del juego y condicionó el rendimiento en varios tramos.`
    : `El rendimiento fue parejo entre fundamentos, sin debilidades marcadas.`;
  return [l1, l2, l3].join(" ");
}

// ---------------- Helpers privados ----------------

const IMP_RANK: Record<Importance, number> = { baja: 1, media: 2, alta: 3, muy_alta: 4 };

function emptyTeam(teamId: string): TeamStat {
  return {
    teamId,
    attack: 0, rotationAttack: 0, counterAttack: 0, block: 0, ace: 0,
    opponentErrors: 0, total: 0, unforcedErrors: 0, serveErrors: 0, attackErrors: 0, blockErrors: 0,
  };
}

function enrichPlayer(p: PlayerStat, playerById: Map<string, Player>): PlayerStat {
  if (p.name && p.number) return p;
  const meta = playerById.get(p.playerId);
  return { ...p, name: meta?.name ?? p.name, number: meta?.number ?? p.number };
}

function zoneLabel(z: OriginZone): string {
  const labels: Record<OriginZone, string> = { 4: "Zona 4", 3: "Zona 3", 2: "Zona 2", 5: "Zaguero 5", 6: "Pipe (Z6)", 1: "Zaguero 1" };
  return labels[z];
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function buildTrainingPlan(weaknesses: WeaknessCard[]): TrainingPlan {
  const blocks: TrainingBlock[] = [];
  const seen = new Set<string>();

  for (const w of weaknesses.slice(0, 4)) {
    const cat = w.category.toLowerCase();
    let block: TrainingBlock | null = null;
    if (cat.includes("recep")) block = { minutes: 20, focus: "Recepción bajo presión", drills: ["Recepción con desplazamiento", "Series contra saque flotado", "Recepción + K1"], reason: w.title };
    else if (cat.includes("saque")) block = { minutes: 15, focus: "Saque táctico", drills: ["Saque a zona 5-6", "Saltos flotados con blancos", "Rutinas bajo presión"], reason: w.title };
    else if (cat.includes("ataque")) block = { minutes: 20, focus: "Ataque diversificado", drills: ["Combinaciones centrales", "Pipe y zaguero", "Ataque contra doble bloqueo"], reason: w.title };
    else if (cat.includes("distribuc")) block = { minutes: 20, focus: "Distribución del armador", drills: ["Balón medio a Z3/Z2", "Rápidos con central", "Combinaciones cortas"], reason: w.title };
    else if (cat.includes("rotac")) block = { minutes: 20, focus: "Ajuste de rotaciones", drills: ["Situaciones simuladas por rotación", "Cambios rápidos", "Estudio de video corto"], reason: w.title };
    else if (cat.includes("bloqueo")) block = { minutes: 15, focus: "Bloqueo y responsabilidades", drills: ["Lectura del armador", "Doble bloqueo", "Cierre de línea"], reason: w.title };
    if (block && !seen.has(block.focus)) {
      blocks.push(block);
      seen.add(block.focus);
    }
  }
  if (blocks.length < 3) {
    if (!seen.has("Juego reducido")) blocks.push({ minutes: 20, focus: "Juego reducido", drills: ["6vs6 con consignas", "Situaciones set 5", "Contra-ataque continuo"], reason: "Integración táctica" });
  }
  const totalMinutes = blocks.reduce((a, b) => a + b.minutes, 0);
  return { totalMinutes, blocks };
}

function buildSeasonComparison(input: {
  teamId: string;
  match: Match;
  history: Match[];
  current: { attackEff: number; recEff: number; aces: number; serveErrors: number; blocks: number; unforced: number };
}): MatchAnalysis["comparison"] {
  const prev = input.history
    .filter((m) => (m.teamAId === input.teamId || m.teamBId === input.teamId) && m.id !== input.match.id && m.status === "finished")
    .sort((a, b) => b.scheduledAt - a.scheduledAt)
    .slice(0, 5);

  if (prev.length === 0) {
    return { label: "Sin partidos previos para comparar", rows: [] };
  }

  let atkEffSum = 0, recEffSum = 0, acesSum = 0, seSum = 0, blkSum = 0, unfSum = 0;
  for (const m of prev) {
    const s = m.teamAId === input.teamId ? "A" : "B";
    const { teams } = computeMatchStats(m);
    const t = teams.get(input.teamId);
    if (!t) continue;
    atkEffSum += pct(t.attack, t.attack + t.attackErrors);
    const rec = [...computeReceptionStats(m.events, s).values()];
    const total = rec.reduce((a, r) => a + r.total, 0);
    const w = rec.reduce((a, r) => a + r.doublePositive * 4 + r.positive * 3 + r.neutral * 2 + r.negative * 1 + r.doubleNegative * 0 + r.overpass * -1, 0);
    recEffSum += total > 0 ? (w / (total * 4)) * 100 : 0;
    acesSum += t.ace;
    seSum += t.serveErrors;
    blkSum += t.block;
    unfSum += t.unforcedErrors + t.attackErrors + t.blockErrors + t.serveErrors;
  }
  const n = prev.length;
  const avg = {
    attackEff: atkEffSum / n,
    recEff: recEffSum / n,
    aces: acesSum / n,
    serveErrors: seSum / n,
    blocks: blkSum / n,
    unforced: unfSum / n,
  };
  const row = (metric: string, current: number, reference: number) => {
    const delta = round(current - reference, 1);
    return { metric, current: round(current, 1), reference: round(reference, 1), delta, trend: trendFromDelta(delta) };
  };
  return {
    label: `Promedio últimos ${n} partidos`,
    rows: [
      row("Eficacia ataque (%)", input.current.attackEff, avg.attackEff),
      row("Eficiencia recepción (%)", input.current.recEff, avg.recEff),
      row("Aces", input.current.aces, avg.aces),
      row("Errores de saque", input.current.serveErrors, avg.serveErrors),
      row("Bloqueos", input.current.blocks, avg.blocks),
      row("Errores no forzados", input.current.unforced, avg.unforced),
    ],
  };
}
