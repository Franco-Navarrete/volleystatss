import type {
  Match,
  MatchEvent,
  PointEvent,
  ReceptionEvent,
  SettingEvent,
  AttackAttemptEvent,
  DefenseEvent,
  Team,
} from "./volley-store";
import { POINT_TYPE_LABEL, DEFENSE_RATING_LABEL } from "./volley-store";

export type RallyPhase =
  | "serve"
  | "reception"
  | "setting"
  | "attack"
  | "defense"
  | "counter_attack";

export const RALLY_PHASE_LABEL: Record<RallyPhase, string> = {
  serve: "Saque",
  reception: "Recepción",
  setting: "Armado",
  attack: "Ataque",
  defense: "Defensa",
  counter_attack: "Contraataque",
};

/** Fase base (K1). Se conserva por compatibilidad con importadores viejos. */
export const RALLY_PHASES: RallyPhase[] = [
  "serve",
  "reception",
  "setting",
  "attack",
];

export interface RallyStep {
  phase: RallyPhase;
  side: "A" | "B" | null;
  playerId: string | null;
  detail: string | null;
  done: boolean;
  current: boolean;
}

export interface RallyContext {
  /** Fase actual esperada (siguiente acción a registrar). */
  currentPhase: RallyPhase;
  /** Lado al que le toca actuar. */
  currentPhaseSide: "A" | "B" | null;
  /** true si el rally acaba de terminar (último evento = punto). */
  finished: boolean;
  /** Equipo que actualmente “tiene” el balón (ataca). */
  possession: "A" | "B" | null;
  /** Ultimo evento relevante de la jugada + resumen. */
  lastActionPlayerId: string | null;
  lastActionSide: "A" | "B" | null;
  lastActionLabel: string | null;
  lastActionDetail: string | null;
  /** Descripción viva de la fase actual (para el card “Acción actual”). */
  currentActionText: string;
  currentActionPlayerId: string | null;
  currentActionSide: "A" | "B" | null;
  /** Línea temporal del rally en curso (para barra + historial). */
  steps: RallyStep[];
  /** Compat: fases K1 marcadas como "hechas" para la vieja barra. */
  done: Set<RallyPhase>;
}

function isPointEvent(ev: MatchEvent): ev is PointEvent {
  return "scoringSide" in ev;
}
function isReception(ev: MatchEvent): ev is ReceptionEvent {
  return "kind" in ev && ev.kind === "reception";
}
function isSetting(ev: MatchEvent): ev is SettingEvent {
  return "kind" in ev && ev.kind === "setting";
}
function isAttackAttempt(ev: MatchEvent): ev is AttackAttemptEvent {
  return "kind" in ev && ev.kind === "attackAttempt";
}
function isDefense(ev: MatchEvent): ev is DefenseEvent {
  return "kind" in ev && ev.kind === "defense";
}

function receptionLabel(rating: ReceptionEvent["rating"]): string {
  switch (rating) {
    case "double_positive": return "#";
    case "positive": return "+";
    case "neutral": return "0";
    case "negative": return "−";
    case "double_negative": return "=";
    case "overpass": return "≠";
  }
}

/**
 * Camino real del voleibol:
 * K1: Saque → Recepción → Armado → Ataque.
 * Continuidad: Defensa → Armado → Contraataque, repetido hasta cerrar el rally.
 */
