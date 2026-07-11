import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PointType =
  | "attack"
  | "block"
  | "ace"
  | "counter_attack"
  | "rotation_attack"
  | "opponent_error"
  | "opponent_rotation_error"
  | "serve_error"
  | "unforced_error"
  | "rotation_error"
  | "attack_error"
  | "block_error";

export const POINT_TYPE_LABEL: Record<PointType, string> = {
  attack: "Ataque",
  block: "Bloqueo",
  ace: "Saque",
  counter_attack: "Contraataque",
  rotation_attack: "Ataque de rotación",
  opponent_error: "Error rival",
  opponent_rotation_error: "Error de rotación",
  serve_error: "Error de saque",
  unforced_error: "Error no forzado",
  rotation_error: "Error de rotación propio",
  attack_error: "Error de ataque",
  block_error: "Error de bloqueo",
};

export const ERROR_TYPES: PointType[] = ["serve_error", "unforced_error", "rotation_error", "attack_error", "block_error"];

export type PlayerPosition = "punta" | "central" | "opuesto" | "armador" | "libero";

export const PLAYER_POSITIONS: PlayerPosition[] = ["punta", "central", "opuesto", "armador", "libero"];

export const PLAYER_POSITION_LABEL: Record<PlayerPosition, string> = {
  punta: "Punta",
  central: "Central",
  opuesto: "Opuesto",
  armador: "Armador",
  libero: "Líbero",
};

export interface Player {
  id: string;
  name: string;
  number: number;
  /** Optional player photo as data URL (uploaded from device). */
  photoUrl?: string;
  position?: PlayerPosition;
}

export type StatsMode = "liga" | "entrenador";

export const STATS_MODE_LABEL: Record<StatsMode, string> = {
  liga: "Modo Liga · Planillero",
  entrenador: "Modo Entrenador · Avanzado",
};

export const STATS_MODE_DESCRIPTION: Record<StatsMode, string> = {
  liga: "Carga rápida. Solo resultados, tabla, rankings y MVP. Sin recepción ni zonas de ataque.",
  entrenador: "Incluye recepción por calidad, zonas de ataque, rotaciones y estadísticas avanzadas.",
};

export interface League {
  id: string;
  name: string;
  season?: string;
  color?: string;
  /** Género de los equipos que juegan esta liga (M/F). Si es undefined, admite ambos. */
  gender?: "M" | "F";
  /** Define qué interfaz y estadísticas se muestran para los partidos de esta liga. */
  statsMode?: StatsMode;
}

/** Modo por defecto cuando una liga no lo define o cuando el partido no pertenece a ninguna liga. */
export const DEFAULT_STATS_MODE: StatsMode = "liga";

export function getLeagueStatsMode(leagueId: string | undefined | null, leagues: League[]): StatsMode {
  if (!leagueId) return DEFAULT_STATS_MODE;
  const l = leagues.find((x) => x.id === leagueId);
  return l?.statsMode ?? DEFAULT_STATS_MODE;
}

export function getMatchStatsMode(
  match: { teamAId: string; teamBId: string } | null | undefined,
  teams: Team[],
  leagues: League[],
): StatsMode {
  if (!match) return DEFAULT_STATS_MODE;
  const a = teams.find((t) => t.id === match.teamAId);
  const b = teams.find((t) => t.id === match.teamBId);
  if (a?.leagueId && a.leagueId === b?.leagueId) {
    return getLeagueStatsMode(a.leagueId, leagues);
  }
  return DEFAULT_STATS_MODE;
}

export type TeamGender = "M" | "F";

export const TEAM_GENDER_LABEL: Record<TeamGender, string> = {
  M: "Masculino",
  F: "Femenino",
};

export type TeamCategory = "12" | "14" | "16" | "18" | "21" | "primera";

export const TEAM_CATEGORIES: TeamCategory[] = ["12", "14", "16", "18", "21", "primera"];

export const TEAM_CATEGORY_LABEL: Record<TeamCategory, string> = {
  "12": "Sub-12",
  "14": "Sub-14",
  "16": "Sub-16",
  "18": "Sub-18",
  "21": "Sub-21",
  primera: "Primera",
};

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  players: Player[];
  /** Optional league this team belongs to. */
  leagueId?: string;
  /** Optional team logo/crest as data URL or remote URL. */
  logoUrl?: string;
  /** Optional team gender (masculino / femenino). */
  gender?: TeamGender;
  /** Optional age category. */
  category?: TeamCategory;
}



/** Zona desde la que se ejecutó el ataque. 4/3/2 = frente, 1/6/5 = zaguero. */
export type AttackZone = 4 | 3 | 2 | 1 | 6 | 5;

export const ATTACK_ZONES: AttackZone[] = [4, 3, 2, 1, 6, 5];

export const ATTACK_ZONE_LABEL: Record<string, string> = {
  "4": "Zona 4",
  "3": "Zona 3",
  "2": "Zona 2",
  "1": "Zaguero 1",
  "6": "Zaguero 6",
  "5": "Zaguero 5",
  back: "Zaguero",
};


export function isAttackType(t: PointType): boolean {
  return t === "attack" || t === "rotation_attack" || t === "counter_attack";
}

/** Sector 1..9 de la cancha rival (3×3): 1..3 cerca de la red, 7..9 fondo. */
export type AttackDirection = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface PointEvent {
  id: string;
  /** Side that scored the point. */
  scoringSide: "A" | "B";
  /** Side of the player involved (errors are charged to losing side). */
  playerSide: "A" | "B" | null;
  playerId: string | null;
  type: PointType;
  setNumber: number;
  timestamp: number;
  /** Sólo para ataques (rotation_attack / counter_attack / attack). */
  attackZone?: AttackZone;
  /** Modo entrenador: tipo táctico del ataque (1er tiempo, pipe, etc.). */
  attackType?: import("@/lib/formations/attack-types").AttackType;
  /** Modo entrenador: dirección del ataque en la cancha rival (1..9). */
  attackDirection?: AttackDirection;
}


export interface SubstitutionEvent {
  id: string;
  kind: "sub";
  side: "A" | "B";
  playerInId: string;
  playerOutId: string;
  setNumber: number;
  timestamp: number;
}

export interface LiberoEvent {
  id: string;
  kind: "libero";
  side: "A" | "B";
  /** "in" = líbero entra; "out" = líbero sale manualmente; "auto_out" = sale por rotación a frente. */
  action: "in" | "out" | "auto_out";
  liberoId: string;
  /** Jugador al que reemplaza (vuelve a cancha al salir el líbero). */
  replacedId: string;
  /** Evento generado por la automatización de líbero, no por un cambio manual. */
  source?: "auto";
  setNumber: number;
  timestamp: number;
}

export interface TimeoutEvent {
  id: string;
  kind: "timeout";
  side: "A" | "B";
  setNumber: number;
  timestamp: number;
}

export type SanctionType = "yellow" | "red" | "yellow_red" | "red_expulsion";

export const SANCTION_LABEL: Record<SanctionType, string> = {
  yellow: "Amarilla (amonestación)",
  red: "Roja (punto al rival)",
  yellow_red: "Amarilla + Roja (expulsión del set)",
  red_expulsion: "Roja sola (descalificación)",
};

