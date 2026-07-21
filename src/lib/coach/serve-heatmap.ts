// Motor de datos para el Mapa de Calor de Saque (Rally Live Stats).
// Todo cliente. Reglas deterministas sobre los eventos ya cargados.
//
// Nota sobre "zona del saque": el flujo actual no registra explícitamente la
// zona donde cae el saque. Se deriva de la posición 1..6 en cancha de la
// jugadora que recibió (índice del onCourt del lado receptor). Esta es
// exactamente la zona donde aterriza la pelota, que es lo que el entrenador
// necesita visualizar. Aces y errores de saque no tienen zona atribuida y se
// contabilizan aparte a nivel equipo.

import type {
  Match, MatchEvent, PointEvent, ReceptionEvent, Team, Player,
} from "@/lib/volley-store";

export type Side = "A" | "B";
export type ServeZone = 1 | 2 | 3 | 4 | 5 | 6;
export const SERVE_ZONES: ServeZone[] = [4, 3, 2, 5, 6, 1];
export const SERVE_ZONE_LABEL: Record<ServeZone, string> = {
  1: "Z1", 2: "Z2", 3: "Z3", 4: "Z4", 5: "Z5", 6: "Z6",
};

export type ReceptionRating = ReceptionEvent["rating"];

/** Un saque enriquecido con contexto de rotación y receptor. */
export interface EnrichedServe {
  id: string;
  timestamp: number;
  setNumber: number;
  serverSide: Side;
  serverId: string | null;
  serverRotation: number; // 1..6 del equipo sacador
  receiverSide: Side;
  receiverId: string | null;
  receiverRotation: number; // 1..6 del equipo receptor
  zone: ServeZone | null; // posición 1..6 del receptor = zona donde cae
  rating: ReceptionRating | null; // null si ace o error sin recepción
  outcome: "ace" | "error" | "in_play";
}

interface SideState {
  onCourt: string[];
  rotation: number; // 1..6
  libero: { liberoId: string; replacedId: string } | null;
}

function rotateClockwise(arr: string[]): string[] {
  return [arr[1], arr[2], arr[3], arr[4], arr[5], arr[0]];
}

// Debe coincidir EXACTAMENTE con volley-store.ts: el líbero cubre a la central
// en toda la zaga (Z1/Z6/Z5) y sale al rotar a primera línea (Z2/Z3/Z4).
// Índices oficiales en `onCourt`: 0=Z1, 1=Z2, 2=Z3, 3=Z4, 4=Z5, 5=Z6.
const LIBERO_EXIT_INDEXES = new Set([1, 2, 3]);

/**
 * Replay ligero. Reproduce onCourt y rotación por lado con las MISMAS reglas
 * que `replayMatch` en volley-store (subs, líbero manual + auto-out por
 * rotación, lineupOverride, rotación en cambio de saque). Así el destino del
 * saque se calcula sobre la formación efectiva idéntica a la que se ve en la
 * cancha en ese instante — nunca la posición nominal, ni el rol, ni la
 * formación inicial.
 */
