import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Share2,
  Trophy,
  Award,
  Star,
  Calendar,
  BarChart3,
  Target,
  Shield,
  Hand,
  Zap,
  TrendingUp,
  TrendingDown,
  Users,
  Sparkles,
  Activity,
  MapPin,
  Flame,
  Download,
  Printer,
  FileText,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import jsPDF from "jspdf";

import { PublicShell } from "@/components/PublicShell";
import { usePublicData } from "@/lib/use-public-data";
import {
  DOMINANT_HAND_LABEL,
  PLAYER_POSITION_LABEL,
  TEAM_CATEGORY_LABEL,
  setsWon,
  type Match,
  type Player,
  type Team,
} from "@/lib/volley-store";
import type { PlayerAggregate } from "@/lib/historical-stats";
import {
  TIMEFRAMES,
  TIMEFRAME_LABEL,
  applyTimeframe,
  computeAttackHeatmap,
  computeByAttackSetter,
  computeLastMatchTimeline,
  computePlayerContext,
  computePlayerEvolution,
  computePlayerInsights,
  computePlayerPatterns,
  computePlayerRotations,
  computePlayerTrends,
  computeRadar,
  perfLevel,
  PERF_META,
  type ContextMetric,
  type Timeframe,
} from "@/lib/player-analytics";

const SITE_URL = "https://volleystatss.lovable.app";