export interface SanctionEvent {
  id: string;
  kind: "sanction";
  side: "A" | "B";
  playerId: string | null;
  sanction: SanctionType;
  setNumber: number;
  timestamp: number;
}

export interface LineupOverrideEvent {
  id: string;
  kind: "lineupOverride";
  side: "A" | "B";
  /** New on-court order (index 0 = pos 1 / saque). */
  lineup: string[];
  setNumber: number;
  timestamp: number;
}

export type ReceptionRating =
  | "double_positive" // #
  | "positive" // +
  | "neutral" // 0
  | "negative" // -
  | "double_negative" // =
  | "overpass"; // ≠ (punto directo de saque)

export interface ReceptionEvent {
  id: string;
  kind: "reception";
  side: "A" | "B";
  playerId: string;
  rating: ReceptionRating;
  setNumber: number;
  timestamp: number;
}

// ============= Armado (Setting) — Modo Entrenador =============

export type SettingQuality = "++" | "+" | "!" | "-" | "=";
export const SETTING_QUALITIES: SettingQuality[] = ["++", "+", "!", "-", "="];
export const SETTING_QUALITY_LABEL: Record<SettingQuality, string> = {
  "++": "Perfecto",
  "+": "Bueno",
  "!": "Jugable",
  "-": "Malo",
  "=": "Error",
};

/**
 * `back` se mantiene por compatibilidad con eventos viejos cargados antes de
 * separar zaguero 1 y zaguero 5. Para cargas nuevas usar `back1` o `back5`.
 */
export type SettingAttackZone = "z4" | "z3" | "z2" | "pipe" | "back1" | "back5" | "back";
export const SETTING_ATTACK_ZONES: SettingAttackZone[] = ["z4", "z3", "z2", "pipe", "back1", "back5"];
export const SETTING_ATTACK_ZONE_LABEL: Record<SettingAttackZone, string> = {
  z4: "Zona 4",
  z3: "Zona 3",
  z2: "Zona 2",
  pipe: "Pipe",
  back1: "Zaguero 1",
  back5: "Zaguero 5",
  back: "Zaguero",
};

export type SettingAttackResult = "point" | "continuity" | "error" | "blocked";
export const SETTING_ATTACK_RESULT_LABEL: Record<SettingAttackResult, string> = {
  point: "Punto",
  continuity: "Continuidad",
  error: "Error",
  blocked: "Bloqueado",
};

/**
 * Evento "armado" (setting): cadena completa recepción → armado → ataque cargada
 * en un solo flujo. NO afecta el marcador: el punto real se sigue cargando con
 * el flujo regular. Es un evento puramente analítico para el modo Entrenador.
 */
export interface SettingEvent {
  id: string;
  kind: "setting";
  side: "A" | "B";
  /** Jugadora que efectivamente realizó el segundo toque. */
  setterId: string;
  /** Calidad del armado. */
  quality: SettingQuality;
  /** Zona desde la que se ejecutó el ataque. */
  attackZone: SettingAttackZone;
  /**
   * Jugadora que atacó tras ese armado. Opcional: en el flujo rápido para tablet
   * sólo cargamos armadora + zona + calidad y se infiere desde la jugada normal.
   */
  attackerId?: string;
  /** Resultado del ataque. Opcional (ver `attackerId`). */
  attackResult?: SettingAttackResult;
  /** Calidad de la recepción que originó la jugada (opcional). */
  receptionQuality?: SettingQuality;
  /** Tipo táctico del ataque (modo Entrenador). */
  attackType?: import("@/lib/formations/attack-types").AttackType;
  /** Dirección 1..9 en la cancha rival (modo Entrenador). */
  attackDirection?: AttackDirection;
  setNumber: number;
  timestamp: number;
}

/**
 * Ataque "neutro" (continuidad de rally): la jugadora efectuó un ataque pero
 * no cerró el punto ni cometió error — la pelota siguió en juego. Se cuenta
 * como intento de ataque para el total de la jugadora / equipo pero NO afecta
 * el marcador ni la eficiencia clásica (kills − errors) / (kills + errors).
 */
export interface AttackAttemptEvent {
  id: string;
  kind: "attackAttempt";
  side: "A" | "B";
  playerId: string | null;
  setNumber: number;
  timestamp: number;
  /** Zona desde la que atacó (2/3/4/1/5/6). */
  attackZone?: AttackZone;
  attackType?: import("@/lib/formations/attack-types").AttackType;
  /** Dirección 1..9 en cancha rival. */
  attackDirection?: AttackDirection;
  /** true si es un contraataque neutro; por defecto false (ataque de rotación). */
  isCounter?: boolean;
}

export type MatchEvent = PointEvent | SubstitutionEvent | TimeoutEvent | SanctionEvent | LiberoEvent | LineupOverrideEvent | ReceptionEvent | SettingEvent | AttackAttemptEvent;

export interface MatchSet {
  number: number;
  scoreA: number;
  scoreB: number;
  finished: boolean;
}

export type MatchStatus = "scheduled" | "live" | "finished";

export interface Match {
  id: string;
  teamAId: string;
  teamBId: string;
  /** Ordered: index 0 = position 1 (back-right, server). */
  startingLineupA: string[];
  startingLineupB: string[];
  onCourtA: string[];
  onCourtB: string[];
  status: MatchStatus;
  currentSet: number;
  setsToWin: number;
  pointsPerSet: number;
  sets: MatchSet[];
  events: MatchEvent[];
  /** Side currently serving. */
  servingSide: "A" | "B";
  /** Side serving at start of match (for replay). */
  initialServingSide: "A" | "B";
  /** Optional per-set starting lineups (overrides startingLineup for that set). */
  lineupsBySet?: Record<number, { A?: string[]; B?: string[] }>;
  /** Set numbers whose starting formation was confirmed. */
  confirmedLineupSets?: number[];
  /** UI: display sides inverted (B on the left). */
  sidesFlipped?: boolean;
  scheduledAt: number;
  createdAt: number;
  captainAId?: string | null;
  captainBId?: string | null;
  liberoA1Id?: string | null;
  liberoA2Id?: string | null;
  liberoB1Id?: string | null;
  liberoB2Id?: string | null;
  /** Timestamp (ms) when each set was started by the scorer. */
  setStartTimes?: Record<number, number>;
  /** Líbero actualmente en cancha (computado por replayMatch). */
  liberoActiveA?: { liberoId: string; replacedId: string } | null;
  liberoActiveB?: { liberoId: string; replacedId: string } | null;
}
export function matchGender(match: Match, teamById: Map<string, Team>): TeamGender | null {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  if (!a?.gender || !b?.gender) return null;
  if (a.gender !== b.gender) return null;
  return a.gender;
}


export type ReceptionOverride = Partial<
  Record<
    import("@/lib/formations/types").TacticalRole,
    { x: number; y: number }
  >
>;
export type CustomReceptionFormations = Partial<
  Record<import("@/lib/formations/types").Rotation, ReceptionOverride>
>;

