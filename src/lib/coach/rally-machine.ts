import { create } from "zustand";
import { useVolley, type AttackDirection, type AttackZone } from "@/lib/volley-store";
import { playerAtZone, findSetterOnCourt } from "./effective-lineup";

/**
 * Motor de estados de Coach Mode. Guía al entrenador durante un rally
 * completo dentro de un único panel flotante. Todos los fundamentos
 * comparten esta arquitectura; agregar uno nuevo = extender el enum,
 * `nextState` y la UI de step correspondiente.
 */

export type RallyState =
  | "idle"
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "contraataque"
  | "fin";

/** Valoración universal usada por TODOS los fundamentos. */
export type Rating = "#" | "+" | "0" | "-" | "=" | "≠";

export const RATING_ORDER: Rating[] = ["#", "+", "0", "-", "=", "≠"];

export const RATING_MEANING: Record<RallyState, Partial<Record<Rating, string>>> = {
  idle: {},
  saque: { "#": "Ace (punto)", "+": "Positivo", "0": "Neutro", "-": "Presionado", "=": "Error de saque", "≠": "Devuelto fácil" },
  recepcion: { "#": "Perfecta", "+": "Buena", "0": "Neutra", "-": "Mala", "=": "Error de recepción", "≠": "Falta de recepción" },
  armado: { "#": "Perfecto", "+": "Bueno", "0": "Neutro", "-": "Malo", "=": "Error de armado", "≠": "Doble / Retención" },
  ataque: { "#": "Punto (Kill)", "+": "Fuerte", "0": "Continúa", "-": "Defendido", "=": "Error (out/red)", "≠": "Falta de ataque" },
  bloqueo: { "#": "Punto de bloqueo", "+": "Toque positivo", "0": "Neutro", "-": "Deja abierto", "=": "Error de bloqueo", "≠": "Falta de bloqueo" },
  defensa: { "#": "Perfecta", "+": "Buena", "0": "Continúa", "-": "Débil", "=": "Error de defensa", "≠": "Falta" },
  contraataque: { "#": "Punto (Contra)", "+": "Fuerte", "0": "Continúa", "-": "Defendido", "=": "Error", "≠": "Falta" },
  fin: {},
};

export type AttackResultKind = "point" | "continue" | "blocked" | "error" | "unforced";

export interface RallyStep {
  state: Exclude<RallyState, "idle" | "fin">;
  side: "A" | "B";
  playerId?: string | null;
  /** Zona de origen (jugador que ejecuta). */
  origin?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Zona destino de la cancha rival (para saque/ataque/contraataque). */
  target?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  rating?: Rating;
  /** Marca cómo terminó un ataque cuando el resultado no cabe en el rating. */
  finishKind?: AttackResultKind;
  timestamp: number;
}

interface CurrentStep {
  state: Exclude<RallyState, "idle" | "fin">;
  side: "A" | "B";
  /** Sub-paso dentro del estado. */
  sub: "player" | "origin" | "target" | "rating";
  playerId?: string | null;
  origin?: 1 | 2 | 3 | 4 | 5 | 6;
  target?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

export interface BlockPickState {
  /** Lado que ATACÓ (el bloqueo lo hace el rival). */
  attackerSide: "A" | "B";
  /** Lado que BLOQUEA (recibe el punto). */
  blockingSide: "A" | "B";
  /** IDs elegibles: delanteros (Z2/Z3/Z4) del lado que bloquea. */
  eligible: string[];
  /** IDs seleccionados en orden de click. */
  picks: string[];
  /** Step del ataque que originó el bloqueo (para persistencia). */
  step: RallyStep;
}

interface CoachRallyState {
  matchId: string | null;
  state: RallyState;
  history: RallyStep[];
  redoStack: RallyStep[];
  current: CurrentStep | null;
  /** Resultado del rally cuando `state === "fin"`. */
  outcome: { scoringSide: "A" | "B"; reason: string } | null;
  /** Modo bloqueo: selección de bloqueadores en la cancha. */
  blockPick: BlockPickState | null;

