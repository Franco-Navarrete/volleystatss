import type { League, Match, Player, Team } from "./volley-store";

/** Self-contained payload stored in `public_matches.data`. */
export interface PublicMatchSnapshot {
  version: 1;
  match: Match;
  teamA: Team;
  teamB: Team;
  league: League | null;
  generatedAt: number;
}

/** Build a deep-cloned snapshot that doesn't share refs with the live zustand store. */
export function buildPublicMatchSnapshot(
  match: Match,
  teams: Team[],
  leagues: League[],
): PublicMatchSnapshot | null {
  const teamA = teams.find((t) => t.id === match.teamAId);
  const teamB = teams.find((t) => t.id === match.teamBId);
  if (!teamA || !teamB) return null;
  const league =
    leagues.find(
      (l) => l.id === teamA.leagueId || l.id === teamB.leagueId,
    ) ?? null;

  const clone = <T>(v: T): T =>
    typeof structuredClone === "function"
      ? structuredClone(v)
      : (JSON.parse(JSON.stringify(v)) as T);

  // Only include players that actually appear in the match (rosters can change).
  const filterPlayers = (team: Team): Team => {
    const playerIds = new Set<string>();
    for (const id of [
      ...match.startingLineupA,
      ...match.startingLineupB,
      ...match.onCourtA,
      ...match.onCourtB,
    ]) {
      playerIds.add(id);
    }
    for (const ev of match.events) {
      if ("playerId" in ev && ev.playerId) playerIds.add(ev.playerId);
      if ("playerInId" in ev) playerIds.add(ev.playerInId);
      if ("playerOutId" in ev) playerIds.add(ev.playerOutId);
      if ("liberoId" in ev) playerIds.add(ev.liberoId);
      if ("replacedId" in ev) playerIds.add(ev.replacedId);
    }
    return {
      ...team,
      players: team.players.filter((p: Player) => playerIds.has(p.id)),
    };
  };

  return clone({
    version: 1,
    match,
    teamA: filterPlayers(teamA),
    teamB: filterPlayers(teamB),
    league,
    generatedAt: Date.now(),
  });
}
