import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-auth";
import type { Match, Team, League } from "@/lib/volley-store";

interface AppStateData {
  teams?: Team[];
  matches?: Match[];
  leagues?: League[];
}

interface MergedAppState {
  matches: Match[];
  teams: Team[];
  leagues: League[];
}

/**
 * Para administradores: trae los `app_state` de todos los usuarios y los une
 * por id. Permite ver partidos, equipos y ligas creados por cualquier perfil.
 * RLS ya permite a los admins leer todas las filas de `app_state`.
 */
export function useAllUsersAppState() {
  const { isAdmin, user, checking } = useIsAdmin();
  const isSuperAdmin = user?.email === "franco.e.navarrete@gmail.com";
  
  return useQuery<MergedAppState>({
    queryKey: ["admin-all-app-state"],
    enabled: !checking && (isAdmin || isSuperAdmin),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_state").select("data");
      if (error) throw error;
      const matches = new Map<string, Match>();
      const teams = new Map<string, Team>();
      const leagues = new Map<string, League>();
      for (const row of data ?? []) {
        const d = (row.data as AppStateData | null) ?? {};
        for (const m of d.matches ?? []) if (m?.id && !matches.has(m.id)) matches.set(m.id, m);
        for (const t of d.teams ?? []) if (t?.id && !teams.has(t.id)) teams.set(t.id, t);
        for (const l of d.leagues ?? []) if (l?.id && !leagues.has(l.id)) leagues.set(l.id, l);
      }
      return {
        matches: [...matches.values()],
        teams: [...teams.values()],
        leagues: [...leagues.values()],
      };
    },
  });
}
