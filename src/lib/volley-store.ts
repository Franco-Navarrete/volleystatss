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
  | "attack_error";

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
};

export const ERROR_TYPES: PointType[] = ["serve_error", "unforced_error", "rotation_error", "attack_error"];

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

export interface League {
  id: string;
  name: string;
  season?: string;
  color?: string;
}

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
}


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

export type MatchEvent = PointEvent | SubstitutionEvent | TimeoutEvent | SanctionEvent | LiberoEvent | LineupOverrideEvent;

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


interface VolleyState {
  teams: Team[];
  matches: Match[];
  leagues: League[];
  addLeague: (l: Omit<League, "id">) => string;
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
    playerId: string | null
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
  recordLiberoOut: (matchId: string, side: "A" | "B") => void;
  recordTimeout: (matchId: string, side: "A" | "B") => boolean;
  recordSanction: (
    matchId: string,
    side: "A" | "B",
    playerId: string | null,
    sanction: SanctionType
  ) => void;
  overrideLineup: (matchId: string, side: "A" | "B", lineup: string[]) => void;
  undoLastEvent: (matchId: string) => void;
  finishMatch: (id: string) => void;
  deleteMatch: (id: string) => void;
  seedDemo: () => void;
}


const uid = () => Math.random().toString(36).slice(2, 10);

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
  if (type === "serve_error" || type === "unforced_error" || type === "rotation_error" || type === "attack_error") {
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
  const target = m.pointsPerSet;

  // Tras rotar: si el líbero quedó en posición de frente (índices 1,2,3 = pos 2,3,4),
  // sale automáticamente y vuelve el jugador original al mismo slot.
  const autoOutIfFront = (side: "A" | "B") => {
    const lib = side === "A" ? liberoA : liberoB;
    if (!lib) return;
    const arr = side === "A" ? onCourtA : onCourtB;
    const idx = arr.indexOf(lib.liberoId);
    if (idx === 1 || idx === 2 || idx === 3) {
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
      autoOutIfFront(ev.scoringSide);
    }
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

export const useVolley = create<VolleyState>()(
  persist(
    (set, get) => ({
      teams: [],
      matches: [],
      leagues: [],

      addLeague: (l) => {
        const id = uid();
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
          matches: s.matches.map((m) =>
            m.id === id ? { ...m, status: "live" } : m
          ),
        })),



      setInitialServingSide: (id, side) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === id && m.status === "scheduled"
              ? { ...m, initialServingSide: side, servingSide: side }
              : m
          ),
        })),

      setSetLineup: (matchId, side, lineup) =>
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const lineupsBySet = { ...(m.lineupsBySet ?? {}) };
            lineupsBySet[m.currentSet] = { ...(lineupsBySet[m.currentSet] ?? {}), [side]: lineup };
            const next = { ...m, lineupsBySet };
            const r = replayMatch(next);
            return { ...next, ...r, status: m.status };
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

      recordPoint: (matchId, playerSide, type, playerId) => {
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
            };
            const next = { ...m, events: [...m.events, ev] };
            const r = replayMatch(next);
            return { ...next, ...r };
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
            const next = { ...m, events: [...m.events, ev] };
            const r = replayMatch(next);
            return { ...next, ...r };
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
            const r = replayMatch(next);
            return { ...next, ...r };
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
              const r = replayMatch(next);
              next = { ...next, ...r };
            }
            return next;
          }),
        }));
      },

      undoLastEvent: (matchId) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const events = [...m.events];
            events.pop();
            const next = { ...m, events };
            const r = replayMatch(next);
            // If still has events, stay live; if no events and was finished, revert
            return { ...next, ...r };
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
}

function aggregateEvents(events: MatchEvent[], match: Match) {
  const players = new Map<string, PlayerStat>();
  const teams = new Map<string, TeamStat>();
  const ensureTeam = (id: string): TeamStat => {
    let t = teams.get(id);
    if (!t) {
      t = {
        teamId: id, attack: 0, rotationAttack: 0, counterAttack: 0, block: 0, ace: 0,
        opponentErrors: 0, total: 0, unforcedErrors: 0, serveErrors: 0,
      };
      teams.set(id, t);
    }
    return t;
  };
  const ensurePlayer = (pid: string): PlayerStat => {
    let p = players.get(pid);
    if (!p) {
      p = { playerId: pid, name: "", number: 0, attack: 0, rotationAttack: 0, counterAttack: 0, block: 0, ace: 0, serveError: 0, unforcedError: 0, total: 0 };
      players.set(pid, p);
    }
    return p;
  };
  for (const ev of events) {
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

    if (ev.type === "serve_error" || ev.type === "unforced_error" || ev.type === "rotation_error" || ev.type === "attack_error") {
      const errorTeamId = ev.playerSide === "A" ? match.teamAId : match.teamBId;
      const et = ensureTeam(errorTeamId);
      if (ev.type === "serve_error") et.serveErrors++;
      else et.unforcedErrors++;
      if (ev.playerId) {
        const pp = ensurePlayer(ev.playerId);
        if (ev.type === "serve_error") pp.serveError++;
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