interface VolleyState {
  teams: Team[];
  matches: Match[];
  leagues: League[];
  customReceptionFormations?: CustomReceptionFormations;
  setReceptionSlot: (
    rotation: import("@/lib/formations/types").Rotation,
    role: import("@/lib/formations/types").TacticalRole,
    pos: { x: number; y: number },
  ) => void;
  resetReceptionRotation: (
    rotation: import("@/lib/formations/types").Rotation,
  ) => void;
  resetAllReceptionFormations: () => void;
  addLeague: (l: Omit<League, "id"> & { id?: string }) => string;
  updateLeague: (id: string, patch: Partial<League>) => void;
  removeLeague: (id: string) => void;

  addTeam: (t: Omit<Team, "id" | "players">) => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  removeTeam: (id: string) => void;
  addPlayer: (teamId: string, p: Omit<Player, "id">) => void;
  updatePlayer: (teamId: string, playerId: string, patch: Partial<Player>) => void;
  removePlayer: (teamId: string, playerId: string) => void;
  createMatch: (
    m: Omit<
      Match,
      | "id"
      | "events"
      | "sets"
      | "currentSet"
      | "status"
      | "onCourtA"
      | "onCourtB"
      | "createdAt"
      | "servingSide"
      | "initialServingSide"
    > & { initialServingSide?: "A" | "B" }
  ) => string;
  startMatch: (id: string) => void;
  setInitialServingSide: (id: string, side: "A" | "B") => void;
  setSetLineup: (matchId: string, side: "A" | "B", lineup: string[]) => void;
  confirmSetLineup: (matchId: string) => void;
  startSet: (matchId: string) => void;
  toggleSidesFlipped: (matchId: string) => void;

  recordPoint: (
    matchId: string,
    playerSide: "A" | "B",
    type: PointType,
    playerId: string | null,
    attackZone?: AttackZone,
    attackType?: import("@/lib/formations/attack-types").AttackType,
    attackDirection?: AttackDirection
  ) => void;

  recordSubstitution: (
    matchId: string,
    side: "A" | "B",
    playerInId: string,
    playerOutId: string
  ) => void;
  recordLiberoIn: (
    matchId: string,
    side: "A" | "B",
    liberoId: string,
    replacedId: string
  ) => void;
  /**
   * Registra un ataque "neutro" (continuidad del rally): cuenta como intento
   * pero no cambia el marcador ni la eficiencia clásica.
   */
  recordAttackAttempt: (
    matchId: string,
    side: "A" | "B",
    playerId: string | null,
    opts?: {
      attackZone?: AttackZone;
      attackType?: import("@/lib/formations/attack-types").AttackType;
      attackDirection?: AttackDirection;
      isCounter?: boolean;
    }
  ) => void;
  recordLiberoOut: (matchId: string, side: "A" | "B") => void;
  recordTimeout: (matchId: string, side: "A" | "B") => boolean;
  recordSanction: (
    matchId: string,
    side: "A" | "B",
    playerId: string | null,
    sanction: SanctionType
  ) => void;
  overrideLineup: (matchId: string, side: "A" | "B", lineup: string[]) => void;
  recordReception: (matchId: string, side: "A" | "B", playerId: string, rating: ReceptionRating) => void;
  recordSetting: (
    matchId: string,
    side: "A" | "B",
    payload: {
      setterId: string;
      quality: SettingQuality;
      attackZone: SettingAttackZone;
      attackerId?: string;
      attackResult?: SettingAttackResult;
      receptionQuality?: SettingQuality;
      attackType?: import("@/lib/formations/attack-types").AttackType;
      attackDirection?: AttackDirection;
    }
  ) => void;

  updateMatchFormat: (matchId: string, setsToWin: number, pointsPerSet: number) => void;
  overrideScore: (matchId: string, scoreA: number, scoreB: number) => void;
  undoLastEvent: (matchId: string) => void;
  reclassifyPointEvent: (
    matchId: string,
    eventId: string,
    newType: PointType,
    playerSide: "A" | "B",
    playerId: string | null
  ) => void;
  finishMatch: (id: string) => void;
  deleteMatch: (id: string) => void;
  seedDemo: () => void;
  seedDemoMatch: () => string | null;
}


const uid = () => Math.random().toString(36).slice(2, 10);

// Índices oficiales en `onCourt`: 0=Z1, 1=Z2, 2=Z3, 3=Z4, 4=Z5, 5=Z6.
// Regla del líbero: entra por el central mientras éste esté en zaga (Z1, Z6 o
// Z5) y sale automáticamente cuando el central rota a la primera línea (Z4).
// Prioridad de entrada: Z1 (sólo si el equipo no está sacando: el central
// primero saca), Z6 y Z5 — cubrimos al central desde cualquier posición zaguera.
const LIBERO_EXIT_INDEXES = new Set([1, 2, 3]);
const BACK_ROW_REPLACE_PRIORITY = [0, 5, 4] as const;

/** Rotate clockwise: position 2 -> 1, 3 -> 2, etc. */
function rotateClockwise(arr: string[]): string[] {
  if (arr.length < 2) return [...arr];
  return [arr[1], arr[2], arr[3], arr[4], arr[5], arr[0]];
}

export function timeoutsUsedInSet(match: Match, side: "A" | "B", setNumber: number): number {
  return match.events.filter(
    (e) => "kind" in e && e.kind === "timeout" && e.side === side && e.setNumber === setNumber
  ).length;
}

function scoringSideFor(playerSide: "A" | "B", type: PointType): "A" | "B" {
  if (type === "serve_error" || type === "unforced_error" || type === "rotation_error" || type === "attack_error" || type === "block_error") {
    return playerSide === "A" ? "B" : "A";
  }
  return playerSide;
}

