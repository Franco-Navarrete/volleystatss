import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Radio, Trophy, Filter } from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { TeamBadge } from "@/components/TeamBadge";
import { GenderFilter, type GenderFilterValue } from "@/components/GenderFilter";
import { usePublicData } from "@/lib/use-public-data";
import { matchGender, setsWon, type Match, type Team, type League } from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RALLY · Estadísticas de vóley en vivo" },
      {
        name: "description",
        content:
          "Seguí partidos, ligas, equipos y rankings de vóley en tiempo real. Resultados live, fixture y estadísticas detalladas.",
      },
      { property: "og:title", content: "RALLY · Estadísticas de vóley en vivo" },
      {
        property: "og:description",
        content:
          "Seguí partidos, ligas, equipos y rankings de vóley en tiempo real.",
      },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: PublicHome,
});

function PublicHome() {
  const { data, isLoading } = usePublicData({ refetchLive: true });
  const teams = data?.teams ?? [];
  const matches = data?.matches ?? [];
  const leagues = data?.leagues ?? [];

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const leagueById = useMemo(
    () => new Map(leagues.map((l) => [l.id, l])),
    [leagues],
  );

  const live = useMemo(
    () =>
      matches
        .filter((m) => m.status === "live")
        .sort((a, b) => a.scheduledAt - b.scheduledAt),
    [matches],
  );

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      matches
        .filter((m) => m.status === "scheduled" && m.scheduledAt >= now - 60_000)
        .sort((a, b) => a.scheduledAt - b.scheduledAt)
        .slice(0, 6),
    [matches, now],
  );

  const recent = useMemo(
    () =>
      matches
        .filter((m) => m.status === "finished")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 6),
    [matches],
  );

  const activeLeagues = useMemo(() => {
    return leagues.map((l) => ({
      league: l,
      teamCount: teams.filter((t) => t.leagueId === l.id).length,
    }));
  }, [leagues, teams]);

  return (
    <PublicShell>
      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando…
        </div>
      ) : (
        <div className="space-y-8">
          {/* Hero */}
          <section className="rounded-2xl bg-gradient-surface border border-border/60 p-5 sm:p-8 shadow-elevated relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-[0.07] pointer-events-none" />
            <div className="relative">
              <h1 className="text-2xl sm:text-4xl font-extrabold leading-[1.1] max-w-2xl">
                Vóley en vivo, <span className="text-primary">punto a punto</span>.
              </h1>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl">
                Seguí tus partidos, ligas y jugadoras favoritas. Sin login, en
                tiempo real.
              </p>
            </div>
          </section>

          {/* Live */}
          <Section
            icon={<Radio className="size-4 text-destructive animate-pulse" />}
            title="Partidos en vivo"
            empty="No hay partidos en vivo ahora mismo."
            count={live.length}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {live.map((m) => (
                <LiveMatchCard key={m.id} match={m} teamById={teamById} />
              ))}
            </div>
          </Section>

          {/* Upcoming */}
          <Section
            icon={<CalendarDays className="size-4 text-accent" />}
            title="Próximos partidos"
            empty="No hay partidos programados."
            count={upcoming.length}
          >
            <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
              {upcoming.map((m) => (
                <ScheduledRow
                  key={m.id}
                  match={m}
                  teamById={teamById}
                  leagueById={leagueById}
                />
              ))}
            </ul>
          </Section>

          {/* Recent */}
          <Section
            icon={<Trophy className="size-4 text-primary" />}
            title="Últimos resultados"
            empty="Aún no hay resultados."
            count={recent.length}
          >
            <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
              {recent.map((m) => (
                <ResultRow key={m.id} match={m} teamById={teamById} />
              ))}
            </ul>
          </Section>

          {/* Leagues */}
          <Section
            icon={<Trophy className="size-4 text-primary" />}
            title="Ligas activas"
            empty="Todavía no hay ligas cargadas."
            count={activeLeagues.length}
          >
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeLeagues.map(({ league, teamCount }) => (
                <Link
                  key={league.id}
                  to="/ligas/$id"
                  params={{ id: league.id }}
                  className="rounded-2xl bg-card border border-border/60 p-4 hover:border-primary/60 hover:shadow-glow transition-all"
                >
                  <div className="font-semibold text-base">{league.name}</div>
                  {league.season && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Temporada {league.season}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {teamCount} {teamCount === 1 ? "equipo" : "equipos"}
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </div>
      )}
    </PublicShell>
  );
}

