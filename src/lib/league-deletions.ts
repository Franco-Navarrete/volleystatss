import type { League } from "@/lib/volley-store";

const DELETED_LEAGUE_IDS_KEY = "vstats:deleted-league-ids";
const DELETED_LEAGUE_KEYS_KEY = "vstats:deleted-league-keys";

type LeagueLike = Pick<League, "id" | "name" | "season" | "gender">;

function readSet(key: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    const values = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(values) ? values.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, values: Set<string>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify([...values].slice(-200)));
}

export function leagueIdentityKey(league: Pick<LeagueLike, "name" | "season" | "gender">): string {
  const name = league.name.trim().toLowerCase().replace(/\s+/g, " ");
  const season = league.season?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  const gender = league.gender ?? "";
  return `${name}|${season}|${gender}`;
}

export function rememberDeletedLeague(league: LeagueLike) {
  const ids = readSet(DELETED_LEAGUE_IDS_KEY);
  const keys = readSet(DELETED_LEAGUE_KEYS_KEY);
  ids.add(league.id);
  keys.add(leagueIdentityKey(league));
  writeSet(DELETED_LEAGUE_IDS_KEY, ids);
  writeSet(DELETED_LEAGUE_KEYS_KEY, keys);
}

export function isDeletedLeagueCandidate(league: LeagueLike): boolean {
  return readSet(DELETED_LEAGUE_IDS_KEY).has(league.id) || readSet(DELETED_LEAGUE_KEYS_KEY).has(leagueIdentityKey(league));
}