function replayMatch(m: Match): {
  sets: MatchSet[];
  currentSet: number;
  status: MatchStatus;
  onCourtA: string[];
  onCourtB: string[];
  servingSide: "A" | "B";
  liberoActiveA: { liberoId: string; replacedId: string } | null;
  liberoActiveB: { liberoId: string; replacedId: string } | null;
} {
  const lineupFor = (setNum: number, side: "A" | "B"): string[] =>
    m.lineupsBySet?.[setNum]?.[side] ?? (side === "A" ? m.startingLineupA : m.startingLineupB);
  let sets: MatchSet[] = [{ number: 1, scoreA: 0, scoreB: 0, finished: false }];
  let currentSet = 1;
  let status: MatchStatus = m.events.length === 0 && m.status === "scheduled" ? "scheduled" : "live";
  let onCourtA = [...lineupFor(1, "A")];
  let onCourtB = [...lineupFor(1, "B")];
  let servingSide: "A" | "B" = m.initialServingSide;
  let liberoA: { liberoId: string; replacedId: string } | null = null;
  let liberoB: { liberoId: string; replacedId: string } | null = null;
  const targetFor = (setNum: number) => {
    // Set decisivo (tie-break) siempre a 15 con diferencia de 2
    const decidingSet = m.setsToWin * 2 - 1;
    return setNum === decidingSet ? 15 : m.pointsPerSet;
  };

  // Tras cualquier recálculo: si el líbero quedó en primera línea (Z4/Z3/Z2),
  // sale automáticamente y vuelve la jugadora reemplazada al mismo slot.
  // El líbero cubre a la central en toda la zaga (Z1, Z6, Z5) y sólo sale al
  // subir a Z4 para atacar/bloquear.
  const autoOutIfExit = (side: "A" | "B") => {
    const lib = side === "A" ? liberoA : liberoB;
    if (!lib) return;
    const arr = side === "A" ? onCourtA : onCourtB;
    const idx = arr.indexOf(lib.liberoId);
    if (LIBERO_EXIT_INDEXES.has(idx)) {
      const next = arr.map((p, i) => (i === idx ? lib.replacedId : p));
      if (side === "A") { onCourtA = next; liberoA = null; }
      else { onCourtB = next; liberoB = null; }
    }
  };

  for (const ev of m.events) {
    if ("kind" in ev) {
      if (ev.kind === "sub") {
        if (ev.side === "A") onCourtA = onCourtA.map((p) => (p === ev.playerOutId ? ev.playerInId : p));
        else onCourtB = onCourtB.map((p) => (p === ev.playerOutId ? ev.playerInId : p));
      } else if (ev.kind === "libero") {
        if (ev.action === "in") {
          if (ev.side === "A") {
            onCourtA = onCourtA.map((p) => (p === ev.replacedId ? ev.liberoId : p));
            liberoA = { liberoId: ev.liberoId, replacedId: ev.replacedId };
          } else {
            onCourtB = onCourtB.map((p) => (p === ev.replacedId ? ev.liberoId : p));
            liberoB = { liberoId: ev.liberoId, replacedId: ev.replacedId };
          }
        } else {
          // out / auto_out: vuelve el reemplazado al slot del líbero
          if (ev.side === "A") {
            onCourtA = onCourtA.map((p) => (p === ev.liberoId ? ev.replacedId : p));
            liberoA = null;
          } else {
            onCourtB = onCourtB.map((p) => (p === ev.liberoId ? ev.replacedId : p));
            liberoB = null;
          }
        }
      } else if (ev.kind === "lineupOverride") {
        if (ev.side === "A") { onCourtA = [...ev.lineup]; liberoA = null; }
        else { onCourtB = [...ev.lineup]; liberoB = null; }
      }
      autoOutIfExit(ev.side);
      continue;
    }
    const cur = sets[sets.length - 1];
    if (ev.scoringSide === "A") cur.scoreA++;
    else cur.scoreB++;
    // Rotation: scoring side rotates only if they were NOT serving.
    if (ev.scoringSide !== servingSide) {
      if (ev.scoringSide === "A") onCourtA = rotateClockwise(onCourtA);
      else onCourtB = rotateClockwise(onCourtB);
      servingSide = ev.scoringSide;
    }
    autoOutIfExit("A");
    autoOutIfExit("B");
    const target = targetFor(cur.number);
    if ((cur.scoreA >= target || cur.scoreB >= target) && Math.abs(cur.scoreA - cur.scoreB) >= 2) {
      cur.finished = true;
      const setsWonA = sets.filter((s) => s.finished && s.scoreA > s.scoreB).length;
      const setsWonB = sets.filter((s) => s.finished && s.scoreB > s.scoreA).length;
      if (setsWonA >= m.setsToWin || setsWonB >= m.setsToWin) {
        status = "finished";
      } else {
        currentSet++;
        sets.push({ number: currentSet, scoreA: 0, scoreB: 0, finished: false });
        // Reset rotation each set to that set's lineup (or starting lineup)
        onCourtA = [...lineupFor(currentSet, "A")];
        onCourtB = [...lineupFor(currentSet, "B")];
        liberoA = null;
        liberoB = null;
        // Alternate first server each set
        servingSide = currentSet % 2 === 1 ? m.initialServingSide : (m.initialServingSide === "A" ? "B" : "A");
      }
    }
  }
  return { sets, currentSet, status, onCourtA, onCourtB, servingSide, liberoActiveA: liberoA, liberoActiveB: liberoB };
}

/**
 * Auto-líbero: recalcula la cancha y, si no hay líbero activo, entra por la
 * central que esté en cualquier posición zaguera (Z1, Z6 o Z5). Z1 se salta
 * mientras el equipo está sacando (la central saca primero y el líbero entra
 * al perder el saque). La salida al subir a la primera línea (Z4) se resuelve
 * en `autoOutIfExit` dentro de `replayMatch`.
 */
function applyAutoLibero(match: Match, teams: Team[]): Match {
  let next = match;
  let r = replayMatch(next);
  next = { ...next, ...r };
  if (r.status === "finished") return next;
  let changed = true;
  let safety = 6;
  while (changed && safety-- > 0) {
    changed = false;
    for (const side of ["A", "B"] as const) {
      const team = teams.find((t) => t.id === (side === "A" ? next.teamAId : next.teamBId));
      if (!team) continue;
      const libIds = (
        side === "A"
          ? [next.liberoA1Id, next.liberoA2Id]
          : [next.liberoB1Id, next.liberoB2Id]
      ).filter(Boolean) as string[];
      if (libIds.length === 0) continue;
      const libActive = side === "A" ? r.liberoActiveA : r.liberoActiveB;
      if (libActive) continue;
      const onCourt = side === "A" ? r.onCourtA : r.onCourtB;
      const liberoId = libIds.find((id) => !onCourt.includes(id));
      if (!liberoId) continue;
      const backIdxs = BACK_ROW_REPLACE_PRIORITY.filter((idx) => idx !== 0 || r.servingSide !== side);
      let replacedId: string | null = null;
      for (const i of backIdxs) {
        const p = team.players.find((pp) => pp.id === onCourt[i]);
        if (p?.position === "central") {
          replacedId = onCourt[i];
          break;
        }
      }
      if (!replacedId) continue;
      const libEv: LiberoEvent = {
        id: uid(),
        kind: "libero",
        side,
        action: "in",
        liberoId,
        replacedId,
        source: "auto",
        setNumber: next.currentSet,
        timestamp: Date.now() + 1,
      };
      next = { ...next, events: [...next.events, libEv] };
      r = replayMatch(next);
      next = { ...next, ...r };
      changed = true;
    }
  }
  return next;
}

