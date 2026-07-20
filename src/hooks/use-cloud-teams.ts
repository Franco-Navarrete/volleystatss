import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPlayer,
  createLeague,
  createTeam,
  deleteLeague,
  deletePlayer,
  deleteTeam,
  listLeagues,
  listTeams,
  updateLeague,
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
  leagueId: string | null;
  name: string;
  shortName: string;
  color: string;
  secondaryColor?: string;
  club?: string;
  clubId?: string;
  clubName?: string;
  clubLogoUrl?: string;
  logoUrl?: string;
  gender?: "M" | "F" | "X";
  category?: "12" | "14" | "16" | "18" | "21" | "primera" | "libre";
  ownerId?: string;
  players: CloudPlayer[];
};

export type CloudLeague = {
  id: string;
  name: string;
  season?: string;
  color?: string;
  gender?: "M" | "F";
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
  const invalidateLeagues = () => qc.invalidateQueries({ queryKey: leaguesKey });
  const invalidateAll = () => {
    invalidate();
    invalidateLeagues();
  };

  const create = useServerFn(createTeam);
  const update = useServerFn(updateTeam);
  const remove = useServerFn(deleteTeam);
  const createL = useServerFn(createLeague);
  const updateL = useServerFn(updateLeague);
  const removeL = useServerFn(deleteLeague);
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
    createLeague: useMutation({
      mutationFn: (data: Parameters<typeof createL>[0]["data"]) => createL({ data }),
      onSuccess: invalidateLeagues,
    }),
    updateLeague: useMutation({
      mutationFn: (data: Parameters<typeof updateL>[0]["data"]) => updateL({ data }),
      onSuccess: invalidateLeagues,
    }),
    deleteLeague: useMutation({
      mutationFn: (data: Parameters<typeof removeL>[0]["data"]) => removeL({ data }),
      onSuccess: invalidateAll,
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