export function buildEnrichedServes(match: Match): EnrichedServe[] {
  const events = [...match.events].sort((a, b) => a.timestamp - b.timestamp);
  const lineupFor = (setNum: number, side: Side): string[] =>
    match.lineupsBySet?.[setNum]?.[side] ?? (side === "A" ? match.startingLineupA : match.startingLineupB);

  let currentSet = 1;
  const stA: SideState = { onCourt: [...lineupFor(1, "A")], rotation: 1, libero: null };
  const stB: SideState = { onCourt: [...lineupFor(1, "B")], rotation: 1, libero: null };
  let servingSide: Side = match.initialServingSide;

  const out: EnrichedServe[] = [];
  const pendingServe: Record<Side, { serverId: string | null; serverRot: number; timestamp: number } | null> = {
    A: null, B: null,
  };

  const autoOutIfExit = (side: Side) => {
    const st = side === "A" ? stA : stB;
    if (!st.libero) return;
    const idx = st.onCourt.indexOf(st.libero.liberoId);
    if (LIBERO_EXIT_INDEXES.has(idx)) {
      const replaced = st.libero.replacedId;
      st.onCourt = st.onCourt.map((p, i) => (i === idx ? replaced : p));
      st.libero = null;
    }
  };

  const resetForSet = (setNum: number) => {
    if (setNum === currentSet) return;
    currentSet = setNum;
    stA.onCourt = [...lineupFor(setNum, "A")];
    stB.onCourt = [...lineupFor(setNum, "B")];
    stA.rotation = 1;
    stB.rotation = 1;
    stA.libero = null;
    stB.libero = null;
    servingSide = setNum % 2 === 1 ? match.initialServingSide : (match.initialServingSide === "A" ? "B" : "A");
    pendingServe.A = null;
    pendingServe.B = null;
  };

  const beginPendingServe = () => {
    const s = servingSide;
    const state = s === "A" ? stA : stB;
    pendingServe[s] = {
      serverId: state.onCourt[0] ?? null,
      serverRot: state.rotation,
      timestamp: Date.now(),
    };
  };

  beginPendingServe();

  for (const ev of events) {
    if (!("setNumber" in ev)) continue;
    resetForSet(ev.setNumber);

    if ("kind" in ev) {
      if (ev.kind === "sub") {
        const st = ev.side === "A" ? stA : stB;
        st.onCourt = st.onCourt.map((p) => (p === ev.playerOutId ? ev.playerInId : p));
        autoOutIfExit(ev.side);
      } else if (ev.kind === "libero") {
        const st = ev.side === "A" ? stA : stB;
        if (ev.action === "in") {
          st.onCourt = st.onCourt.map((p) => (p === ev.replacedId ? ev.liberoId : p));
          st.libero = { liberoId: ev.liberoId, replacedId: ev.replacedId };
        } else {
          st.onCourt = st.onCourt.map((p) => (p === ev.liberoId ? ev.replacedId : p));
          st.libero = null;
        }
        autoOutIfExit(ev.side);
      } else if (ev.kind === "lineupOverride") {
        const st = ev.side === "A" ? stA : stB;
        st.onCourt = [...ev.lineup];
        st.libero = null;
        autoOutIfExit(ev.side);
      } else if (ev.kind === "reception") {
        const rec = ev as ReceptionEvent;
        const receiverSide = rec.side;
        const serverSide: Side = receiverSide === "A" ? "B" : "A";
        const rxState = receiverSide === "A" ? stA : stB;
        const idx = rxState.onCourt.indexOf(rec.playerId);
        const zone: ServeZone | null = idx >= 0 ? ((idx + 1) as ServeZone) : null;
        const srvState = serverSide === "A" ? stA : stB;
        const pending = pendingServe[serverSide];
        const outcome: EnrichedServe["outcome"] = rec.rating === "overpass" ? "ace" : "in_play";
        const serverId = pending?.serverId ?? srvState.onCourt[0] ?? null;

        // Log de depuración (solo dev): sacador, receptor y zona efectiva.
        if (
          typeof window !== "undefined" &&
          (import.meta as { env?: { DEV?: boolean } }).env?.DEV
        ) {
          // eslint-disable-next-line no-console
          console.debug(
            `[serve-heatmap] Sacador=${serverId ?? "?"} Receptor=${rec.playerId} ` +
              `PosEnCancha=${zone ? `Z${zone}` : "?"} ZonaMapa=${zone ? `Z${zone}` : "?"} ` +
              `Resultado=${zone ? "Correcto" : "SIN_POSICION"} ` +
              `onCourt=[${rxState.onCourt.join(",")}]`,
          );
          if (zone === null) {
            // eslint-disable-next-line no-console
            console.warn(
              `[serve-heatmap] Receptor ${rec.playerId} NO está en onCourt del lado ` +
                `${receiverSide}. Zona sin registrar. Revisar libero/subs previos.`,
            );
          }
        }

        out.push({
          id: rec.id,
          timestamp: rec.timestamp,
          setNumber: rec.setNumber,
          serverSide,
          serverId,
          serverRotation: pending?.serverRot ?? srvState.rotation,
          receiverSide,
          receiverId: rec.playerId,
          receiverRotation: rxState.rotation,
          zone,
          rating: rec.rating,
          outcome,
        });
      }
      continue;
    }

    const pe = ev as PointEvent;

    if (pe.type === "ace" || pe.type === "serve_error") {
      const serverSide: Side = pe.playerSide as Side;
      const receiverSide: Side = serverSide === "A" ? "B" : "A";
      const srvState = serverSide === "A" ? stA : stB;
      const rxState = receiverSide === "A" ? stA : stB;
      const pending = pendingServe[serverSide];
      const dup = out.find(
        (s) => Math.abs(s.timestamp - pe.timestamp) < 1500 &&
               s.serverSide === serverSide &&
               s.outcome === "ace",
      );
      if (!dup) {
        out.push({
          id: pe.id,
          timestamp: pe.timestamp,
          setNumber: pe.setNumber,
          serverSide,
          serverId: pe.playerId ?? pending?.serverId ?? srvState.onCourt[0] ?? null,
          serverRotation: pending?.serverRot ?? srvState.rotation,
          receiverSide,
          receiverId: null,
          receiverRotation: rxState.rotation,
          zone: null,
          rating: null,
          outcome: pe.type === "ace" ? "ace" : "error",
        });
      }
    }

    const winner = pe.scoringSide as Side;
    if (winner !== servingSide) {
      const st = winner === "A" ? stA : stB;
      st.onCourt = rotateClockwise(st.onCourt);
      st.rotation = (st.rotation % 6) + 1;
      servingSide = winner;
    }
    autoOutIfExit("A");
    autoOutIfExit("B");
    beginPendingServe();
  }
  return out;
}

