/**
 * Utilities to translate match events (from the client volley-store)
 * into video timeline marks (t_ms relative to the video start).
 *
 * Formula:
 *   t_ms(event) = (event.timestamp - firstEventTs) + sync_offset_ms
 *
 * `firstEventTs` is the timestamp of the earliest event of the match,
 * which is what the user aligns the video to via "Marcar primer saque".
 */
import type { Match, MatchEvent, Team } from "@/lib/volley-store";

export type VideoMarkKind =
  | "serve"
  | "reception"
  | "attack"
  | "block"
  | "defense"
  | "error"
  | "point"
  | "timeout"
  | "sub"
  | "sanction"
  | "other";

export interface VideoMark {
  id: string;
  tMs: number;
  setNumber: number;
  kind: VideoMarkKind;
  fundamento: string;
  side: "A" | "B" | null;
  playerId: string | null;
  playerNumber: number | null;
  playerName: string | null;
  team: string | null;
  zone: number | null;
  result: string | null;
  score: string; // "12-10"
  rotation: number | null; // rotation of team A at that moment (1..6)
  event: MatchEvent;
}

export const MARK_COLORS: Record<VideoMarkKind, string> = {
  serve: "#22c55e",
  reception: "#38bdf8",
  attack: "#f97316",
  block: "#a855f7",
  defense: "#eab308",
  error: "#ef4444",
  point: "#f43f5e",
  timeout: "#94a3b8",
  sub: "#64748b",
  sanction: "#f87171",
  other: "#94a3b8",
};

export const MARK_LABEL: Record<VideoMarkKind, string> = {
  serve: "Saque",
  reception: "Recepción",
  attack: "Ataque",
  block: "Bloqueo",
  defense: "Defensa",
  error: "Error",
  point: "Punto",
  timeout: "Timeout",
  sub: "Cambio",
  sanction: "Sanción",
  other: "Otro",
};

function playerLookup(teamA: Team | undefined, teamB: Team | undefined) {
  const map = new Map<string, { number: number | null; name: string | null; team: string }>();
  const push = (t: Team | undefined) => {
    if (!t) return;
    for (const p of t.players) {
      map.set(p.id, { number: p.number ?? null, name: p.name, team: t.name });
    }
  };
  push(teamA);
  push(teamB);
  return map;
}

function classifyPoint(kind: MatchEvent extends { kind: infer K } ? K : never, ev: MatchEvent): { markKind: VideoMarkKind; fundamento: string; result: string } {
  if (ev.kind !== "point") return { markKind: "other", fundamento: "-", result: "-" };
  const t = ev.type;
  const map: Record<string, { k: VideoMarkKind; f: string; r: string }> = {
    ace: { k: "serve", f: "Saque", r: "Ace" },
    service_error: { k: "error", f: "Saque", r: "Error de saque" },
    reception_error: { k: "error", f: "Recepción", r: "Error de recepción" },
    rotation_attack: { k: "attack", f: "Ataque rotación", r: "Punto" },
    counter_attack: { k: "attack", f: "Contraataque", r: "Punto" },
    attack: { k: "attack", f: "Ataque", r: "Punto" },
    attack_error: { k: "error", f: "Ataque", r: "Error de ataque" },
    block: { k: "block", f: "Bloqueo", r: "Punto" },
    block_error: { k: "error", f: "Bloqueo", r: "Error de bloqueo" },
    dig: { k: "defense", f: "Defensa", r: "Punto" },
    unforced_error: { k: "error", f: "No forzado", r: "Error no forzado" },
    opponent_error: { k: "point", f: "Rival", r: "Error del rival" },
    penalty: { k: "sanction", f: "Sanción", r: "Punto por sanción" },
  };
  const m = map[String(t)] ?? { k: "point" as VideoMarkKind, f: "Punto", r: String(t) };
  return { markKind: m.k, fundamento: m.f, result: m.r };
}

/** Score progression up to (but not including) each event. */
function buildScoreMap(match: Match): Map<string, { a: number; b: number; setNumber: number }> {
  const map = new Map<string, { a: number; b: number; setNumber: number }>();
  const perSet = new Map<number, { a: number; b: number }>();
  for (const ev of match.events) {
    const s = perSet.get(ev.setNumber) ?? { a: 0, b: 0 };
    map.set(ev.id, { a: s.a, b: s.b, setNumber: ev.setNumber });
    if (ev.kind === "point") {
      if (ev.scoringSide === "A") s.a += 1;
      else s.b += 1;
    }
    perSet.set(ev.setNumber, s);
  }
  return map;
}