export const Route = createFileRoute("/jugadora/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Perfil de jugadora · RALLY" },
      { name: "description", content: "Análisis integral de rendimiento individual en RALLY." },
      { property: "og:title", content: "Perfil de jugadora · RALLY" },
      { property: "og:url", content: `${SITE_URL}/jugadora/${params.id}` },
      { property: "og:type", content: "profile" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/jugadora/${params.id}` }],
  }),
  component: PlayerProfile,
});

function findPlayer(teams: Team[], playerId: string): { player: Player; team: Team } | null {
  for (const t of teams) {
    const p = t.players.find((x) => x.id === playerId);
    if (p) return { player: p, team: t };
  }
  return null;
}

function computeAge(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

function PlayerProfile() {
  const { id } = Route.useParams();
  const { data, isLoading } = usePublicData({ refetchLive: false });

  const teams = data?.teams ?? [];
  const allMatches = data?.matches ?? [];
  const leagues = data?.leagues ?? [];

  const leagueById = useMemo(() => new Map(leagues.map((l) => [l.id, l])), [leagues]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const found = useMemo(() => findPlayer(teams, id), [teams, id]);

  const [timeframe, setTimeframe] = useState<Timeframe>("all");

  const matches = useMemo(
    () => applyTimeframe(allMatches, timeframe, id),
    [allMatches, timeframe, id],
  );

  const ctx = useMemo(
    () => computePlayerContext(matches, teams, id),
    [matches, teams, id],
  );
  const agg = ctx.agg;

  const radar = useMemo(() => computeRadar(ctx), [ctx]);
  const evolution = useMemo(() => computePlayerEvolution(matches, id), [matches, id]);
  const heatmap = useMemo(() => computeAttackHeatmap(matches, id), [matches, id]);
  const rotations = useMemo(() => computePlayerRotations(matches, id), [matches, id]);
  const bySetter = useMemo(() => computeByAttackSetter(matches, teams, id), [matches, teams, id]);
  const trends = useMemo(() => computePlayerTrends(matches, id), [matches, id]);
  const timeline = useMemo(() => computeLastMatchTimeline(matches, id), [matches, id]);
  const patterns = useMemo(() => computePlayerPatterns(matches, teams, id), [matches, teams, id]);
  const insights = useMemo(() => computePlayerInsights(ctx), [ctx]);

  if (isLoading) {
    return (
      <PublicShell>
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
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
      ? `${player.name} — ${agg.totals.points} pts · ${agg.totals.block} blk · ${agg.totals.ace} aces (${team.name})`
      : `${player.name} (${team.name})`;
    if (navigator.share) {
      try { await navigator.share({ title: player.name, text, url }); return; } catch { /* */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      window.alert("Enlace copiado");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank");
    }
  };

  const handleExportPdf = () => exportPlayerPdf({ player, team, agg, ctx, evolution, patterns, insights });
  const handleExportCsv = () => exportPlayerCsv({ player, team, agg, matches, teamById, leagueById });
  const handlePrint = () => window.print();

  const hasStats = agg && agg.matchesPlayed > 0;

  return (
    <PublicShell>
      <div className="space-y-5 print:space-y-3" id="player-profile-root">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground print:hidden">
          <ArrowLeft className="size-3.5" /> Inicio
        </Link>

        {/* Header + Ficha */}
        <PlayerHeader
          player={player}
          team={team}
          positionLabel={positionLabel}
          leagueName={leagueName ?? null}
          onShare={handleShare}
          onPdf={handleExportPdf}
          onCsv={handleExportCsv}
          onPrint={handlePrint}
        />

        {/* Filtros temporales */}
        <TimeframeBar value={timeframe} onChange={setTimeframe} />

        {!hasStats ? (
          <EmptyState teamId={team.id} />
        ) : (
          <>
            {/* Contexto comparativo */}
            <Section title="Resumen comparativo" icon={<BarChart3 className="size-4" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ctx.metrics.map((m) => (
                  <ContextCard key={m.key} metric={m} />
                ))}
              </div>
            </Section>

            {/* Insights automáticos */}
            {(insights.length > 0 || patterns.length > 0) && (
              <Section title="Análisis automático" icon={<Sparkles className="size-4" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {insights.map((i, idx) => (
                    <InsightPill key={`i-${idx}`} text={i.text} tone={i.tone} />
                  ))}
                </div>
              </Section>
            )}

            {/* Radar */}
            {radar.length > 0 && (
              <Section title="Radar de habilidades" icon={<Activity className="size-4" />}>
                <div className="rounded-xl border border-border/60 bg-card/40 p-3 h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radar}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="axis" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" fontSize={10} angle={30} domain={[0, 100]} />
                      <Radar name="Jugadora" dataKey="player" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
                      <Radar name="Equipo" dataKey="team" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} />
                      <Radar name="Liga" dataKey="league" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <RTooltip contentStyle={chartTooltipStyle} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}

            {/* Evolución */}
            {evolution.length >= 2 && (
              <Section title="Evolución" icon={<TrendingUp className="size-4" />}>
                <EvolutionCharts data={evolution} />
              </Section>
            )}

            {/* Tendencias */}
            {trends.length > 0 && (
              <Section title="Tendencias recientes" icon={<Flame className="size-4" />}>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {trends.map((t) => (
                    <TrendCard key={t.key} row={t} />
                  ))}
                </div>
              </Section>
            )}

            {/* Ataque + Heatmap */}
            <Section title="Ataque" icon={<Target className="size-4" />}>
              <AttackBlock agg={agg!} heatmap={heatmap} />
            </Section>

            {/* Rendimiento por armador */}
            {bySetter.length > 0 && (
              <Section title="Rendimiento por armador" icon={<Hand className="size-4" />}>
                <SetterTable rows={bySetter} />
              </Section>
            )}

            {/* Recepción */}
            <Section title="Recepción" icon={<Hand className="size-4" />}>
              <ReceptionBlock agg={agg!} />
            </Section>

            {/* Saque */}
            <Section title="Saque" icon={<Zap className="size-4" />}>
              <ServeBlock agg={agg!} />
            </Section>

            {/* Bloqueo */}
            <Section title="Bloqueo" icon={<Shield className="size-4" />}>
              <BlockBlock agg={agg!} />
            </Section>

            {/* Defensa */}
            <Section title="Defensa" icon={<Shield className="size-4" />}>
              <ComingSoon text="Las defensas y freeballs por jugadora se sumarán al motor de eventos en una próxima actualización." />
            </Section>

            {/* Rotaciones P1..P6 */}
            <Section title="Estadísticas por rotación" icon={<MapPin className="size-4" />}>
              <RotationTable rows={rotations} />
            </Section>

            {/* Patrones de juego */}
            {patterns.length > 0 && (
              <Section title="Patrones de juego" icon={<Sparkles className="size-4" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {patterns.map((p, idx) => (
                    <InsightPill key={`p-${idx}`} text={p.text} tone={p.tone} />
                  ))}
                </div>
              </Section>
            )}

            {/* Timeline último partido */}
            {timeline.entries.length > 0 && (
              <Section title="Timeline del último partido" icon={<Activity className="size-4" />}>
                <TimelinePanel entries={timeline.entries} match={timeline.match} teamById={teamById} />
              </Section>
            )}

            {/* Historial */}
            <Section title="Historial" icon={<Calendar className="size-4" />}>
              <HistoryTable agg={agg!} matches={allMatches} teamById={teamById} leagueById={leagueById} playerId={id} />
            </Section>


            {/* Comparación visual */}
            <Section title="Comparación" icon={<Award className="size-4" />}>
              <ComparePanel ctx={ctx} />
            </Section>

            {/* MVPs */}
            {agg!.totals.mvp > 0 && (
              <Section title="Premios MVP" icon={<Trophy className="size-4" />}>
                <div className="flex flex-wrap gap-2">
                  {agg!.allPerformances.filter((p) => p.wasMvp).map((p) => (
                    <div key={p.matchId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold">
                      <Star className="size-3 fill-current" />
                      MVP vs {p.opponentName}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </PublicShell>
  );
}

/* ============= Presentational blocks ============= */

const chartTooltipStyle: React.CSSProperties = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  fontSize: 12,
  borderRadius: 8,
};

function PlayerHeader({
  player, team, positionLabel, leagueName, onShare, onPdf, onCsv, onPrint,
}: {
  player: Player; team: Team; positionLabel: string | null; leagueName: string | null;
  onShare: () => void; onPdf: () => void; onCsv: () => void; onPrint: () => void;
}) {
  const age = computeAge(player.birthDate);
  const na = <span className="text-muted-foreground/60">No disponible</span>;
  const bioRows: { label: string; value: React.ReactNode }[] = [
    { label: "Edad", value: age !== null ? `${age} años` : na },
    { label: "Nacimiento", value: player.birthDate ? new Date(player.birthDate).toLocaleDateString("es-AR") : na },
    { label: "Altura", value: player.height ? `${player.height} cm` : na },
    { label: "Peso", value: player.weight ? `${player.weight} kg` : na },
    { label: "Mano hábil", value: player.dominantHand ? DOMINANT_HAND_LABEL[player.dominantHand] : na },
    { label: "Nacionalidad", value: player.nationality || na },
    { label: "Posición", value: positionLabel || na },
    { label: "Categoría", value: team.category ? TEAM_CATEGORY_LABEL[team.category] : na },
    { label: "Equipo", value: (
      <Link to="/equipos/$id" params={{ id: team.id }} className="text-primary hover:underline">
        {team.name}
      </Link>
    ) },
  ];
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="p-4 sm:p-6 flex items-center gap-4">
        <div className="size-16 sm:size-20 rounded-full overflow-hidden flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ background: team.color }}>
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
          ) : (<span>#{player.number}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate">{player.name}</h1>
          <div className="text-sm text-muted-foreground truncate">
            <Link to="/equipos/$id" params={{ id: team.id }} className="hover:text-foreground">{team.name}</Link>
            {positionLabel ? ` · ${positionLabel}` : ""} · #{player.number}
            {leagueName ? ` · ${leagueName}` : ""}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 print:hidden">
          <IconBtn onClick={onShare} icon={<Share2 className="size-4" />} label="Compartir" />
          <IconBtn onClick={onPdf} icon={<FileText className="size-4" />} label="PDF" />
          <IconBtn onClick={onCsv} icon={<Download className="size-4" />} label="CSV" />
          <IconBtn onClick={onPrint} icon={<Printer className="size-4" />} label="Imprimir" />
        </div>
      </div>
      <div className="border-t border-border/40 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 px-4 sm:px-6 py-4 text-sm">
        {bioRows.map((r) => (
          <div key={r.label} className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
            <div className="truncate">{r.value}</div>
          </div>
        ))}
      </div>
      <div className="sm:hidden border-t border-border/40 flex flex-wrap gap-1.5 p-3 print:hidden">
        <IconBtn onClick={onShare} icon={<Share2 className="size-4" />} label="Compartir" />
        <IconBtn onClick={onPdf} icon={<FileText className="size-4" />} label="PDF" />
        <IconBtn onClick={onCsv} icon={<Download className="size-4" />} label="CSV" />
        <IconBtn onClick={onPrint} icon={<Printer className="size-4" />} label="Imprimir" />
      </div>
    </div>
  );
}

function IconBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/60 bg-card/60 text-xs font-semibold hover:bg-secondary/50">
      {icon}<span>{label}</span>
    </button>
  );
}

function TimeframeBar({ value, onChange }: { value: Timeframe; onChange: (t: Timeframe) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 print:hidden">
      {TIMEFRAMES.map((t) => (
        <button key={t} onClick={() => onChange(t)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            value === t ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
          }`}>
          {TIMEFRAME_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">{icon}{title}</h2>
      {children}
    </section>
  );
}