export const useVolley = create<VolleyState>()(
  persist(
    (set, get) => ({
      teams: [],
      matches: [],
      leagues: [],
      customReceptionFormations: {},

      setReceptionSlot: (rotation, role, pos) =>
        set((s) => {
          const current = s.customReceptionFormations ?? {};
          const rot = current[rotation] ?? {};
          return {
            customReceptionFormations: {
              ...current,
              [rotation]: { ...rot, [role]: { x: pos.x, y: pos.y } },
            },
          };
        }),
      resetReceptionRotation: (rotation) =>
        set((s) => {
          const current = { ...(s.customReceptionFormations ?? {}) };
          delete current[rotation];
          return { customReceptionFormations: current };
        }),
      resetAllReceptionFormations: () =>
        set(() => ({ customReceptionFormations: {} })),



      addLeague: (l) => {
        const id = l.id ?? uid();
        set((s) => ({ leagues: [...s.leagues, { ...l, id }] }));
        return id;
      },
      updateLeague: (id, patch) =>
        set((s) => ({ leagues: s.leagues.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      removeLeague: (id) =>
        set((s) => ({
          leagues: s.leagues.filter((l) => l.id !== id),
          teams: s.teams.map((t) => (t.leagueId === id ? { ...t, leagueId: undefined } : t)),
        })),

      addTeam: (t) => {
        const id = uid();
        set((s) => ({ teams: [...s.teams, { ...t, id, players: [] }] }));
        return id;
      },
      updateTeam: (id, patch) =>
        set((s) => ({ teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTeam: (id) =>
        set((s) => ({
          teams: s.teams.filter((t) => t.id !== id),
          matches: s.matches.filter((m) => m.teamAId !== id && m.teamBId !== id),
        })),
      addPlayer: (teamId, p) =>
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === teamId ? { ...t, players: [...t.players, { ...p, id: uid() }] } : t
          ),
        })),
      updatePlayer: (teamId, playerId, patch) =>
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === teamId
              ? { ...t, players: t.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)) }
              : t
          ),
        })),
      removePlayer: (teamId, playerId) =>
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === teamId ? { ...t, players: t.players.filter((p) => p.id !== playerId) } : t
          ),
        })),


      createMatch: (m) => {
        const id = uid();
        const initialServingSide = m.initialServingSide ?? "A";
        const match: Match = {
          ...m,
          id,
          status: "scheduled",
          currentSet: 1,
          sets: [{ number: 1, scoreA: 0, scoreB: 0, finished: false }],
          onCourtA: [...m.startingLineupA],
          onCourtB: [...m.startingLineupB],
          events: [],
          servingSide: initialServingSide,
          initialServingSide,
          createdAt: Date.now(),
        };
        set((s) => ({ matches: [...s.matches, match] }));
        return id;
      },

      startMatch: (id) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== id) return m;
            const live = { ...m, status: "live" as MatchStatus };
            return applyAutoLibero(live, s.teams);
          }),
        })),




      setInitialServingSide: (id, side) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== id) return m;
            const hasEvents = m.events.some(
              (e) => "setNumber" in e && e.setNumber === m.currentSet
            );
            if (hasEvents) return m;
            return { ...m, initialServingSide: side, servingSide: side };
          }),
        })),

      setSetLineup: (matchId, side, lineup) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const lineupsBySet = { ...(m.lineupsBySet ?? {}) };
            lineupsBySet[m.currentSet] = { ...(lineupsBySet[m.currentSet] ?? {}), [side]: lineup };
            const next = { ...m, lineupsBySet };
            const withAuto = applyAutoLibero(next, s.teams);
            return { ...withAuto, status: m.status };
          }),
        })),


      confirmSetLineup: (matchId) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId
              ? { ...m, confirmedLineupSets: [...new Set([...(m.confirmedLineupSets ?? []), m.currentSet])] }
              : m
          ),
        })),

      startSet: (matchId) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            if (m.setStartTimes?.[m.currentSet]) return m;
            return {
              ...m,
              setStartTimes: { ...(m.setStartTimes ?? {}), [m.currentSet]: Date.now() },
            };
          }),
        })),


      toggleSidesFlipped: (matchId) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, sidesFlipped: !m.sidesFlipped } : m
          ),
        })),

      recordPoint: (matchId, playerSide, type, playerId, attackZone, attackType, attackDirection) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId || m.status === "finished") return m;
            const scoringSide = scoringSideFor(playerSide, type);
            const ev: PointEvent = {
              id: uid(),
              scoringSide,
              playerSide,
              playerId,
              type,
              setNumber: m.currentSet,
              timestamp: Date.now(),
              ...(attackZone !== undefined && isAttackType(type) ? { attackZone } : {}),
              ...(attackType !== undefined && (isAttackType(type) || type === "attack_error")
                ? { attackType }
                : {}),
              ...(attackDirection !== undefined && (isAttackType(type) || type === "attack_error")
                ? { attackDirection }
                : {}),
            };

            const withEvent: Match = { ...m, events: [...m.events, ev] };
            const next = applyAutoLibero(withEvent, s.teams);
            return next;

          }),
        }));
      },

      recordSubstitution: (matchId, side, playerInId, playerOutId) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const ev: SubstitutionEvent = {
              id: uid(),
              kind: "sub",
              side,
              playerInId,
              playerOutId,
              setNumber: m.currentSet,
              timestamp: Date.now(),
            };
            const withEvent = { ...m, events: [...m.events, ev] };
            return applyAutoLibero(withEvent, s.teams);
          }),
        }));
      },


      recordLiberoIn: (matchId, side, liberoId, replacedId) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const ev: LiberoEvent = {
              id: uid(),
              kind: "libero",
              side,
              action: "in",
              liberoId,
              replacedId,
              setNumber: m.currentSet,
              timestamp: Date.now(),
            };
            const next = { ...m, events: [...m.events, ev] };
            return applyAutoLibero(next, s.teams);
          }),
        }));
      },

      recordLiberoOut: (matchId, side) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const active = side === "A" ? m.liberoActiveA : m.liberoActiveB;
            if (!active) return m;
            const ev: LiberoEvent = {
              id: uid(),
              kind: "libero",
              side,
              action: "out",
              liberoId: active.liberoId,
              replacedId: active.replacedId,
              setNumber: m.currentSet,
              timestamp: Date.now(),
            };
            const next = { ...m, events: [...m.events, ev] };
            const r = replayMatch(next);
            return { ...next, ...r };
          }),
        }));
      },


      recordTimeout: (matchId, side) => {
        const m = get().matches.find((x) => x.id === matchId);
        if (!m) return false;
        const used = timeoutsUsedInSet(m, side, m.currentSet);
        if (used >= 2) return false;
        const ev: TimeoutEvent = {
          id: uid(),
          kind: "timeout",
          side,
          setNumber: m.currentSet,
          timestamp: Date.now(),
        };
        set((s) => ({
          matches: s.matches.map((mm) =>
            mm.id === matchId ? { ...mm, events: [...mm.events, ev] } : mm
          ),
        }));
        return true;
      },

      recordSanction: (matchId, side, playerId, sanction) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const ev: SanctionEvent = {
              id: uid(),
              kind: "sanction",
              side,
              playerId,
              sanction,
              setNumber: m.currentSet,
              timestamp: Date.now(),
            };
            // Red card and yellow_red award a point to the opponent.
            const awardsPoint = sanction === "red" || sanction === "yellow_red" || sanction === "red_expulsion";
            let next: Match = { ...m, events: [...m.events, ev] };
            if (awardsPoint) {
              const scoringSide: "A" | "B" = side === "A" ? "B" : "A";
              const pev: PointEvent = {
                id: uid(),
                scoringSide,
                playerSide: side,
                playerId,
                type: "opponent_error",
                setNumber: m.currentSet,
                timestamp: Date.now() + 1,
              };
              next = { ...next, events: [...next.events, pev] };
              next = applyAutoLibero(next, s.teams);
            }
            return next;
          }),
        }));
      },

      overrideLineup: (matchId, side, lineup) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const ev: LineupOverrideEvent = {
              id: uid(),
              kind: "lineupOverride",
              side,
              lineup: [...lineup],
              setNumber: m.currentSet,
              timestamp: Date.now(),
            };
            const next = { ...m, events: [...m.events, ev] };
            const r = replayMatch(next);
            return { ...next, ...r };
          }),
        }));
      },

      recordReception: (matchId, side, playerId, rating) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const ev: ReceptionEvent = {
              id: uid(),
              kind: "reception",
              side,
              playerId,
              rating,
              setNumber: m.currentSet,
              timestamp: Date.now(),
            };
            let next = { ...m, events: [...m.events, ev] };
            // Punto directo de saque (≠): ace para el equipo sacador.
            if (rating === "overpass") {
              const servingSide: "A" | "B" = side === "A" ? "B" : "A";
              const serverLineup = servingSide === "A" ? next.onCourtA : next.onCourtB;
              const serverId = serverLineup[0] ?? null;
              const pev: PointEvent = {
                id: uid(),
                scoringSide: servingSide,
                playerSide: servingSide,
                playerId: serverId,
                type: "ace",
                setNumber: next.currentSet,
                timestamp: Date.now() + 1,
              };
              next = { ...next, events: [...next.events, pev] };
              return applyAutoLibero(next, s.teams);
            }
            return next;
          }),
        }));
      },

      recordSetting: (matchId, side, payload) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const ev: SettingEvent = {
              id: uid(),
              kind: "setting",
              side,
              setterId: payload.setterId,
              quality: payload.quality,
              attackZone: payload.attackZone,
              ...(payload.attackerId ? { attackerId: payload.attackerId } : {}),
              ...(payload.attackResult ? { attackResult: payload.attackResult } : {}),
              ...(payload.receptionQuality ? { receptionQuality: payload.receptionQuality } : {}),
              ...(payload.attackType ? { attackType: payload.attackType } : {}),
              ...(payload.attackDirection !== undefined ? { attackDirection: payload.attackDirection } : {}),
              setNumber: m.currentSet,
              timestamp: Date.now(),
            };
            return { ...m, events: [...m.events, ev] };
          }),
        }));
      },

      recordAttackAttempt: (matchId, side, playerId, opts) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId || m.status === "finished") return m;
            const ev: AttackAttemptEvent = {
              id: uid(),
              kind: "attackAttempt",
              side,
              playerId,
              setNumber: m.currentSet,
              timestamp: Date.now(),
              ...(opts?.attackZone !== undefined ? { attackZone: opts.attackZone } : {}),
              ...(opts?.attackType ? { attackType: opts.attackType } : {}),
              ...(opts?.attackDirection !== undefined ? { attackDirection: opts.attackDirection } : {}),
              ...(opts?.isCounter ? { isCounter: true } : {}),
            };
            return { ...m, events: [...m.events, ev] };
          }),
        }));
      },

      updateMatchFormat: (matchId, setsToWin, pointsPerSet) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const next = { ...m, setsToWin, pointsPerSet };
            const r = replayMatch(next);
            return { ...next, ...r };
          }),
        }));
      },

      overrideScore: (matchId, scoreA, scoreB) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId || m.status === "finished") return m;
            const setNum = m.currentSet;
            const preservedEvents = m.events.filter((e) => {
              if (!("scoringSide" in e)) return true;
              return e.setNumber !== setNum;
            });
            const newPoints: PointEvent[] = [];
            const now = Date.now();
            let a = 0, b = 0, i = 0;
            while (a < scoreA || b < scoreB) {
              if (a < scoreA) {
                newPoints.push({
                  id: uid(),
                  scoringSide: "A",
                  playerSide: "A",
                  playerId: null,
                  type: "opponent_error",
                  setNumber: setNum,
                  timestamp: now + i,
                });
                a++; i++;
              }
              if (b < scoreB) {
                newPoints.push({
                  id: uid(),
                  scoringSide: "B",
                  playerSide: "B",
                  playerId: null,
                  type: "opponent_error",
                  setNumber: setNum,
                  timestamp: now + i,
                });
                b++; i++;
              }
            }
            const next = { ...m, events: [...preservedEvents, ...newPoints] };
            return applyAutoLibero(next, s.teams);
          }),
        }));
      },

      undoLastEvent: (matchId) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const events = [...m.events];
            while (events.length > 0) {
              const last = events[events.length - 1];
              if (!("kind" in last) || last.kind !== "libero" || last.source !== "auto") break;
              events.pop();
            }
            events.pop();
            const next = { ...m, events };
            // If still has events, stay live; if no events and was finished, revert.
            return applyAutoLibero(next, s.teams);
          }),
        }));
      },

      reclassifyPointEvent: (matchId, eventId, newType, playerSide, playerId) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const events = m.events.map((e) => {
              if (e.id !== eventId || !("type" in e)) return e;
              const scoringSide = scoringSideFor(playerSide, newType);
              return { ...e, type: newType, playerSide, playerId, scoringSide };
            });
            return applyAutoLibero({ ...m, events }, s.teams);
          }),
        }));
      },

      finishMatch: (id) =>
        set((s) => ({
          matches: s.matches.map((m) => (m.id === id ? { ...m, status: "finished" } : m)),
        })),

      deleteMatch: (id) =>
        set((s) => ({ matches: s.matches.filter((m) => m.id !== id) })),

      seedDemo: () => {
        if (get().teams.length > 0) return;
        const leagueId = uid();
        const league: League = { id: leagueId, name: "Liga Apertura", season: "2026" };
        const mkTeam = (name: string, shortName: string, color: string, names: string[]): Team => ({
          id: uid(),
          name,
          shortName,
          color,
          leagueId,
          players: names.map((n, i) => ({ id: uid(), name: n, number: i + 1, position: PLAYER_POSITIONS[i % PLAYER_POSITIONS.length] })),
        });
        const teams = [
          mkTeam("Tiburones FC", "TIB", "#ff7a3d", [
            "M. Pérez", "L. Gómez", "J. Ruiz", "F. Soto", "D. Vega",
            "R. Castro", "P. Méndez", "A. Núñez",
          ]),
          mkTeam("Cóndores", "CND", "#3ec1d3", [
            "S. Bravo", "I. Luna", "N. Reyes", "T. Ortiz", "G. Mora",
            "H. Silva", "C. Paz", "B. Rojas",
          ]),
          mkTeam("Pumas Voley", "PUM", "#ffd23f", [
            "E. Salas", "V. Acosta", "K. Díaz", "O. Pinto", "M. Vidal",
            "J. Cano", "Q. Ibarra", "Z. Lara",
          ]),
          mkTeam("Halcones", "HAL", "#9b5de5", [
            "W. Vera", "U. Romero", "X. Peña", "Y. Cabrera", "L. Fuentes",
            "T. Aguirre", "R. Mansilla", "S. Quiroga",
          ]),
        ];
        set({ teams, leagues: [league] });
      },

      seedDemoMatch: () => {
        if (get().teams.length < 2) get().seedDemo();
        const teams = get().teams;
        if (teams.length < 2) return null;
        const teamA = teams[0];
        const teamB = teams[1];
        const startingLineupA = teamA.players.slice(0, 6).map((p) => p.id);
        const startingLineupB = teamB.players.slice(0, 6).map((p) => p.id);
        if (startingLineupA.length < 6 || startingLineupB.length < 6) return null;

        const matchId = uid();
        const initialServingSide: "A" | "B" = "A";
        const now = Date.now() - 1000 * 60 * 120;
        const setScores: Array<[number, number]> = [[25, 20], [22, 25], [25, 18], [25, 22]];
        const scoringTypes: PointType[] = [
          "attack", "attack", "attack", "block", "ace",
          "counter_attack", "rotation_attack", "opponent_error",
          "unforced_error", "serve_error", "attack_error",
        ];
        let seed = 42;
        const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

        const events: MatchEvent[] = [];
        let ts = now;
        const setStartTimes: Record<number, number> = {};

        for (let i = 0; i < setScores.length; i++) {
          const setNum = i + 1;
          const [sa, sb] = setScores[i];
          setStartTimes[setNum] = ts;
          const seq: ("A" | "B")[] = [];
          let na = 0, nb = 0;
          while (na < sa || nb < sb) {
            if (na < sa && (nb >= sb || rand() < sa / (sa + sb))) { seq.push("A"); na++; }
            else { seq.push("B"); nb++; }
          }
          for (const sc of seq) {
            const t = scoringTypes[Math.floor(rand() * scoringTypes.length)];
            const isError = t === "serve_error" || t === "unforced_error" || t === "attack_error" || t === "block_error";
            const playerSide: "A" | "B" = isError || t === "opponent_error"
              ? (sc === "A" ? "B" : "A")
              : sc;
            const lineup = playerSide === "A" ? startingLineupA : startingLineupB;
            const playerId = t === "opponent_error" ? null : lineup[Math.floor(rand() * lineup.length)];
            ts += 30000;
            events.push({
              id: uid(),
              scoringSide: sc,
              playerSide,
              playerId,
              type: t,
              setNumber: setNum,
              timestamp: ts,
            });
          }
          ts += 1000 * 60 * 3;
        }

        const base: Match = {
          id: matchId,
          teamAId: teamA.id,
          teamBId: teamB.id,
          startingLineupA,
          startingLineupB,
          onCourtA: [...startingLineupA],
          onCourtB: [...startingLineupB],
          status: "live",
          currentSet: 1,
          setsToWin: 3,
          pointsPerSet: 25,
          sets: [{ number: 1, scoreA: 0, scoreB: 0, finished: false }],
          events,
          servingSide: initialServingSide,
          initialServingSide,
          scheduledAt: now,
          createdAt: now,
          setStartTimes,
          confirmedLineupSets: [1, 2, 3, 4],
        };
        const r = replayMatch(base);
        const finalMatch: Match = { ...base, ...r, status: "finished" };
        set((s) => ({ matches: [...s.matches, finalMatch] }));
        return matchId;
      },

    }),
    { name: "volley-stats-store-v2" }
  )
);