export function computeRallyContext(
  match: Match,
  teams: { A: Team; B: Team },
): RallyContext {
  const setEvents = match.events.filter(
    (e) => "setNumber" in e && e.setNumber === match.currentSet,
  );

  let lastPointIdx = -1;
  for (let i = setEvents.length - 1; i >= 0; i--) {
    if (isPointEvent(setEvents[i])) { lastPointIdx = i; break; }
  }
  const finished = lastPointIdx === setEvents.length - 1 && lastPointIdx >= 0;
  const rallyEvents = finished ? [] : setEvents.slice(lastPointIdx + 1);

  const servingSide = match.servingSide;
  const shortA = teams.A.shortName ?? teams.A.name;
  const shortB = teams.B.shortName ?? teams.B.name;
  const short = (s: "A" | "B") => (s === "A" ? shortA : shortB);

  const steps: RallyStep[] = [];
  // Paso 1 siempre: saque del equipo sacador.
  steps.push({
    phase: "serve", side: servingSide, playerId: null,
    detail: null, done: false, current: false,
  });

  let possession: "A" | "B" | null = servingSide;
  let hasFirstAttack = false;

  for (const ev of rallyEvents) {
    if (isReception(ev)) {
      // Marca saque como hecho, agrega la recepción.
      steps.push({
        phase: "reception", side: ev.side, playerId: ev.playerId,
        detail: receptionLabel(ev.rating), done: true, current: false,
      });
      possession = ev.side;
    } else if (isSetting(ev)) {
      steps.push({
        phase: "setting", side: ev.side, playerId: ev.setterId,
        detail: ev.attackZone.toUpperCase(), done: true, current: false,
      });
      possession = ev.side;
    } else if (isAttackAttempt(ev)) {
      steps.push({
        phase: hasFirstAttack ? "counter_attack" : "attack",
        side: ev.side, playerId: ev.playerId,
        detail: ev.attackZone ? `Z${ev.attackZone}` : null,
        done: true, current: false,
      });
      possession = ev.side === "A" ? "B" : "A";
      hasFirstAttack = true;
    } else if (isDefense(ev)) {
      steps.push({
        phase: "defense", side: ev.side, playerId: ev.playerId,
        detail: DEFENSE_RATING_LABEL[ev.rating], done: true, current: false,
      });
      possession = ev.side;
    }
  }

  // Marcar el saque como hecho si hubo alguna acción posterior.
  if (steps.length > 1) steps[0].done = true;

  // Determinar próxima fase esperada (si el rally sigue abierto).
  let currentPhase: RallyPhase = "reception";
  let currentPhaseSide: "A" | "B" | null = servingSide === "A" ? "B" : "A";
  let currentActionText = `Esperando recepción · ${short(currentPhaseSide)}`;
  let currentActionPlayerId: string | null = null;
  let currentActionSide: "A" | "B" | null = currentPhaseSide;

  if (!finished) {
    const last = rallyEvents[rallyEvents.length - 1];
    if (!last) {
      // Sólo el saque.
      currentPhase = "reception";
      currentPhaseSide = servingSide === "A" ? "B" : "A";
      currentActionText = `Esperando recepción · ${short(currentPhaseSide)}`;
    } else if (isReception(last)) {
      currentPhase = "setting";
      currentPhaseSide = last.side;
      currentActionText = `Recepción ${receptionLabel(last.rating)} · esperando armado de ${short(last.side)}`;
    } else if (isSetting(last)) {
      currentPhase = hasFirstAttack ? "counter_attack" : "attack";
      currentPhaseSide = last.side;
      currentActionText = hasFirstAttack
        ? `Armado ${last.attackZone.toUpperCase()} · esperando contraataque de ${short(last.side)}`
        : `Armado ${last.attackZone.toUpperCase()} · esperando ataque de ${short(last.side)}`;
    } else if (isAttackAttempt(last)) {
      // Continuidad: rival defiende.
      const defSide: "A" | "B" = last.side === "A" ? "B" : "A";
      currentPhase = "defense";
      currentPhaseSide = defSide;
      currentActionText = `Ataque continúa · esperando defensa de ${short(defSide)}`;
    } else if (isDefense(last)) {
      currentPhase = "setting";
      currentPhaseSide = last.side;
      currentActionText = `Defensa ${DEFENSE_RATING_LABEL[last.rating]} · esperando armado de ${short(last.side)}`;
    }

    steps.push({
      phase: currentPhase,
      side: currentPhaseSide,
      playerId: null,
      detail: null,
      done: false,
      current: true,
    });
  }

  // Última acción (para el card "Última").
  const lastEv = setEvents[setEvents.length - 1] ?? null;
  let lastActionPlayerId: string | null = null;
  let lastActionSide: "A" | "B" | null = null;
  let lastActionLabel: string | null = null;
  let lastActionDetail: string | null = null;

  if (lastEv) {
    if (isPointEvent(lastEv)) {
      lastActionPlayerId = lastEv.playerId;
      lastActionSide = lastEv.playerSide;
      lastActionLabel = POINT_TYPE_LABEL[lastEv.type];
      const isPoint = lastEv.playerSide === lastEv.scoringSide;
      lastActionDetail = isPoint ? "Punto" : "Error";
      if (lastEv.attackZone) lastActionDetail = `${lastActionDetail} · Z${lastEv.attackZone}`;
    } else if (isReception(lastEv)) {
      lastActionPlayerId = lastEv.playerId;
      lastActionSide = lastEv.side;
      lastActionLabel = "Recepción";
      lastActionDetail = receptionLabel(lastEv.rating);
    } else if (isSetting(lastEv)) {
      lastActionPlayerId = lastEv.setterId;
      lastActionSide = lastEv.side;
      lastActionLabel = `Armado ${lastEv.quality}`;
      lastActionDetail = lastEv.attackZone.toUpperCase();
    } else if (isAttackAttempt(lastEv)) {
      lastActionPlayerId = lastEv.playerId;
      lastActionSide = lastEv.side;
      lastActionLabel = hasFirstAttack && rallyEvents.filter(isAttackAttempt).length > 1
        ? "Contraataque (continuidad)"
        : "Ataque (continuidad)";
      lastActionDetail = lastEv.attackZone ? `Z${lastEv.attackZone}` : null;
    } else if (isDefense(lastEv)) {
      lastActionPlayerId = lastEv.playerId;
      lastActionSide = lastEv.side;
      lastActionLabel = "Defensa";
      lastActionDetail = DEFENSE_RATING_LABEL[lastEv.rating];
    }
  }

  if (finished) {
    currentActionText = "Rally finalizado";
    currentActionPlayerId = lastActionPlayerId;
    currentActionSide = lastActionSide;
  } else {
    currentActionPlayerId = null;
    currentActionSide = currentPhaseSide;
  }

  // Compat: build `done` set con fases K1 completas.
  const done = new Set<RallyPhase>();
  for (const s of steps) if (s.done) done.add(s.phase);

  return {
    currentPhase,
    currentPhaseSide,
    finished,
    possession,
    lastActionPlayerId,
    lastActionSide,
    lastActionLabel,
    lastActionDetail,
    currentActionText,
    currentActionPlayerId,
    currentActionSide,
    steps,
    done,
  };
}
