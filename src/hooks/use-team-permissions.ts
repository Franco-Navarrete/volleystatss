import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";

/**
 * Devuelve true si el usuario puede crear nuevos equipos.
 * Regla: admin O rol `entrenador` (permiso lógico `team.create`).
 */
export function useCanCreateTeam() {
  const { user, loading: userLoading } = useAuthUser();
  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (userLoading || adminChecking) return;
    if (!user) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    if (isAdmin) {
      setAllowed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 4000);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "entrenador")
      .then(({ data, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        if (error) console.warn("[useCanCreateTeam] error:", error.message);
        setAllowed(!!data && data.length > 0);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, isAdmin, userLoading, adminChecking]);

  return { allowed, loading };
}

/**
 * Chequeo cliente (no reemplaza RLS) para decidir si mostrar controles de
 * administración sobre un equipo concreto: admin o propietario.
 */
export function useCanManageTeam(ownerId?: string | null) {
  const { user, loading } = useAuthUser();
  const { isAdmin, checking } = useIsAdmin();
  if (loading || checking) return { allowed: false, loading: true };
  if (!user) return { allowed: false, loading: false };
  if (isAdmin) return { allowed: true, loading: false };
  return { allowed: !!ownerId && ownerId === user.id, loading: false };
}