// ---------- Selectors / helpers ----------

export function getTeam(state: VolleyState, id: string) {
  return state.teams.find((t) => t.id === id);
}
export function getPlayer(team: Team | undefined, id: string | null) {
  if (!team || !id) return undefined;
  return team.players.find((p) => p.id === id);
}
export function setsWon(match: Match) {
  if (match.status === "finished") {
    const a = match.sets.filter((s) => s.scoreA > s.scoreB).length;
    const b = match.sets.filter((s) => s.scoreB > s.scoreA).length;
    return { a, b };
  }
  const a = match.sets.filter((s) => s.finished && s.scoreA > s.scoreB).length;
  const b = match.sets.filter((s) => s.finished && s.scoreB > s.scoreA).length;
  return { a, b };
}
export function currentServer(match: Match): { side: "A" | "B"; playerId: string | null } {
  const lineup = match.servingSide === "A" ? match.onCourtA : match.onCourtB;
  return { side: match.servingSide, playerId: lineup[0] ?? null };
}


/** Duration of a set in ms. Returns null if the set hasn't started yet. */
export function getSetDuration(match: Match, setNumber: number, nowMs?: number): number | null {
  const start = match.setStartTimes?.[setNumber];
  if (!start) return null;
  const setObj = match.sets.find((s) => s.number === setNumber);
  if (setObj?.finished) {
    // last event timestamp within this set is the end
    for (let i = match.events.length - 1; i >= 0; i--) {
      const ev = match.events[i];
      if ("setNumber" in ev && ev.setNumber === setNumber) {
        return Math.max(0, ev.timestamp - start);
      }
    }
    return 0;
  }
  return Math.max(0, (nowMs ?? Date.now()) - start);
}

