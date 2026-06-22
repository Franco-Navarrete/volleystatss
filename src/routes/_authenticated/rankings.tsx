import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RankingList } from "@/components/RankingList";
import { useVolley } from "@/lib/volley-store";
import { computeHistoricalStats, RANKING_METRICS, type RankingMetric } from "@/lib/historical-stats";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rankings")({
  head: () => ({ meta: [{ title: "Rankings · RALLY" }] }),
  component: RankingsPage,
});

function RankingsPage() {
  const matches = useVolley((s) => s.matches);
  const teams = useVolley((s) => s.teams);

  const allAggregates = useMemo(
    () => computeHistoricalStats(matches, teams),
    [matches, teams],
  );

  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [metricKey, setMetricKey] = useState<RankingMetric>("points");

  const aggregates = useMemo(() => {
    if (teamFilter === "all") return allAggregates;
    return allAggregates.filter((a) => a.team.id === teamFilter);
  }, [allAggregates, teamFilter]);

  const metric = RANKING_METRICS.find((m) => m.key === metricKey) ?? RANKING_METRICS[0];

  const finishedCount = useMemo(
    () => matches.filter((m) => m.status === "finished").length,
    [matches],
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <header className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
            <Trophy className="size-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight">Rankings históricos</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acumulado de todos los partidos finalizados
              {finishedCount > 0 && ` · ${finishedCount} ${finishedCount === 1 ? "partido" : "partidos"}`}
            </p>
          </div>
        </header>

        {/* Team filter */}
        {teams.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
              Equipo
            </label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los equipos</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Metric chips */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {RANKING_METRICS.map((m) => {
            const active = m.key === metricKey;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetricKey(m.key)}
                className={[
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card/40 text-muted-foreground border-border/50 hover:text-foreground",
                ].join(" ")}
              >
                {m.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {metric.label}
          </h2>
        </div>

        {finishedCount === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Todavía no hay partidos finalizados. Cuando termines uno, sus estadísticas aparecerán acá.
          </div>
        ) : (
          <RankingList aggregates={aggregates} metric={metric} />
        )}
      </div>
    </AppShell>
  );
}