function ContextCard({ metric }: { metric: ContextMetric }) {
  const fmt = metric.format ?? ((n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)));
  const benchmark = metric.leagueAvg > 0 ? metric.leagueAvg : metric.teamAvg;
  const level = perfLevel(metric.value, benchmark);
  const meta = PERF_META[level];
  const deltaTeam = metric.teamAvg > 0 ? ((metric.value - metric.teamAvg) / metric.teamAvg) * 100 : null;
  const deltaLeague = metric.leagueAvg > 0 ? ((metric.value - metric.leagueAvg) / metric.leagueAvg) * 100 : null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.color}`}>
          <span>{meta.emoji}</span>{meta.label}
        </span>
      </div>
      <div className="text-2xl font-bold text-primary tabular-nums leading-tight">{fmt(metric.value)}</div>
      <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
        <div>
          <div className="text-muted-foreground">Equipo</div>
          <div className="tabular-nums">{fmt(metric.teamAvg)}</div>
          {deltaTeam !== null && <DeltaBadge value={deltaTeam} />}
        </div>
        <div>
          <div className="text-muted-foreground">Liga</div>
          <div className="tabular-nums">{fmt(metric.leagueAvg)}</div>
          {deltaLeague !== null && <DeltaBadge value={deltaLeague} />}
        </div>
      </div>
    </div>
  );
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
      <Icon className="size-3" />
      {positive ? "+" : ""}{value.toFixed(0)}%
    </div>
  );
}

function InsightPill({ text, tone }: { text: string; tone: "positive" | "negative" | "neutral" }) {
  const cls = tone === "positive" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
    : tone === "negative" ? "border-rose-500/30 bg-rose-500/5 text-rose-300"
    : "border-border/60 bg-card/40 text-foreground";
  const bullet = tone === "positive" ? "✓" : tone === "negative" ? "▼" : "•";
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${cls}`}>
      <span className="font-bold mt-0.5">{bullet}</span>
      <span className="leading-snug">{text}</span>
    </div>
  );
}

