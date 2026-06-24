import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Share2,
  Trophy,
  Award,
  Flame,
  Star,
  Calendar,
} from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { usePublicData } from "@/lib/use-public-data";
import {
  PLAYER_POSITION_LABEL,
  type Match,
  type Player,
  type Team,
} from "@/lib/volley-store";
import {
  computeHistoricalStats,
  RANKING_METRICS,
  rankBy,
  type PlayerAggregate,
} from "@/lib/historical-stats";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/jugadora/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Perfil de jugadora · RALLY" },
      {
        name: "description",
        content: "Estadísticas públicas de la jugadora en RALLY.",
      },
      {
        property: "og:title",
        content: "Perfil de jugadora · RALLY",
      },
      {
        property: "og:url",
        content: `${SITE_URL}/jugadora/${params.id}`,
      },
      { property: "og:type", content: "profile" },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/jugadora/${params.id}` },
    ],
  }),
  component: PlayerProfile,
});

function findPlayer(
  teams: Team[],
  playerId: string,
): { player: Player; team: Team } | null {
  for (const t of teams) {
    const p = t.players.find((x) => x.id === playerId);
    if (p) return { player: p, team: t };
  }
  return null;
}

function PlayerProfile() {
  const { id } = Route.useParams();
  const { data, isLoading } = usePublicData({ refetchLive: false });
  const [leagueFilter, setLeagueFilter] = useState<string>("all");

  const teams = data?.teams ?? [];
  const matches = data?.matches ?? [];
  const leagues = data?.leagues ?? [];

  const found = useMemo(() => findPlayer(teams, id), [teams, id]);

  // Filter matches by league using team membership
  const filteredMatches = useMemo<Match[]>(() => {
    if (leagueFilter === "all") return matches;
    const teamIdsInLeague = new Set(
      teams.filter((t) => t.leagueId === leagueFilter).map((t) => t.id),
    );
    return matches.filter(
      (m) => teamIdsInLeague.has(m.teamAId) && teamIdsInLeague.has(m.teamBId),
    );
  }, [matches, teams, leagueFilter]);

  // All aggregates (over filtered matches), needed for ranking positions
  const allAggs = useMemo(
    () => computeHistoricalStats(filteredMatches, teams),
    [filteredMatches, teams],
  );

  const agg: PlayerAggregate | undefined = useMemo(
    () => allAggs.find((a) => a.player.id === id),
    [allAggs, id],
  );

  // Compute ranking positions (1-based) for this player across all metrics
  const rankings = useMemo(() => {
    if (!agg) return [];
    return RANKING_METRICS.map((m) => {
      const ranked = rankBy(allAggs, m, 9999);
      const idx = ranked.findIndex((a) => a.player.id === id);
      return idx >= 0
        ? {
            label: m.label,
            short: m.shortLabel,
            pos: idx + 1,
            value: m.format(agg),
            total: ranked.length,
          }
        : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [allAggs, agg, id]);

  // Player's leagues (deduped, from teams the player belongs to historically)
  // For now we only have the current team's league.
  const playerLeagues = useMemo(() => {
    if (!found?.team.leagueId) return leagues;
    return leagues;
  }, [leagues, found]);

  if (isLoading) {
    return (
      <PublicShell>
        <div className="py-16 text-center text-sm text-muted-foreground">
          Cargando…
        </div>
      </PublicShell>
    );
  }
  if (!found) throw notFound();

  const { player, team } = found;
  const positionLabel = player.position ? PLAYER_POSITION_LABEL[player.position] : null;

  const handleShare = async () => {
    const url = `${SITE_URL}/jugadora/${id}`;
    const text = agg
      ? `${player.name} — ${agg.totals.points} pts · ${agg.totals.block} bloqueos · ${agg.totals.ace} aces (${team.name})`
      : `${player.name} (${team.name}) en RALLY`;
    if (navigator.share) {
      try {
        await navigator.share({ title: player.name, text, url });
        return;
      } catch {
        // fall through
      }
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  };

  return (
    <PublicShell>
      <div className="space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Inicio
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-6 flex items-center gap-4">
          <div
            className="size-16 sm:size-20 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ background: team.color }}
          >
            {player.photoUrl ? (
              <img
                src={player.photoUrl}
                alt={player.name}
                className="size-full object-cover"
              />
            ) : (
              <span>#{player.number}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate">
              {player.name}
            </h1>
            <div className="text-sm text-muted-foreground truncate">
              {team.name}
              {positionLabel ? ` · ${positionLabel}` : ""} · #{player.number}
            </div>
          </div>
          <button
            onClick={handleShare}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90"
          >
            <Share2 className="size-4" />
            <span className="hidden sm:inline">Compartir</span>
          </button>
        </div>

        {/* League filter */}
        {playerLeagues.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-muted-foreground shrink-0">Liga:</span>
            <button
              onClick={() => setLeagueFilter("all")}
              className={`shrink-0 px-3 py-1.5 rounded-full border transition-colors ${
                leagueFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 hover:bg-secondary/50"
              }`}
            >
              Todas
            </button>
            {playerLeagues.map((l) => (
              <button
                key={l.id}
                onClick={() => setLeagueFilter(l.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full border transition-colors ${
                  leagueFilter === l.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/60 hover:bg-secondary/50"
                }`}
              >
                {l.name}
                {l.season ? ` ${l.season}` : ""}
              </button>
            ))}
          </div>
        )}

        {!agg || agg.matchesPlayed === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card/30 p-8 text-center text-sm text-muted-foreground">
            Aún no hay estadísticas registradas para esta jugadora
            {leagueFilter !== "all" ? " en esta liga" : ""}.
          </div>
        ) : (
          <>
            {/* Totals */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Estadísticas generales
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <StatCell label="Partidos" value={agg.matchesPlayed} />
                <StatCell label="Puntos" value={agg.totals.points} highlight />
                <StatCell label="Ataques" value={agg.totals.attack} />
                <StatCell
                  label="Contraataques"
                  value={agg.totals.counterAttack}
                />
                <StatCell label="Bloqueos" value={agg.totals.block} />
                <StatCell label="Aces" value={agg.totals.ace} />
                <StatCell label="MVP" value={agg.totals.mvp} highlight />
                <StatCell
                  label="Err. no forz."
                  value={agg.totals.unforcedError}
                />
              </div>
            </section>

            {/* Averages */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Promedios por partido
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCell
                  label="Puntos/PJ"
                  value={agg.averages.points.toFixed(1)}
                />
                <StatCell
                  label="Ataques/PJ"
                  value={agg.averages.attack.toFixed(1)}
                />
                <StatCell
                  label="Bloqueos/PJ"
                  value={agg.averages.block.toFixed(1)}
                />
                <StatCell label="Aces/PJ" value={agg.averages.ace.toFixed(1)} />
              </div>
              {agg.totals.receptionTotal > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Recepción:{" "}
                  <span className="text-foreground font-semibold">
                    {agg.averages.receptionEfficiency.toFixed(0)}%
                  </span>{" "}
                  ({agg.totals.receptionTotal} recepciones)
                </div>
              )}
            </section>

            {/* Rankings */}
            {rankings.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <Trophy className="size-4" /> Posición en rankings
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {rankings.map((r) => (
                    <div
                      key={r.label}
                      className="rounded-lg border border-border/60 bg-card/40 p-3"
                    >
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {r.label}
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-bold text-primary">
                          #{r.pos}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          de {r.total}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {r.short}: {r.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Records */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Flame className="size-4" /> Récords personales
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <RecordCard label="Máximo de puntos" rec={agg.records.points} />
                <RecordCard
                  label="Máximo de bloqueos"
                  rec={agg.records.block}
                />
                <RecordCard label="Máximo de aces" rec={agg.records.ace} />
              </div>
            </section>

            {/* Last matches */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Calendar className="size-4" /> Últimos partidos
              </h2>
              <div className="rounded-lg border border-border/60 bg-card/40 divide-y divide-border/40">
                {agg.lastMatches.map((m) => (
                  <Link
                    key={m.matchId}
                    to="/partidos/$id"
                    params={{ id: m.matchId }}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        vs {m.opponentName}
                        {m.wasMvp && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-500 font-bold">
                            <Star className="size-3 fill-current" /> MVP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(m.date).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-primary">
                        {m.points}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        pts
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Evolution: simple bar chart of points per match */}
            {agg.allPerformances.length >= 2 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Evolución de puntos
                </h2>
                <EvolutionChart performances={agg.allPerformances} />
              </section>
            )}

            {/* Awards: MVPs */}
            {agg.totals.mvp > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <Award className="size-4" /> Premios
                </h2>
                <div className="flex flex-wrap gap-2">
                  {agg.allPerformances
                    .filter((p) => p.wasMvp)
                    .map((p) => (
                      <div
                        key={p.matchId}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold"
                      >
                        <Star className="size-3 fill-current" />
                        MVP vs {p.opponentName}
                      </div>
                    ))}
                </div>
              </section>
            )}
          </>
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

function RecordCard({
  label,
  rec,
}: {
  label: string;
  rec: { value: number; opponentName: string; date: number } | null;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {rec ? (
        <>
          <div className="text-2xl font-bold text-primary leading-tight">
            {rec.value}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            vs {rec.opponentName}
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground mt-1">—</div>
      )}
    </div>
  );
}

function EvolutionChart({
  performances,
}: {
  performances: { date: number; points: number; opponentName: string }[];
}) {
  // Oldest -> newest for the chart
  const data = [...performances].reverse();
  const max = Math.max(1, ...data.map((d) => d.points));
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const h = (d.points / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
              title={`${d.points} pts vs ${d.opponentName}`}
            >
              <div className="text-[9px] text-muted-foreground">{d.points}</div>
              <div
                className="w-full bg-primary/70 rounded-t"
                style={{ height: `${h}%`, minHeight: 2 }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
        <span>
          {new Date(data[0].date).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
          })}
        </span>
        <span>
          {new Date(data[data.length - 1].date).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
          })}
        </span>
      </div>
    </div>
  );
}