// ─────────────────────────────────────────────────────────
// Filtros y agregación

export interface ServeFilters {
  setNumber?: number | "all";
  serverRotation?: number | "all";
  receiverRotation?: number | "all";
  serverId?: string | "all";
  receiverId?: string | "all";
  outcome?: "all" | "ace" | "error" | "in_play";
  zone?: ServeZone | "all";
  rating?: ReceptionRating | "all";
}

function passesFilters(s: EnrichedServe, f: ServeFilters): boolean {
  if (f.setNumber !== undefined && f.setNumber !== "all" && s.setNumber !== f.setNumber) return false;
  if (f.serverRotation !== undefined && f.serverRotation !== "all" && s.serverRotation !== f.serverRotation) return false;
  if (f.receiverRotation !== undefined && f.receiverRotation !== "all" && s.receiverRotation !== f.receiverRotation) return false;
  if (f.serverId !== undefined && f.serverId !== "all" && s.serverId !== f.serverId) return false;
  if (f.receiverId !== undefined && f.receiverId !== "all" && s.receiverId !== f.receiverId) return false;
  if (f.outcome !== undefined && f.outcome !== "all" && s.outcome !== f.outcome) return false;
  if (f.zone !== undefined && f.zone !== "all" && s.zone !== f.zone) return false;
  if (f.rating !== undefined && f.rating !== "all" && s.rating !== f.rating) return false;
  return true;
}

export interface ZoneStats {
  zone: ServeZone;
  count: number;
  pct: number;
  aces: number;
  errors: number;
  positives: number; // # + +
  perfects: number;  // #
  negatives: number; // - = ≠
  efficacy: number;  // (aces + positives - errors - negatives) / count  * 100
}

export interface ReceiverStats {
  playerId: string;
  count: number;
  perfect: number;
  positive: number;
  neutral: number;
  negative: number;
  errors: number; // overpass
  quality: number; // 0..100
}

export interface ServerStats {
  playerId: string;
  count: number;
  aces: number;
  errors: number;
  efficacy: number;
}

export interface SideAnalytics {
  side: Side;
  total: number;
  aces: number;
  errors: number;
  inPlay: number;
  efficacy: number;
  zones: Record<ServeZone, ZoneStats>;
  topZone: ServeZone | null;
  bestEfficacyZone: ServeZone | null;
  mostAcesZone: ServeZone | null;
  mostErrorsZone: ServeZone | null;
  bestReceptionZone: ServeZone | null;   // rival recibe mejor
  worstReceptionZone: ServeZone | null;  // rival recibe peor (mayor daño)
  receivers: ReceiverStats[];
  servers: ServerStats[];
  topTarget: ReceiverStats | null;
  avoidedPlayer: ReceiverStats | null;
  topServer: ServerStats | null;
}

function emptyZoneStats(z: ServeZone): ZoneStats {
  return { zone: z, count: 0, pct: 0, aces: 0, errors: 0, positives: 0, perfects: 0, negatives: 0, efficacy: 0 };
}

