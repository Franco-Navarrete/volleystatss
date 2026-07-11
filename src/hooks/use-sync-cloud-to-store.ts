import { useEffect } from "react";
import { useCloudLeagues, useCloudTeams } from "@/hooks/use-cloud-teams";
import { useVolley, type Team, type League, type Player, type PlayerPosition } from "@/lib/volley-store";
import { isDeletedLeagueCandidate, forgetDeletedLeague } from "@/lib/league-deletions";

/**
 * Espeja los equipos y ligas del servidor (cloud) dentro del store local de zustand.
 * Esto permite que pantallas que históricamente leen del store local (matches.new,
 * scorer, stats, PDF) "vean" los equipos compartidos creados desde Equipos.
 */
export function useSyncCloudToStore() {
  const teamsQ = useCloudTeams();
  const leaguesQ = useCloudLeagues();

  useEffect(() => {
    if (!teamsQ.data && !leaguesQ.data) return;
    const cloudTeams: Team[] = (teamsQ.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      logoUrl: t.logoUrl,
      leagueId: t.leagueId ?? undefined,
      gender: t.gender,
      category: t.category,

      players: (t.players ?? []).map<Player>((p) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        photoUrl: p.photoUrl,
        position: p.position as PlayerPosition | undefined,
      })),
    }));
    // Toda liga que aparezca en la nube resucita cualquier tombstone local.
    for (const l of leaguesQ.data ?? []) forgetDeletedLeague(l);
    useVolley.setState((s) => {
      const cloudLeagues: League[] = (leaguesQ.data ?? []).filter((l) => !isDeletedLeagueCandidate(l)).map((l) => {
        const current = s.leagues.find((existing) => existing.id === l.id);
        return {
          ...current,
          id: l.id,
          name: l.name,
          season: l.season,
          color: l.color,
          gender: l.gender,
        };
      });
      const cloudTeamIds = new Set(cloudTeams.map((t) => t.id));
      const cloudLeagueIds = new Set(cloudLeagues.map((l) => l.id));
      const mergedCloudTeams = cloudTeams.map((team) => {
        const current = s.teams.find((existing) => existing.id === team.id);
        if (!current) return team;
        // Preferimos la asignación de la nube cuando existe; si no, la local.
        const leagueId = team.leagueId ?? current.leagueId;
        return { ...team, leagueId };
      });
      const mergedTeams = [
        ...mergedCloudTeams,
        ...s.teams.filter((t) => !cloudTeamIds.has(t.id)),
      ];
      const mergedLeagues = [
        ...cloudLeagues,
        ...s.leagues.filter((l) => !cloudLeagueIds.has(l.id) && !isDeletedLeagueCandidate(l)),
      ];
      return { teams: mergedTeams, leagues: mergedLeagues };
    });
  }, [teamsQ.data, leaguesQ.data]);
}
