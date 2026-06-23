import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { PublicMatchView } from "@/components/PublicMatchView";
import { usePublicData } from "@/lib/use-public-data";
import { setsWon } from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/partidos/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Partido · RALLY" },
      { property: "og:url", content: `${SITE_URL}/partidos/${params.id}` },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/partidos/${params.id}` }],
  }),
  component: PublicMatchPage,
});

function PublicMatchPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = usePublicData({ refetchLive: true });

  if (isLoading) {
    return (
      <PublicShell>
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando…
        </div>
      </PublicShell>
    );
  }

  const match = data?.matches.find((m) => m.id === id);
  if (!match) throw notFound();

  const teamA = data?.teams.find((t) => t.id === match.teamAId);
  const teamB = data?.teams.find((t) => t.id === match.teamBId);
  if (!teamA || !teamB) throw notFound();

  const league = teamA.leagueId
    ? data?.leagues.find((l) => l.id === teamA.leagueId) ?? null
    : null;

  const w = setsWon(match);

  return (
    <PublicShell>
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-3.5" /> Inicio
      </Link>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-extrabold">
          {teamA.shortName} <span className="text-primary">{w.a}–{w.b}</span> {teamB.shortName}
        </h1>
        {match.status === "live" && (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-destructive">
            <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
            En vivo
          </span>
        )}
      </div>
      <PublicMatchView
        match={match}
        teamA={teamA}
        teamB={teamB}
        league={league}
      />
    </PublicShell>
  );
}