function computeSideAnalytics(
  serves: EnrichedServe[], serverSide: Side, receiverTeam: Team,
): SideAnalytics {
  const filtered = serves.filter((s) => s.serverSide === serverSide);
  const zones: Record<ServeZone, ZoneStats> = {} as Record<ServeZone, ZoneStats>;
  SERVE_ZONES.forEach((z) => (zones[z] = emptyZoneStats(z)));

  const receiverAcc = new Map<string, ReceiverStats>();
  const serverAcc = new Map<string, ServerStats>();

  let total = 0, aces = 0, errors = 0, inPlay = 0;
  for (const s of filtered) {
    total++;
    if (s.outcome === "ace") aces++;
    else if (s.outcome === "error") errors++;
    else inPlay++;

    if (s.zone) {
      const b = zones[s.zone];
      b.count++;
      if (s.outcome === "ace") b.aces++;
      if (s.outcome === "error") b.errors++;
      if (s.rating === "double_positive") { b.perfects++; b.positives++; }
      else if (s.rating === "positive") b.positives++;
      else if (s.rating === "negative" || s.rating === "double_negative") b.negatives++;
      else if (s.rating === "overpass") b.aces++;
    }

    if (s.receiverId) {
      const acc = receiverAcc.get(s.receiverId) ?? {
        playerId: s.receiverId, count: 0, perfect: 0, positive: 0, neutral: 0, negative: 0, errors: 0, quality: 0,
      };
      acc.count++;
      switch (s.rating) {
        case "double_positive": acc.perfect++; break;
        case "positive": acc.positive++; break;
        case "neutral": acc.neutral++; break;
        case "negative": acc.negative++; break;
        case "double_negative": acc.negative++; break;
        case "overpass": acc.errors++; break;
      }
      receiverAcc.set(s.receiverId, acc);
    }
    if (s.serverId) {
      const acc = serverAcc.get(s.serverId) ?? { playerId: s.serverId, count: 0, aces: 0, errors: 0, efficacy: 0 };
      acc.count++;
      if (s.outcome === "ace") acc.aces++;
      if (s.outcome === "error") acc.errors++;
      serverAcc.set(s.serverId, acc);
    }
  }

  for (const z of SERVE_ZONES) {
    const b = zones[z];
    b.pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
    b.efficacy = b.count > 0
      ? Math.round(((b.aces + b.positives - b.errors - b.negatives) / b.count) * 100)
      : 0;
  }

  const receivers = [...receiverAcc.values()].map((r) => {
    // quality: perfect=100, positive=75, neutral=50, negative=20, overpass=0
    const score = r.perfect * 100 + r.positive * 75 + r.neutral * 50 + r.negative * 20;
    const q = r.count > 0 ? Math.round(score / r.count) : 0;
    return { ...r, quality: q };
  }).sort((a, b) => b.count - a.count);

  const servers = [...serverAcc.values()].map((s) => ({
    ...s,
    efficacy: s.count > 0 ? Math.round(((s.aces - s.errors) / s.count) * 100) : 0,
  })).sort((a, b) => b.aces - a.aces);

  // Zonas destacadas
  const zonesArr = SERVE_ZONES.map((z) => zones[z]);
  const bestReceptionZone = zonesArr.filter((z) => z.count > 0).sort((a, b) => b.efficacy - a.efficacy).at(-1)?.zone ?? null;
  const worstReceptionZone = zonesArr.filter((z) => z.count > 0).sort((a, b) => b.efficacy - a.efficacy)[0]?.zone ?? null;

  const rosterIds = new Set(receiverTeam.players.map((p) => p.id));
  const rosterReceivers = receivers.filter((r) => rosterIds.has(r.playerId));

  return {
    side: serverSide,
    total, aces, errors, inPlay,
    efficacy: total > 0 ? Math.round(((aces - errors) / total) * 100) : 0,
    zones,
    topZone: [...zonesArr].sort((a, b) => b.count - a.count)[0]?.count ? [...zonesArr].sort((a, b) => b.count - a.count)[0].zone : null,
    bestEfficacyZone: [...zonesArr].filter((z) => z.count > 0).sort((a, b) => b.efficacy - a.efficacy)[0]?.zone ?? null,
    mostAcesZone: [...zonesArr].sort((a, b) => b.aces - a.aces)[0]?.aces ? [...zonesArr].sort((a, b) => b.aces - a.aces)[0].zone : null,
    mostErrorsZone: [...zonesArr].sort((a, b) => b.errors - a.errors)[0]?.errors ? [...zonesArr].sort((a, b) => b.errors - a.errors)[0].zone : null,
    bestReceptionZone,
    worstReceptionZone,
    receivers: rosterReceivers,
    servers,
    topTarget: rosterReceivers[0] ?? null,
    avoidedPlayer: findAvoidedPlayer(rosterReceivers, receiverTeam),
    topServer: servers[0] ?? null,
  };
}

