import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-auth";

/**
 * Devuelve true si el usuario actual es SOLO planillero
 * (no admin y no entrenador). Se usa para ocultar módulos de
 * estadísticas avanzadas que este rol no debe ver.
 */
export function useIsPlanilleroOnly() {
  const { user, loading } = useAuthUser();
  const [isPlanilleroOnly, setIsPlanilleroOnly] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setIsPlanilleroOnly(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[useIsPlanilleroOnly] error:", error.message);
        const roles = new Set((data ?? []).map((r) => r.role));
        setIsPlanilleroOnly(
          roles.has("planillero") && !roles.has("admin") && !roles.has("entrenador"),
        );
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading]);

  return { isPlanilleroOnly, checking };
}
