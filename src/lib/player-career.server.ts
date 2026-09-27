import { computeHistoricalStats, type MatchPerformance } from "./historical-stats";
import type { Match, Team } from "./volley-store";

export interface CareerTeam { teamId: string; teamName: string; club: string | null; category: string | null; gender: string | null; firstMatch: number | null; lastMatch: number | null; matches: number }
export interface CareerPerformance extends MatchPerformance { teamId: string; teamName: string; season: number }
export interface Career {
  matchesPlayed: number;
  totals: { points: number; attack: number; block: number; ace: number; counterAttack: number; serveError: number; attackError: number; unforcedError: number; mvp: number; receptionTotal: number; receptionPositive: number; receptionNegative: number };
  averages: { points: number; attack: number; block: number; ace: number; reception: number };
  records: { points: CareerPerformance | null; block: CareerPerformance | null; ace: CareerPerformance | null };
  performances: CareerPerformance[];
  teams: CareerTeam[];
  seasons: { season: number; matches: number; points: number; avgPoints: number }[];
}

export const EMPTY_CAREER: Career = {
  matchesPlayed: 0,
  totals: { points: 0, attack: 0, block: 0, ace: 0, counterAttack: 0, serveError: 0, attackError: 0, unforcedError: 0, mvp: 0, receptionTotal: 0, receptionPositive: 0, receptionNegative: 0 },
  averages: { points: 0, attack: 0, block: 0, ace: 0, reception: 0 },
  records: { points: null, block: null, ace: null },
  performances: [], teams: [], seasons: [],
};

/** Carrera completa de una cuenta: suma todas las filas de plantel vinculadas a ese usuario. */
export async function computeCareerForUser(db: any, userId: string): Promise<Career> {
  const { data: rows } = await db.from("players").select("id, team_id, name, number, position, photo_url").eq("user_id", userId);
  return computeCareerForRows(db, rows ?? []);
}

/** Carrera de una identidad deportiva (player_id), con o sin cuenta vinculada. */
export async function computeCareerForPlayer(db: any, playerId: string): Promise<Career> {
  const { data: row } = await db.from("players").select("id, team_id, name, number, position, photo_url, user_id").eq("id", playerId).maybeSingle();
  if (!row) return EMPTY_CAREER;
  // Con cuenta: el mismo perfil que ve la jugadora (todas sus filas). Sin cuenta: solo esta fila.
  if (row.user_id) return computeCareerForUser(db, row.user_id);
  return computeCareerForRows(db, [row]);
}

async function computeCareerForRows(db: any, rows: any[]): Promise<Career> {
  const linked = (rows ?? []) as { id: string; team_id: string; name: string; number: number; position: string | null; photo_url: string | null }[];
  if (!linked.length) return EMPTY_CAREER;
  const teamIds = [...new Set(linked.map((r) => r.team_id))];
  const { data: cloudTeams } = await db.from("teams").select("id, name, short_name, color, category, gender, club, clubs(name)").in("id", teamIds);

  const [{ data: states }, { data: deleted }] = await Promise.all([
    db.from("app_state").select("data"),
    db.from("match_deletions").select("match_id"),
  ]);
  const gone = new Set(((deleted ?? []) as { match_id: string }[]).map((d) => d.match_id));
  const teams = new Map<string, Team>();
  const matches = new Map<string, Match>();
  for (const s of (states ?? []) as { data: any }[]) {
    for (const t of (s.data?.teams ?? []) as Team[]) if (t?.id && !teams.has(t.id)) teams.set(t.id, t);
    for (const m of (s.data?.matches ?? []) as Match[]) {
      if (!m?.id || gone.has(m.id) || m.status !== "finished") continue;
      const prev = matches.get(m.id);
      if (!prev || (m.events?.length ?? 0) > (prev.events?.length ?? 0)) matches.set(m.id, m);
    }
  }
  // Asegura que las filas vinculadas existan dentro de su equipo.
  for (const ct of (cloudTeams ?? []) as any[]) {
    const t = teams.get(ct.id) ?? ({ id: ct.id, name: ct.name, shortName: ct.short_name, color: ct.color, players: [] } as unknown as Team);
    for (const r of linked.filter((l) => l.team_id === ct.id)) {
      if (!t.players.some((p) => p.id === r.id)) t.players = [...t.players, { id: r.id, name: r.name, number: r.number } as any];
    }
    teams.set(ct.id, t);
  }
  const relevant = [...matches.values()].filter((m) => teamIds.includes(m.teamAId) || teamIds.includes(m.teamBId));
  const aggs = computeHistoricalStats(relevant, [...teams.values()]);
  const ids = new Set(linked.map((l) => l.id));
  const mine = aggs.filter((a) => ids.has(a.player.id));

  const c: Career = structuredClone(EMPTY_CAREER);
  const cloudById = new Map(((cloudTeams ?? []) as any[]).map((t) => [t.id, t]));
  const teamStats = new Map<string, CareerTeam>();
  for (const a of mine) {
    const ct = cloudById.get(a.team.id);
    for (const p of a.allPerformances) {
      c.performances.push({ ...p, teamId: a.team.id, teamName: ct?.name ?? a.team.name, season: new Date(p.date).getFullYear() });
    }
    for (const k of Object.keys(c.totals) as (keyof Career["totals"])[]) c.totals[k] += (a.totals as any)[k] ?? 0;
    const ts = teamStats.get(a.team.id) ?? { teamId: a.team.id, teamName: ct?.name ?? a.team.name, club: ct?.clubs?.name ?? ct?.club ?? null, category: ct?.category ?? null, gender: ct?.gender ?? null, firstMatch: null, lastMatch: null, matches: 0 };
    ts.matches += a.matchesPlayed;
    for (const p of a.allPerformances) {
      ts.firstMatch = ts.firstMatch == null ? p.date : Math.min(ts.firstMatch, p.date);
      ts.lastMatch = ts.lastMatch == null ? p.date : Math.max(ts.lastMatch, p.date);
    }
    teamStats.set(a.team.id, ts);
  }
  for (const r of linked) if (!teamStats.has(r.team_id)) {
    const ct = cloudById.get(r.team_id);
    teamStats.set(r.team_id, { teamId: r.team_id, teamName: ct?.name ?? "Equipo", club: ct?.clubs?.name ?? ct?.club ?? null, category: ct?.category ?? null, gender: ct?.gender ?? null, firstMatch: null, lastMatch: null, matches: 0 });
  }
  c.performances.sort((a, b) => b.date - a.date);
  c.matchesPlayed = c.performances.length;
  const mp = c.matchesPlayed || 1;
  c.averages = {
    points: c.totals.points / mp, attack: c.totals.attack / mp, block: c.totals.block / mp, ace: c.totals.ace / mp,
    reception: c.totals.receptionTotal ? ((c.totals.receptionPositive - c.totals.receptionNegative) / c.totals.receptionTotal) * 100 : 0,
  };
  for (const key of ["points", "block", "ace"] as const) {
    c.records[key] = c.performances.reduce<CareerPerformance | null>((best, p) => (p[key] > 0 && (!best || p[key] > best[key]) ? p : best), null);
  }
  const bySeason = new Map<number, { matches: number; points: number }>();
  for (const p of c.performances) { const s = bySeason.get(p.season) ?? { matches: 0, points: 0 }; s.matches++; s.points += p.points; bySeason.set(p.season, s); }
  c.seasons = [...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([season, s]) => ({ season, ...s, avgPoints: s.points / s.matches }));
  c.teams = [...teamStats.values()].sort((a, b) => (b.lastMatch ?? 0) - (a.lastMatch ?? 0));
  return c;
}
