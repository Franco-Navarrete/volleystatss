// Motor táctico para "Estadísticas en Vivo" — reglas deterministas.
// Toda la lógica opera sobre eventos ya en memoria; no llama a la IA remota.

import type {
  Match,
  MatchEvent,
  PointEvent,
  ReceptionEvent,
  Team,
  TimeoutEvent,
  SubstitutionEvent,
  AttackZone,
  PointType,
} from "@/lib/volley-store";
import { isAttackType } from "@/lib/volley-store";

export type Impact = "high" | "med" | "low";
export type Side = "A" | "B";

export interface CoachAlert {
  id: string;
  title: string;
  detail: string;
  impact: Impact;
  side: Side; // lado sobre el que impacta
  tone: "danger" | "warn" | "info";
}

export interface CoachRecommendation {
  id: string;
  title: string;
  detail: string;
  impact: Impact;
  side: Side;
}

export interface CoachPriority {
  id: string;
  title: string;
  detail: string;
  impact: Impact;
  side: Side;
}

// ─────────────────────────────────────────────────────────
// Helpers básicos

export function currentSetPoints(match: Match): PointEvent[] {
  return match.events
    .filter((e): e is PointEvent => !("kind" in e) && e.setNumber === match.currentSet)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function allEventsInCurrentSet(match: Match): MatchEvent[] {
  return match.events
    .filter((e) => "setNumber" in e && e.setNumber === match.currentSet)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function currentSetReceptions(match: Match, side: Side): ReceptionEvent[] {
  return match.events
    .filter(
      (e): e is ReceptionEvent =>
        "kind" in e &&
        e.kind === "reception" &&
        e.setNumber === match.currentSet &&
        e.side === side,
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ─────────────────────────────────────────────────────────
// Momentum

export interface MomentumPoint {
  index: number;
  scoringSide: Side;
  scoreA: number;
  scoreB: number;
  delta: number; // A - B
  type: PointType;
  timestamp: number;
}

export interface MomentumMarker {
  index: number; // se pinta después del rally #index
  kind: "timeout" | "sub";
  side: Side;
  label: string;
  timestamp: number;
}

export function computeMomentum(match: Match): {
  points: MomentumPoint[];
  markers: MomentumMarker[];
  streak: { side: Side; length: number } | null;
  last10: Side[];
  parcial: { A: number; B: number };
} {
  const points = currentSetPoints(match);
  let a = 0;
  let b = 0;
  const out: MomentumPoint[] = points.map((p, i) => {
    if (p.scoringSide === "A") a++;
    else b++;
    return {
      index: i,
      scoringSide: p.scoringSide,
      scoreA: a,
      scoreB: b,
      delta: a - b,
      type: p.type,
      timestamp: p.timestamp,
    };
  });

  // Marcadores (timeouts / subs) referenciados al índice del último punto ≤ timestamp
  const markers: MomentumMarker[] = [];
  const setEvents = allEventsInCurrentSet(match);
  for (const ev of setEvents) {
    if (!("kind" in ev)) continue;
    if (ev.kind !== "timeout" && ev.kind !== "sub") continue;
    let idx = -1;
    for (let i = points.length - 1; i >= 0; i--) {
      if (points[i].timestamp <= ev.timestamp) {
        idx = i;
        break;
      }
    }
    if (ev.kind === "timeout") {
      const t = ev as TimeoutEvent;
      markers.push({ index: idx, kind: "timeout", side: t.side, label: "TO", timestamp: t.timestamp });
    } else {
      const s = ev as SubstitutionEvent;
      markers.push({ index: idx, kind: "sub", side: s.side, label: "CAMBIO", timestamp: s.timestamp });
    }
  }

  // Racha actual
  let streak: { side: Side; length: number } | null = null;
  if (out.length > 0) {
    const last = out[out.length - 1].scoringSide;
    let n = 0;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].scoringSide === last) n++;
      else break;
    }
    streak = { side: last, length: n };
  }

  const last10Slice = out.slice(-10).map((p) => p.scoringSide);
  const parcial10 = last10Slice.reduce(
    (acc, s) => {
      if (s === "A") acc.A++;
      else acc.B++;
      return acc;
    },
    { A: 0, B: 0 },
  );

  return { points: out, markers, streak, last10: last10Slice, parcial: parcial10 };
}

// Estimación simple de probabilidad de victoria del set actual
export function winProbabilityCurrentSet(match: Match): { A: number; B: number } {
  const set = match.sets.find((s) => s.number === match.currentSet);
  if (!set) return { A: 50, B: 50 };
  const target = match.currentSet === 5 ? 15 : match.pointsPerSet;
  const diff = set.scoreA - set.scoreB;
  const leader = diff >= 0 ? set.scoreA : set.scoreB;
  const remaining = Math.max(1, target - leader);
  // sigmoide sobre diferencial ajustado por lo poco que queda del set
  const scale = Math.max(2, remaining);
  const p = 1 / (1 + Math.exp(-diff / scale));
  return { A: Math.round(p * 100), B: Math.round((1 - p) * 100) };
}

// ─────────────────────────────────────────────────────────
// Receiver map — cuántos saques recibió cada jugadora y con qué calidad

export interface ReceiverRow {
  playerId: string;
  total: number;
  doublePositive: number;
  positive: number;
  neutral: number;
  negative: number;
  doubleNegative: number;
  overpass: number;
  positivity: number; // %
}

export function receiverMap(match: Match, side: Side): ReceiverRow[] {
  const rec = currentSetReceptions(match, side);
  const map = new Map<string, ReceiverRow>();
  for (const r of rec) {
    const row =
      map.get(r.playerId) ??
      {
        playerId: r.playerId,
        total: 0,
        doublePositive: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        doubleNegative: 0,
        overpass: 0,
        positivity: 0,
      };
    row.total++;
    if (r.rating === "double_positive") row.doublePositive++;
    else if (r.rating === "positive") row.positive++;
    else if (r.rating === "neutral") row.neutral++;
    else if (r.rating === "negative") row.negative++;
    else if (r.rating === "double_negative") row.doubleNegative++;
    else if (r.rating === "overpass") row.overpass++;
    map.set(r.playerId, row);
  }
  for (const row of map.values()) {
    row.positivity = row.total > 0 ? ((row.doublePositive + row.positive) / row.total) * 100 : 0;
  }
  return [...map.values()].sort((x, y) => y.total - x.total);
}

// ─────────────────────────────────────────────────────────
// Serve heatmap (por sacador propio) — aces + errores

export interface ServerRow {
  playerId: string | null;
  attempts: number; // aces + serve_errors + inferidos (rallies iniciados sacando)
  aces: number;
  errors: number;
}

export function servePressure(match: Match, side: Side): ServerRow[] {
  const points = currentSetPoints(match);
  const map = new Map<string, ServerRow>();
  for (const p of points) {
    if (p.playerSide !== side) continue;
    if (p.type !== "ace" && p.type !== "serve_error") continue;
    const key = p.playerId ?? "unknown";
    const row = map.get(key) ?? { playerId: p.playerId, attempts: 0, aces: 0, errors: 0 };
    row.attempts++;
    if (p.type === "ace") row.aces++;
    else row.errors++;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.aces - a.aces || b.attempts - a.attempts);
}

// ─────────────────────────────────────────────────────────
// Rotaciones — parcial por rotación del set actual

export interface RotationDelta {
  rotation: number; // 1..6
  pf: number;
  pc: number;
  diff: number;
  isCurrent: boolean;
  risk: "critical" | "warn" | "ok" | "elite";
}

export function currentSetRotationDeltas(
  match: Match,
  side: Side,
): { rows: RotationDelta[]; currentRot: number } {
  const points = currentSetPoints(match);
  const initial = match.initialServingSide;
  let serving: Side =
    match.currentSet % 2 === 1 ? initial : initial === "A" ? "B" : "A";
  let rotA = 0;
  let rotB = 0;
  const buckets = Array.from({ length: 6 }, (_, i) => ({
    rotation: i + 1,
    pf: 0,
    pc: 0,
  }));
  for (const ev of points) {
    const winner = ev.scoringSide;
    const winRot = winner === "A" ? rotA : rotB;
    const losRot = winner === "A" ? rotB : rotA;
    if (winner === side) buckets[winRot].pf++;
    else buckets[losRot].pc++;
    if (winner !== serving) {
      if (winner === "A") rotA = (rotA + 1) % 6;
      else rotB = (rotB + 1) % 6;
      serving = winner;
    }
  }
  const currentRot = (side === "A" ? rotA : rotB) + 1;
  const rows: RotationDelta[] = buckets.map((b) => {
    const diff = b.pf - b.pc;
    const total = b.pf + b.pc;
    let risk: RotationDelta["risk"] = "ok";
    if (total >= 2) {
      if (diff <= -3) risk = "critical";
      else if (diff < 0) risk = "warn";
      else if (diff >= 3) risk = "elite";
    }
    return { ...b, diff, isCurrent: b.rotation === currentRot, risk };
  });
  return { rows, currentRot };
}

// ─────────────────────────────────────────────────────────
// Reglas de alerta / recomendaciones

function playerName(team: Team, playerId: string | null | undefined): string {
  if (!playerId) return "s/d";
  const p = team.players.find((x) => x.id === playerId);
  if (!p) return "s/d";
  return `#${p.number} ${p.name.split(" ")[0]}`;
}

const ZONE_LABEL: Record<AttackZone, string> = {
  4: "Zona 4",
  3: "Zona 3",
  2: "Zona 2",
  1: "Zaguero 1",
  6: "Zaguero 6",
  5: "Zaguero 5",
};

interface Ctx {
  match: Match;
  teamA: Team;
  teamB: Team;
  ownSide: Side; // el lado propio del entrenador (por defecto A)
}

export function generateInsights(ctx: Ctx): {
  alerts: CoachAlert[];
  recommendations: CoachRecommendation[];
  priorities: CoachPriority[];
} {
  const { match, teamA, teamB, ownSide } = ctx;
  const rivalSide: Side = ownSide === "A" ? "B" : "A";
  const rivalTeam = rivalSide === "A" ? teamA : teamB;
  const ownTeam = ownSide === "A" ? teamA : teamB;

  const alerts: CoachAlert[] = [];
  const recs: CoachRecommendation[] = [];

  const momentum = computeMomentum(match);

  // 1. Racha rival
  if (momentum.streak && momentum.streak.side === rivalSide && momentum.streak.length >= 3) {
    alerts.push({
      id: "racha-rival",
      title: `Racha rival: ${momentum.streak.length} puntos consecutivos`,
      detail: "El rival está encadenando puntos. Cortá el ritmo.",
      impact: momentum.streak.length >= 4 ? "high" : "med",
      side: ownSide,
      tone: "danger",
    });
    recs.push({
      id: "pedir-timeout",
      title: "Pedir timeout técnico",
      detail: "Frená el momentum antes de que el parcial se dispare.",
      impact: "high",
      side: ownSide,
    });
  }

  // 2. Rotación crítica actual
  const rot = currentSetRotationDeltas(match, ownSide);
  const currRow = rot.rows.find((r) => r.isCurrent);
  if (currRow && currRow.risk === "critical") {
    alerts.push({
      id: `rot-critica-R${currRow.rotation}`,
      title: `Rotación R${currRow.rotation} en pérdida (${currRow.diff})`,
      detail: `Parcial actual ${currRow.pf}-${currRow.pc} en R${currRow.rotation}.`,
      impact: "high",
      side: ownSide,
      tone: "danger",
    });
    recs.push({
      id: `rec-rot-${currRow.rotation}`,
      title: `Reforzar R${currRow.rotation}`,
      detail: "Evaluá un cambio ofensivo o mover la recepción.",
      impact: "high",
      side: ownSide,
    });
  }

  // 3. Recepción cayendo por jugadora propia
  const myReceivers = receiverMap(match, ownSide);
  for (const r of myReceivers) {
    if (r.total >= 3 && r.positivity < 40) {
      alerts.push({
        id: `rec-baja-${r.playerId}`,
        title: `Recepción baja: ${playerName(ownTeam, r.playerId)}`,
        detail: `${r.total} recepciones, positividad ${r.positivity.toFixed(0)}%.`,
        impact: r.total >= 5 ? "high" : "med",
        side: ownSide,
        tone: "warn",
      });
      recs.push({
        id: `rec-cambio-form-${r.playerId}`,
        title: `Cubrir a ${playerName(ownTeam, r.playerId)}`,
        detail: "Modificá la formación de recepción o pedí apoyo del líbero.",
        impact: "med",
        side: ownSide,
      });
      break;
    }
  }

  // 4. Rival dirigiendo saques (últimas N recepciones a la misma jugadora)
  const recentRecs = myReceivers.length
    ? currentSetReceptions(match, ownSide).slice(-5)
    : [];
  if (recentRecs.length >= 3) {
    const targetId = recentRecs[recentRecs.length - 1].playerId;
    const streak = recentRecs.filter((r) => r.playerId === targetId).length;
    if (streak >= 3) {
      alerts.push({
        id: `saque-dirigido-${targetId}`,
        title: `Rival dirige el saque a ${playerName(ownTeam, targetId)}`,
        detail: `${streak} de los últimos ${recentRecs.length} saques van a ella.`,
        impact: "med",
        side: ownSide,
        tone: "warn",
      });
    }
  }

  // 5. Zona de ataque saturada (propia)
  const attackEvents = currentSetPoints(match).filter(
    (p) =>
      p.playerSide === ownSide &&
      (isAttackType(p.type) || p.type === "attack_error") &&
      p.attackZone !== undefined,
  );
  if (attackEvents.length >= 3) {
    const last = attackEvents.slice(-4);
    const zones = new Set(last.map((p) => p.attackZone));
    if (zones.size === 1 && last.length >= 3) {
      const z = last[0].attackZone!;
      alerts.push({
        id: `zona-saturada-${z}`,
        title: `${last.length} ataques seguidos por ${ZONE_LABEL[z]}`,
        detail: "El rival ya te está leyendo. Variá la distribución.",
        impact: "med",
        side: ownSide,
        tone: "warn",
      });
      recs.push({
        id: `variar-zona-${z}`,
        title: "Variar distribución del armado",
        detail: `Buscá salidas por zonas distintas a ${ZONE_LABEL[z]}.`,
        impact: "med",
        side: ownSide,
      });
    }
  }

  // 6. Ataque rival saturado por una zona
  const rivalAttacks = currentSetPoints(match).filter(
    (p) =>
      p.playerSide === rivalSide &&
      isAttackType(p.type) &&
      p.attackZone !== undefined,
  );
  if (rivalAttacks.length >= 4) {
    const last = rivalAttacks.slice(-4);
    const zones = new Set(last.map((p) => p.attackZone));
    if (zones.size === 1) {
      const z = last[0].attackZone!;
      alerts.push({
        id: `rival-zona-${z}`,
        title: `Rival atacando por ${ZONE_LABEL[z]}`,
        detail: `Sus últimos ${last.length} ataques salieron por ahí.`,
        impact: "med",
        side: ownSide,
        tone: "info",
      });
      recs.push({
        id: `bloqueo-zona-${z}`,
        title: `Cerrar bloqueo sobre ${ZONE_LABEL[z]}`,
        detail: `Ajustá la doble sobre ${rivalTeam.shortName} en ${ZONE_LABEL[z]}.`,
        impact: "med",
        side: ownSide,
      });
    }
  }

  // 7. Errores no forzados propios en el set
  const unf = currentSetPoints(match).filter(
    (p) => p.playerSide === ownSide && (p.type === "unforced_error" || p.type === "attack_error" || p.type === "serve_error"),
  );
  if (unf.length >= 4) {
    alerts.push({
      id: "errores-propios",
      title: `${unf.length} errores propios en el set`,
      detail: "Estás regalando puntos. Bajá el riesgo.",
      impact: unf.length >= 6 ? "high" : "med",
      side: ownSide,
      tone: "warn",
    });
    recs.push({
      id: "bajar-riesgo",
      title: "Bajar riesgo en saque y ataque",
      detail: "Priorizá poner la pelota; recuperá el ritmo.",
      impact: "med",
      side: ownSide,
    });
  }

  // Limitar a 3 alertas y 3 recomendaciones por impacto
  const impactRank: Record<Impact, number> = { high: 3, med: 2, low: 1 };
  alerts.sort((a, b) => impactRank[b.impact] - impactRank[a.impact]);
  recs.sort((a, b) => impactRank[b.impact] - impactRank[a.impact]);

  const priorities: CoachPriority[] = alerts.slice(0, 3).map((a) => ({
    id: `pri-${a.id}`,
    title: a.title,
    detail: a.detail,
    impact: a.impact,
    side: a.side,
  }));

  return {
    alerts: alerts.slice(0, 3),
    recommendations: recs.slice(0, 3),
    priorities,
  };
}

// ─────────────────────────────────────────────────────────
// Timeline compacto del set actual

export interface TimelineItem {
  id: string;
  timestamp: number;
  scoreA?: number;
  scoreB?: number;
  side: Side;
  kind:
    | "ace"
    | "block"
    | "attack"
    | "error"
    | "timeout"
    | "sub"
    | "decisive";
  label: string;
}

export function computeTimeline(match: Match): TimelineItem[] {
  const items: TimelineItem[] = [];
  const points = currentSetPoints(match);
  let a = 0;
  let b = 0;
  for (const p of points) {
    if (p.scoringSide === "A") a++;
    else b++;
    let kind: TimelineItem["kind"] = "attack";
    let label = "Punto";
    if (p.type === "ace") { kind = "ace"; label = "Ace"; }
    else if (p.type === "block") { kind = "block"; label = "Bloqueo"; }
    else if (p.type === "attack" || p.type === "counter_attack" || p.type === "rotation_attack") { kind = "attack"; label = "Ataque"; }
    else if (["serve_error", "unforced_error", "attack_error", "block_error", "rotation_error", "opponent_error", "opponent_rotation_error"].includes(p.type)) {
      kind = "error"; label = "Error";
    }
    const isDecisive = Math.max(a, b) >= (match.currentSet === 5 ? 14 : match.pointsPerSet - 1);
    items.push({
      id: p.id,
      timestamp: p.timestamp,
      scoreA: a,
      scoreB: b,
      side: p.scoringSide,
      kind: isDecisive ? "decisive" : kind,
      label,
    });
  }
  for (const ev of allEventsInCurrentSet(match)) {
    if (!("kind" in ev)) continue;
    if (ev.kind === "timeout") {
      items.push({ id: ev.id, timestamp: ev.timestamp, side: ev.side, kind: "timeout", label: "Timeout" });
    } else if (ev.kind === "sub") {
      items.push({ id: ev.id, timestamp: ev.timestamp, side: ev.side, kind: "sub", label: "Cambio" });
    }
  }
  return items.sort((a, b) => a.timestamp - b.timestamp);
}
