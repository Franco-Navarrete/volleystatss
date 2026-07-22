import { supabase } from "@/integrations/supabase/client";
import {
  useVolley,
  type Match,
  type Team,
  type League,
  type CustomReceptionFormations,
} from "./volley-store";
import { isDeletedLeagueCandidate } from "@/lib/league-deletions";

type CloudData = {
  teams?: Team[];
  matches?: Match[];
  leagues?: League[];
  customReceptionFormations?: CustomReceptionFormations;
  matchCategories?: string[];
  referees?: string[];
  scorekeepers?: string[];
};


const LOCAL_TS_KEY = "vstats:lastLocalChange";

let startedFor: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
/** Ignoramos el primer cambio del store que disparamos nosotros al hidratar desde la nube. */
let suppressNextChange = false;
let flushHandler: (() => void) | null = null;
let saveInFlight = false;
let saveAgain = false;

function getLocalTs(): number {
  if (typeof localStorage === "undefined") return 0;
  const v = localStorage.getItem(LOCAL_TS_KEY);
  return v ? Number(v) || 0 : 0;
}
function setLocalTs(ts: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LOCAL_TS_KEY, String(ts));
}

/** Union-merge dos arrays por id, priorizando `local` en conflicto y preservando los `remote` que no estén en local. */
function mergeById<T extends { id: string }>(local: T[], remote: T[] | undefined): T[] {
  if (!remote || remote.length === 0) return local;
  const localIds = new Set(local.map((x) => x.id));
  const extras = remote.filter((x) => x && !localIds.has(x.id));
  return [...local, ...extras];
}

async function saveToCloud(userId: string) {
  const s = useVolley.getState();
  // Read-modify-write: traemos lo que hay en la nube y hacemos union por id
  // para que cambios hechos en otra pestaña/dispositivo no se pierdan cuando
  // esta pestaña sube su estado. Bias a preservar datos: si un partido/equipo/
  // liga existe en la nube y no localmente, se conserva.
  const { data: row } = await supabase
    .from("app_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  const cloud = ((row?.data as CloudData | null) ?? null);
  const leagues = mergeById(
    s.leagues.filter((league) => !isDeletedLeagueCandidate(league)),
    cloud?.leagues?.filter((league) => !isDeletedLeagueCandidate(league)),
  );
  const validLeagueIds = new Set(leagues.map((league) => league.id));
  const cleanTeamLeague = (team: Team): Team =>
    team.leagueId && !validLeagueIds.has(team.leagueId)
      ? { ...team, leagueId: undefined }
      : team;
  const teams = mergeById(s.teams.map(cleanTeamLeague), cloud?.teams).map(cleanTeamLeague);

  const data = {
    teams,
    matches: mergeById(s.matches, cloud?.matches),
    leagues,
    customReceptionFormations: {
      ...(cloud?.customReceptionFormations ?? {}),
      ...s.customReceptionFormations,
    },
  };
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("app_state").upsert({
    user_id: userId,
    data: data as never,
    updated_at: updatedAt,
  });
  if (!error) setLocalTs(Date.parse(updatedAt));
}

function requestImmediateSave(userId: string) {
  if (saveInFlight) {
    saveAgain = true;
    return;
  }
  saveInFlight = true;
  void (async () => {
    try {
      do {
        saveAgain = false;
        await saveToCloud(userId);
      } while (saveAgain);
    } finally {
      saveInFlight = false;
    }
  })();
}


/**
 * Carga la data del usuario y la sincroniza usando last-write-wins por timestamp.
 * - Si la nube es más nueva que el último cambio local → reemplaza el estado local con la nube.
 * - Si el local es más nuevo (o no hay nube) → empuja el local a la nube.
 * Esto evita que items eliminados localmente reaparezcan al recargar.
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
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  const cloud = ((row?.data as CloudData | null) ?? null);
  const cloudTs = row?.updated_at ? Date.parse(row.updated_at) : 0;
  const localTs = getLocalTs();

  const hasLocal =
    useVolley.getState().teams.length > 0 ||
    useVolley.getState().matches.length > 0 ||
    useVolley.getState().leagues.length > 0;

  if (cloud && cloudTs > localTs) {
    // La nube gana: reemplazamos el estado local íntegramente.
    suppressNextChange = true;
    useVolley.setState({
      teams: cloud.teams ?? [],
      matches: cloud.matches ?? [],
      leagues: cloud.leagues ?? [],
      customReceptionFormations: cloud.customReceptionFormations ?? {},
    });
    setLocalTs(cloudTs);
  } else if (!cloud && hasLocal) {
    // Primera sync de este usuario: subimos lo que ya hay localmente.
    await saveToCloud(userId);
  } else if (cloud && cloudTs <= localTs) {
    // Local gana (incluye eliminaciones pendientes): pisamos la nube.
    await saveToCloud(userId);
  }


  unsubscribe = useVolley.subscribe(() => {
    if (suppressNextChange) {
      suppressNextChange = false;
      return;
    }
    setLocalTs(Date.now());
    requestImmediateSave(userId);
  });

  // Flush pendiente antes de que la pestaña se oculte/cierre para que
  // cambios rápidos (ej: agregar equipo a liga y refrescar) no se pierdan.
  flushHandler = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    requestImmediateSave(userId);
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushHandler);
    window.addEventListener("beforeunload", flushHandler);
    document.addEventListener("visibilitychange", visibilityFlush);
  }
}

function visibilityFlush() {
  if (document.visibilityState === "hidden") flushHandler?.();
}

export function stopCloudSync() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  startedFor = null;
  suppressNextChange = false;
  saveInFlight = false;
  saveAgain = false;
  if (typeof window !== "undefined" && flushHandler) {
    window.removeEventListener("pagehide", flushHandler);
    window.removeEventListener("beforeunload", flushHandler);
    document.removeEventListener("visibilitychange", visibilityFlush);
  }
  flushHandler = null;
}

/**
 * Fuerza traer el estado desde la nube y sobrescribe el local,
 * ignorando los timestamps. Útil para recuperar datos cuando el
 * local quedó desfasado (last-write-wins lo dejó vacío o viejo).
 */
export async function forceReloadFromCloud(userId: string): Promise<{
  ok: boolean;
  teams: number;
  matches: number;
  leagues: number;
  totalEvents: number;
}> {
  const { data: row, error } = await supabase
    .from("app_state")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const cloud = (row?.data as CloudData | null) ?? null;
  if (!cloud) {
    return { ok: false, teams: 0, matches: 0, leagues: 0, totalEvents: 0 };
  }
  const teams = cloud.teams ?? [];
  const matches = cloud.matches ?? [];
  const leagues = cloud.leagues ?? [];
  suppressNextChange = true;
  useVolley.setState({
    teams,
    matches,
    leagues,
    customReceptionFormations: cloud.customReceptionFormations ?? {},
  });

  const cloudTs = row?.updated_at ? Date.parse(row.updated_at) : Date.now();
  setLocalTs(cloudTs);
  const totalEvents = matches.reduce(
    (acc, m) => acc + ((m as { events?: unknown[] }).events?.length ?? 0),
    0,
  );
  return {
    ok: true,
    teams: teams.length,
    matches: matches.length,
    leagues: leagues.length,
    totalEvents,
  };
}
