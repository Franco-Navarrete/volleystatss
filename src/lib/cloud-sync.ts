import { supabase } from "@/integrations/supabase/client";
import { useVolley, type Match, type Team, type League } from "./volley-store";

type CloudData = {
  teams?: Team[];
  matches?: Match[];
  leagues?: League[];
};

let startedFor: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

function mergeById<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const localIds = new Set(local.map((x) => x.id));
  return [...local, ...cloud.filter((c) => !localIds.has(c.id))];
}

async function saveToCloud(userId: string) {
  const s = useVolley.getState();
  const data = { teams: s.teams, matches: s.matches, leagues: s.leagues };
  await supabase.from("app_state").upsert({
    user_id: userId,
    data: data as never,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Loads the user's cloud data, merges it with anything stored locally
 * (local wins on conflicts), pushes the merged state back up and then
 * auto-saves on every store change (debounced).
 */
export async function startCloudSync(userId: string, email: string | null) {
  if (startedFor === userId) return;
  stopCloudSync();
  startedFor = userId;

  if (email) {
    await supabase.from("profiles").upsert({ id: userId, email });
  }

  const { data: row } = await supabase
    .from("app_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  const cloud = ((row?.data as CloudData | null) ?? {}) as CloudData;
  const s = useVolley.getState();
  useVolley.setState({
    teams: mergeById(s.teams, cloud.teams ?? []),
    matches: mergeById(s.matches, cloud.matches ?? []),
    leagues: mergeById(s.leagues, cloud.leagues ?? []),
  });

  await saveToCloud(userId);

  unsubscribe = useVolley.subscribe(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveToCloud(userId);
    }, 1200);
  });
}

export function stopCloudSync() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  startedFor = null;
}
