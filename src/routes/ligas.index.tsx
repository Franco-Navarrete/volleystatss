import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Calendar, Users, ArrowRight } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { usePublicData } from "@/lib/use-public-data";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/ligas/")({
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE_URL}/ligas` }],
  }),
  component: LeaguesIndex,
});

function LeaguesIndex() {
  const { data, isLoading } = usePublicData();
  const leagues = data?.leagues ?? [];
  const teams = data?.teams ?? [];

  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
          <Trophy className="size-6 text-primary" /> Ligas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Elegí una liga para ver tabla, partidos y equipos.
        </p>
      </header>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando…
        </div>
      ) : leagues.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border/60 p-8 text-center text-sm text-muted-foreground">
          No hay ligas cargadas todavía.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leagues.map((l) => {
            const teamCount = teams.filter((t) => t.leagueId === l.id).length;
            return (
              <Link
                key={l.id}
                to="/ligas/$id"
                params={{ id: l.id }}
                className="group rounded-2xl bg-card border border-border/60 p-0 hover:border-primary/60 hover:shadow-glow transition-all overflow-hidden flex flex-col"
              >
                <div 
                  className="h-24 w-full bg-cover bg-center relative"
                  style={{ backgroundColor: l.color + '20' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  {l.color && <div className="absolute top-4 right-4 size-3 rounded-full shadow-glow" style={{ backgroundColor: l.color }} />}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="font-bold text-lg group-hover:text-primary transition-colors">{l.name}</div>
                  {l.season && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="size-3" /> Temporada {l.season}
                    </div>
                  )}
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {teamCount} {teamCount === 1 ? "Equipo" : "Equipos"}
                    </div>
                    <div className="text-xs font-bold text-primary flex items-center gap-1">
                      Ver liga <ArrowRight className="size-3" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}
