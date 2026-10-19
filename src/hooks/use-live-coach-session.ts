import { useEffect, useState } from "react";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { readLiveSession } from "@/lib/coach/live.functions";
import { supabase } from "@/integrations/supabase/client";

export const liveSessionOptions = (matchId: string) => queryOptions({
  queryKey: ["live-coach-session", matchId], queryFn: () => readLiveSession({ data: { matchId } }),
  staleTime: 1000, refetchInterval: 5000, refetchOnWindowFocus: true,
});

export function useLiveCoachConnection(matchId: string) {
  const client = useQueryClient();
  const [connection, setConnection] = useState("reconnecting");
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["live-coach-session", matchId] }); };
    const online = () => { setConnection("reconnecting"); refresh(); };
    const offline = () => setConnection("offline");
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const channel = supabase.channel(`coach-match-${matchId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_match_sessions", filter: `match_id=eq.${matchId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_match_notes", filter: `match_id=eq.${matchId}` }, refresh)
      .subscribe((status) => setConnection(!navigator.onLine ? "offline" : status === "SUBSCRIBED" ? "connected" : "reconnecting"));
    window.addEventListener("online", online); window.addEventListener("offline", offline); document.addEventListener("visibilitychange", visible);
    if (!navigator.onLine) offline();
    return () => { void supabase.removeChannel(channel); window.removeEventListener("online", online); window.removeEventListener("offline", offline); document.removeEventListener("visibilitychange", visible); };
  }, [matchId, client]);
  return connection;
}

/** Optional lookup for the scorer; the independent route primes its required read in a loader. */
export function useOptionalLiveSession(matchId: string) {
  return useQuery(liveSessionOptions(matchId));
}