function EvolutionCharts({ data }: { data: ReturnType<typeof computePlayerEvolution> }) {
  const series: { key: keyof typeof data[number]; label: string; color: string }[] = [
    { key: "points", label: "Puntos", color: "hsl(var(--primary))" },
    { key: "attacks", label: "Ataques", color: "#22d3ee" },
    { key: "attackEff", label: "Eficiencia %", color: "#f59e0b" },
    { key: "receptionEff", label: "Recepción %", color: "#a78bfa" },
    { key: "aces", label: "Aces", color: "#34d399" },
    { key: "blocks", label: "Bloqueos", color: "#f472b6" },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {series.map((s) => (
        <div key={s.key as string} className="rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1">{s.label}</div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border) / 0.4)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={30} />
                <RTooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey={s.key as string} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendCard({ row }: { row: import("@/lib/player-analytics").TrendRow }) {
  const positive = row.delta >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{row.label}</div>
      <div className={`text-sm font-bold tabular-nums flex items-center gap-1 ${positive ? "text-emerald-400" : "text-rose-400"}`}>
        <Icon className="size-3.5" />
        {positive ? "+" : ""}{row.delta.toFixed(1)}{row.suffix ?? ""}
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">
        Ult: {row.recent.toFixed(1)}{row.suffix ?? ""} · Hist: {row.historical.toFixed(1)}{row.suffix ?? ""}
      </div>
    </div>
  );
}

function AttackBlock({ agg, heatmap }: { agg: PlayerAggregate; heatmap: ReturnType<typeof computeAttackHeatmap> }) {
  const t = agg.totals;
  const attackTotal = t.attack + t.counterAttack + t.rotationAttack;
  const kills = attackTotal;
  const eff = attackTotal + t.attackError > 0 ? ((kills - t.attackError) / (attackTotal + t.attackError)) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCell label="Intentos" value={attackTotal} />
        <StatCell label="Puntos" value={kills} highlight />
        <StatCell label="Errores" value={t.attackError} />
        <StatCell label="Eficiencia" value={`${eff.toFixed(0)}%`} highlight />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCell label="Ataque" value={t.attack} />
        <StatCell label="Contraataque" value={t.counterAttack} />
        <StatCell label="Rotación" value={t.rotationAttack} />
      </div>
      <AttackHeatmapPanel cells={heatmap} />
    </div>
  );
}

function AttackHeatmapPanel({ cells }: { cells: ReturnType<typeof computeAttackHeatmap> }) {
  const total = cells.reduce((s, c) => s + c.attempts, 0);
  if (total === 0) {
    return <ComingSoon text="Sin ataques con dirección registrada. Cargá los ataques con zona destino desde el modo Entrenador." />;
  }
  const maxAttempts = Math.max(...cells.map((c) => c.attempts), 1);
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[11px] font-semibold text-muted-foreground">Mapa de calor — cancha rival</div>
        <div className="text-[10px] text-muted-foreground">{total} ataques</div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 aspect-[3/2] max-w-md">
        {cells.map((c) => {
          const intensity = c.attempts / maxAttempts;
          const alpha = 0.05 + intensity * 0.55;
          const border = c.attempts > 0 ? "border-primary/40" : "border-border/40";
          return (
            <div key={c.zone}
              className={`relative rounded border ${border} flex flex-col items-center justify-center text-center`}
              style={{ background: `hsl(var(--primary) / ${alpha})` }}>
              <div className="text-[9px] text-muted-foreground absolute top-1 left-1.5">Z{c.zone}</div>
              <div className="text-lg font-bold tabular-nums">{c.attempts}</div>
              {c.attempts > 0 && (
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {c.kills}pt · {c.successRate}%
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
        <Info className="size-3" /> Fila superior (1-3) cerca de la red · fila inferior (7-9) al fondo.
      </div>
    </div>
  );
}

function ReceptionBlock({ agg }: { agg: PlayerAggregate }) {
  const t = agg.totals;
  const total = t.receptionTotal;
  if (total === 0) return <p className="text-xs text-muted-foreground">Sin recepciones registradas.</p>;
  const perfectPct = (t.receptionPositive / total) * 100;
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCell label="Recepciones" value={total} />
        <StatCell label="Positivas (#/+)" value={t.receptionPositive} />
        <StatCell label="Neutras (0)" value={t.receptionNeutral} />
        <StatCell label="Negativas" value={t.receptionNegative} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <StatCell label="% Positiva" value={`${perfectPct.toFixed(0)}%`} highlight />
        <StatCell label="Eficiencia" value={`${agg.averages.receptionEfficiency.toFixed(0)}%`} highlight />
      </div>
      <ComingSoon text="Mapa de recepción por zona · próximamente (requiere zona de origen en el evento)." />
    </>
  );
}

function ServeBlock({ agg }: { agg: PlayerAggregate }) {
  const t = agg.totals;
  const total = t.ace + t.serveError;
  const ratio = total > 0 ? (t.ace / total) * 100 : 0;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <StatCell label="Aces" value={t.ace} highlight />
        <StatCell label="Errores" value={t.serveError} />
        <StatCell label="Ratio ace" value={total > 0 ? `${ratio.toFixed(0)}%` : "—"} />
      </div>
      <ComingSoon text="Distribución por zona objetivo · próximamente." />
    </>
  );
}

function BlockBlock({ agg }: { agg: PlayerAggregate }) {
  const t = agg.totals;
  const ratio = t.block + t.blockError > 0 ? (t.block / (t.block + t.blockError)) * 100 : 0;
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatCell label="Puntos" value={t.block} highlight />
      <StatCell label="Errores" value={t.blockError} />
      <StatCell label="Efectividad" value={t.block + t.blockError > 0 ? `${ratio.toFixed(0)}%` : "—"} />
    </div>
  );
}

function RotationTable({ rows }: { rows: ReturnType<typeof computePlayerRotations> }) {
  const total = rows.reduce((s, r) => s + r.points, 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">Aún no hay datos suficientes por rotación.</p>;
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Rot.</th>
            <th className="text-right px-2 py-2">Pts</th>
            <th className="text-right px-2 py-2">Atq</th>
            <th className="text-right px-2 py-2">Err</th>
            <th className="text-right px-2 py-2">Blk</th>
            <th className="text-right px-2 py-2">Ace</th>
            <th className="text-right px-2 py-2">Rec+ / Tot</th>
            <th className="text-right px-2 py-2">Efic.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((r) => {
            const eff = r.attacks + r.attackErrors > 0 ? ((r.attacks - r.attackErrors) / (r.attacks + r.attackErrors)) * 100 : 0;
            return (
              <tr key={r.rotation} className="hover:bg-secondary/20">
                <td className="px-3 py-2 font-semibold">P{r.rotation}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-primary">{r.points}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.attacks}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.attackErrors}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.blocks}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.aces}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.receptionPos}/{r.receptionTotal}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.attacks + r.attackErrors > 0 ? `${eff.toFixed(0)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SetterTable({ rows }: { rows: ReturnType<typeof computeByAttackSetter> }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Armador</th>
            <th className="text-right px-2 py-2">Ataques</th>
            <th className="text-right px-2 py-2">Puntos</th>
            <th className="text-right px-2 py-2">Errores</th>
            <th className="text-right px-2 py-2">Eficiencia</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((r) => (
            <tr key={r.setterId} className="hover:bg-secondary/20">
              <td className="px-3 py-2 truncate max-w-[180px]">{r.setterName}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.attempts}</td>
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-primary">{r.points}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.errors}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.efficiency}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelinePanel({
  entries, match, teamById,
}: {
  entries: ReturnType<typeof computeLastMatchTimeline>["entries"];
  match?: Match;
  teamById: Map<string, Team>;
}) {
  const bySet = new Map<number, typeof entries>();
  for (const e of entries) {
    const list = bySet.get(e.set) ?? [];
    list.push(e);
    bySet.set(e.set, list);
  }
  const rival = match ? `${teamById.get(match.teamAId)?.shortName ?? "A"} vs ${teamById.get(match.teamBId)?.shortName ?? "B"}` : "";
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-3">
      {match && <div className="text-[11px] text-muted-foreground">{rival} · {new Date(match.scheduledAt).toLocaleDateString("es-AR")}</div>}
      {[...bySet.keys()].sort((a, b) => a - b).map((setNum) => (
        <div key={setNum}>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Set {setNum}</div>
          <div className="flex flex-wrap gap-1.5">
            {bySet.get(setNum)!.map((e) => {
              const cls = e.tone === "positive" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : e.tone === "negative" ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                : "border-border/60 bg-secondary/30";
              return (
                <span key={e.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] tabular-nums ${cls}`}>
                  <span className="text-[9px] text-muted-foreground">{e.scoreA}-{e.scoreB}</span>
                  <span className="font-semibold">{e.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTable({
  agg, matches, teamById, leagueById, playerId,
}: {
  agg: PlayerAggregate;
  matches: Match[];
  teamById: Map<string, Team>;
  leagueById: Map<string, { id: string; name: string; season?: string }>;
  playerId: string;
}) {
  const matchIndex = new Map(matches.map((m) => [m.id, m]));
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Fecha</th>
            <th className="text-left px-3 py-2">Rival</th>
            <th className="text-left px-3 py-2 hidden md:table-cell">Liga</th>
            <th className="text-center px-2 py-2">Res.</th>
            <th className="text-right px-2 py-2">Pts</th>
            <th className="text-right px-2 py-2">Atq</th>
            <th className="text-right px-2 py-2 hidden sm:table-cell">Rec%</th>
            <th className="text-right px-2 py-2 hidden sm:table-cell">Ace/Err</th>
            <th className="text-right px-2 py-2 hidden md:table-cell">Blk</th>
            <th className="text-right px-2 py-2 hidden lg:table-cell">Efic.</th>
            <th className="px-2 py-2 print:hidden"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {agg.allPerformances.map((p) => {
            const m = matchIndex.get(p.matchId);
            const tA = m ? teamById.get(m.teamAId) : undefined;
            const tB = m ? teamById.get(m.teamBId) : undefined;
            const leagueId = tA?.leagueId ?? tB?.leagueId;
            const leagueName = leagueId ? leagueById.get(leagueId)?.name : null;
            const sw = m ? setsWon(m) : null;
            const score = sw ? `${sw.a}–${sw.b}` : "—";
            const atk = p.attack + p.counterAttack + p.rotationAttack;
            const eff = atk + p.attackError > 0 ? Math.round(((atk - p.attackError) / (atk + p.attackError)) * 100) : 0;
            return (
              <tr key={p.matchId} className="hover:bg-secondary/20">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(p.date).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                </td>
                <td className="px-3 py-2 truncate max-w-[140px]">
                  {p.opponentName}
                  {p.wasMvp && <Star className="inline size-3 text-amber-400 ml-1 fill-current" />}
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell truncate max-w-[120px]">{leagueName ?? "—"}</td>
                <td className="px-2 py-2 text-center tabular-nums">{score}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-primary">{p.points}</td>
                <td className="px-2 py-2 text-right tabular-nums">{atk}</td>
                <td className="px-2 py-2 text-right tabular-nums hidden sm:table-cell">—</td>
                <td className="px-2 py-2 text-right tabular-nums hidden sm:table-cell">{p.ace}/{p.serveError}</td>
                <td className="px-2 py-2 text-right tabular-nums hidden md:table-cell">{p.block}</td>
                <td className="px-2 py-2 text-right tabular-nums hidden lg:table-cell">{atk + p.attackError > 0 ? `${eff}%` : "—"}</td>
                <td className="px-2 py-2 print:hidden">
                  <Link to="/partidos/$id" params={{ id: p.matchId }} search={{ from: "jugadora", fromId: playerId }} className="text-primary text-[10px] font-semibold hover:underline">Ver detalle</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ComparePanel({ ctx }: { ctx: ReturnType<typeof computePlayerContext> }) {
  const agg = ctx.agg!;
  const groups = [
    { title: "Vs. equipo", peers: ctx.teamPeers },
    { title: "Vs. liga", peers: ctx.leaguePeers },
    { title: "Vs. mismo puesto", peers: ctx.positionPeers },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {groups.map((g) => {
        const rows = [
          { label: "Puntos/PJ", me: agg.averages.points, peer: avg(g.peers, (a) => a.averages.points) },
          { label: "Ataques/PJ", me: agg.averages.attack, peer: avg(g.peers, (a) => a.averages.attack) },
          { label: "Bloqueos/PJ", me: agg.averages.block, peer: avg(g.peers, (a) => a.averages.block) },
          { label: "Aces/PJ", me: agg.averages.ace, peer: avg(g.peers, (a) => a.averages.ace) },
          { label: "Recep. %", me: agg.averages.receptionEfficiency, peer: avg(g.peers, (a) => a.averages.receptionEfficiency), suffix: "%" as const },
        ];
        return (
          <div key={g.title} className="rounded-xl border border-border/60 bg-card/40 p-3">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm font-semibold">{g.title}</div>
              <div className="text-[10px] text-muted-foreground">{g.peers.length} jug.</div>
            </div>
            {g.peers.length === 0 ? (
              <div className="text-xs text-muted-foreground">Sin datos.</div>
            ) : (
              <div className="space-y-2.5">
                {rows.map((r) => (
                  <ComparisonBar key={r.label} label={r.label} me={r.me} peer={r.peer} suffix={r.suffix} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ComparisonBar({ label, me, peer, suffix }: { label: string; me: number; peer: number; suffix?: string }) {
  const max = Math.max(me, peer, 1) * 1.1;
  const mePct = (me / max) * 100;
  const peerPct = (peer / max) * 100;
  const delta = me - peer;
  const status = Math.abs(delta) < peer * 0.05 ? "igual" : delta > 0 ? "arriba" : "abajo";
  const cls = status === "arriba" ? "text-emerald-400" : status === "abajo" ? "text-rose-400" : "text-muted-foreground";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${cls}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}{suffix ?? ""}
        </span>
      </div>
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-8 text-[9px] text-muted-foreground">Ella</span>
          <div className="flex-1 h-2 rounded-full bg-secondary/30 overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${mePct}%` }} />
          </div>
          <span className="w-10 text-right text-[10px] tabular-nums">{me.toFixed(1)}{suffix ?? ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-8 text-[9px] text-muted-foreground">Prom</span>
          <div className="flex-1 h-2 rounded-full bg-secondary/30 overflow-hidden">
            <div className="h-full bg-muted-foreground/50 rounded-full" style={{ width: `${peerPct}%` }} />
          </div>
          <span className="w-10 text-right text-[10px] tabular-nums">{peer.toFixed(1)}{suffix ?? ""}</span>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 ${highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/40"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className={`text-lg font-bold leading-tight tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function ComingSoon({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-md border border-dashed border-border/50 bg-card/20 px-3 py-2 text-[11px] text-muted-foreground">{text}</div>
  );
}

function EmptyState({ teamId }: { teamId: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-8 sm:p-12 text-center">
      <div className="mx-auto size-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
        <BarChart3 className="size-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold mb-1">Sin estadísticas disponibles</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
        Esta jugadora todavía no tiene partidos registrados. Cuando participe en un partido usando Rally, aquí aparecerán automáticamente sus estadísticas, gráficos y evolución.
      </p>
      <Link to="/equipos/$id" params={{ id: teamId }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
        <Users className="size-4" />Ver partidos del equipo
      </Link>
    </div>
  );
}

/* ============= Helpers ============= */

function avg<T>(arr: T[], pick: (a: T) => number): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, a) => s + pick(a), 0) / arr.length;
}

/* ============= Export ============= */

function exportPlayerPdf({
  player, team, agg, ctx, evolution, patterns, insights,
}: {
  player: Player; team: Team; agg?: PlayerAggregate;
  ctx: ReturnType<typeof computePlayerContext>;
  evolution: ReturnType<typeof computePlayerEvolution>;
  patterns: ReturnType<typeof computePlayerPatterns>;
  insights: ReturnType<typeof computePlayerInsights>;
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  let y = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(player.name, margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${team.name}  ·  #${player.number}${player.position ? "  ·  " + PLAYER_POSITION_LABEL[player.position] : ""}`, margin, y);
  y += 24;
  if (agg) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Resumen", margin, y); y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const t = agg.totals;
    const lines = [
      `Partidos jugados: ${agg.matchesPlayed}`,
      `Puntos: ${t.points}`,
      `Ataques (kills / errores): ${t.attack + t.counterAttack + t.rotationAttack} / ${t.attackError}`,
      `Aces / errores de saque: ${t.ace} / ${t.serveError}`,
      `Bloqueos / errores de bloqueo: ${t.block} / ${t.blockError}`,
      `Recepción: ${t.receptionTotal} (positivas ${t.receptionPositive})`,
      `MVP: ${t.mvp}`,
    ];
    for (const l of lines) { doc.text(l, margin, y); y += 14; }
    y += 8;
  }
  if (ctx.metrics.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Contexto vs equipo y liga", margin, y); y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const m of ctx.metrics) {
      doc.text(`${m.label}: ${m.value.toFixed(1)}${m.suffix ?? ""}  (equipo ${m.teamAvg.toFixed(1)}, liga ${m.leagueAvg.toFixed(1)})`, margin, y);
      y += 14;
      if (y > 780) { doc.addPage(); y = margin; }
    }
    y += 8;
  }
  const bullets = [...insights, ...patterns];
  if (bullets.length > 0) {
    if (y > 720) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Análisis automático", margin, y); y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const b of bullets) {
      const wrapped = doc.splitTextToSize(`• ${b.text}`, 515);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 12 + 2;
      if (y > 780) { doc.addPage(); y = margin; }
    }
  }
  if (evolution.length > 0) {
    if (y > 700) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Historial reciente", margin, y); y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const e of [...evolution].reverse().slice(0, 20)) {
      doc.text(`${e.label}  ·  ${e.points} pts  ·  ${e.attacks} atq (${e.attackEff}%)  ·  ${e.aces} ace  ·  ${e.blocks} blk`, margin, y);
      y += 12;
      if (y > 800) { doc.addPage(); y = margin; }
    }
  }
  doc.save(`${player.name.replace(/\s+/g, "_")}_perfil.pdf`);
}

function exportPlayerCsv({
  player, team, agg, matches, teamById, leagueById,
}: {
  player: Player; team: Team; agg?: PlayerAggregate; matches: Match[];
  teamById: Map<string, Team>;
  leagueById: Map<string, { id: string; name: string; season?: string }>;
}) {
  if (!agg) return;
  const headers = ["Fecha", "Rival", "Liga", "Resultado", "Puntos", "Ataques", "Errores atq", "Aces", "Err. saque", "Bloqueos", "Err. bloqueo"];
  const matchIndex = new Map(matches.map((m) => [m.id, m]));
  const rows = agg.allPerformances.map((p) => {
    const m = matchIndex.get(p.matchId);
    const tA = m ? teamById.get(m.teamAId) : undefined;
    const tB = m ? teamById.get(m.teamBId) : undefined;
    const leagueId = tA?.leagueId ?? tB?.leagueId;
    const leagueName = leagueId ? leagueById.get(leagueId)?.name ?? "" : "";
    const sw = m ? setsWon(m) : null;
    const atk = p.attack + p.counterAttack + p.rotationAttack;
    return [
      new Date(p.date).toLocaleDateString("es-AR"),
      p.opponentName,
      leagueName,
      sw ? `${sw.a}-${sw.b}` : "",
      p.points, atk, p.attackError, p.ace, p.serveError, p.block, p.blockError,
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${player.name.replace(/\s+/g, "_")}_${team.shortName || team.name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
