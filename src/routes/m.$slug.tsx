import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Volleyball } from "lucide-react";

import { getPublicMatch } from "@/lib/public-match.functions";
import { PublicMatchView } from "@/components/PublicMatchView";
import { setsWon } from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

const publicMatchQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public-match", slug],
    queryFn: () => getPublicMatch({ data: { slug } }),
  });

export const Route = createFileRoute("/m/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(publicMatchQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE_URL}/m/${params.slug}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Partido · RALLY" },
          { property: "og:url", content: url },
          { name: "robots", content: "noindex" },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const { snapshot } = loaderData;
    const { match, teamA, teamB, league } = snapshot;
    const w = setsWon(match);
    const title = `${teamA.name} ${w.a}–${w.b} ${teamB.name} · RALLY`;
    const setsLine = match.sets
      .map((s) => `${s.scoreA}-${s.scoreB}`)
      .join(" · ");
    const leagueLine = league
      ? `${league.name}${league.season ? ` ${league.season}` : ""} · `
      : "";
    const description = `${leagueLine}Sets ${setsLine}. Estadísticas completas del partido.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "RALLY" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsEvent",
            name: `${teamA.name} vs ${teamB.name}`,
            sport: "Volleyball",
            url,
            description,
          }),
        },
      ],
    };
  },
  component: PublicMatchPage,
  errorComponent: PublicMatchError,
  notFoundComponent: PublicMatchNotFound,
});

function PublicMatchPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(publicMatchQuery(slug));
  const { snapshot } = data;
  return (
    <PublicShell>
      <PublicMatchView
        match={snapshot.match}
        teamA={snapshot.teamA}
        teamB={snapshot.teamB}
        league={snapshot.league}
      />
    </PublicShell>
  );
}

function PublicMatchError() {
  return (
    <PublicShell>
      <div className="text-center py-20 text-muted-foreground">
        <p>No pudimos cargar este partido.</p>
      </div>
    </PublicShell>
  );
}

function PublicMatchNotFound() {
  return (
    <PublicShell>
      <div className="text-center py-20">
        <p className="text-muted-foreground">
          Este partido no está disponible o el dueño desactivó el enlace público.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ir al inicio
        </Link>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="size-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Volleyball className="size-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm tracking-tight">RALLY</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Live Stats
              </div>
            </div>
          </Link>
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Crear el tuyo
          </a>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6">
        {children}
      </main>
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        RALLY · estadísticas en tiempo real
      </footer>
    </div>
  );
}
