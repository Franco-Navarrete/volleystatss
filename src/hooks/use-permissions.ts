import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";
import { useCoachAccess } from "@/hooks/use-coach-access";

/**
 * Devuelve si el usuario actual puede crear partidos.
 * Los admins siempre pueden. El resto depende de `user_permissions.can_create_matches`.
 */
export function useCanCreateMatches() {
  const { user, loading: userLoading } = useAuthUser();
  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const { hasAccess: isCoach, checking: coachChecking } = useCoachAccess();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (userLoading || adminChecking || coachChecking) return;
    if (!user) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    if (isAdmin || isCoach) {
      setAllowed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Si la consulta falla o tarda demasiado, asumimos NO permitido
    // (sólo admins, entrenadores o usuarios con permiso explícito pueden crear).
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setAllowed(false);
        setLoading(false);
      }
    }, 4000);
    supabase
      .from("user_permissions")
      .select("can_create_matches")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        if (error) {
          console.warn("[useCanCreateMatches] error:", error.message);
          setAllowed(false);
        } else {
          setAllowed(!!data?.can_create_matches);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, isAdmin, isCoach, userLoading, adminChecking, coachChecking]);

  return { allowed, loading };
}

/**
 * Devuelve si el usuario actual puede crear/editar equipos y jugadores.
 * Los admins siempre pueden. El resto depende de `user_permissions.can_manage_teams`.
 */
export function useCanManageTeams() {
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
      if (!cancelled) {
        setAllowed(false);
        setLoading(false);
      }
    }, 4000);
    supabase
      .from("user_permissions")
      .select("can_manage_teams")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        if (error) {
          console.warn("[useCanManageTeams] error:", error.message);
          setAllowed(false);
        } else {
          setAllowed(!!data?.can_manage_teams);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, isAdmin, userLoading, adminChecking]);

  return { allowed, loading };
}
