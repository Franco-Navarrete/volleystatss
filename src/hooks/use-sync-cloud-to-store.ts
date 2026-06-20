import { useEffect } from "react";
import { useCloudLeagues, useCloudTeams } from "@/hooks/use-cloud-teams";
import { useVolley, type Team, type League, type Player, type PlayerPosition } from "@/lib/volley-store";

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
    const cloudLeagues: League[] = (leaguesQ.data ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      season: l.season,
      color: l.color,
    }));
    const cloudTeams: Team[] = (teamsQ.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      color: t.color,
      logoUrl: t.logoUrl,
      leagueId: t.leagueId ?? undefined,
      players: (t.players ?? []).map<Player>((p) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        photoUrl: p.photoUrl,
        position: p.position as PlayerPosition | undefined,
      })),
    }));
    useVolley.setState((s) => {
      // Merge: mantenemos cualquier equipo/liga local que NO esté en la nube
      // (por compatibilidad con datos viejos) y reemplazamos los que sí están.
      const cloudTeamIds = new Set(cloudTeams.map((t) => t.id));
      const cloudLeagueIds = new Set(cloudLeagues.map((l) => l.id));
      const mergedTeams = [
        ...cloudTeams,
        ...s.teams.filter((t) => !cloudTeamIds.has(t.id)),
      ];
      const mergedLeagues = [
        ...cloudLeagues,
        ...s.leagues.filter((l) => !cloudLeagueIds.has(l.id)),
      ];
      return { teams: mergedTeams, leagues: mergedLeagues };
    });
  }, [teamsQ.data, leaguesQ.data]);
}
