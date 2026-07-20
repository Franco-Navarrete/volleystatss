import type {
  Match,
  MatchEvent,
  PointEvent,
  ReceptionEvent,
  SettingEvent,
  AttackAttemptEvent,
  Team,
} from "./volley-store";
import { POINT_TYPE_LABEL } from "./volley-store";

export type RallyPhase =
  | "serve"
  | "reception"
  | "setting"
  | "attack"
  | "block"
  | "defense";

export const RALLY_PHASES: RallyPhase[] = [
  "serve",
  "reception",
  "setting",
  "attack",
  "block",
  "defense",
];

export const RALLY_PHASE_LABEL: Record<RallyPhase, string> = {
  serve: "Saque",
  reception: "Recepción",
  setting: "Armado",
  attack: "Ataque",
  block: "Bloqueo",
  defense: "Defensa",
};

export interface RallyContext {
  /** Fase actual esperada (siguiente acción a registrar). */
  currentPhase: RallyPhase;
  /** Fases ya cumplidas en el rally en curso. */
  done: Set<RallyPhase>;
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

/**
 * Devuelve el estado del rally en curso a partir de los eventos del set.
 * No muta nada. Todo se deriva; se usa solo para UI de guía.
 */
export function computeRallyContext(
  match: Match,
  teams: { A: Team; B: Team },
): RallyContext {
  const setEvents = match.events.filter(
    (e) => "setNumber" in e && e.setNumber === match.currentSet,
  );

  // Encontrar índice del último PointEvent → todo lo posterior pertenece al rally actual.
  let lastPointIdx = -1;
  for (let i = setEvents.length - 1; i >= 0; i--) {
    if (isPointEvent(setEvents[i])) {
      lastPointIdx = i;
      break;
    }
  }
  const finished = lastPointIdx === setEvents.length - 1 && lastPointIdx >= 0;
  const rallyEvents = finished
    ? []
    : setEvents.slice(lastPointIdx + 1);

  const done = new Set<RallyPhase>();
  // El saque siempre está “en curso” cuando hay un rally abierto.
  const servingSide = match.servingSide;

  let currentPhase: RallyPhase = "serve";
  let possession: "A" | "B" | null = servingSide;
  let currentActionText = `Espera saque de ${teams[servingSide].shortName ?? teams[servingSide].name}`;
  let currentActionPlayerId: string | null = null;
  let currentActionSide: "A" | "B" | null = servingSide;

  const hasReception = rallyEvents.some(isReception);
  const hasSetting = rallyEvents.some(isSetting);
  const hasAttack = rallyEvents.some((e) => isAttackAttempt(e));

  if (rallyEvents.length > 0 || !finished) {
    done.add("serve");
  }

  if (hasReception) {
    done.add("reception");
    const rec = [...rallyEvents].reverse().find(isReception)!;
    // La posesión pasa al equipo receptor.
    possession = rec.side;
    currentPhase = "setting";
    currentActionText = `Recepción ${receptionLabel(rec.rating)} · esperando armado`;
    currentActionPlayerId = rec.playerId;
    currentActionSide = rec.side;
  } else if (!finished) {
    currentPhase = "reception";
    const recvSide: "A" | "B" = servingSide === "A" ? "B" : "A";
    currentActionText = `Esperando recepción · ${teams[recvSide].shortName ?? teams[recvSide].name}`;
    currentActionSide = recvSide;
  }

  if (hasSetting) {
    done.add("setting");
    const set = [...rallyEvents].reverse().find(isSetting)!;
    possession = set.side;
    currentPhase = "attack";
    currentActionText = `Armado ${set.quality} → ${set.attackZone.toUpperCase()} · esperando ataque`;
    currentActionPlayerId = set.setterId;
    currentActionSide = set.side;
  }

  if (hasAttack) {
    done.add("attack");
    const at = [...rallyEvents].reverse().find(isAttackAttempt)!;
    possession = at.side === "A" ? "B" : "A"; // pelota pasa al rival
    currentPhase = "block";
    currentActionText = `Ataque neutral · esperando bloqueo/defensa rival`;
    currentActionPlayerId = at.playerId;
    currentActionSide = at.side;
  }

  // Última acción (incluye el punto que cerró el rally previo si el rally está finalizado).
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
      lastActionLabel = "Ataque (continuidad)";
      lastActionDetail = lastEv.attackZone ? `Z${lastEv.attackZone}` : null;
    }
  }

  if (finished) {
    currentActionText = "Rally finalizado";
    currentActionPlayerId = lastActionPlayerId;
    currentActionSide = lastActionSide;
    // Mark visual "todos los pasos hasta ataque" done → mostrar barra completa.
    done.add("serve");
    if (hasReception || (lastEv && isPointEvent(lastEv) && lastEv.type !== "ace" && lastEv.type !== "serve_error")) {
      done.add("reception");
    }
    if (hasSetting) done.add("setting");
    if (lastEv && isPointEvent(lastEv)) {
      const t = lastEv.type;
      if (t === "attack" || t === "counter_attack" || t === "rotation_attack" || t === "attack_error") {
        done.add("attack");
      }
      if (t === "block" || t === "block_error") done.add("block");
    }
  }

  return {
    currentPhase,
    done,
    finished,
    possession,
    lastActionPlayerId,
    lastActionSide,
    lastActionLabel,
    lastActionDetail,
    currentActionText,
    currentActionPlayerId,
    currentActionSide,
  };
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