export function buildVideoMarks(
  match: Match,
  teamA: Team | undefined,
  teamB: Team | undefined,
  syncOffsetMs: number,
): VideoMark[] {
  if (!match.events.length) return [];
  const firstTs = match.events[0]!.timestamp;
  const players = playerLookup(teamA, teamB);
  const scoreMap = buildScoreMap(match);
  const marks: VideoMark[] = [];

  for (const ev of match.events) {
    const tMs = (ev.timestamp - firstTs) + syncOffsetMs;
    const base = {
      id: ev.id,
      tMs,
      setNumber: ev.setNumber,
      event: ev,
      score: (() => {
        const s = scoreMap.get(ev.id);
        return s ? `${s.a}-${s.b}` : "0-0";
      })(),
      rotation: null as number | null,
    };
    const pid = (ev as { playerId?: string | null }).playerId ?? null;
    const side = (ev as { side?: "A" | "B" | null }).side ?? null;
    const p = pid ? players.get(pid) : null;
    const common = {
      side,
      playerId: pid,
      playerNumber: p?.number ?? null,
      playerName: p?.name ?? null,
      team: p?.team ?? (side === "A" ? teamA?.name ?? null : side === "B" ? teamB?.name ?? null : null),
    };

    if (ev.kind === "point") {
      const c = classifyPoint(ev.kind, ev);
      marks.push({
        ...base,
        ...common,
        kind: c.markKind,
        fundamento: c.fundamento,
        zone: ev.attackZone ?? null,
        result: c.result,
      });
    } else if (ev.kind === "reception") {
      const RATING_LABEL: Record<string, string> = {
        double_positive: "# Doble positiva",
        positive: "+ Positiva",
        neutral: "0 Neutra",
        negative: "- Negativa",
        double_negative: "= Doble negativa",
        overpass: "≠ Punto directo",
      };
      marks.push({
        ...base,
        ...common,
        kind: "reception",
        fundamento: "Recepción",
        zone: null,
        result: RATING_LABEL[ev.rating] ?? ev.rating,
      });
    } else if (ev.kind === "attackAttempt") {
      marks.push({
        ...base,
        ...common,
        kind: "attack",
        fundamento: ev.isCounter ? "Contraataque (intento)" : "Ataque (intento)",
        zone: ev.attackZone ?? null,
        result: "Continuidad",
      });
    } else if (ev.kind === "defense") {
      marks.push({
        ...base,
        ...common,
        kind: "defense",
        fundamento: "Defensa",
        zone: null,
        result: ev.rating,
      });
    } else if (ev.kind === "setting") {
      marks.push({
        ...base,
        ...common,
        kind: "attack",
        fundamento: "Armado→Ataque",
        zone: null,
        result: ev.attackResult ?? ev.quality,
      });
    } else if (ev.kind === "timeout") {
      marks.push({
        ...base,
        ...common,
        kind: "timeout",
        fundamento: "Timeout",
        zone: null,
        result: side === "A" ? teamA?.name ?? "A" : teamB?.name ?? "B",
      });
    } else if (ev.kind === "sub") {
      marks.push({
        ...base,
        ...common,
        kind: "sub",
        fundamento: "Cambio",
        zone: null,
        result: "Sustitución",
      });
    } else if (ev.kind === "sanction") {
      marks.push({
        ...base,
        ...common,
        kind: "sanction",
        fundamento: "Sanción",
        zone: null,
        result: ev.sanction,
      });
    } else {
      marks.push({
        ...base,
        ...common,
        kind: "other",
        fundamento: ev.kind,
        zone: null,
        result: null,
      });
    }
  }

  return marks;
}

/** Rally = span between two `point` events (inclusive of end). */
export interface RallyBlock {
  index: number;
  setNumber: number;
  startMs: number;
  endMs: number;
  winnerSide: "A" | "B" | null;
  scoreAfter: string;
  markCount: number;
}

export function buildRallyBlocks(marks: VideoMark[]): RallyBlock[] {
  if (!marks.length) return [];
  const blocks: RallyBlock[] = [];
  let start = marks[0]!.tMs;
  let count = 0;
  let idx = 0;
  let currentSet = marks[0]!.setNumber;
  for (const m of marks) {
    count += 1;
    if (m.event.kind === "point") {
      blocks.push({
        index: idx++,
        setNumber: currentSet,
        startMs: start,
        endMs: m.tMs,
        winnerSide: (m.event as { scoringSide: "A" | "B" }).scoringSide,
        scoreAfter: m.score,
        markCount: count,
      });
      start = m.tMs;
      count = 0;
      currentSet = m.setNumber;
    }
  }
  return blocks;
}