export function formatDurationMs(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatLocalTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export interface PlayerStat {
  playerId: string;
  name: string;
  number: number;
  attack: number;
  rotationAttack: number;
  counterAttack: number;
  block: number;
  ace: number;
  serveError: number;
  unforcedError: number;
  attackError: number;
  blockError: number;
  total: number;
}

export interface TeamStat {
  teamId: string;
  attack: number;
  rotationAttack: number;
  counterAttack: number;
  block: number;
  ace: number;
  opponentErrors: number;
  total: number;
  unforcedErrors: number;
  serveErrors: number;
  attackErrors: number;
  blockErrors: number;
}

function aggregateEvents(events: MatchEvent[], match: Match) {
  const players = new Map<string, PlayerStat>();
  const teams = new Map<string, TeamStat>();
  const ensureTeam = (id: string): TeamStat => {
    let t = teams.get(id);
    if (!t) {
      t = {
        teamId: id, attack: 0, rotationAttack: 0, counterAttack: 0, block: 0, ace: 0,
        opponentErrors: 0, total: 0, unforcedErrors: 0, serveErrors: 0, attackErrors: 0, blockErrors: 0,
      };
      teams.set(id, t);
    }
    return t;
  };
  const ensurePlayer = (pid: string): PlayerStat => {
    let p = players.get(pid);
    if (!p) {
      p = { playerId: pid, name: "", number: 0, attack: 0, rotationAttack: 0, counterAttack: 0, block: 0, ace: 0, serveError: 0, unforcedError: 0, attackError: 0, blockError: 0, total: 0 };
      players.set(pid, p);
    }
    return p;
  };
  for (const ev of events) {
    // Ataques neutros: cuentan como intento sin cambiar marcador.
    if ("kind" in ev && ev.kind === "attackAttempt") {
      const teamId = ev.side === "A" ? match.teamAId : match.teamBId;
      const t = ensureTeam(teamId);
      t.attack++;
      if (ev.playerId) {
        const p = ensurePlayer(ev.playerId);
        p.attack++;
      }
      continue;
    }
    if (!("type" in ev)) continue;
    const scoringTeamId = ev.scoringSide === "A" ? match.teamAId : match.teamBId;
    const scoringTeam = ensureTeam(scoringTeamId);
    scoringTeam.total++;
    if (ev.type === "attack") scoringTeam.attack++;
    if (ev.type === "block") scoringTeam.block++;
    if (ev.type === "ace") scoringTeam.ace++;
    if (ev.type === "rotation_attack") { scoringTeam.attack++; scoringTeam.rotationAttack++; }
    if (ev.type === "counter_attack") { scoringTeam.attack++; scoringTeam.counterAttack++; }
    if (ev.type === "opponent_error") scoringTeam.opponentErrors++;
    if (ev.type === "opponent_rotation_error") scoringTeam.opponentErrors++;

    if (ev.type === "serve_error" || ev.type === "unforced_error" || ev.type === "rotation_error" || ev.type === "attack_error" || ev.type === "block_error") {
      const errorTeamId = ev.playerSide === "A" ? match.teamAId : match.teamBId;
      const et = ensureTeam(errorTeamId);
      if (ev.type === "serve_error") et.serveErrors++;
      else if (ev.type === "attack_error") et.attackErrors++;
      else if (ev.type === "block_error") et.blockErrors++;
      else et.unforcedErrors++;
      if (ev.playerId) {
        const pp = ensurePlayer(ev.playerId);
        if (ev.type === "serve_error") pp.serveError++;
        else if (ev.type === "attack_error") pp.attackError++;
        else if (ev.type === "block_error") pp.blockError++;
        else pp.unforcedError++;
      }
    } else if (ev.playerId) {
      const p = ensurePlayer(ev.playerId);
      if (ev.type === "attack" || ev.type === "counter_attack" || ev.type === "rotation_attack") p.attack++;
      if (ev.type === "rotation_attack") p.rotationAttack++;
      if (ev.type === "counter_attack") p.counterAttack++;
      if (ev.type === "block") p.block++;
      if (ev.type === "ace") p.ace++;
      p.total++;
    }
  }
  return { players, teams };
}

export function computeMatchStats(match: Match) {
  return aggregateEvents(match.events, match);
}

export function computeSetStats(match: Match, setNumber: number) {
  const setEvents = match.events.filter((e) => ("setNumber" in e) && e.setNumber === setNumber);
  return aggregateEvents(setEvents, match);
}

export interface ReceptionStat {
  playerId: string;
  /** # perfectas */
  doublePositive: number;
  /** + positivas */
  positive: number;
  /** 0 neutras */
  neutral: number;
  /** - negativas */
  negative: number;
  /** = doble negativa */
  doubleNegative: number;
  /** ≠ punto directo de saque (error) */
  overpass: number;
  total: number;
  /** Positividad = (# + +) / total * 100 */
  positivity: number;
  /** Eficiencia estilo Data Volley = (# − = − ≠) / total * 100 */
  efficiency: number;
}

export function computeReceptionStats(events: MatchEvent[], side?: "A" | "B"): Map<string, ReceptionStat> {
  const m = new Map<string, ReceptionStat>();
  for (const ev of events) {
    if (!("kind" in ev) || ev.kind !== "reception") continue;
    if (side && ev.side !== side) continue;
    let s = m.get(ev.playerId);
    if (!s) {
      s = {
        playerId: ev.playerId,
        doublePositive: 0, positive: 0, neutral: 0,
        negative: 0, doubleNegative: 0, overpass: 0,
        total: 0, positivity: 0, efficiency: 0,
      };
      m.set(ev.playerId, s);
    }
    switch (ev.rating) {
      case "double_positive": s.doublePositive++; break;
      case "positive": s.positive++; break;
      case "neutral": s.neutral++; break;
      case "negative": s.negative++; break;
      case "double_negative": s.doubleNegative++; break;
      case "overpass": s.overpass++; break;
    }
    s.total++;
    if (s.total > 0) {
      s.positivity = ((s.doublePositive + s.positive) / s.total) * 100;
      s.efficiency = ((s.doublePositive - s.doubleNegative - s.overpass) / s.total) * 100;
    }
  }
  return m;
}

/** True if the receiving side still needs to record a reception for the current rally in `setNumber`. */
export function needsReceptionForRally(match: Match, setNumber: number, receivingSide: "A" | "B"): boolean {
  const setEvents = match.events.filter((e) => "setNumber" in e && e.setNumber === setNumber);
  for (let i = setEvents.length - 1; i >= 0; i--) {
    const ev = setEvents[i];
    if ("kind" in ev) {
      if (ev.kind === "reception" && ev.side === receivingSide) return false;
      continue;
    }
    // PointEvent → start of new rally; reception needed.
    return true;
  }
  return true;
}

/**
 * Devuelve el equipo (A|B) que registró una recepción válida en el rally
 * actual del set indicado, o null si aún no se registró ninguna recepción
 * desde el último punto (o desde el inicio del set).
 *
 * Se considera "rally actual" al tramo de eventos posterior al último
 * PointEvent del set. Si en ese tramo existe una recepción, se devuelve
 * el side de la jugadora que la ejecutó. Si dentro del mismo rally hay
 * recepciones de ambos lados (raro, inconsistencia), se prioriza la
 * última registrada para reflejar el estado más reciente.
 */
export function getCurrentRallyReceptionSide(match: Match, setNumber: number): "A" | "B" | null {
  const setEvents = match.events.filter((e) => "setNumber" in e && e.setNumber === setNumber);
  for (let i = setEvents.length - 1; i >= 0; i--) {
    const ev = setEvents[i];
    if ("kind" in ev) {
      if (ev.kind === "reception") return ev.side;
      continue;
    }
    // PointEvent — fin del rally anterior, no hay recepción para el actual.
    return null;
  }
  return null;
}



export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  leaguePoints: number;
}

