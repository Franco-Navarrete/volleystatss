import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useIsAdmin() {
  const { user, loading } = useAuthUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    // Failsafe: never stay "checking" forever on flaky mobile networks.
    const timeout = setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 4000);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("[useIsAdmin] error:", error.message);
        setIsAdmin(!!data && data.length > 0);
        setChecking(false);
        clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, loading]);

  return { user, isAdmin, checking };
}
