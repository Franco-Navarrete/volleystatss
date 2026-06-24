import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users, Search } from "lucide-react";

import { PublicShell } from "@/components/PublicShell";
import { TeamBadge } from "@/components/TeamBadge";
import { GenderFilter, type GenderFilterValue } from "@/components/GenderFilter";
import { usePublicData } from "@/lib/use-public-data";
import { TEAM_GENDER_LABEL, TEAM_CATEGORY_LABEL } from "@/lib/volley-store";

const SITE_URL = "https://volleystatss.lovable.app";

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
  const [gender, setGender] = useState<GenderFilterValue>("all");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const teams = data?.teams ?? [];
  const leagues = data?.leagues ?? [];
  const leagueById = useMemo(
    () => new Map(leagues.map((l) => [l.id, l])),
    [leagues],
  );

  const filtered = useMemo(() => {
    let list = teams;
    if (gender !== "all") list = list.filter((t) => t.gender === gender);
    if (leagueFilter === "none") {
      list = list.filter((t) => !t.leagueId);
    } else if (leagueFilter !== "all") {
      list = list.filter((t) => t.leagueId === leagueFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.shortName.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, gender, leagueFilter, query]);

  const teamsWithoutLeague = teams.filter((t) => !t.leagueId).length;

  return (
    <PublicShell>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Equipos</h1>
            <div className="text-xs text-muted-foreground">
              {teams.length} equipos · {teamsWithoutLeague} sin liga
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar equipo…"
            className="w-full pl-9 pr-3 py-2 rounded-md bg-card/40 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <GenderFilter value={gender} onChange={setGender} />
          <div className="flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-muted-foreground shrink-0">Liga:</span>
            <FilterChip
              active={leagueFilter === "all"}
              onClick={() => setLeagueFilter("all")}
            >
              Todas
            </FilterChip>
            <FilterChip
              active={leagueFilter === "none"}
              onClick={() => setLeagueFilter("none")}
            >
              Sin liga
            </FilterChip>
            {leagues.map((l) => (
              <FilterChip
                key={l.id}
                active={leagueFilter === l.id}
                onClick={() => setLeagueFilter(l.id)}
              >
                {l.name}
                {l.season ? ` ${l.season}` : ""}
              </FilterChip>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No se encontraron equipos con esos filtros.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((team) => {
              const league = team.leagueId ? leagueById.get(team.leagueId) : null;
              return (
                <Link
                  key={team.id}
                  to="/equipos/$id"
                  params={{ id: team.id }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/40 hover:bg-secondary/40 transition-colors"
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
                  <div className="text-xs text-muted-foreground shrink-0">
                    {team.players.length} jug.
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PublicShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border/60 hover:bg-secondary/50"
      }`}
    >
      {children}
    </button>
  );
}
