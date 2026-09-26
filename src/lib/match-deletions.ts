import { supabase } from "@/integrations/supabase/client";

/**
 * Registro global de partidos eliminados por un admin.
 * Cuando el super admin elimina un partido, su ID queda registrado en la
 * tabla `match_deletions`. Todos los clientes consultan ese registro al
 * sincronizar y descartan esos partidos de su estado local y de la nube,
 * para que no "resuciten" por el merge union de cloud-sync.
 */

let cachedIds: Set<string> | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

export async function getDeletedMatchIds(force = false): Promise<Set<string>> {
  if (!force && cachedIds && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedIds;
  }
  const { data, error } = await supabase.from("match_deletions").select("match_id");
  if (error) {
    // Si falla la lectura, devolvemos lo último conocido para no bloquear la sync.
    return cachedIds ?? new Set();
  }
  cachedIds = new Set((data ?? []).map((r) => r.match_id as string));
  cachedAt = Date.now();
  return cachedIds;
}

export function isDeletedMatch(id: string): boolean {
  return cachedIds?.has(id) ?? false;
}

export function invalidateDeletedMatchCache() {
  cachedIds = null;
  cachedAt = 0;
}
