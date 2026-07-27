import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";
import { type ModuleId } from "@/lib/modules/rally-modules";

/**
 * Verifica si el usuario actual tiene acceso a un módulo específico.
 * Lógica:
 * 1. Admins tienen acceso a todo.
 * 2. Ciertos módulos son públicos (gratuitos).
 * 3. Otros requieren permiso explícito en `user_permissions` (módulos adquiridos).
 */
export function useModuleAccess(moduleId: ModuleId) {
  const { user, loading: authLoading } = useAuthUser();
  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading || adminChecking) return;

    // Admin siempre tiene acceso
    if (isAdmin) {
      setHasAccess(true);
      setLoading(false);
      return;
    }

    if (!user) {
      setHasAccess(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Consultamos los permisos extendidos del usuario
    supabase
      .from("user_permissions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn(`[useModuleAccess] error checking ${moduleId}:`, error.message);
        }

        // Mapeo de módulos a campos en user_permissions
        // Nota: En una fase posterior, esto debería ser una tabla `user_modules`
        // Por ahora usamos los permisos booleanos existentes.
        const permissionsMap: Partial<Record<ModuleId, boolean>> = {
          scout_live: !!data?.can_create_matches,
          team_management: !!data?.can_manage_teams,
          // Módulos nuevos por defecto bloqueados si no hay permiso explícito
          video_analysis: !!(data as any)?.can_access_video, 
          intelligence_pro: !!(data as any)?.can_access_intelligence,
        };

        setHasAccess(permissionsMap[moduleId] ?? false);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id, isAdmin, authLoading, adminChecking, moduleId]);

  return { hasAccess, loading };
}
