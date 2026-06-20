import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPlayer,
  createTeam,
  deletePlayer,
  deleteTeam,
  listLeagues,
  listTeams,
  updatePlayer,
  updateTeam,
} from "@/lib/teams.functions";

export const teamsKey: QueryKey = ["cloud-teams"];
export const leaguesKey: QueryKey = ["cloud-leagues"];

export type CloudPlayer = {
  id: string;
  name: string;
  number: number;
  position?: string;
  photoUrl?: string;
};

export type CloudTeam = {
  id: string;
  leagueId: string;
  name: string;
  shortName: string;
  color: string;
  logoUrl?: string;
  players: CloudPlayer[];
};

export type CloudLeague = {
  id: string;
  name: string;
  season?: string;
  color?: string;
};

export function useCloudTeams() {
  const list = useServerFn(listTeams);
  return useQuery<CloudTeam[]>({
    queryKey: teamsKey,
    queryFn: () => list(),
    staleTime: 30_000,
  });
}

export function useCloudLeagues() {
  const list = useServerFn(listLeagues);
  return useQuery<CloudLeague[]>({
    queryKey: leaguesKey,
    queryFn: () => list(),
    staleTime: 60_000,
  });
}

export function useTeamMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: teamsKey });

  const create = useServerFn(createTeam);
  const update = useServerFn(updateTeam);
  const remove = useServerFn(deleteTeam);
  const addPlayer = useServerFn(createPlayer);
  const editPlayer = useServerFn(updatePlayer);
  const removePlayer = useServerFn(deletePlayer);

  return {
    createTeam: useMutation({
      mutationFn: (data: Parameters<typeof create>[0]["data"]) => create({ data }),
      onSuccess: invalidate,
    }),
    updateTeam: useMutation({
      mutationFn: (data: Parameters<typeof update>[0]["data"]) => update({ data }),
      onSuccess: invalidate,
    }),
    deleteTeam: useMutation({
      mutationFn: (data: Parameters<typeof remove>[0]["data"]) => remove({ data }),
      onSuccess: invalidate,
    }),
    createPlayer: useMutation({
      mutationFn: (data: Parameters<typeof addPlayer>[0]["data"]) => addPlayer({ data }),
      onSuccess: invalidate,
    }),
    updatePlayer: useMutation({
      mutationFn: (data: Parameters<typeof editPlayer>[0]["data"]) => editPlayer({ data }),
      onSuccess: invalidate,
    }),
    deletePlayer: useMutation({
      mutationFn: (data: Parameters<typeof removePlayer>[0]["data"]) => removePlayer({ data }),
      onSuccess: invalidate,
    }),
  };
}
