import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";

/**
 * Devuelve si el usuario actual puede crear partidos.
 * Los admins siempre pueden. El resto depende de `user_permissions.can_create_matches`.
 */
export function useCanCreateMatches() {
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
      .from("user_permissions")
      .select("can_create_matches")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[useCanCreateMatches] error:", error.message);
        setAllowed(!!data?.can_create_matches);
        setLoading(false);
        clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, isAdmin, userLoading, adminChecking]);

  return { allowed, loading };
}
