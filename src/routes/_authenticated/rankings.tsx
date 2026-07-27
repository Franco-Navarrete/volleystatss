import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RankingList } from "@/components/RankingList";
import { useGenderPreference } from "@/hooks/use-gender-preference";
import { getTerminology } from "@/lib/terminology";
import {
  useVolley,
  PLAYER_POSITIONS,
  PLAYER_POSITION_LABEL,
  TEAM_CATEGORIES,
  TEAM_CATEGORY_LABEL,
  type PlayerPosition,
  type TeamCategory,
} from "@/lib/volley-store";
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
  const leagues = useVolley((s) => s.leagues);

  const allAggregates = useMemo(
    () => computeHistoricalStats(matches, teams),
    [matches, teams],
  );

  const { globalGender, setGlobalGender } = useGenderPreference();
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "F" | "M">(
    globalGender === "femenino" ? "F" : globalGender === "masculino" ? "M" : "all"
  );
  const [categoryFilter, setCategoryFilter] = useState<"all" | TeamCategory>("all");
  const [positionFilter, setPositionFilter] = useState<"all" | PlayerPosition>("all");
  const [metricKey, setMetricKey] = useState<RankingMetric>("points");

  const t = getTerminology(globalGender);

  useEffect(() => {
    const newGender = globalGender === "femenino" ? "F" : globalGender === "masculino" ? "M" : "all";
    if (newGender !== genderFilter) {
      setGenderFilter(newGender);
    }
  }, [globalGender]);

  const aggregates = useMemo(() => {
    let list = allAggregates;
    if (leagueFilter !== "all") list = list.filter((a) => a.team.leagueId === leagueFilter);
    if (genderFilter !== "all") list = list.filter((a) => a.team.gender === genderFilter);
    if (categoryFilter !== "all") list = list.filter((a) => a.team.category === categoryFilter);
    if (teamFilter !== "all") list = list.filter((a) => a.team.id === teamFilter);
    if (positionFilter !== "all") list = list.filter((a) => a.player.position === positionFilter);
    return list;
  }, [allAggregates, leagueFilter, teamFilter, genderFilter, categoryFilter, positionFilter]);

  const visibleTeams = useMemo(() => {
    let list = teams;
    if (leagueFilter !== "all") list = list.filter((t) => t.leagueId === leagueFilter);
    if (genderFilter !== "all") list = list.filter((t) => t.gender === genderFilter);
    if (categoryFilter !== "all") list = list.filter((t) => t.category === categoryFilter);
    return list;
  }, [teams, leagueFilter, genderFilter, categoryFilter]);

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

        {/* League filter */}
        {leagues.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
              Liga
            </label>
            <Select
              value={leagueFilter}
              onValueChange={(v) => {
                setLeagueFilter(v);
                if (teamFilter !== "all") {
                  const t = teams.find((x) => x.id === teamFilter);
                  if (v !== "all" && t?.leagueId !== v) setTeamFilter("all");
                }
              }}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ligas</SelectItem>
                {leagues.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}{l.season ? ` · ${l.season}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Gender filter */}
        <div className="grid grid-cols-3 gap-1.5 bg-card/40 border border-border/40 rounded-xl p-1">
          {(["all", "F", "M"] as const).map((g) => {
            const label = g === "all" ? "Todos" : g === "F" ? "Femenino" : "Masculino";
            const active = genderFilter === g;
            return (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGenderFilter(g);
                  setGlobalGender(g === "F" ? "femenino" : g === "M" ? "masculino" : "mixto");
                  // si el equipo elegido ya no aplica, lo limpio
                  if (teamFilter !== "all") {
                    const stillValid = teams.find((t) => t.id === teamFilter);
                    if (g !== "all" && stillValid?.gender !== g) setTeamFilter("all");
                  }
                }}
                className={[
                  "py-1.5 rounded-lg text-xs font-bold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Category + Position filters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
              Categoría
            </label>
            <Select value={categoryFilter} onValueChange={(v) => {
              setCategoryFilter(v as "all" | TeamCategory);
              if (v !== "all") {
                // If a specific category is selected, align gender if it matches common patterns
                if (v.includes("Fem")) setGlobalGender("femenino");
                else if (v.includes("Masc")) setGlobalGender("masculino");
              }
            }}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {TEAM_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{TEAM_CATEGORY_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
              Rol
            </label>
            <Select value={positionFilter} onValueChange={(v) => setPositionFilter(v as "all" | PlayerPosition)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {PLAYER_POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>{PLAYER_POSITION_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Team filter */}
        {visibleTeams.length > 0 && (
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
                {visibleTeams.map((t) => (
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
            {metricKey === "points" 
              ? t.scorers.toUpperCase() 
              : metricKey === "block" 
                ? t.blockers.toUpperCase()
                : metricKey === "ace"
                  ? t.servers.toUpperCase()
                  : metric.label}
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
