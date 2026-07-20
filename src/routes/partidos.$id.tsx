import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";
import { z } from "zod";

import { PublicShell } from "@/components/PublicShell";
import { PublicMatchView } from "@/components/PublicMatchView";
import { usePublicData } from "@/lib/use-public-data";
import { setsWon } from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

const searchSchema = z.object({
  from: z.enum(["jugadora", "equipo", "liga"]).optional(),
  fromId: z.string().optional(),
});

export const Route = createFileRoute("/partidos/$id")({
  validateSearch: searchSchema,
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
  const { from, fromId } = Route.useSearch();
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

  // Resolve contextual back link (only if we received origin metadata AND we
  // can name the origin entity). Otherwise show only "Inicio".
  let backLabel: string | null = null;
  let backLink: React.ReactNode = null;
  if (from === "jugadora" && fromId) {
    const player = (data?.teams ?? [])
      .flatMap((t) => t.players ?? [])
      .find((p) => p.id === fromId);
    if (player) {
      backLabel = player.name;
      backLink = (
        <Link
          to="/jugadora/$id"
          params={{ id: fromId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver a {player.name}
        </Link>
      );
    }
  } else if (from === "equipo" && fromId) {
    const team = data?.teams.find((t) => t.id === fromId);
    if (team) {
      backLabel = team.name;
      backLink = (
        <Link
          to="/equipos/$id"
          params={{ id: fromId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver a {team.shortName ?? team.name}
        </Link>
      );
    }
  } else if (from === "liga" && fromId) {
    const lg = data?.leagues.find((l) => l.id === fromId);
    if (lg) {
      backLabel = lg.name;
      backLink = (
        <Link
          to="/ligas/$id"
          params={{ id: fromId }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Volver a {lg.name}
        </Link>
      );
    }
  }

  return (
    <PublicShell>
      <nav aria-label="Navegación" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {backLink}
        {backLabel && <span className="text-muted-foreground/40 text-xs">|</span>}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Home className="size-3.5" /> Inicio
        </Link>
      </nav>
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
