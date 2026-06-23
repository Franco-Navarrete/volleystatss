import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Team, Match, League } from "./volley-store";

export interface PublicData {
  teams: Team[];
  matches: Match[];
  leagues: League[];
  updatedAt: number;
}

const EMPTY: PublicData = { teams: [], matches: [], leagues: [], updatedAt: 0 };

async function fetchPublicData(): Promise<PublicData> {
  // Fetch every admin user's app_state row. RLS restricts to admin rows for anon.
  const { data, error } = await supabase
    .from("app_state")
    .select("data, updated_at");
  if (error) {
    console.warn("[publicData] error:", error.message);
    return EMPTY;
  }
  if (!data || data.length === 0) return EMPTY;

  const teams: Team[] = [];
  const matches: Match[] = [];
  const leagues: League[] = [];
  let updatedAt = 0;

  for (const row of data) {
    const d = (row.data as Partial<PublicData>) ?? {};
    if (Array.isArray(d.teams)) teams.push(...(d.teams as Team[]));
    if (Array.isArray(d.matches)) matches.push(...(d.matches as Match[]));
    if (Array.isArray(d.leagues)) leagues.push(...(d.leagues as League[]));
    const ts = row.updated_at ? Date.parse(row.updated_at) : 0;
    if (ts > updatedAt) updatedAt = ts;
  }

  return { teams, matches, leagues, updatedAt };
}

export function usePublicData(opts?: { refetchLive?: boolean }) {
  return useQuery({
    queryKey: ["public-data"],
    queryFn: fetchPublicData,
    staleTime: 30_000,
    refetchInterval: opts?.refetchLive ? 15_000 : false,
    refetchIntervalInBackground: false,
  });
}