  start: (matchId: string, entry: Exclude<RallyState, "idle" | "fin">, side: "A" | "B") => void;
  setPlayer: (playerId: string) => void;
  setOrigin: (zone: 1 | 2 | 3 | 4 | 5 | 6) => void;
  setTarget: (zone: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9) => void;
  setRating: (rating: Rating) => void;
  /** Resultado final del ataque (reemplaza el paso de destino + rating). */
  setAttackResult: (kind: AttackResultKind) => void;
  /** Modo bloqueo: alterna un jugador en la selección; auto-cierra a los 800ms. */
  toggleBlockerPick: (playerId: string) => void;
  /** Modo bloqueo: cancela y vuelve al selector de resultado. */
  cancelBlockPick: () => void;
  back: () => void;
  cancel: () => void;
  reset: () => void;
  /** Deshace la última acción registrada en el rally (Ctrl+Z). */
  undoStep: () => void;
  /** Rehace (Ctrl+Y). */
  redoStep: () => void;
  /** Comitea la step actual y avanza al siguiente estado. */
  commit: () => void;
}

/** Estados que necesitan zona destino explícita. */
const NEEDS_TARGET: Exclude<RallyState, "idle" | "fin">[] = ["saque", "armado", "ataque", "contraataque"];
/** Estados que necesitan zona de origen (el jugador se autodetecta desde ahí). */
const NEEDS_ORIGIN_BEFORE_PLAYER: Exclude<RallyState, "idle" | "fin">[] = [];

function opposite(side: "A" | "B"): "A" | "B" { return side === "A" ? "B" : "A"; }

/**
 * Transición determinista según fundamento + valoración.
 * Devuelve el próximo estado y quién lo ejecuta.
 */
function transition(step: RallyStep): { state: RallyState; side: "A" | "B"; scoringSide?: "A" | "B"; reason?: string } {
  const { state, side, rating } = step;
  if (!rating) return { state: "fin", side, scoringSide: side, reason: "Sin valoración" };

  switch (state) {
    case "saque":
      if (rating === "#") return { state: "fin", side, scoringSide: side, reason: "Ace" };
      if (rating === "=") return { state: "fin", side, scoringSide: opposite(side), reason: "Error de saque" };
      // + 0 - ≠ → recepción del rival
      return { state: "recepcion", side: opposite(side) };
    case "recepcion":
      if (rating === "=") return { state: "fin", side, scoringSide: opposite(side), reason: "Error de recepción" };
      if (rating === "≠") return { state: "fin", side, scoringSide: opposite(side), reason: "Falta de recepción" };
      // # + 0 - → armado propio
      return { state: "armado", side };
    case "armado":
      if (rating === "=") return { state: "fin", side, scoringSide: opposite(side), reason: "Error de armado" };
      if (rating === "≠") return { state: "fin", side, scoringSide: opposite(side), reason: "Falta de armado" };
      return { state: "ataque", side };
    case "ataque":
      if (rating === "#") return { state: "fin", side, scoringSide: side, reason: "Punto de ataque" };
      if (rating === "=") return { state: "fin", side, scoringSide: opposite(side), reason: "Error de ataque" };
      if (rating === "≠") return { state: "fin", side, scoringSide: opposite(side), reason: "Falta de ataque" };
      // + 0 - → el rival defiende directamente (sin paso de bloqueo)
      return { state: "defensa", side: opposite(side) };
    case "bloqueo":
      if (rating === "#") return { state: "fin", side, scoringSide: side, reason: "Punto de bloqueo" };
      if (rating === "=") return { state: "fin", side, scoringSide: opposite(side), reason: "Error de bloqueo" };
      if (rating === "≠") return { state: "fin", side, scoringSide: opposite(side), reason: "Falta de bloqueo" };
      // + 0 - → defensa (mismo lado que bloqueó)
      return { state: "defensa", side };
    case "defensa":
      if (rating === "=") return { state: "fin", side, scoringSide: opposite(side), reason: "Error de defensa" };
      if (rating === "≠") return { state: "fin", side, scoringSide: opposite(side), reason: "Falta de defensa" };
      // # + 0 - → contraataque: armado del mismo equipo, luego ataque = contraataque
      return { state: "armado", side };
    case "contraataque":
      if (rating === "#") return { state: "fin", side, scoringSide: side, reason: "Punto de contraataque" };
      if (rating === "=") return { state: "fin", side, scoringSide: opposite(side), reason: "Error de contraataque" };
      if (rating === "≠") return { state: "fin", side, scoringSide: opposite(side), reason: "Falta de contraataque" };
      return { state: "defensa", side: opposite(side) };
  }
}


/**
 * Persiste el rally al volley-store cuando termina (única vez).
 * Emite un solo `recordPoint` para no descuadrar el marcador ni disparar
 * dobles rotaciones. Los pasos intermedios viven en `history` para la UI.
 */
function persistToStore(matchId: string, history: RallyStep[], outcome: { scoringSide: "A" | "B"; reason: string }): void {
  const store = useVolley.getState();
  const last = history[history.length - 1];
  const finisher = [...history].reverse().find((h) => h.rating === "#" || h.rating === "≠") ?? last;
  const attack = [...history].reverse().find((h) => h.state === "ataque" || h.state === "contraataque");
  const serve = history.find((h) => h.state === "saque");
  const block = [...history].reverse().find((h) => h.state === "bloqueo");

  // Determinar tipo y jugador que "cerró" el rally.
  const scoring = outcome.scoringSide;

  if (finisher.state === "saque" && finisher.rating === "#") {
    store.recordPoint(matchId, scoring, "ace", serve?.playerId ?? null);
    return;
  }
  if (finisher.state === "saque" && finisher.rating === "=") {
    store.recordPoint(matchId, opposite(scoring), "serve_error", serve?.playerId ?? null);
    return;
  }
  // Resultado de ataque con finishKind explícito (bloqueo rival / error no forzado).
  if ((finisher.state === "ataque" || finisher.state === "contraataque") && finisher.finishKind === "blocked") {
    store.recordPoint(matchId, scoring, "block", null);
    return;
  }
  if ((finisher.state === "ataque" || finisher.state === "contraataque") && finisher.finishKind === "unforced") {
    store.recordPoint(matchId, scoring, "unforced_error", attack?.playerId ?? null);
    return;
  }
  if ((finisher.state === "ataque" || finisher.state === "contraataque") && finisher.rating === "#") {
    store.recordPoint(matchId, scoring, "attack", attack?.playerId ?? null, attack?.origin as AttackZone | undefined, undefined, attack?.target as AttackDirection | undefined);
    return;
  }
  if ((finisher.state === "ataque" || finisher.state === "contraataque") && (finisher.rating === "=" || finisher.rating === "≠")) {
    store.recordPoint(matchId, opposite(scoring), "attack_error", attack?.playerId ?? null);
    return;
  }

  if (finisher.state === "bloqueo" && finisher.rating === "#") {
    store.recordPoint(matchId, scoring, "block", block?.playerId ?? null);
    return;
  }
  if (finisher.state === "bloqueo" && (finisher.rating === "=" || finisher.rating === "≠")) {
    store.recordPoint(matchId, opposite(scoring), "block_error", block?.playerId ?? null);
    return;
  }
  if (finisher.state === "recepcion") {
    // Recepción perdida = punto para el sacador
    store.recordPoint(matchId, scoring, "ace", serve?.playerId ?? null);
    return;
  }
  if (finisher.state === "armado" && (finisher.rating === "=" || finisher.rating === "≠")) {
    store.recordPoint(matchId, opposite(scoring), "unforced_error", finisher.playerId ?? null);
    return;
  }
  if (finisher.state === "defensa") {
    // Defensa fallida ⇒ el atacante rival ganó el punto.
    store.recordPoint(matchId, scoring, attack ? "attack" : "opponent_error", attack?.playerId ?? null, attack?.origin as AttackZone | undefined, undefined, attack?.target as AttackDirection | undefined);
    return;
  }
  // Fallback
  store.recordPoint(matchId, scoring, "opponent_error", null);
}

/** Temporizador global para auto-cierre del modo bloqueo (800ms). */
let blockPickTimer: ReturnType<typeof setTimeout> | null = null;
function clearBlockPickTimer() {
  if (blockPickTimer) { clearTimeout(blockPickTimer); blockPickTimer = null; }
}
const BLOCK_PICK_DELAY_MS = 800;

/** Finaliza el modo bloqueo: registra el punto y cierra el rally. */
function finalizeBlockPick(
  get: () => CoachRallyState,
  set: (partial: Partial<CoachRallyState>) => void,
) {
  clearBlockPickTimer();
  const bp = get().blockPick;
  const matchId = get().matchId;
  if (!bp || !matchId || bp.picks.length === 0) return;
  const nextHistory = [...get().history, bp.step];
  useVolley.getState().recordBlockPoint(matchId, bp.blockingSide, bp.picks);
  const label = bp.picks.length === 3 ? "Bloqueo triple" : bp.picks.length === 2 ? "Bloqueo doble" : "Bloqueo individual";
  set({
    state: "fin",
    history: nextHistory,
    current: null,
    outcome: { scoringSide: bp.blockingSide, reason: label },
    redoStack: [],
    blockPick: null,
  });
}

export const useCoachRally = create<CoachRallyState>((set, get) => ({
  matchId: null,
  state: "idle",
  history: [],
  redoStack: [],
  current: null,
  outcome: null,
  blockPick: null,

  start: (matchId, entry, side) => {
    const needsOriginFirst = NEEDS_ORIGIN_BEFORE_PLAYER.includes(entry);
    // Saque: autoselección del sacador (Z1 de la formación efectiva del equipo con saque).
    // El entrenador sólo indica destino + valoración.
    let playerId: string | null | undefined = undefined;
    let sub: CurrentStep["sub"] = needsOriginFirst ? "origin" : "player";
    let origin: 1 | 2 | 3 | 4 | 5 | 6 | undefined = undefined;
    if (entry === "saque") {
      const match = useVolley.getState().matches.find((m) => m.id === matchId);
      playerId = match ? playerAtZone(match, side, 1) : null;
      origin = 1;
      sub = "target";
    }
    set({
      matchId,
      state: entry,
      history: [],
      redoStack: [],
      outcome: null,
      current: { state: entry, side, sub, playerId, origin },
    });
  },


  setPlayer: (playerId) => {
    const cur = get().current;
    if (!cur) return;
    const nextSub: CurrentStep["sub"] = NEEDS_TARGET.includes(cur.state) ? "target" : "rating";
    set({ current: { ...cur, playerId, sub: nextSub } });
  },

  setOrigin: (zone) => {
    // Al elegir origen, autoseleccionamos jugador desde formación efectiva.
    const cur = get().current;
    const matchId = get().matchId;
    if (!cur || !matchId) return;
    const match = useVolley.getState().matches.find((m) => m.id === matchId);
    const auto = match ? playerAtZone(match, cur.side, zone) : null;
    const nextSub: CurrentStep["sub"] = NEEDS_TARGET.includes(cur.state)
      ? "target"
      : "rating";
    set({ current: { ...cur, origin: zone, playerId: auto, sub: nextSub } });
  },

  setTarget: (zone) => {
    const cur = get().current;
    if (!cur) return;
    set({ current: { ...cur, target: zone, sub: "rating" } });
    // Armado: la distribución NO requiere valoración manual — se comitea
    // con rating neutro y se avanza al ataque con el atacante autodetectado.
    if (cur.state === "armado") {
      get().setRating("0");
    }
  },

  setRating: (rating) => {
    // Al fijar valoración disparamos commit inmediato (sin Enter).
    const cur = get().current;
    if (!cur) return;
    set({ current: { ...cur, sub: "rating" } });
    // Guardamos la valoración y comiteamos en el próximo tick para permitir animación.
    (get() as CoachRallyState & { _pendingRating?: Rating })._pendingRating = rating;
    setTimeout(() => get().commit(), 0);
  },

  setAttackResult: (kind) => {
    const cur = get().current;
    const matchId = get().matchId;
    if (!cur || !matchId) return;
    if (cur.state !== "ataque" && cur.state !== "contraataque") return;
    // Mapeo simple → rating universal (reutiliza el commit estándar).
    if (kind === "point") { get().setRating("#"); return; }
    if (kind === "continue") { get().setRating("0"); return; }
    if (kind === "error") { get().setRating("="); return; }

    // "blocked" → activar modo bloqueo: seleccionar bloqueador(es) en la cancha.
    if (kind === "blocked") {
      const match = useVolley.getState().matches.find((m) => m.id === matchId);
      if (!match) return;
      const blockingSide = opposite(cur.side);
      // Delanteros del bloqueador = onCourt índices 1 (Z2), 2 (Z3), 3 (Z4).
      const raw = blockingSide === "A" ? match.onCourtA : match.onCourtB;
      const eligible = [raw[1], raw[2], raw[3]].filter(Boolean) as string[];
      const step: RallyStep = {
        state: cur.state,
        side: cur.side,
        playerId: cur.playerId,
        origin: cur.origin,
        target: cur.target,
        rating: "=",
        finishKind: "blocked",
        timestamp: Date.now(),
      };
      clearBlockPickTimer();
      // eslint-disable-next-line no-console
      console.log("[block-pick] activado", { blockingSide, eligible, raw });
      set({
        blockPick: { attackerSide: cur.side, blockingSide, eligible, picks: [], step },
      });
      return;
    }

    // "unforced": cierre inmediato.
    const step: RallyStep = {
      state: cur.state,
      side: cur.side,
      playerId: cur.playerId,
      origin: cur.origin,
      target: cur.target,
      rating: "≠",
      finishKind: kind,
      timestamp: Date.now(),
    };
    const nextHistory = [...get().history, step];
    const scoringSide = opposite(cur.side);
    persistToStore(matchId, nextHistory, { scoringSide, reason: "Error no forzado" });
    set({
      state: "fin",
      history: nextHistory,
      current: null,
      outcome: { scoringSide, reason: "Error no forzado" },
      redoStack: [],
    });
  },

  toggleBlockerPick: (playerId) => {
    const bp = get().blockPick;
    const matchId = get().matchId;
    if (!bp || !matchId) return;
    if (!bp.eligible.includes(playerId)) return;

    let picks = bp.picks.includes(playerId)
      ? bp.picks.filter((id) => id !== playerId)
      : [...bp.picks, playerId];
    if (picks.length > 3) picks = picks.slice(0, 3);

    clearBlockPickTimer();
    set({ blockPick: { ...bp, picks } });

    // Triple: cierre inmediato.
    if (picks.length === 3) {
      finalizeBlockPick(get, set);
      return;
    }
    // 1 o 2 seleccionados: esperar 800ms antes de cerrar.
    if (picks.length >= 1) {
      blockPickTimer = setTimeout(() => finalizeBlockPick(get, set), BLOCK_PICK_DELAY_MS);
    }
  },

  cancelBlockPick: () => {
    clearBlockPickTimer();
    set({ blockPick: null });
  },


  commit: () => {
    const cur = get().current;
    const matchId = get().matchId;
    if (!cur || !matchId) return;
    const rating: Rating | undefined = (get() as unknown as { _pendingRating?: Rating })._pendingRating;
    if (!rating) return;

    // Autoseleccionar jugador para estados que no requieren origen explícito.
    let playerId = cur.playerId;
    if (playerId == null && !NEEDS_ORIGIN_BEFORE_PLAYER.includes(cur.state)) {
      const match = useVolley.getState().matches.find((m) => m.id === matchId);
      if (match) {
        const zone: 1 | 2 | 3 | 4 | 5 | 6 =
          cur.state === "saque" ? 1 :
          cur.state === "armado" ? 2 :
          cur.state === "bloqueo" ? 3 :
          cur.state === "defensa" ? 6 :
          cur.state === "recepcion" ? 6 : 1;
        playerId = playerAtZone(match, cur.side, zone);
      }
    }

    const step: RallyStep = {
      state: cur.state,
      side: cur.side,
      playerId,
      origin: cur.origin,
      target: cur.target,
      rating,
      timestamp: Date.now(),
    };
    const nextHistory = [...get().history, step];
    let t = transition(step);

    // Ciclo continuo: si venimos de una defensa, el próximo ataque es contraataque.
    if (t.state === "ataque") {
      const hasDefensa = nextHistory.some((h) => h.state === "defensa");
      if (hasDefensa) t = { ...t, state: "contraataque" };
    }
    (get() as unknown as { _pendingRating?: Rating })._pendingRating = undefined;
    set({ redoStack: [] });

    if (t.state === "fin") {
      const outcome = { scoringSide: t.scoringSide ?? cur.side, reason: t.reason ?? "" };
      persistToStore(matchId, nextHistory, outcome);
      set({
        state: "fin",
        history: nextHistory,
        current: null,
        outcome,
      });
      return;
    }

    // Autoselección del siguiente jugador según el fundamento y la formación efectiva.
    const match = useVolley.getState().matches.find((m) => m.id === matchId);
    const teamState = useVolley.getState();
    let nextPlayerId: string | null | undefined = undefined;
    let nextOrigin: 1 | 2 | 3 | 4 | 5 | 6 | undefined = undefined;
    let nextSub: CurrentStep["sub"] = "player";

    if (match) {
      const team = t.side === "A"
        ? teamState.teams.find((tm) => tm.id === match.teamAId)
        : teamState.teams.find((tm) => tm.id === match.teamBId);

      if (t.state === "recepcion" && step.state === "saque" && step.target && step.target <= 6) {
        // Saque → Recepción: receptor = jugador en la zona destino del saque.
        const zone = step.target as 1 | 2 | 3 | 4 | 5 | 6;
        nextPlayerId = playerAtZone(match, t.side, zone);
        nextOrigin = zone;
        nextSub = "rating";
      } else if (t.state === "armado") {
        // Recepción / Defensa → Armado: armador autodetectado; sólo falta distribución.
        nextPlayerId = team ? findSetterOnCourt(match, team, t.side) : null;
        nextSub = "target";
      } else if ((t.state === "ataque" || t.state === "contraataque") && step.state === "armado" && step.target) {
        // Armado → Ataque: atacante = jugador en la zona a la que distribuyó el armado.
        // El entrenador ahora indica el destino del ataque antes del resultado.
        const zone = step.target as 1 | 2 | 3 | 4 | 5 | 6;
        nextPlayerId = playerAtZone(match, t.side, zone);
        nextOrigin = zone;
        nextSub = "target";
      } else if (t.state === "bloqueo") {
        nextPlayerId = playerAtZone(match, t.side, 3);
        nextSub = "rating";
      } else if (t.state === "defensa") {
        // Ataque → Defensa: defensor = jugador en la zona destino del ataque, lado opuesto.
        if ((step.state === "ataque" || step.state === "contraataque") && step.target && step.target <= 6) {
          const zone = step.target as 1 | 2 | 3 | 4 | 5 | 6;
          nextPlayerId = playerAtZone(match, t.side, zone);
          nextOrigin = zone;
        } else {
          nextPlayerId = playerAtZone(match, t.side, 6);
        }
        nextSub = "rating";
      }
    }

    set({
      state: t.state,
      history: nextHistory,
      current: {
        state: t.state as Exclude<RallyState, "idle" | "fin">,
        side: t.side,
        sub: nextSub,
        playerId: nextPlayerId,
        origin: nextOrigin,
      },
    });
  },



  back: () => {
    const { current, history, blockPick } = get();
    // Modo bloqueo: back sale del selector sin registrar el punto.
    if (blockPick) { get().cancelBlockPick(); return; }
    if (current) {
      // Volver al sub-paso anterior dentro del estado actual.
      if (current.sub === "rating" && NEEDS_TARGET.includes(current.state)) {
        set({ current: { ...current, target: undefined, sub: "target" } });
        return;
      }
      if (current.sub === "rating") {
        set({ current: { ...current, sub: NEEDS_ORIGIN_BEFORE_PLAYER.includes(current.state) ? "origin" : "player" } });
        return;
      }
      if (current.sub === "target") {
        set({ current: { ...current, target: undefined, sub: NEEDS_ORIGIN_BEFORE_PLAYER.includes(current.state) ? "origin" : "player" } });
        return;
      }
    }
    // Sin sub-paso previo: retrocedemos al step anterior en la historia.
    if (history.length === 0) { get().cancel(); return; }
    const prev = history[history.length - 1];
    set({
      state: prev.state,
      history: history.slice(0, -1),
      current: {
        state: prev.state,
        side: prev.side,
        playerId: prev.playerId,
        origin: prev.origin,
        target: prev.target,
        sub: "rating",
      },
    });
  },

  cancel: () => {
    clearBlockPickTimer();
    set({ state: "idle", current: null, history: [], redoStack: [], outcome: null, matchId: null, blockPick: null });
  },

  reset: () => {
    clearBlockPickTimer();
    set({ state: "idle", current: null, history: [], redoStack: [], outcome: null, blockPick: null });
  },

  undoStep: () => {
    const { history, redoStack, current, state, matchId } = get();
    // Si estamos en "fin", revertimos también el punto persistido.
    if (state === "fin" && matchId) {
      const match = useVolley.getState().matches.find((m) => m.id === matchId);
      if (match && match.events.length > 0) useVolley.getState().undoLastEvent(matchId);
    }
    if (history.length === 0) {
      if (current) set({ current: { ...current, playerId: undefined, origin: undefined, target: undefined, sub: NEEDS_ORIGIN_BEFORE_PLAYER.includes(current.state) ? "origin" : "player" } });
      return;
    }
    const last = history[history.length - 1];
    set({
      state: last.state,
      history: history.slice(0, -1),
      redoStack: [...redoStack, last],
      outcome: null,
      current: {
        state: last.state,
        side: last.side,
        playerId: last.playerId,
        origin: last.origin,
        target: last.target,
        sub: "rating",
      },
    });
  },


  redoStep: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const step = redoStack[redoStack.length - 1];
    const nextRedo = redoStack.slice(0, -1);
    const nextHistory = [...get().history, step];
    const t = transition(step);
    if (t.state === "fin") {
      const outcome = { scoringSide: t.scoringSide ?? step.side, reason: t.reason ?? "" };
      const mid = get().matchId;
      if (mid) persistToStore(mid, nextHistory, outcome);
      set({ state: "fin", history: nextHistory, redoStack: nextRedo, current: null, outcome });
      return;
    }
    const needsOriginFirst = NEEDS_ORIGIN_BEFORE_PLAYER.includes(t.state as Exclude<RallyState, "idle" | "fin">);
    set({
      state: t.state,
      history: nextHistory,
      redoStack: nextRedo,
      current: {
        state: t.state as Exclude<RallyState, "idle" | "fin">,
        side: t.side,
        sub: needsOriginFirst ? "origin" : "player",
      },
    });
  },
}));

/** Etiqueta corta del fundamento para UI. */
export const STATE_LABEL: Record<RallyState, string> = {
  idle: "Inactivo",
  saque: "Saque",
  recepcion: "Recepción",
  armado: "Armado",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  contraataque: "Contraataque",
  fin: "Fin del rally",
};

/** Orden canónico del flujo (para progress bar). */
export const FLOW_STATES: RallyState[] = [
  "saque", "recepcion", "armado", "ataque", "bloqueo", "defensa", "contraataque", "fin",
];

// DEV: expose store for browser debugging.
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as unknown as { __coach?: unknown }).__coach = useCoachRally;
}


