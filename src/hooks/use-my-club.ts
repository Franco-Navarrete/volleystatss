import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createClub, getMyClub, updateClub, type ClubDTO } from "@/lib/clubs.functions";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";
import { useCanCreateTeam } from "@/hooks/use-team-permissions";

const myClubKey = ["my-club"] as const;

export function useMyClub() {
  const { user, loading } = useAuthUser();
  const get = useServerFn(getMyClub);
  return useQuery<ClubDTO | null>({
    queryKey: [...myClubKey, user?.id ?? "anon"],
    queryFn: () => get(),
    enabled: !loading && !!user,
    staleTime: 60_000,
  });
}

export function useClubMutations() {
  const qc = useQueryClient();
  const create = useServerFn(createClub);
  const update = useServerFn(updateClub);
  const invalidate = () => qc.invalidateQueries({ queryKey: myClubKey });
  return {
    createClub: useMutation({
      mutationFn: (data: Parameters<typeof create>[0]["data"]) => create({ data }),
      onSuccess: invalidate,
    }),
    updateClub: useMutation({
      mutationFn: (data: Parameters<typeof update>[0]["data"]) => update({ data }),
      onSuccess: invalidate,
    }),
  };
}

/** true si el usuario puede crear/editar jugadores: admin o entrenador. */
export function useCanCreatePlayer() {
  const { isAdmin } = useIsAdmin();
  const { allowed } = useCanCreateTeam();
  return { allowed: isAdmin || allowed };
}
