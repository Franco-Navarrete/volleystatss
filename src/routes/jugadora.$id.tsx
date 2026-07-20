import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowLeft,
  Share2,
  Trophy,
  Award,
  Flame,
  Star,
  Calendar,
  BarChart3,
  Target,
  Shield,
  Hand,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { usePublicData } from "@/lib/use-public-data";
import {
  PLAYER_POSITION_LABEL,
  setsWon,
  type Match,
  type Player,
  type Team,
} from "@/lib/volley-store";
import {
  computeHistoricalStats,
  type PlayerAggregate,
} from "@/lib/historical-stats";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/jugadora/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Perfil de jugadora · RALLY" },
      {
        name: "description",
        content: "Estadísticas y rendimiento individual de la jugadora en RALLY.",
      },
      { property: "og:title", content: "Perfil de jugadora · RALLY" },
      { property: "og:url", content: `${SITE_URL}/jugadora/${params.id}` },
      { property: "og:type", content: "profile" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/jugadora/${params.id}` }],
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

/** Simple avg helper over an array of aggregates for a specific numeric picker. */
function avgOf<T>(
  aggs: PlayerAggregate[],
  pick: (a: PlayerAggregate) => number,
): number {
  const withPlay = aggs.filter((a) => a.matchesPlayed > 0);
  if (withPlay.length === 0) return 0;
  return withPlay.reduce((sum, a) => sum + pick(a), 0) / withPlay.length;
}

function PlayerProfile() {
  const { id } = Route.useParams();
  const { data, isLoading } = usePublicData({ refetchLive: false });

  const teams = data?.teams ?? [];
  const matches = data?.matches ?? [];
  const leagues = data?.leagues ?? [];

  const leagueById = useMemo(
    () => new Map(leagues.map((l) => [l.id, l])),
    [leagues],
  );
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );

  const found = useMemo(() => findPlayer(teams, id), [teams, id]);

  const allAggs = useMemo(
    () => computeHistoricalStats(matches, teams),
    [matches, teams],
  );

  const agg = useMemo<PlayerAggregate | undefined>(
    () => allAggs.find((a) => a.player.id === id),
    [allAggs, id],
  );

  // Comparison groups (memoized regardless of `found` for hook stability)
  const teamPeers = useMemo(
    () => allAggs.filter((a) => found && a.team.id === found.team.id && a.player.id !== id),
    [allAggs, found, id],
  );
  const leaguePeers = useMemo(() => {
    if (!found?.team.leagueId) return [];
    const leagueTeams = new Set(
      teams.filter((t) => t.leagueId === found.team.leagueId).map((t) => t.id),
    );
    return allAggs.filter((a) => leagueTeams.has(a.team.id) && a.player.id !== id);
  }, [allAggs, teams, found, id]);
  const positionPeers = useMemo(() => {
    if (!found?.player.position) return [];
    return allAggs.filter(
      (a) => a.player.position === found.player.position && a.player.id !== id,
    );
  }, [allAggs, found, id]);

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
  const leagueName = team.leagueId ? leagueById.get(team.leagueId)?.name : null;

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
        /* fall through */
      }
    }
    const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  };

  const hasStats = agg && agg.matchesPlayed > 0;

  return (
    <PublicShell>
      <div className="space-y-5">
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
              <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
            ) : (
              <span>#{player.number}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate">
              {player.name}
            </h1>
            <div className="text-sm text-muted-foreground truncate">
              <Link
                to="/equipos/$id"
                params={{ id: team.id }}
                className="hover:text-foreground"
              >
                {team.name}
              </Link>
              {positionLabel ? ` · ${positionLabel}` : ""} · #{player.number}
              {leagueName ? ` · ${leagueName}` : ""}
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

        {!hasStats ? (
          <EmptyState teamId={team.id} />
        ) : (
          <PlayerDashboard
            agg={agg!}
            matches={matches}
            teamById={teamById}
            leagueById={leagueById}
            teamPeers={teamPeers}
            leaguePeers={leaguePeers}
            positionPeers={positionPeers}
          />
        )}
      </div>
    </PublicShell>
  );
}

/* ---------------- Empty state ---------------- */

function EmptyState({ teamId }: { teamId: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-8 sm:p-12 text-center">
      <div className="mx-auto size-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
        <BarChart3 className="size-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Sin estadísticas disponibles</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
        Esta jugadora todavía no tiene partidos registrados. Cuando participe en
        un partido utilizando Rally, aquí aparecerán automáticamente sus
        estadísticas, gráficos y evolución.
      </p>
      <Link
        to="/equipos/$id"
        params={{ id: teamId }}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
      >
        <Users className="size-4" />
        Ver partidos del equipo
      </Link>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

function PlayerDashboard({
  agg,
  matches,
  teamById,
  leagueById,
  teamPeers,
  leaguePeers,
  positionPeers,
}: {
  agg: PlayerAggregate;
  matches: Match[];
  teamById: Map<string, Team>;
  leagueById: Map<string, { id: string; name: string; season?: string }>;
  teamPeers: PlayerAggregate[];
  leaguePeers: PlayerAggregate[];
  positionPeers: PlayerAggregate[];
}) {
  const t = agg.totals;

  // Sets jugados (aproximación por sumatoria de sets de los partidos participados)
  const matchIds = new Set(agg.allPerformances.map((p) => p.matchId));
  const setsPlayed = matches
    .filter((m) => matchIds.has(m.id))
    .reduce((sum, m) => sum + (m.sets?.length ?? 0), 0);

  const totalErrors = t.serveError + t.attackError + t.blockError + t.unforcedError;
  const attackTotal = t.attack + t.counterAttack + t.rotationAttack;
  const attackKills = attackTotal; // en el modelo actual, cada evento de ataque cuenta como punto
  const attackEff =
    attackTotal + t.attackError > 0
      ? (attackKills - t.attackError) / (attackTotal + t.attackError)
      : 0;

  const recTotal = t.receptionTotal;
  const recPerfectPct = recTotal > 0 ? (t.receptionPositive / recTotal) * 100 : 0;
  const recEff = agg.averages.receptionEfficiency;

  const blockRatio =
    t.block + t.blockError > 0 ? (t.block / (t.block + t.blockError)) * 100 : 0;

  const serveTotal = t.ace + t.serveError;
  const serveRatio = serveTotal > 0 ? (t.ace / serveTotal) * 100 : 0;

  // MVP score promedio como “rendimiento”
  const perfScore =
    agg.matchesPlayed > 0
      ? (t.attack + t.counterAttack + t.rotationAttack + t.block + t.ace - t.unforcedError) /
        agg.matchesPlayed
      : 0;

  // Por rival (top 5 por puntos)
  const byOpponent = useMemo_localByOpponent(agg);

  // Por liga
  const byLeague = useMemo_localByLeague(agg, matches, teamById, leagueById);

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <Section title="Resumen" icon={<BarChart3 className="size-4" />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCell label="Partidos" value={agg.matchesPlayed} />
          <StatCell label="Sets" value={setsPlayed} />
          <StatCell label="Puntos" value={t.points} highlight />
          <StatCell label="Aces" value={t.ace} />
          <StatCell label="Ataques" value={attackTotal} />
          <StatCell label="Bloqueos" value={t.block} />
          <StatCell label="Errores" value={totalErrors} />
          <StatCell
            label="Eficiencia atq"
            value={`${(attackEff * 100).toFixed(0)}%`}
            highlight
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          <StatCell label="Rendimiento (pts/PJ)" value={perfScore.toFixed(1)} />
          <StatCell label="Puntos/PJ" value={agg.averages.points.toFixed(1)} />
          <StatCell label="MVP" value={t.mvp} />
        </div>
      </Section>

      {/* Gráficos */}
      {agg.allPerformances.length >= 2 && (
        <Section title="Evolución por partido" icon={<TrendingUp className="size-4" />}>
          <EvolutionChart performances={agg.allPerformances} />
        </Section>
      )}

      {byOpponent.length > 0 && (
        <Section title="Rendimiento por rival" icon={<Users className="size-4" />}>
          <RankedBars
            rows={byOpponent.map((o) => ({
              label: o.opponentName,
              value: o.points,
              sub: `${o.matches} PJ · ${o.attack} atq · ${o.block} blk`,
            }))}
            unit="pts"
          />
        </Section>
      )}

      {byLeague.length > 0 && (
        <Section title="Rendimiento por liga" icon={<Trophy className="size-4" />}>
          <RankedBars
            rows={byLeague.map((l) => ({
              label: l.leagueName,
              value: l.points,
              sub: `${l.matches} PJ · ${(l.points / Math.max(1, l.matches)).toFixed(1)} pts/PJ`,
            }))}
            unit="pts"
          />
        </Section>
      )}

      {/* Ataque */}
      <Section title="Ataque" icon={<Target className="size-4" />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCell label="Totales" value={attackTotal} />
          <StatCell label="Puntos" value={attackKills} highlight />
          <StatCell label="Errores" value={t.attackError} />
          <StatCell
            label="Eficiencia"
            value={`${(attackEff * 100).toFixed(0)}%`}
            highlight
          />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatCell label="Ataque" value={t.attack} />
          <StatCell label="Contraataque" value={t.counterAttack} />
          <StatCell label="Rotación" value={t.rotationAttack} />
        </div>
        <ComingSoon text="Mapa de calor y ataques por zona · próximamente" />
      </Section>

      {/* Recepción */}
      <Section title="Recepción" icon={<Hand className="size-4" />}>
        {recTotal === 0 ? (
          <p className="text-xs text-muted-foreground">Sin recepciones registradas.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCell label="Recepciones" value={recTotal} />
              <StatCell label="Positivas" value={t.receptionPositive} />
              <StatCell label="Neutras" value={t.receptionNeutral} />
              <StatCell label="Negativas" value={t.receptionNegative} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <StatCell
                label="% Perfecta"
                value={`${recPerfectPct.toFixed(0)}%`}
                highlight
              />
              <StatCell
                label="Eficiencia"
                value={`${recEff.toFixed(0)}%`}
                highlight
              />
            </div>
          </>
        )}
      </Section>

      {/* Saque */}
      <Section title="Saque" icon={<Zap className="size-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Aces" value={t.ace} highlight />
          <StatCell label="Errores" value={t.serveError} />
          <StatCell
            label="Ratio ace"
            value={serveTotal > 0 ? `${serveRatio.toFixed(0)}%` : "—"}
          />
        </div>
        <ComingSoon text="Distribución por zona · próximamente" />
      </Section>

      {/* Bloqueo */}
      <Section title="Bloqueo" icon={<Shield className="size-4" />}>
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Puntos" value={t.block} highlight />
          <StatCell label="Errores" value={t.blockError} />
          <StatCell
            label="Efectividad"
            value={t.block + t.blockError > 0 ? `${blockRatio.toFixed(0)}%` : "—"}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Los toques de bloqueo se registrarán en una próxima actualización.
        </p>
      </Section>

      {/* Defensa */}
      <Section title="Defensa" icon={<Shield className="size-4" />}>
        <ComingSoon text="Defensas, freeballs y continuidades · próximamente" />
      </Section>

      {/* Historial */}
      <Section title="Historial" icon={<Calendar className="size-4" />}>
        <HistoryTable
          performances={agg.allPerformances}
          matches={matches}
          teamById={teamById}
          leagueById={leagueById}
        />
      </Section>

      {/* Récords personales */}
      <Section title="Récords personales" icon={<Flame className="size-4" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <RecordCard label="Máx. puntos" rec={agg.records.points} />
          <RecordCard label="Máx. bloqueos" rec={agg.records.block} />
          <RecordCard label="Máx. aces" rec={agg.records.ace} />
        </div>
      </Section>

      {/* Comparación */}
      <Section title="Comparación" icon={<Award className="size-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CompareCard
            title="Vs. equipo"
            subtitle={`${teamPeers.length} compañeras`}
            rows={buildCompareRows(agg, teamPeers)}
          />
          <CompareCard
            title="Vs. liga"
            subtitle={`${leaguePeers.length} jugadoras`}
            rows={buildCompareRows(agg, leaguePeers)}
          />
          <CompareCard
            title="Vs. mismo puesto"
            subtitle={`${positionPeers.length} jugadoras`}
            rows={buildCompareRows(agg, positionPeers)}
          />
        </div>
      </Section>

      {/* MVPs */}
      {t.mvp > 0 && (
        <Section title="Premios MVP" icon={<Star className="size-4" />}>
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
        </Section>
      )}
    </div>
  );
}

/* ---------------- Local aggregations ---------------- */

function useMemo_localByOpponent(agg: PlayerAggregate) {
  return useMemo(() => {
    const map = new Map<
      string,
      { opponentName: string; matches: number; points: number; attack: number; block: number }
    >();
    for (const p of agg.allPerformances) {
      const key = p.opponentTeamId;
      const cur = map.get(key) ?? {
        opponentName: p.opponentName,
        matches: 0,
        points: 0,
        attack: 0,
        block: 0,
      };
      cur.matches += 1;
      cur.points += p.points;
      cur.attack += p.attack + p.counterAttack + p.rotationAttack;
      cur.block += p.block;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.points - a.points).slice(0, 5);
  }, [agg]);
}

function useMemo_localByLeague(
  agg: PlayerAggregate,
  matches: Match[],
  teamById: Map<string, Team>,
  leagueById: Map<string, { id: string; name: string; season?: string }>,
) {
  return useMemo(() => {
    const matchIndex = new Map(matches.map((m) => [m.id, m]));
    const map = new Map<
      string,
      { leagueName: string; matches: number; points: number }
    >();
    for (const p of agg.allPerformances) {
      const m = matchIndex.get(p.matchId);
      if (!m) continue;
      const tA = teamById.get(m.teamAId);
      const tB = teamById.get(m.teamBId);
      const leagueId = tA?.leagueId ?? tB?.leagueId;
      const leagueName = leagueId
        ? leagueById.get(leagueId)?.name ?? "Sin liga"
        : "Sin liga";
      const key = leagueId ?? "none";
      const cur = map.get(key) ?? { leagueName, matches: 0, points: 0 };
      cur.matches += 1;
      cur.points += p.points;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.points - a.points);
  }, [agg, matches, teamById, leagueById]);
}

function buildCompareRows(
  agg: PlayerAggregate,
  peers: PlayerAggregate[],
): { label: string; me: number; peer: number; suffix?: string }[] {
  if (peers.length === 0) return [];
  return [
    {
      label: "Puntos/PJ",
      me: agg.averages.points,
      peer: avgOf(peers, (a) => a.averages.points),
    },
    {
      label: "Ataques/PJ",
      me: agg.averages.attack,
      peer: avgOf(peers, (a) => a.averages.attack),
    },
    {
      label: "Bloqueos/PJ",
      me: agg.averages.block,
      peer: avgOf(peers, (a) => a.averages.block),
    },
    {
      label: "Aces/PJ",
      me: agg.averages.ace,
      peer: avgOf(peers, (a) => a.averages.ace),
    },
    {
      label: "Efic. recepción",
      me: agg.averages.receptionEfficiency,
      peer: avgOf(peers, (a) => a.averages.receptionEfficiency),
      suffix: "%",
    },
  ];
}

/* ---------------- Presentational ---------------- */

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </section>
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
        highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/40"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
        {label}
      </div>
      <div
        className={`text-lg font-bold leading-tight tabular-nums ${
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
          <div className="text-2xl font-bold text-primary leading-tight tabular-nums">
            {rec.value}
          </div>
          <div className="text-xs text-muted-foreground truncate">vs {rec.opponentName}</div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground mt-1">—</div>
      )}
    </div>
  );
}

