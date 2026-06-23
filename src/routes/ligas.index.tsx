import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {leagues.map((l) => {
            const teamCount = teams.filter((t) => t.leagueId === l.id).length;
            return (
              <Link
                key={l.id}
                to="/ligas/$id"
                params={{ id: l.id }}
                className="rounded-2xl bg-card border border-border/60 p-5 hover:border-primary/60 hover:shadow-glow transition-all"
              >
                <div className="font-bold text-lg">{l.name}</div>
                {l.season && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Temporada {l.season}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-3">
                  {teamCount} {teamCount === 1 ? "equipo" : "equipos"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PublicShell>
  );
}
