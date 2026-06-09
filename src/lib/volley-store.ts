import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PointType =
  | "attack"
  | "block"
  | "ace"
  | "opponent_error"
  | "serve_error"
  | "unforced_error";

export const POINT_TYPE_LABEL: Record<PointType, string> = {
  attack: "Ataque",
  block: "Bloqueo",
  ace: "Saque",
  opponent_error: "Error rival",
  serve_error: "Error de saque",
  unforced_error: "Error no forzado",
};

export interface Player {
  id: string;
  name: string;
  number: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  color: string;
  players: Player[];
}

export interface PointEvent {
  id: string;
  teamId: string;
  playerId: string | null; // null for opponent_error
  type: PointType;
  setNumber: number;
  timestamp: number;
}

export interface SubstitutionEvent {
  id: string;
  kind: "sub";
  teamId: string;
  playerInId: string;
  playerOutId: string;
  setNumber: number;
  timestamp: number;
}

export interface TimeoutEvent {
  id: string;
  kind: "timeout";
  teamId: string;
  setNumber: number;
  timestamp: number;
}

export type MatchEvent = PointEvent | SubstitutionEvent | TimeoutEvent;

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
  startingLineupA: string[]; // player IDs
  startingLineupB: string[];
  onCourtA: string[];
  onCourtB: string[];
  status: MatchStatus;
  currentSet: number;
  setsToWin: number; // best of 5 -> 3
  pointsPerSet: number; // 25
  sets: MatchSet[];
  events: MatchEvent[];
  scheduledAt: number;
  createdAt: number;
}

