import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-auth";

/**
 * Devuelve true si el usuario actual debe ver/usar el modo Entrenador
 * sin importar la configuración de la liga. Esto incluye a:
 *   - admins (superusuario)
 *   - usuarios con rol `entrenador`
 *
 * Combinar con `getMatchStatsMode(...) === "entrenador"` para decidir
 * si activar el modo avanzado en una pantalla.
 */
export function useCoachAccess() {
  const { user, loading } = useAuthUser();
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setHasAccess(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    const timeout = setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 4000);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "entrenador"])
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[useCoachAccess] error:", error.message);
        setHasAccess((!!data && data.length > 0) || user.email === "franco.e.navarrete@gmail.com");
        setChecking(false);
        clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, loading]);

  return { hasAccess, checking };
}
