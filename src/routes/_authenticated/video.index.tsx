import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useVolley } from "@/lib/volley-store";
import { listMatchVideos, type MatchVideoRow } from "@/hooks/use-match-video";
import { useMatchSessionStore } from "@/lib/match-session/store";
import { Button } from "@/components/ui/button";
import { Video, Plus, LayoutGrid } from "lucide-react";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";
import { MatchSessionCard } from "@/components/match-center/MatchSessionCard";
import { MatchSessionFilters, type Filters } from "@/components/match-center/MatchSessionFilters";

export const Route = createFileRoute("/_authenticated/video/")({
  head: () => ({
    meta: [
      { title: "Match Center — RALLY" },
      { name: "description", content: "Centro operativo de partidos: grabación, scouting, análisis y clips en un único flujo." },
      { property: "og:title", content: "Match Center — RALLY" },
      { property: "og:description", content: "Centro operativo de partidos con grabación, scouting y análisis." },
    ],
  }),
  component: MatchCenterHome,
});

const DEFAULT_FILTERS: Filters = {
  q: "",
  status: "all",
  video: "all",
  scout: "all",
  onlyFav: false,
  competition: "all",
  category: "all",
  teamId: "all",
  sort: "recent",
};

function MatchCenterHome() {
  const { user } = useAuthUser();
  const { isAdmin } = useIsAdmin();
  const matches = useVolley((s) => s.matches);
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const sessions = useMatchSessionStore((s) => s.sessions);
  const [videos, setVideos] = useState<MatchVideoRow[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => { void listMatchVideos().then(setVideos); }, []);

  const videoByMatch = useMemo(() => new Map(videos.map((v) => [v.match_id, v] as const)), [videos]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t] as const)), [teams]);
  const leagueById = useMemo(() => new Map(leagues.map((l) => [l.id, l] as const)), [leagues]);

  const competitions = useMemo(
    () => Array.from(new Set(leagues.map((l) => l.name).filter(Boolean))) as string[],
    [leagues],
  );
  const categories = useMemo(
    () => Array.from(new Set(matches.map((m) => m.category).filter(Boolean))) as string[],
    [matches],
  );

  const rows = useMemo(() => {
    // Para entrenadores: filtrar matches por propiedad de equipo
    let sourceMatches = matches;
    if (!isAdmin && user) {
      const myTeamIds = new Set(teams.filter(t => t.ownerId === user.id).map(t => t.id));
      sourceMatches = matches.filter(m => myTeamIds.has(m.teamAId) || myTeamIds.has(m.teamBId));
    }

    const list = sourceMatches.map((m) => {
      const v = videoByMatch.get(m.id) ?? null;
      const session = sessions[m.id];
      const a = teamById.get(m.teamAId);
      const b = teamById.get(m.teamBId);
      const leagueId = a?.leagueId ?? b?.leagueId;
      const league = leagueId ? leagueById.get(leagueId) : undefined;
      const competition = session?.competition ?? league?.name ?? undefined;
      return { m, v, session, competition, a, b };
    });

    return list
      .filter(({ m, v, session, competition, a, b }) => {
        if (filters.q) {
          const text = `${a?.name ?? ""} ${b?.name ?? ""} ${m.category ?? ""} ${competition ?? ""}`.toLowerCase();
          if (!text.includes(filters.q.toLowerCase())) return false;
        }
        if (filters.competition !== "all" && competition !== filters.competition) return false;
        if (filters.category !== "all" && m.category !== filters.category) return false;
        if (filters.teamId !== "all" && m.teamAId !== filters.teamId && m.teamBId !== filters.teamId) return false;
        if (filters.onlyFav && !v?.favorite) return false;

        // Video filter
        if (filters.video === "with" && !v) return false;
        if (filters.video === "without" && v) return false;
        if (filters.video === "synced" && !(v && v.sync_offset_ms !== 0)) return false;

        // Scout filter
        const scoutState = m.events.length === 0 ? "idle" : m.sets.some((s) => s.finished) ? "done" : "progress";
        if (filters.scout !== "all" && scoutState !== filters.scout) return false;

        // Status filter
        const finished = m.sets.some((s) => s.finished) && m.status !== "live";
        const explicit = session?.status;
        const derived = explicit ?? (m.status === "live" ? "live" : finished && v ? "analysis" : finished ? "finished" : "preparation");
        if (filters.status !== "all" && derived !== filters.status) return false;

        return true;
      })
      .sort((x, y) => {
        if (filters.sort === "actions") return y.m.events.length - x.m.events.length;
        if (filters.sort === "analyzed") return (y.v?.updated_at ? Date.parse(y.v.updated_at) : 0) - (x.v?.updated_at ? Date.parse(x.v.updated_at) : 0);
        return y.m.scheduledAt - x.m.scheduledAt;
      });
  }, [matches, sessions, videoByMatch, teamById, leagueById, filters]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Video className="size-7 text-primary shrink-0" />
              <span className="truncate">Match Center</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Cada tarjeta es un partido completo: grabación, scouting, análisis y clips en un único flujo.
            </p>
          </div>
          <Link to="/matches/new">
            <Button className="gap-2">
              <Plus className="size-4" /> Nueva Match Session
            </Button>
          </Link>
        </header>

        <MatchSessionFilters
          value={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          competitions={competitions}
          categories={categories}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        />

        {rows.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground text-sm flex flex-col items-center gap-3">
            <LayoutGrid className="size-8 text-muted-foreground/60" />
            No hay partidos que coincidan con los filtros.
            <Link to="/matches/new">
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="size-3.5" /> Crear match session
              </Button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {rows.map(({ m, v, competition, a, b }) => (
            <MatchSessionCard
              key={m.id}
              match={m}
              teamA={a}
              teamB={b}
              video={v}
              competition={competition}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