function findAvoidedPlayer(receivers: ReceiverStats[], team: Team): ReceiverStats | null {
  // Jugadora del roster receptor con MENOR volumen (excluyendo quienes nunca están en cancha).
  const inPlay = team.players.filter((p) => receivers.some((r) => r.playerId === p.id));
  if (inPlay.length === 0) return null;
  const list = inPlay.map((p) => receivers.find((r) => r.playerId === p.id)!);
  return list.sort((a, b) => a.count - b.count)[0];
}

// ─────────────────────────────────────────────────────────
// Patrones (IA determinista)

export interface ServePattern {
  id: string;
  side: Side; // lado que saca
  title: string;
  detail: string;
  impact: "high" | "med" | "low";
}

function playerName(team: Team, id: string): string {
  const p = team.players.find((x) => x.id === id);
  return p ? `#${p.number} ${p.name}` : "Jugadora";
}

function isLibero(team: Team, id: string): boolean {
  return team.players.find((p) => p.id === id)?.position === "libero";
}

export function detectServePatterns(
  serves: EnrichedServe[], teamA: Team, teamB: Team,
): ServePattern[] {
  const patterns: ServePattern[] = [];

  for (const serverSide of ["A", "B"] as Side[]) {
    const receiverTeam = serverSide === "A" ? teamB : teamA;
    const sideServes = serves.filter((s) => s.serverSide === serverSide && s.receiverId);
    if (sideServes.length < 5) continue;

    // 1) Concentración en una receptora (>40%)
    const byReceiver = new Map<string, number>();
    for (const s of sideServes) byReceiver.set(s.receiverId!, (byReceiver.get(s.receiverId!) ?? 0) + 1);
    const [topRxId, topRxCount] = [...byReceiver.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (topRxId && topRxCount / sideServes.length >= 0.4) {
      patterns.push({
        id: `${serverSide}-target-${topRxId}`,
        side: serverSide,
        title: `Busca constantemente a ${playerName(receiverTeam, topRxId)}`,
        detail: `${Math.round((topRxCount / sideServes.length) * 100)}% de los saques dirigidos a esta receptora (${topRxCount}/${sideServes.length}).`,
        impact: "high",
      });
    }

    // 2) Evasión del líbero
    const liberos = receiverTeam.players.filter((p) => p.position === "libero").map((p) => p.id);
    if (liberos.length > 0) {
      const libServes = sideServes.filter((s) => liberos.includes(s.receiverId!)).length;
      const libRatio = libServes / sideServes.length;
      if (libRatio < 0.1 && sideServes.length >= 8) {
        patterns.push({
          id: `${serverSide}-avoid-libero`,
          side: serverSide,
          title: "Evita al líbero",
          detail: `Sólo ${Math.round(libRatio * 100)}% de los saques van al líbero (${libServes}/${sideServes.length}).`,
          impact: "med",
        });
      }
    }

    // 3) Dominancia diagonal (Z1 o Z5 muy usadas)
    const zoneCounts: Record<number, number> = {};
    for (const s of sideServes) if (s.zone) zoneCounts[s.zone] = (zoneCounts[s.zone] ?? 0) + 1;
    const diagonal = (zoneCounts[1] ?? 0) + (zoneCounts[5] ?? 0);
    if (diagonal / sideServes.length >= 0.55) {
      patterns.push({
        id: `${serverSide}-diagonal`,
        side: serverSide,
        title: "Busca la diagonal",
        detail: `${Math.round((diagonal / sideServes.length) * 100)}% de los saques a Z1/Z5.`,
        impact: "med",
      });
    }

    // 4) Cambio de objetivo por rotación (varianza alta entre rotaciones)
    const byRotTarget = new Map<number, Map<string, number>>();
    for (const s of sideServes) {
      if (!byRotTarget.has(s.serverRotation)) byRotTarget.set(s.serverRotation, new Map());
      const m = byRotTarget.get(s.serverRotation)!;
      m.set(s.receiverId!, (m.get(s.receiverId!) ?? 0) + 1);
    }
    const rotTops: string[] = [];
    byRotTarget.forEach((m, rot) => {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      if (total < 3) return;
      const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / total >= 0.6) rotTops.push(`R${rot}→${playerName(receiverTeam, top[0])}`);
    });
    if (rotTops.length >= 2) {
      patterns.push({
        id: `${serverSide}-rot-shift`,
        side: serverSide,
        title: "Cambia de objetivo según la rotación",
        detail: rotTops.slice(0, 3).join(" · "),
        impact: "med",
      });
    }

    // 5) Modifica el saque en puntos importantes (24+ o iguales)
    const critical = sideServes.filter((_, idx) => idx >= sideServes.length - 5);
    if (critical.length >= 3) {
      const critZones: Record<number, number> = {};
      for (const s of critical) if (s.zone) critZones[s.zone] = (critZones[s.zone] ?? 0) + 1;
      const globalTop = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const critTop = Object.entries(critZones).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (globalTop && critTop && globalTop !== critTop) {
        patterns.push({
          id: `${serverSide}-clutch-shift`,
          side: serverSide,
          title: "Modifica el saque en puntos importantes",
          detail: `En los últimos saques prioriza Z${critTop} (vs Z${globalTop} habitual).`,
          impact: "low",
        });
      }
    }
  }
  return patterns;
}

