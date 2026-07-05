import { Link, useNavigate } from "@tanstack/react-router";
import { Globe, LogOut, Settings, ShieldCheck, Volleyball } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stopCloudSync } from "@/lib/cloud-sync";
import { useIsAdmin } from "@/hooks/use-auth";
import { useSyncCloudToStore } from "@/hooks/use-sync-cloud-to-store";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, isAdmin } = useIsAdmin();
  useSyncCloudToStore();

  const signOut = async () => {
    stopCloudSync();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-7xl device-tablet:max-w-[1800px] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <Link to="/dashboard" className="flex items-center gap-2.5 group shrink-0">
            <div className="size-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow group-hover:scale-105 transition-transform">
              <Volleyball className="size-5 text-primary-foreground" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-bold text-sm tracking-tight">RALLY · Admin</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Panel de carga
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm overflow-x-auto">
            <NavLink to="/dashboard">Panel</NavLink>
            <NavLink to="/leagues">Ligas</NavLink>
            <NavLink to="/teams">Equipos</NavLink>
            <NavLink to="/matches">Partidos</NavLink>
            <NavLink to="/rankings">Rankings</NavLink>
            <NavLink to="/awards">Premios</NavLink>
            {isAdmin && (
              <Link
                to="/admin"
                className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors font-medium flex items-center gap-1"
                activeProps={{
                  className:
                    "px-3 py-2 rounded-md text-foreground bg-secondary font-semibold flex items-center gap-1",
                }}
              >
                <ShieldCheck className="size-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <Link
              to="/settings"
              className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors font-medium flex items-center gap-1"
              activeProps={{
                className:
                  "px-3 py-2 rounded-md text-foreground bg-secondary font-semibold flex items-center gap-1",
              }}
            >
              <Settings className="size-4" />
              <span className="hidden sm:inline">Ajustes</span>
            </Link>
          </nav>
          <div className="shrink-0 flex items-center gap-1">
            <Link
              to="/"
              title="Ver sitio público"
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <Globe className="size-4" />
            </Link>
            <button
              onClick={() => void signOut()}
              title={user?.email ? `Cerrar sesión (${user.email})` : "Cerrar sesión"}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl [@media(min-width:1600px)_and_(pointer:coarse)]:max-w-[1800px] px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        RALLY · estadísticas en tiempo real
        {user?.email ? ` · ${user.email}` : ""}
      </footer>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors font-medium"
      activeProps={{ className: "px-3 py-2 rounded-md text-foreground bg-secondary font-semibold" }}
      activeOptions={{ exact: to === "/" }}
    >
      {children}
    </Link>
  );
}