interface VolleyState {
  teams: Team[];
  matches: Match[];
  // teams
  addTeam: (t: Omit<Team, "id" | "players">) => string;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  removeTeam: (id: string) => void;
  addPlayer: (teamId: string, p: Omit<Player, "id">) => void;
  removePlayer: (teamId: string, playerId: string) => void;
  // matches
  createMatch: (m: Omit<Match, "id" | "events" | "sets" | "currentSet" | "status" | "onCourtA" | "onCourtB" | "createdAt">) => string;
  startMatch: (id: string) => void;
  recordPoint: (matchId: string, teamSide: "A" | "B", type: PointType, playerId: string | null) => void;
  recordSubstitution: (matchId: string, teamSide: "A" | "B", playerInId: string, playerOutId: string) => void;
  recordTimeout: (matchId: string, teamSide: "A" | "B") => void;
  undoLastEvent: (matchId: string) => void;
  finishMatch: (id: string) => void;
  deleteMatch: (id: string) => void;
  seedDemo: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useVolley = create<VolleyState>()(
  persist(
    (set, get) => ({
      teams: [],
      matches: [],

      addTeam: (t) => {
        const id = uid();
        set((s) => ({ teams: [...s.teams, { ...t, id, players: [] }] }));
        return id;
      },
      updateTeam: (id, patch) =>
        set((s) => ({ teams: s.teams.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTeam: (id) =>
        set((s) => ({ teams: s.teams.filter((t) => t.id !== id) })),
      addPlayer: (teamId, p) =>
        set((s) => ({
          teams: s.teams.map((t) =>
            t.id === teamId ? { ...t, players: [...t.players, { ...p, id: uid() }] } : t
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
        const match: Match = {
          ...m,
          id,
          status: "scheduled",
          currentSet: 1,
          sets: [{ number: 1, scoreA: 0, scoreB: 0, finished: false }],
          onCourtA: [...m.startingLineupA],
          onCourtB: [...m.startingLineupB],
          events: [],
          createdAt: Date.now(),
        };
        set((s) => ({ matches: [...s.matches, match] }));
        return id;
      },

      startMatch: (id) =>
        set((s) => ({
          matches: s.matches.map((m) => (m.id === id ? { ...m, status: "live" } : m)),
        })),

      recordPoint: (matchId, teamSide, type, playerId) => {
        const state = get();
        const match = state.matches.find((m) => m.id === matchId);
        if (!match || match.status === "finished") return;
        const teamId = teamSide === "A" ? match.teamAId : match.teamBId;
        const ev: PointEvent = {
          id: uid(),
          teamId,
          playerId,
          type,
          setNumber: match.currentSet,
          timestamp: Date.now(),
        };
        const sets = match.sets.map((s) => {
          if (s.number !== match.currentSet) return s;
          return {
            ...s,
            scoreA: teamSide === "A" ? s.scoreA + 1 : s.scoreA,
            scoreB: teamSide === "B" ? s.scoreB + 1 : s.scoreB,
          };
        });
        // Check set win
        const cur = sets.find((s) => s.number === match.currentSet)!;
        let currentSet = match.currentSet;
        let status: MatchStatus = match.status;
        const target = match.pointsPerSet;
        const setWon =
          (cur.scoreA >= target || cur.scoreB >= target) && Math.abs(cur.scoreA - cur.scoreB) >= 2;
        if (setWon) {
          cur.finished = true;
          // count sets
          const setsWonA = sets.filter((s) => s.finished && s.scoreA > s.scoreB).length;
          const setsWonB = sets.filter((s) => s.finished && s.scoreB > s.scoreA).length;
          if (setsWonA >= match.setsToWin || setsWonB >= match.setsToWin) {
            status = "finished";
          } else {
            currentSet = match.currentSet + 1;
            sets.push({ number: currentSet, scoreA: 0, scoreB: 0, finished: false });
          }
        }
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId
              ? { ...m, sets, events: [...m.events, ev], currentSet, status }
              : m
          ),
        }));
      },

      recordSubstitution: (matchId, teamSide, playerInId, playerOutId) => {
        const state = get();
        const match = state.matches.find((m) => m.id === matchId);
        if (!match) return;
        const teamId = teamSide === "A" ? match.teamAId : match.teamBId;
        const ev: SubstitutionEvent = {
          id: uid(),
          kind: "sub",
          teamId,
          playerInId,
          playerOutId,
          setNumber: match.currentSet,
          timestamp: Date.now(),
        };
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const onCourtA =
              teamSide === "A"
                ? m.onCourtA.map((p) => (p === playerOutId ? playerInId : p))
                : m.onCourtA;
            const onCourtB =
              teamSide === "B"
                ? m.onCourtB.map((p) => (p === playerOutId ? playerInId : p))
                : m.onCourtB;
            return { ...m, onCourtA, onCourtB, events: [...m.events, ev] };
          }),
        }));
      },

      recordTimeout: (matchId, teamSide) => {
        const state = get();
        const match = state.matches.find((m) => m.id === matchId);
        if (!match) return;
        const teamId = teamSide === "A" ? match.teamAId : match.teamBId;
        const ev: TimeoutEvent = {
          id: uid(),
          kind: "timeout",
          teamId,
          setNumber: match.currentSet,
          timestamp: Date.now(),
        };
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, events: [...m.events, ev] } : m
          ),
        }));
      },

      undoLastEvent: (matchId) => {
        set((s) => ({
          matches: s.matches.map((m) => {
            if (m.id !== matchId) return m;
            const events = [...m.events];
            const last = events.pop();
            if (!last) return m;
            // recompute sets from scratch
            let sets: MatchSet[] = [{ number: 1, scoreA: 0, scoreB: 0, finished: false }];
            let currentSet = 1;
            let status: MatchStatus = "live";
            for (const ev of events) {
              if ("type" in ev) {
                const isA = ev.teamId === m.teamAId;
                const cur = sets[sets.length - 1];
                cur.scoreA += isA ? 1 : 0;
                cur.scoreB += isA ? 0 : 1;
                const target = m.pointsPerSet;
                if (
                  (cur.scoreA >= target || cur.scoreB >= target) &&
                  Math.abs(cur.scoreA - cur.scoreB) >= 2
                ) {
                  cur.finished = true;
                  const setsWonA = sets.filter((s) => s.finished && s.scoreA > s.scoreB).length;
                  const setsWonB = sets.filter((s) => s.finished && s.scoreB > s.scoreA).length;
                  if (setsWonA >= m.setsToWin || setsWonB >= m.setsToWin) {
                    status = "finished";
                  } else {
                    currentSet++;
                    sets.push({ number: currentSet, scoreA: 0, scoreB: 0, finished: false });
                  }
                }
              }
            }
            return { ...m, events, sets, currentSet, status };
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
        const mkTeam = (name: string, shortName: string, color: string, names: string[]): Team => ({
          id: uid(),
          name,
          shortName,
          color,
          players: names.map((n, i) => ({ id: uid(), name: n, number: i + 1 })),
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
        set({ teams });
      },
    }),
    { name: "volley-stats-store-v1" }
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

export interface PlayerStat {
  playerId: string;
  name: string;
  number: number;
  attack: number;
  block: number;
  ace: number;
  total: number;
}

export interface TeamStat {
  teamId: string;
  attack: number;
  block: number;
  ace: number;
  opponentErrors: number;
  total: number;
  unforcedErrors: number; // points the opponent got via opponent_error against this team
}

export function computeMatchStats(match: Match) {
  const players = new Map<string, PlayerStat>();
  const teams = new Map<string, TeamStat>();
  const ensureTeam = (id: string): TeamStat => {
    let t = teams.get(id);
    if (!t) {
      t = { teamId: id, attack: 0, block: 0, ace: 0, opponentErrors: 0, total: 0, unforcedErrors: 0 };
      teams.set(id, t);
    }
    return t;
  };
  for (const ev of match.events) {
    if (!("type" in ev)) continue;
    const t = ensureTeam(ev.teamId);
    t.total++;
    if (ev.type === "attack") t.attack++;
    if (ev.type === "block") t.block++;
    if (ev.type === "ace") t.ace++;
    if (ev.type === "opponent_error") {
      t.opponentErrors++;
      // Attribute unforced error to the OTHER team
      const otherId = ev.teamId === match.teamAId ? match.teamBId : match.teamAId;
      ensureTeam(otherId).unforcedErrors++;
    }
    if (ev.playerId) {
      let p = players.get(ev.playerId);
      if (!p) {
        p = { playerId: ev.playerId, name: "", number: 0, attack: 0, block: 0, ace: 0, total: 0 };
        players.set(ev.playerId, p);
      }
      if (ev.type === "attack") p.attack++;
      if (ev.type === "block") p.block++;
      if (ev.type === "ace") p.ace++;
      p.total++;
    }
  }
  return { players, teams };
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
  leaguePoints: number; // 3 for 3-0/3-1, 2 for 3-2, 1 for 2-3, 0 for 0-3/1-3
}

export function computeStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id, played: 0, won: 0, lost: 0,
      setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0, leaguePoints: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "finished") continue;
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
