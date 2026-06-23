import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Trophy, Users, Filter } from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { TeamBadge } from "@/components/TeamBadge";
import { GenderFilter, type GenderFilterValue } from "@/components/GenderFilter";
import { usePublicData } from "@/lib/use-public-data";
import {
  computeStandings,
  matchGender,
  setsWon,
  type Match,
  type Team,
} from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/ligas/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Liga · RALLY" },
      { property: "og:url", content: `${SITE_URL}/ligas/${params.id}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/ligas/${params.id}` }],
  }),
  component: LeagueDetail,
});

type Tab = "tabla" | "partidos" | "equipos";

function LeagueDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = usePublicData({ refetchLive: true });
  const [tab, setTab] = useState<Tab>("tabla");

  const league = data?.leagues.find((l) => l.id === id);
  const teams = useMemo(
    () => (data?.teams ?? []).filter((t) => t.leagueId === id),
    [data, id],
  );
  const teamIds = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);
  const matches = useMemo(
    () =>
      (data?.matches ?? []).filter(
        (m) => teamIds.has(m.teamAId) && teamIds.has(m.teamBId),
      ),
    [data, teamIds],
  );

  if (isLoading) {
    return (
      <PublicShell>
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando…
        </div>
      </PublicShell>
    );
  }
  if (!league) throw notFound();

  return (
    <PublicShell>
      <Link
        to="/ligas"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
      >
        <ArrowLeft className="size-3.5" /> Ligas
      </Link>
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold">{league.name}</h1>
        {league.season && (
          <div className="text-sm text-muted-foreground mt-1">
            Temporada {league.season} · {teams.length} equipos
          </div>
        )}
      </header>

      <nav className="flex gap-1 border-b border-border/60 mb-5 -mx-3 px-3 sm:mx-0 sm:px-0 overflow-x-auto">
        {(
          [
            { id: "tabla", label: "Tabla", icon: Trophy },
            { id: "partidos", label: "Partidos", icon: CalendarDays },
            { id: "equipos", label: "Equipos", icon: Users },
          ] as { id: Tab; label: string; icon: typeof Trophy }[]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </nav>

      {tab === "tabla" && <StandingsTab teams={teams} matches={matches} leagueId={id} />}
      {tab === "partidos" && <MatchesTab teams={teams} matches={matches} />}
      {tab === "equipos" && <TeamsTab teams={teams} />}
    </PublicShell>
  );
}

function StandingsTab({
  teams,
  matches,
  leagueId,
}: {
  teams: Team[];
  matches: Match[];
  leagueId: string;
}) {
  const standings = useMemo(
    () => computeStandings(teams, matches, leagueId),
    [teams, matches, leagueId],
  );
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (standings.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-8 text-center text-sm text-muted-foreground">
        Sin equipos cargados.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/60 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary/40">
          <tr>
            <th className="text-left py-2.5 px-2 sm:px-3 w-6">#</th>
            <th className="text-left py-2.5 px-2 sm:px-3">Equipo</th>
            <th className="text-center py-2.5 px-1.5">PJ</th>
            <th className="text-center py-2.5 px-1.5">G</th>
            <th className="text-center py-2.5 px-1.5">P</th>
            <th className="text-center py-2.5 px-1.5">Sets</th>
            <th className="text-center py-2.5 px-2 sm:px-3 text-primary">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => {
            const team = teamById.get(row.teamId);
            return (
              <tr
                key={row.teamId}
                className="border-t border-border/40 hover:bg-secondary/30"
              >
                <td className="py-2.5 px-2 sm:px-3 text-muted-foreground tabular-nums">
                  {i + 1}
                </td>
                <td className="py-2.5 px-2 sm:px-3">
                  <div className="flex items-center gap-2">
                    <TeamBadge team={team} size="sm" />
                    <span className="font-medium text-sm truncate">
                      {team?.shortName ?? "—"}
                    </span>
                  </div>
                </td>
                <td className="text-center tabular-nums">{row.played}</td>
                <td className="text-center tabular-nums text-success">
                  {row.won}
                </td>
                <td className="text-center tabular-nums text-muted-foreground">
                  {row.lost}
                </td>
                <td className="text-center tabular-nums text-muted-foreground">
                  {row.setsFor}-{row.setsAgainst}
                </td>
                <td className="text-center tabular-nums font-bold text-primary px-2 sm:px-3">
                  {row.leaguePoints}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatchesTab({ teams, matches }: { teams: Team[]; matches: Match[] }) {
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const sorted = useMemo(
    () => [...matches].sort((a, b) => b.scheduledAt - a.scheduledAt),
    [matches],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-8 text-center text-sm text-muted-foreground">
        No hay partidos.
      </div>
    );
  }

  return (
    <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
      {sorted.map((m) => {
        const a = teamById.get(m.teamAId);
        const b = teamById.get(m.teamBId);
        const w = setsWon(m);
        const date = new Date(m.scheduledAt);
        const label = date.toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <li key={m.id}>
            <Link
              to="/partidos/$id"
              params={{ id: m.id }}
              className="flex items-center gap-2 px-3 sm:px-4 py-3 hover:bg-secondary/30"
            >
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground w-16 shrink-0">
                {label}
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                <TeamBadge team={a} size="sm" />
                <span className="font-medium truncate flex-1">
                  {a?.shortName ?? "—"}
                </span>
                {m.status === "finished" || m.status === "live" ? (
                  <span className="scoreboard-digit font-bold tabular-nums">
                    {w.a}–{w.b}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">vs</span>
                )}
                <span className="font-medium truncate flex-1 text-right">
                  {b?.shortName ?? "—"}
                </span>
                <TeamBadge team={b} size="sm" />
              </div>
              {m.status === "live" && (
                <span className="text-[10px] uppercase font-bold text-destructive shrink-0">
                  LIVE
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TeamsTab({ teams }: { teams: Team[] }) {
  if (teams.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-8 text-center text-sm text-muted-foreground">
        Sin equipos.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {teams.map((t) => (
        <div
          key={t.id}
          className="rounded-2xl bg-card border border-border/60 p-4 flex flex-col items-center text-center"
        >
          <TeamBadge team={t} size="lg" />
          <div className="font-semibold text-sm mt-2 truncate w-full">
            {t.name}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
            {t.players.length} jugadoras
          </div>
        </div>
      ))}
    </div>
  );
}
