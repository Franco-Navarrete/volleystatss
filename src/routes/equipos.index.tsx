import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Check,
  Mars,
  Search,
  SlidersHorizontal,
  Users,
  Venus,
  Volleyball,
  X,
} from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { TeamBadge } from "@/components/TeamBadge";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePublicData } from "@/lib/use-public-data";
import {
  TEAM_CATEGORIES,
  TEAM_CATEGORY_LABEL,
  TEAM_GENDER_LABEL,
  type TeamCategory,
} from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

type GenderFilter = "all" | "F" | "M";
type StatusFilter = "all" | "active" | "no_league";
type SortKey =
  | "name"
  | "name_desc"
  | "matches"
  | "matches_asc"
  | "activity"
  | "created";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Nombre A-Z",
  name_desc: "Nombre Z-A",
  matches: "Mayor cantidad de partidos",
  matches_asc: "Menor cantidad de partidos",
  activity: "Última actividad",
  created: "Fecha de creación",
};

export const Route = createFileRoute("/equipos/")({
  head: () => ({
    meta: [
      { title: "Equipos · RALLY" },
      {
        name: "description",
        content: "Todos los equipos de vóley registrados en RALLY.",
      },
      { property: "og:title", content: "Equipos · RALLY" },
      { property: "og:url", content: `${SITE_URL}/equipos` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/equipos` }],
  }),
  component: TeamsIndex,
});

function TeamsIndex() {
  const { data, isLoading } = usePublicData();
  const isMobile = useIsMobile();

  const teams = data?.teams ?? [];
  const matches = data?.matches ?? [];
  const leagues = data?.leagues ?? [];

  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<GenderFilter>("all");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [category, setCategory] = useState<"all" | TeamCategory>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showFilters, setShowFilters] = useState(false);
  const [leagueSearch, setLeagueSearch] = useState("");

  // Reset invalid league selection when data changes
  useEffect(() => {
    if (leagueFilter === "all" || leagueFilter === "none") return;
    if (leagues.length && !leagues.find((l) => l.id === leagueFilter)) {
      setLeagueFilter("all");
    }
  }, [leagues, leagueFilter]);

  const leagueById = useMemo(
    () => new Map(leagues.map((l) => [l.id, l])),
    [leagues],
  );

  // Per-team stats derived from public matches
  const teamStats = useMemo(() => {
    const m = new Map<string, { count: number; lastAt: number }>();
    for (const t of teams) m.set(t.id, { count: 0, lastAt: 0 });
    for (const match of matches) {
      for (const id of [match.teamAId, match.teamBId]) {
        const s = m.get(id);
        if (!s) continue;
        s.count++;
        if (match.status !== "scheduled" && match.createdAt > s.lastAt) {
          s.lastAt = match.createdAt;
        }
      }
    }
    return m;
  }, [teams, matches]);

  const teamsPerLeague = useMemo(() => {
    const byId = new Map<string, number>();
    let noLeague = 0;
    for (const t of teams) {
      if (t.leagueId) byId.set(t.leagueId, (byId.get(t.leagueId) ?? 0) + 1);
      else noLeague++;
    }
    return { byId, noLeague };
  }, [teams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const stat = (id: string) => teamStats.get(id) ?? { count: 0, lastAt: 0 };
    let list = teams.filter((t) => {
      if (gender !== "all" && t.gender !== gender) return false;
      if (leagueFilter === "none" && t.leagueId) return false;
      if (
        leagueFilter !== "all" &&
        leagueFilter !== "none" &&
        t.leagueId !== leagueFilter
      )
        return false;
      if (category !== "all" && t.category !== category) return false;
      if (status === "no_league" && t.leagueId) return false;
      if (status === "active" && stat(t.id).count === 0) return false;
      if (q) {
        const leagueName = t.leagueId
          ? leagueById.get(t.leagueId)?.name ?? ""
          : "";
        const hay = [t.name, t.shortName, leagueName].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "matches":
          return stat(b.id).count - stat(a.id).count;
        case "matches_asc":
          return stat(a.id).count - stat(b.id).count;
        case "activity":
          return stat(b.id).lastAt - stat(a.id).lastAt;
        case "created":
          return 0;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [
    teams,
    query,
    gender,
    leagueFilter,
    category,
    status,
    sortBy,
    leagueById,
    teamStats,
  ]);

  const withoutLeague = teams.filter((t) => !t.leagueId).length;

  const activeCount =
    (gender !== "all" ? 1 : 0) +
    (leagueFilter !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (sortBy !== "name" ? 1 : 0);

  const genderLabel =
    gender === "F" ? "Femenino" : gender === "M" ? "Masculino" : null;
  const leagueLabel =
    leagueFilter === "none"
      ? "Sin liga"
      : leagueFilter !== "all"
        ? leagueById.get(leagueFilter)?.name ?? null
        : null;
  const categoryLabel = category !== "all" ? TEAM_CATEGORY_LABEL[category] : null;
  const statusLabel =
    status === "active" ? "Activos" : status === "no_league" ? "Sin liga" : null;
  const sortLabel = sortBy !== "name" ? SORT_LABELS[sortBy] : null;
  const anyChip = !!(
    genderLabel ||
    leagueLabel ||
    categoryLabel ||
    statusLabel ||
    sortLabel
  );

  const clearAll = () => {
    setGender("all");
    setLeagueFilter("all");
    setCategory("all");
    setStatus("all");
    setSortBy("name");
  };

  return (
    <PublicShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Users className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">Equipos</h1>
            <div className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground tabular-nums">
                {teams.length}
              </span>{" "}
              equipos ·{" "}
              <span className="font-bold text-foreground tabular-nums">
                {leagues.length}
              </span>{" "}
              ligas ·{" "}
              <span className="tabular-nums">{withoutLeague}</span> sin liga
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, abreviatura o liga…"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-card/60 border border-border/60 text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Filters toolbar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="h-9 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 text-sm font-semibold hover:border-primary/50 hover:bg-secondary/40 transition-colors"
          >
            <SlidersHorizontal className="size-4" />
            Filtros
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tabular-nums">
                {activeCount}
              </span>
            )}
          </button>
          <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            <span className="tabular-nums text-foreground font-bold">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "equipo" : "equipos"}
          </div>
        </div>

        {/* Active chips */}
        {anyChip && (
          <div className="flex flex-wrap items-center gap-1.5">
            {genderLabel && (
              <ActiveChip label={genderLabel} onClear={() => setGender("all")} />
            )}
            {leagueLabel && (
              <ActiveChip
                label={leagueLabel}
                onClear={() => setLeagueFilter("all")}
              />
            )}
            {categoryLabel && (
              <ActiveChip
                label={categoryLabel}
                onClear={() => setCategory("all")}
              />
            )}
            {statusLabel && (
              <ActiveChip label={statusLabel} onClear={() => setStatus("all")} />
            )}
            {sortLabel && (
              <ActiveChip
                label={`Orden: ${sortLabel}`}
                onClear={() => setSortBy("name")}
              />
            )}
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 h-7 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              Limpiar todos
            </button>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border/60 bg-card/40">
            No se encontraron equipos con esos filtros.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((team) => {
              const league = team.leagueId
                ? leagueById.get(team.leagueId)
                : null;
              return (
                <Link
                  key={team.id}
                  to="/equipos/$id"
                  params={{ id: team.id }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/40 hover:bg-secondary/40 hover:border-primary/30 transition-colors"
                >
                  <TeamBadge team={team} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">
                      {team.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {league ? league.name : "Sin liga"}
                      {team.gender ? ` · ${TEAM_GENDER_LABEL[team.gender]}` : ""}
                      {team.category
                        ? ` · ${TEAM_CATEGORY_LABEL[team.category]}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {team.players.length} jug.
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={
            isMobile
              ? "p-0 max-h-[85vh] rounded-t-2xl border-t border-border/60 bg-card flex flex-col"
              : "p-0 w-full sm:max-w-md bg-card border-l border-border/60 flex flex-col"
          }
        >
          <SheetHeader className="px-5 py-4 border-b border-border/60 flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              Filtros
            </SheetTitle>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Restablecer
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Género */}
            <Section title="Género">
              <div className="grid grid-cols-3 gap-1.5">
                <SegBtn
                  active={gender === "all"}
                  onClick={() => setGender("all")}
                  icon={<Volleyball className="size-3.5" />}
                  label="Todos"
                />
                <SegBtn
                  active={gender === "F"}
                  onClick={() => setGender("F")}
                  icon={<Venus className="size-3.5" />}
                  label="Femenino"
                />
                <SegBtn
                  active={gender === "M"}
                  onClick={() => setGender("M")}
                  icon={<Mars className="size-3.5" />}
                  label="Masculino"
                />
              </div>
            </Section>

            {/* Liga */}
            <Section
              title="Liga"
              rightSlot={
                <span className="text-[11px] text-muted-foreground">
                  {leagues.length} disponibles
                </span>
              }
            >
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  placeholder="Buscar liga…"
                  value={leagueSearch}
                  onChange={(e) => setLeagueSearch(e.target.value)}
                  className="w-full h-9 bg-background border border-border/60 rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="rounded-lg border border-border/60 max-h-64 overflow-y-auto divide-y divide-border/40">
                <LeagueRow
                  active={leagueFilter === "all"}
                  onClick={() => setLeagueFilter("all")}
                  label="Todas"
                  count={teams.length}
                />
                <LeagueRow
                  active={leagueFilter === "none"}
                  onClick={() => setLeagueFilter("none")}
                  label="Sin liga"
                  count={teamsPerLeague.noLeague}
                  muted
                />
                {leagues
                  .filter(
                    (l) =>
                      !leagueSearch.trim() ||
                      l.name
                        .toLowerCase()
                        .includes(leagueSearch.trim().toLowerCase()),
                  )
                  .map((l) => (
                    <LeagueRow
                      key={l.id}
                      active={leagueFilter === l.id}
                      onClick={() => setLeagueFilter(l.id)}
                      label={l.name + (l.season ? ` · ${l.season}` : "")}
                      count={teamsPerLeague.byId.get(l.id) ?? 0}
                      accent={l.color}
                    />
                  ))}
                {leagueSearch.trim() &&
                  leagues.filter((l) =>
                    l.name
                      .toLowerCase()
                      .includes(leagueSearch.trim().toLowerCase()),
                  ).length === 0 && (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Sin resultados
                    </div>
                  )}
              </div>
            </Section>

            {/* Categoría */}
            <Section title="Categoría">
              <div className="flex flex-wrap gap-1.5">
                <PillBtn
                  active={category === "all"}
                  onClick={() => setCategory("all")}
                  label="Todas"
                />
                {TEAM_CATEGORIES.map((c) => (
                  <PillBtn
                    key={c}
                    active={category === c}
                    onClick={() => setCategory(c)}
                    label={TEAM_CATEGORY_LABEL[c]}
                  />
                ))}
              </div>
            </Section>

            {/* Estado */}
            <Section title="Estado">
              <div className="grid grid-cols-3 gap-1.5">
                <SegBtn
                  active={status === "all"}
                  onClick={() => setStatus("all")}
                  label="Todos"
                />
                <SegBtn
                  active={status === "active"}
                  onClick={() => setStatus("active")}
                  label="Activos"
                />
                <SegBtn
                  active={status === "no_league"}
                  onClick={() => setStatus("no_league")}
                  label="Sin liga"
                />
              </div>
            </Section>

            {/* Ordenar por */}
            <Section title="Ordenar por">
              <div className="rounded-lg border border-border/60 divide-y divide-border/40 overflow-hidden">
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSortBy(k)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors ${
                      sortBy === k
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowUpDown className="size-3.5 opacity-70" />
                      {SORT_LABELS[k]}
                    </span>
                    {sortBy === k && <Check className="size-4 text-primary" />}
                  </button>
                ))}
              </div>
            </Section>
          </div>

          <SheetFooter className="px-5 py-3 border-t border-border/60 bg-card flex-row gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={clearAll}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setShowFilters(false)}>
              Mostrar {filtered.length}{" "}
              {filtered.length === 1 ? "equipo" : "equipos"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </PublicShell>
  );
}

/* ============================================================
   Presentational helpers
============================================================ */

function Section({
  title,
  rightSlot,
  children,
}: {
  title: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
        {rightSlot}
      </div>
      {children}
    </section>
  );
}

function ActiveChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-foreground">
      <span className="truncate max-w-[160px]">{label}</span>
      <button
        type="button"
        onClick={onClear}
        className="size-5 rounded-full inline-flex items-center justify-center hover:bg-primary/25 text-muted-foreground hover:text-foreground"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function SegBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground border border-primary shadow-sm"
          : "bg-background border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PillBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-xs font-semibold transition-all ${
        active
          ? "bg-primary text-primary-foreground border border-primary"
          : "bg-background border border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
      }`}
    >
      {label}
    </button>
  );
}

function LeagueRow({
  active,
  onClick,
  label,
  count,
  accent,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  accent?: string | null;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
        active ? "bg-primary/10" : "hover:bg-secondary/40"
      }`}
    >
      <span
        className="size-2.5 rounded-full shrink-0"
        style={{
          background:
            accent ||
            (muted
              ? "hsl(var(--muted-foreground) / 0.3)"
              : "hsl(var(--primary) / 0.6)"),
        }}
      />
      <span
        className={`flex-1 min-w-0 truncate ${muted ? "text-muted-foreground" : ""}`}
      >
        {label}
      </span>
      <span className="text-[11px] tabular-nums font-bold text-muted-foreground">
        ({count})
      </span>
      {active && <Check className="size-4 text-primary shrink-0" />}
    </button>
  );
}