// ─────────────────────────────────────────────────────────
// Predicción de próximo saque (Markov de orden 1 sobre el sacador actual)

export interface ServePrediction {
  serverSide: Side;
  zone: ServeZone | null;
  zoneConfidence: number; // 0..100
  targetPlayerId: string | null;
  targetConfidence: number; // 0..100
  explanation: string;
}

export function predictNextServe(
  serves: EnrichedServe[], currentServerSide: Side, currentServerId: string | null,
  receiverTeam: Team,
): ServePrediction | null {
  const own = serves.filter((s) => s.serverSide === currentServerSide);
  if (own.length < 3) return null;
  const byServer = currentServerId ? own.filter((s) => s.serverId === currentServerId) : own;
  const source = byServer.length >= 3 ? byServer : own;

  const zoneCounts: Record<number, number> = {};
  const targetCounts: Record<string, number> = {};
  for (const s of source) {
    if (s.zone) zoneCounts[s.zone] = (zoneCounts[s.zone] ?? 0) + 1;
    if (s.receiverId) targetCounts[s.receiverId] = (targetCounts[s.receiverId] ?? 0) + 1;
  }
  const zoneTotal = Object.values(zoneCounts).reduce((a, b) => a + b, 0);
  const tgtTotal = Object.values(targetCounts).reduce((a, b) => a + b, 0);
  const topZone = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])[0];
  const topTgt = Object.entries(targetCounts).sort((a, b) => b[1] - a[1])[0];

  const zone = topZone ? (Number(topZone[0]) as ServeZone) : null;
  const zoneConfidence = topZone && zoneTotal > 0 ? Math.round((topZone[1] / zoneTotal) * 100) : 0;
  const targetPlayerId = topTgt ? topTgt[0] : null;
  const targetConfidence = topTgt && tgtTotal > 0 ? Math.round((topTgt[1] / tgtTotal) * 100) : 0;

  const parts: string[] = [];
  if (byServer.length >= 3 && currentServerId) parts.push("Basado en el historial del sacador actual.");
  else parts.push("Basado en el patrón global del equipo sacador.");
  if (targetPlayerId) parts.push(`Receptora frecuente: ${playerName(receiverTeam, targetPlayerId)}.`);
  return {
    serverSide: currentServerSide,
    zone, zoneConfidence, targetPlayerId, targetConfidence,
    explanation: parts.join(" "),
  };
}

// ─────────────────────────────────────────────────────────
// Recomendaciones tácticas

export interface ServeRecommendation {
  id: string;
  side: Side; // lado al que la recomendación beneficia
  title: string;
  detail: string;
  impact: "high" | "med" | "low";
}

