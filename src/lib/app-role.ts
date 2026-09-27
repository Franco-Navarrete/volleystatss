import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "coach" | "player";

let cache: { userId: string; role: AppRole; at: number } | null = null;

/** Rol de navegación del usuario actual (la seguridad real la aplican las políticas de la base). */
export async function getMyAppRole(userId: string): Promise<AppRole> {
  if (cache && cache.userId === userId && Date.now() - cache.at < 60_000) return cache.role;
  const { data, error } = await supabase.rpc("get_my_app_role");
  // Si no se puede verificar, se asume el rol con menos permisos y no se guarda en caché.
  if (error) return "player";
  const role: AppRole = data === "admin" || data === "player" ? data : "coach";
  cache = { userId, role, at: Date.now() };
  return role;
}

export function clearAppRoleCache() {
  cache = null;
}