export function computeStandings(
  teams: Team[],
  matches: Match[],
  leagueId?: string
): StandingRow[] {
  const scopedTeams = leagueId ? teams.filter((t) => t.leagueId === leagueId) : teams;
  const teamSet = new Set(scopedTeams.map((t) => t.id));
  const rows = new Map<string, StandingRow>();
  for (const t of scopedTeams) {
    rows.set(t.id, {
      teamId: t.id, played: 0, won: 0, lost: 0,
      setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0, leaguePoints: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "finished") continue;
    if (leagueId && (!teamSet.has(m.teamAId) || !teamSet.has(m.teamBId))) continue;
    const a = rows.get(m.teamAId);
    const b = rows.get(m.teamBId);
    if (!a || !b) continue;
    const won = setsWon(m);
    a.played++; b.played++;
    a.setsFor += won.a; a.setsAgainst += won.b;
    b.setsFor += won.b; b.setsAgainst += won.a;
    for (const s of m.sets) {
      a.pointsFor += s.scoreA; a.pointsAgainst += s.scoreB;
      b.pointsFor += s.scoreB; b.pointsAgainst += s.scoreA;
    }
    if (won.a > won.b) {
      a.won++; b.lost++;
      a.leaguePoints += won.b <= 1 ? 3 : 2;
      b.leaguePoints += won.b === 2 ? 1 : 0;
    } else {
      b.won++; a.lost++;
      b.leaguePoints += won.a <= 1 ? 3 : 2;
      a.leaguePoints += won.a === 2 ? 1 : 0;
    }
  }
  return [...rows.values()].sort(
    (x, y) =>
      y.leaguePoints - x.leaguePoints ||
      y.won - x.won ||
      (y.setsFor - y.setsAgainst) - (x.setsFor - x.setsAgainst) ||
      (y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst)
  );
}