export function buildServeRecommendations(
  analytics: { A: SideAnalytics; B: SideAnalytics },
  patterns: ServePattern[],
  teamA: Team, teamB: Team,
): ServeRecommendation[] {
  const recs: ServeRecommendation[] = [];

  // Para cada lado receptor: reaccionar a los patrones del sacador contrario.
  for (const receiverSide of ["A", "B"] as Side[]) {
    const serverSide: Side = receiverSide === "A" ? "B" : "A";
    const receiverTeam = receiverSide === "A" ? teamA : teamB;
    const sideAnalytics = analytics[serverSide];

    // Concentración en una receptora → reforzar esa zona
    const targetPattern = patterns.find((p) => p.side === serverSide && p.id.startsWith(`${serverSide}-target-`));
    if (targetPattern && sideAnalytics.topTarget) {
      recs.push({
        id: `${receiverSide}-support-${sideAnalytics.topTarget.playerId}`,
        side: receiverSide,
        title: `Reforzar recepción sobre ${playerName(receiverTeam, sideAnalytics.topTarget.playerId)}`,
        detail: "Movilizar al líbero o dar cobertura para descargarla.",
        impact: "high",
      });
    }

    // Zona con peor eficacia → cambio de formación
    if (sideAnalytics.worstReceptionZone && sideAnalytics.zones[sideAnalytics.worstReceptionZone].count >= 3) {
      recs.push({
        id: `${receiverSide}-cover-z${sideAnalytics.worstReceptionZone}`,
        side: receiverSide,
        title: `Ajustar formación en Z${sideAnalytics.worstReceptionZone}`,
        detail: `El rival genera daño con saques a esta zona (${sideAnalytics.zones[sideAnalytics.worstReceptionZone].pct}%, eficacia ${sideAnalytics.zones[sideAnalytics.worstReceptionZone].efficacy}%).`,
        impact: "med",
      });
    }

    // Diagonal detectada → mover líbero hacia la zona atacada
    const diagPattern = patterns.find((p) => p.id === `${serverSide}-diagonal`);
    if (diagPattern) {
      recs.push({
        id: `${receiverSide}-libero-diagonal`,
        side: receiverSide,
        title: "Mover al líbero hacia la diagonal",
        detail: "El rival concentra el saque en Z1/Z5. Redistribuir la formación de recepción.",
        impact: "med",
      });
    }

    // Recomendación para el lado que saca: mantener presión en zona más efectiva
    const own = analytics[receiverSide];
    if (own.bestEfficacyZone && own.zones[own.bestEfficacyZone].count >= 3) {
      recs.push({
        id: `${receiverSide}-press-${own.bestEfficacyZone}`,
        side: receiverSide,
        title: `Mantener presión en Z${own.bestEfficacyZone}`,
        detail: `Tu mejor zona de saque tiene ${own.zones[own.bestEfficacyZone].efficacy}% de eficacia. Continuar buscándola.`,
        impact: "med",
      });
    }
  }
  return recs.slice(0, 8);
}

// ─────────────────────────────────────────────────────────
// API pública principal

export interface ServeAnalytics {
  serves: EnrichedServe[];
  A: SideAnalytics;
  B: SideAnalytics;
  patterns: ServePattern[];
  prediction: ServePrediction | null;
  recommendations: ServeRecommendation[];
}

export function computeServeAnalytics(
  match: Match, teamA: Team, teamB: Team, filters: ServeFilters = {},
): ServeAnalytics {
  const all = buildEnrichedServes(match);
  const filtered = all.filter((s) => passesFilters(s, filters));
  const A = computeSideAnalytics(filtered, "A", teamB);
  const B = computeSideAnalytics(filtered, "B", teamA);
  const patterns = detectServePatterns(filtered, teamA, teamB);
  const recommendations = buildServeRecommendations({ A, B }, patterns, teamA, teamB);

  // Predicción: usar todos los saques (sin filtros) para próxima decisión real.
  const currentServerSide = all.length > 0 ? all[all.length - 1].serverSide : "A";
  const currentServerId = all.length > 0 ? all[all.length - 1].serverId : null;
  const receiverTeam = currentServerSide === "A" ? teamB : teamA;
  const prediction = predictNextServe(all, currentServerSide, currentServerId, receiverTeam);

  return { serves: filtered, A, B, patterns, prediction, recommendations };
}

// Utilidades exportadas para el UI
export function findPlayer(team: Team, id: string | null): Player | undefined {
  if (!id) return undefined;
  return team.players.find((p) => p.id === id);
}
