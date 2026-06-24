import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Users, Trophy } from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { TeamBadge } from "@/components/TeamBadge";
import { usePublicData } from "@/lib/use-public-data";
import {
  PLAYER_POSITION_LABEL,
  TEAM_GENDER_LABEL,
  TEAM_CATEGORY_LABEL,
  setsWon,
} from "@/lib/volley-store";
import { computeHistoricalStats } from "@/lib/historical-stats";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/equipos/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Equipo · RALLY" },
      { property: "og:url", content: `${SITE_URL}/equipos/${params.id}` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/equipos/${params.id}` }],
  }),
  component: TeamDetail,
});

function TeamDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = usePublicData();

  const team = data?.teams.find((t) => t.id === id);
  const league = team?.leagueId
    ? data?.leagues.find((l) => l.id === team.leagueId)
    : null;

  const teamMatches = useMemo(
    () =>
      (data?.matches ?? []).filter(
        (m) => m.teamAId === id || m.teamBId === id,
      ),
    [data, id],
  );

  const stats = useMemo(() => {
    const finished = teamMatches.filter((m) => m.status === "finished");
    let won = 0;
    for (const m of finished) {
      const [a, b] = setsWon(m);
      if ((m.teamAId === id && a > b) || (m.teamBId === id && b > a)) won++;
    }
    return { played: finished.length, won, lost: finished.length - won };
  }, [teamMatches, id]);

  const playerAggs = useMemo(() => {
    if (!data) return [];
    return computeHistoricalStats(teamMatches, data.teams).filter(
      (a) => a.team.id === id,
    );
  }, [data, teamMatches, id]);

  const aggByPlayer = useMemo(
    () => new Map(playerAggs.map((a) => [a.player.id, a])),
    [playerAggs],
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
  if (!team) throw notFound();

  const teamById = new Map((data?.teams ?? []).map((t) => [t.id, t]));

  return (
    <PublicShell>
      <div className="space-y-4">
        <Link
          to="/equipos"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Equipos
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-6 flex items-center gap-4">
          <TeamBadge team={team} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {team.name}
            </h1>
            <div className="text-xs text-muted-foreground truncate">
              {league ? (
                <Link
                  to="/ligas/$id"
                  params={{ id: league.id }}
                  className="hover:text-foreground"
                >
                  {league.name}
                  {league.season ? ` · ${league.season}` : ""}
                </Link>
              ) : (
                "Sin liga"
              )}
              {team.gender ? ` · ${TEAM_GENDER_LABEL[team.gender]}` : ""}
              {team.category
                ? ` · ${TEAM_CATEGORY_LABEL[team.category]}`
                : ""}
            </div>
          </div>
        </div>

        {/* Team stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Partidos" value={stats.played} />
          <StatCell label="Ganados" value={stats.won} highlight />
          <StatCell label="Perdidos" value={stats.lost} />
        </div>

        {/* Roster */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Users className="size-4" /> Plantel ({team.players.length})
          </h2>
          {team.players.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
              Sin jugadoras cargadas.
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 bg-card/40 divide-y divide-border/40">
              {[...team.players]
                .sort((a, b) => a.number - b.number)
                .map((p) => {
                  const agg = aggByPlayer.get(p.id);
                  return (
                    <Link
                      key={p.id}
                      to="/jugadora/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/40 transition-colors"
                    >
                      <div
                        className="size-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: team.color }}
                      >
                        {p.photoUrl ? (
                          <img
                            src={p.photoUrl}
                            alt={p.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <span>#{p.number}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          #{p.number}
                          {p.position
                            ? ` · ${PLAYER_POSITION_LABEL[p.position]}`
                            : ""}
                        </div>
                      </div>
                      {agg && agg.matchesPlayed > 0 && (
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-primary">
                            {agg.totals.points}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            pts · {agg.matchesPlayed} PJ
                          </div>
                        </div>
                      )}
                    </Link>
                  );
                })}
            </div>
          )}
        </section>

        {/* Recent matches */}
        {teamMatches.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <Trophy className="size-4" /> Partidos
            </h2>
            <div className="rounded-lg border border-border/60 bg-card/40 divide-y divide-border/40">
              {[...teamMatches]
                .sort((a, b) => b.scheduledAt - a.scheduledAt)
                .slice(0, 15)
                .map((m) => {
                  const opponent =
                    m.teamAId === id
                      ? teamById.get(m.teamBId)
                      : teamById.get(m.teamAId);
                  const [a, b] = setsWon(m);
                  const myScore = m.teamAId === id ? a : b;
                  const opScore = m.teamAId === id ? b : a;
                  const isFinished = m.status === "finished";
                  return (
                    <Link
                      key={m.id}
                      to="/partidos/$id"
                      params={{ id: m.id }}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          vs {opponent?.name ?? "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(m.scheduledAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {" · "}
                          {m.status === "live"
                            ? "En vivo"
                            : m.status === "finished"
                              ? "Finalizado"
                              : "Programado"}
                        </div>
                      </div>
                      {isFinished && (
                        <div
                          className={`text-base font-bold shrink-0 ${
                            myScore > opScore
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        >
                          {myScore}–{opScore}
                        </div>
                      )}
                    </Link>
                  );
                })}
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-card/40"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>
      <div
        className={`text-lg font-bold leading-tight ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
