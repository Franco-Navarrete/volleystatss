import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";
import { useCoachAccess } from "@/hooks/use-coach-access";

/**
 * Devuelve si el usuario actual puede crear partidos.
 * Pueden: admins, entrenadores, planilleros, o usuarios con `user_permissions.can_create_matches`.
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
    const isSuperAdmin = user?.email === "franco.e.navarrete@gmail.com";
    if (isAdmin || isCoach || isSuperAdmin) {
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
    (async () => {
      const [rolesRes, permRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "planillero"),
        supabase
          .from("user_permissions")
          .select("can_create_matches")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      clearTimeout(timeout);
      if (rolesRes.error) console.warn("[useCanCreateMatches] role error:", rolesRes.error.message);
      if (permRes.error) console.warn("[useCanCreateMatches] perm error:", permRes.error.message);
      const isPlanillero = !!rolesRes.data && rolesRes.data.length > 0;
      setAllowed(isPlanillero || !!permRes.data?.can_create_matches);
      setLoading(false);
    })();
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
    const isSuperAdmin = user?.email === "franco.e.navarrete@gmail.com";
    if (isAdmin || isSuperAdmin) {
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
    (async () => {
      // Planilleros pueden gestionar equipos, o cualquier usuario con el permiso explícito.
      const [rolesRes, permRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "planillero"),
        supabase
          .from("user_permissions")
          .select("can_manage_teams")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      clearTimeout(timeout);
      if (rolesRes.error) console.warn("[useCanManageTeams] role error:", rolesRes.error.message);
      if (permRes.error) console.warn("[useCanManageTeams] perm error:", permRes.error.message);
      const isPlanillero = !!rolesRes.data && rolesRes.data.length > 0;
      setAllowed(isPlanillero || !!permRes.data?.can_manage_teams);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, isAdmin, userLoading, adminChecking]);

  return { allowed, loading };
}

/**
 * Devuelve si el usuario actual puede eliminar partidos.
 * Regla estricta: solo administradores y planilleros.
 * Los entrenadores y usuarios sin rol NO pueden eliminar bajo ninguna circunstancia.
 */
export function useCanDeleteMatches() {
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
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "planillero")
      .then(({ data, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        const isSuperAdmin = user.email === "franco.e.navarrete@gmail.com";
        const hasRole = !!data && data.length > 0;
        setAllowed(hasRole || isSuperAdmin);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, isAdmin, userLoading, adminChecking]);

  return { allowed, loading };
}