function Section({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {icon} {title}
      </h2>
      {count === 0 ? (
        <div className="rounded-2xl bg-card border border-border/60 p-6 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function LiveMatchCard({
  match,
  teamById,
}: {
  match: Match;
  teamById: Map<string, Team>;
}) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const currentSet = match.sets.find((s) => !s.finished) ?? match.sets.at(-1);
  const w = setsWon(match);

  return (
    <Link
      to="/partidos/$id"
      params={{ id: match.id }}
      className="rounded-2xl bg-card border border-border/60 p-4 hover:border-destructive/60 hover:shadow-glow transition-all block"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-destructive">
          <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
          En vivo · Set {match.currentSet}
        </span>
        <span className="text-[10px] uppercase text-muted-foreground tabular-nums">
          {w.a}–{w.b}
        </span>
      </div>
      <div className="space-y-1.5">
        <TeamRow team={a} score={currentSet?.scoreA ?? 0} live />
        <TeamRow team={b} score={currentSet?.scoreB ?? 0} live />
      </div>
    </Link>
  );
}

function TeamRow({
  team,
  score,
  live,
}: {
  team: Team | undefined;
  score: number;
  live?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <TeamBadge team={team} size="sm" />
      <span className="font-medium text-sm truncate flex-1">
        {team?.name ?? "—"}
      </span>
      <span
        className={`tabular-nums font-bold ${live ? "text-xl" : "text-base"}`}
      >
        {score}
      </span>
    </div>
  );
}

function ScheduledRow({
  match,
  teamById,
  leagueById,
}: {
  match: Match;
  teamById: Map<string, Team>;
  leagueById: Map<string, League>;
}) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const league = a?.leagueId ? leagueById.get(a.leagueId) : null;
  const date = new Date(match.scheduledAt);
  const dateLabel = date.toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li>
      <Link
        to="/partidos/$id"
        params={{ id: match.id }}
        className="flex items-center gap-2 px-4 py-3 hover:bg-secondary/30"
      >
        <div className="text-xs text-muted-foreground w-20 shrink-0">
          <div className="font-semibold text-foreground capitalize">
            {dateLabel}
          </div>
          <div className="tabular-nums">{timeLabel}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <TeamBadge team={a} size="sm" />
            <span className="font-medium truncate">{a?.shortName ?? "—"}</span>
            <span className="text-muted-foreground text-xs">vs</span>
            <span className="font-medium truncate">{b?.shortName ?? "—"}</span>
            <TeamBadge team={b} size="sm" />
          </div>
          {league && (
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              {league.name}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

function ResultRow({
  match,
  teamById,
}: {
  match: Match;
  teamById: Map<string, Team>;
}) {
  const a = teamById.get(match.teamAId);
  const b = teamById.get(match.teamBId);
  const w = setsWon(match);
  const aWon = w.a > w.b;
  return (
    <li>
      <Link
        to="/partidos/$id"
        params={{ id: match.id }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30"
      >
        <TeamBadge team={a} size="sm" />
        <span
          className={`flex-1 text-sm truncate ${aWon ? "font-bold" : "text-muted-foreground"}`}
        >
          {a?.shortName ?? "—"}
        </span>
        <span className="scoreboard-digit font-bold tabular-nums text-base">
          <span className={aWon ? "text-primary" : ""}>{w.a}</span>
          <span className="text-muted-foreground mx-1">–</span>
          <span className={!aWon ? "text-primary" : ""}>{w.b}</span>
        </span>
        <span
          className={`flex-1 text-right text-sm truncate ${!aWon ? "font-bold" : "text-muted-foreground"}`}
        >
          {b?.shortName ?? "—"}
        </span>
        <TeamBadge team={b} size="sm" />
      </Link>
    </li>
  );
}
