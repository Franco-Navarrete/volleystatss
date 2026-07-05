import { Link } from "@tanstack/react-router";
import { LogIn, ShieldCheck, Volleyball } from "lucide-react";
import type { ReactNode } from "react";
import { useIsAdmin } from "@/hooks/use-auth";

const PUBLIC_NAV = [
  { to: "/", label: "Inicio" },
  { to: "/ligas", label: "Ligas" },
  { to: "/equipos", label: "Equipos" },
] as const;

export function PublicShell({ children }: { children: ReactNode }) {
  const { user, isAdmin } = useIsAdmin();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-5xl [@media(min-width:1600px)_and_(pointer:coarse)]:max-w-7xl px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <div className="size-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Volleyball className="size-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm tracking-tight">RALLY</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest hidden sm:block">
                Live Stats
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-0.5 text-xs sm:text-sm overflow-x-auto">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="px-2 sm:px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-medium transition-colors"
                activeProps={{
                  className:
                    "px-2 sm:px-3 py-2 rounded-md text-foreground bg-secondary font-semibold",
                }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {user && isAdmin ? (
            <Link
              to="/dashboard"
              className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 text-xs sm:text-sm font-semibold"
            >
              <ShieldCheck className="size-3.5" />
              <span className="hidden xs:inline">Admin</span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="shrink-0 flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md border border-border/60 hover:bg-secondary/50 text-xs sm:text-sm font-medium"
            >
              <LogIn className="size-3.5" />
              <span className="hidden xs:inline">Iniciar sesión</span>
              <span className="xs:hidden">Entrar</span>
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl [@media(min-width:1600px)_and_(pointer:coarse)]:max-w-7xl px-3 sm:px-6 py-4 sm:py-6">
        {children}
      </main>
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        RALLY · estadísticas de vóley en tiempo real
      </footer>
    </div>
  );
}
