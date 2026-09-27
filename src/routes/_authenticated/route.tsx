import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startCloudSync } from "@/lib/cloud-sync";
import { getMyAppRole } from "@/lib/app-role";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    const role = await getMyAppRole(data.session.user.id);
    const isPlayerArea = location.pathname.startsWith("/jugadora");
    if (role === "player" && !isPlayerArea) {
      throw redirect({ to: "/jugadora", search: { denied: location.pathname !== "/dashboard" ? 1 : undefined } });
    }
    return { user: data.session.user, role };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, role } = Route.useRouteContext();

  useEffect(() => {
    if (role === "player") return;
    void startCloudSync(user.id, user.email ?? null);
  }, [user.id, user.email, role]);

  return <Outlet />;
}