function ComingSoon({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-md border border-dashed border-border/50 bg-card/20 px-3 py-2 text-[11px] text-muted-foreground">
      {text}
    </div>
  );
}

function RankedBars({
  rows,
  unit,
}: {
  rows: { label: string; value: number; sub?: string }[];
  unit: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2">
      {rows.map((r) => {
        const pct = (r.value / max) * 100;
        return (
          <div key={r.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate">{r.label}</span>
              <span className="font-bold tabular-nums text-primary shrink-0">
                {r.value} <span className="text-[10px] text-muted-foreground font-normal">{unit}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
              <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            {r.sub && (
              <div className="text-[10px] text-muted-foreground">{r.sub}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CompareCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; me: number; peer: number; suffix?: string }[];
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[10px] text-muted-foreground">{subtitle}</div>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">Sin datos para comparar.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const delta = r.me - r.peer;
            const positive = delta >= 0;
            return (
              <div key={r.label} className="text-xs">
                <div className="flex items-baseline justify-between">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      positive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {delta.toFixed(1)}
                    {r.suffix ?? ""}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>
                    Ella: <span className="text-foreground">{r.me.toFixed(1)}{r.suffix ?? ""}</span>
                  </span>
                  <span>
                    Prom.: {r.peer.toFixed(1)}{r.suffix ?? ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HistoryTable({
  performances,
  matches,
  teamById,
  leagueById,
}: {
  performances: PlayerAggregate["allPerformances"];
  matches: Match[];
  teamById: Map<string, Team>;
  leagueById: Map<string, { id: string; name: string; season?: string }>;
}) {
  const matchIndex = new Map(matches.map((m) => [m.id, m]));
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Fecha</th>
            <th className="text-left px-3 py-2 font-medium">Rival</th>
            <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Liga</th>
            <th className="text-center px-2 py-2 font-medium">Res.</th>
            <th className="text-right px-2 py-2 font-medium">Pts</th>
            <th className="text-right px-2 py-2 font-medium">Atq</th>
            <th className="text-right px-2 py-2 font-medium hidden sm:table-cell">Ace/Err</th>
            <th className="text-right px-2 py-2 font-medium hidden sm:table-cell">Blk</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {performances.map((p) => {
            const m = matchIndex.get(p.matchId);
            const tA = m ? teamById.get(m.teamAId) : undefined;
            const tB = m ? teamById.get(m.teamBId) : undefined;
            const leagueId = tA?.leagueId ?? tB?.leagueId;
            const leagueName = leagueId ? leagueById.get(leagueId)?.name : null;
            const sw = m ? setsWon(m) : null;
            const score = sw ? `${sw.a}–${sw.b}` : "—";
            const atk = p.attack + p.counterAttack + p.rotationAttack;
            return (
              <tr key={p.matchId} className="hover:bg-secondary/20">
                <td className="px-3 py-2 whitespace-nowrap">
                  <Link
                    to="/partidos/$id"
                    params={{ id: p.matchId }}
                    className="hover:text-primary"
                  >
                    {new Date(p.date).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </Link>
                </td>
                <td className="px-3 py-2 truncate max-w-[140px]">
                  {p.opponentName}
                  {p.wasMvp && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-[9px] text-amber-500 font-bold">
                      <Star className="size-2.5 fill-current" />
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell truncate max-w-[120px]">
                  {leagueName ?? "—"}
                </td>
                <td className="px-2 py-2 text-center tabular-nums">{score}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-primary">
                  {p.points}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{atk}</td>
                <td className="px-2 py-2 text-right tabular-nums hidden sm:table-cell">
                  {p.ace}/{p.serveError}
                </td>
                <td className="px-2 py-2 text-right tabular-nums hidden sm:table-cell">
                  {p.block}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EvolutionChart({
  performances,
}: {
  performances: { date: number; points: number; opponentName: string }[];
}) {
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
              <div className="text-[9px] text-muted-foreground tabular-nums">
                {d.points}
              </div>
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
