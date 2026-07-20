import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import {
  PLAYER_POSITIONS,
  PLAYER_POSITION_LABEL,
  TEAM_CATEGORIES,
  TEAM_CATEGORY_LABEL,
  TEAM_GENDER_LABEL,
  useVolley,
  type PlayerPosition,
  type TeamCategory,
} from "@/lib/volley-store";
import {
  useCloudLeagues,
  useCloudTeams,
  useTeamMutations,
  type CloudLeague,
  type CloudTeam,
} from "@/hooks/use-cloud-teams";
import { useCanManageTeams } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeletedLeagueCandidate } from "@/lib/league-deletions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Camera,
  CloudOff,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  Mars,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Venus,
  Volleyball,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "Equipos · RALLY" }] }),
  component: TeamsPage,
});

const COLORS = ["#ff7a3d", "#3ec1d3", "#ffd23f", "#9b5de5", "#43d27a", "#ff5d8f", "#5d9cec", "#f48c06"];
const MAX_PHOTO_BYTES = 800 * 1024;
const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SortKey = "name" | "matches" | "league" | "created" | "activity";
type ViewMode = "grid" | "list";
type GenderChip = "all" | "F" | "M";

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const target = 256;
    const min = Math.min(img.width, img.height);
    const sx = (img.width - min) / 2;
    const sy = (img.height - min) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, min, min, 0, 0, target, target);
    let quality = 0.82;
    let data = canvas.toDataURL("image/jpeg", quality);
    while (data.length > MAX_PHOTO_BYTES * 1.34 && quality > 0.4) {
      quality -= 0.1;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function TeamsPage() {
  const teamsQ = useCloudTeams();
  const leaguesQ = useCloudLeagues();
  const teams = teamsQ.data ?? [];
  const cloudLeagues = leaguesQ.data ?? [];
  const storeLeagues = useVolley((s) => s.leagues);
  const storeMatches = useVolley((s) => s.matches);
  const storeTeams = useVolley((s) => s.teams);

  const leagues = useMemo<CloudLeague[]>(() => {
    const byId = new Map<string, CloudLeague>();
    for (const l of cloudLeagues) if (!isDeletedLeagueCandidate(l)) byId.set(l.id, l);
    for (const l of storeLeagues) {
      if (!byId.has(l.id) && !isDeletedLeagueCandidate(l)) {
        byId.set(l.id, {
          id: l.id,
          name: l.name,
          season: l.season,
          color: l.color,
          gender: l.gender,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cloudLeagues, storeLeagues]);

  const perms = useCanManageTeams();
  const canEdit = perms.allowed;
  const mut = useTeamMutations();

  // Per-team activity index derived from local store matches (fallback source)
  const teamStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; lastAt: number; nextAt: number | null }
    >();
    for (const t of teams) map.set(t.id, { count: 0, lastAt: 0, nextAt: null });
    const now = Date.now();
    for (const m of storeMatches) {
      for (const id of [m.teamAId, m.teamBId]) {
        const s = map.get(id);
        if (!s) continue;
        s.count++;
        if (m.status !== "scheduled" && m.createdAt > s.lastAt) s.lastAt = m.createdAt;
        if (m.status === "scheduled" && m.scheduledAt >= now) {
          if (s.nextAt == null || m.scheduledAt < s.nextAt) s.nextAt = m.scheduledAt;
        }
      }
    }
    return map;
  }, [teams, storeMatches]);

  // Auto-migrate local-only leagues to cloud AND sync team↔league assignments
  const syncingRef = useRef(false);
  useEffect(() => {
    if (!canEdit || syncingRef.current) return;
    const cloudTeams = teams;
    const seenNames = new Set(cloudLeagues.map((c) => c.name.trim().toLowerCase()));
    const missingLeagues: typeof leagues = [];
    for (const l of leagues) {
      if (UUID_RE.test(l.id) || isDeletedLeagueCandidate(l)) continue;
      const key = l.name.trim().toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      missingLeagues.push(l);
    }
    const nameToCloudLeague = new Map<string, string>();
    for (const c of cloudLeagues) nameToCloudLeague.set(c.name.trim().toLowerCase(), c.id);
    for (const l of leagues) if (UUID_RE.test(l.id)) nameToCloudLeague.set(l.name.trim().toLowerCase(), l.id);
    const localLeagueById = new Map(storeLeagues.map((l) => [l.id, l] as const));

    const teamFixes: { id: string; leagueId: string }[] = [];
    for (const ct of cloudTeams) {
      if (ct.leagueId) continue;
      const st =
        storeTeams.find((s) => s.id === ct.id) ??
        storeTeams.find(
          (s) =>
            s.name.trim().toLowerCase() === ct.name.trim().toLowerCase() &&
            s.shortName.trim().toLowerCase() === ct.shortName.trim().toLowerCase(),
        );
      if (!st?.leagueId) continue;
      const localLeague = localLeagueById.get(st.leagueId);
      const targetName = localLeague?.name ?? st.leagueId;
      const cloudLeagueId = nameToCloudLeague.get(targetName.trim().toLowerCase());
      if (cloudLeagueId) teamFixes.push({ id: ct.id, leagueId: cloudLeagueId });
    }
    if (missingLeagues.length === 0 && teamFixes.length === 0) return;
    syncingRef.current = true;
    (async () => {
      try {
        for (const l of missingLeagues) {
          try {
            await mut.createLeague.mutateAsync({
              name: l.name,
              season: l.season ?? null,
              color: l.color ?? null,
              gender: l.gender ?? null,
            });
          } catch {
            /* skip */
          }
        }
        for (const fix of teamFixes) {
          try {
            await mut.updateTeam.mutateAsync(fix);
          } catch {
            /* skip */
          }
        }
      } finally {
        syncingRef.current = false;
      }
    })();
  }, [teams, leagues, cloudLeagues, storeTeams, storeLeagues, canEdit, mut.createLeague, mut.updateTeam]);

  // ============ Create team dialog state ============
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [newLeagueId, setNewLeagueId] = useState<string>("");
  const [newGender, setNewGender] = useState<"" | "M" | "F">("");
  const [newCategory, setNewCategory] = useState<"" | TeamCategory>("");
  const logoFileRef = useRef<HTMLInputElement | null>(null);

  // ============ Selection / detail state ============
  const [selected, setSelected] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pNum, setPNum] = useState<number | "">("");
  const [pPos, setPPos] = useState<PlayerPosition | "">("");
  const [pPhoto, setPPhoto] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);
  const teamLogoFileRef = useRef<HTMLInputElement | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamShort, setEditTeamShort] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ============ Browsing controls ============
  const [query, setQuery] = useState("");
  const [filterLeague, setFilterLeague] = useState<string>(() => {
    if (typeof localStorage === "undefined") return "all";
    return localStorage.getItem("vstats:leagues:selected") || "all";
  });
  const [filterGender, setFilterGender] = useState<GenderChip>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | TeamCategory>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  // Sync selection with the Ligas page (shared localStorage key)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "vstats:leagues:selected" && e.newValue) setFilterLeague(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (filterLeague && filterLeague !== "all" && filterLeague !== "none") {
      localStorage.setItem("vstats:leagues:selected", filterLeague);
    }
  }, [filterLeague]);
  useEffect(() => {
    if (filterLeague === "all" || filterLeague === "none") return;
    if (leagues.length && !leagues.find((l) => l.id === filterLeague)) setFilterLeague("all");
  }, [leagues, filterLeague]);
  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [query, filterLeague, filterGender, filterCategory, sortBy]);

  const leagueById = useMemo(() => new Map(leagues.map((l) => [l.id, l])), [leagues]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = teams.filter((t) => {
      if (filterLeague === "none" && t.leagueId) return false;
      if (filterLeague !== "all" && filterLeague !== "none" && t.leagueId !== filterLeague) return false;
      if (filterGender !== "all" && t.gender !== filterGender) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (q) {
        const league = t.leagueId ? leagueById.get(t.leagueId)?.name ?? "" : "";
        const hay = [t.name, t.shortName, league].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const stat = (id: string) => teamStats.get(id) ?? { count: 0, lastAt: 0, nextAt: null };
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "matches":
          return stat(b.id).count - stat(a.id).count;
        case "league": {
          const la = a.leagueId ? leagueById.get(a.leagueId)?.name ?? "zzz" : "zzz";
          const lb = b.leagueId ? leagueById.get(b.leagueId)?.name ?? "zzz" : "zzz";
          return la.localeCompare(lb) || a.name.localeCompare(b.name);
        }
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
  }, [teams, filterLeague, filterGender, filterCategory, query, sortBy, leagueById, teamStats]);

  const totalPages = Math.max(1, Math.ceil(filteredTeams.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTeams = filteredTeams.slice(0, currentPage * PAGE_SIZE);

  const activeTeam: CloudTeam | undefined =
    teams.find((t) => t.id === selected) ?? undefined;
  const deletingTeam = teams.find((t) => t.id === deleteTarget) ?? null;
  const affectedLeague = deletingTeam
    ? leagues.find((l) => l.id === deletingTeam.leagueId) ?? null
    : null;

  const withoutLeague = teams.filter((t) => !t.leagueId).length;
  const withLeague = teams.length - withoutLeague;
  const lastActivityAt = useMemo(() => {
    let ts = 0;
    for (const m of storeMatches) if (m.createdAt > ts) ts = m.createdAt;
    return ts;
  }, [storeMatches]);

  const busy =
    mut.createTeam.isPending ||
    mut.updateTeam.isPending ||
    mut.deleteTeam.isPending ||
    mut.createPlayer.isPending ||
    mut.updatePlayer.isPending ||
    mut.deletePlayer.isPending;

  const lastError = useMemo(() => {
    const e =
      mut.createTeam.error ||
      mut.updateTeam.error ||
      mut.deleteTeam.error ||
      mut.createPlayer.error ||
      mut.updatePlayer.error ||
      mut.deletePlayer.error;
    return e ? (e as Error).message : null;
  }, [
    mut.createTeam.error,
    mut.updateTeam.error,
    mut.deleteTeam.error,
    mut.createPlayer.error,
    mut.updatePlayer.error,
    mut.deletePlayer.error,
  ]);

  if (teamsQ.isLoading || leaguesQ.isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" /> Cargando equipos…
        </div>
      </AppShell>
    );
  }

  if (teamsQ.isError) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm">
          <div className="flex items-center gap-2 font-bold text-destructive mb-1">
            <CloudOff className="size-4" /> No pudimos cargar los equipos
          </div>
          <p className="text-muted-foreground">
            {(teamsQ.error as Error)?.message ?? "Reintentá en unos segundos."}
          </p>
          <Button className="mt-3" size="sm" onClick={() => teamsQ.refetch()}>
            Reintentar
          </Button>
        </div>
      </AppShell>
    );
  }

  const resetNewTeamForm = () => {
    setName("");
    setShortName("");
    setNewLeagueId("");
    setNewGender("");
    setNewCategory("");
    setLogo(undefined);
    setColor(COLORS[0]);
  };

  return (
    <AppShell>
      {/* ========== Header info bar ========== */}
      <section className="rounded-2xl bg-card border border-border/60 px-4 py-3 sm:px-5 sm:py-4 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">Equipos</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            <span>
              <span className="text-foreground font-bold tabular-nums">{teams.length}</span> equipos
            </span>
            <span className="text-border">•</span>
            <span>
              <span className="text-foreground font-bold tabular-nums">{leagues.length}</span> ligas
            </span>
            <span className="text-border">•</span>
            <span>
              <span className="text-foreground font-bold tabular-nums">{withLeague}</span> con liga
            </span>
            <span className="text-border">•</span>
            <span>
              <span className="text-foreground font-bold tabular-nums">{withoutLeague}</span> sin liga
            </span>
            {lastActivityAt > 0 && (
              <>
                <span className="text-border hidden sm:inline">•</span>
                <span className="hidden sm:inline">
                  Actualizado {formatRelative(lastActivityAt)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {busy && (
            <span className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Guardando…
            </span>
          )}
          {canEdit && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                resetNewTeamForm();
                setShowNewTeam(true);
              }}
            >
              <Plus className="size-4" /> Nuevo equipo
            </Button>
          )}
        </div>
      </section>

      {lastError && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {lastError}
        </div>
      )}

      {leagues.length === 0 && !canEdit && (
        <div className="mb-4 rounded-lg border border-border/60 bg-secondary/40 px-4 py-3 text-sm flex items-start gap-2">
          <Lock className="size-4 mt-0.5 text-muted-foreground" />
          <div>
            No tenés acceso a ninguna liga todavía. Un admin tiene que asignarte una liga
            desde el panel de administración antes de que puedas ver o crear equipos.
          </div>
        </div>
      )}

      {/* ========== Search ========== */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Buscar equipo por nombre, abreviatura o liga…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-card border border-border/60 rounded-xl pl-10 pr-10 h-12 text-sm sm:text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Limpiar búsqueda"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* ========== Chips row: gender ========== */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        <Chip
          active={filterGender === "all"}
          onClick={() => setFilterGender("all")}
          icon={<Volleyball className="size-3.5" />}
          label="Todos"
        />
        <Chip
          active={filterGender === "F"}
          onClick={() => setFilterGender("F")}
          icon={<Venus className="size-3.5" />}
          label="Femenino"
        />
        <Chip
          active={filterGender === "M"}
          onClick={() => setFilterGender("M")}
          icon={<Mars className="size-3.5" />}
          label="Masculino"
        />
      </div>

      {/* ========== Chips row: leagues ========== */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1">
        <Chip
          active={filterLeague === "all"}
          onClick={() => setFilterLeague("all")}
          icon={<Trophy className="size-3.5" />}
          label="Todas las ligas"
        />
        <Chip
          active={filterLeague === "none"}
          onClick={() => setFilterLeague("none")}
          label="Sin liga"
        />
        {leagues.map((l) => (
          <Chip
            key={l.id}
            active={filterLeague === l.id}
            onClick={() => setFilterLeague(l.id)}
            label={l.name + (l.season ? ` · ${l.season}` : "")}
            accent={l.color}
          />
        ))}
      </div>

      {/* ========== Sort / view toggle ========== */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
          {filteredTeams.length} {filteredTeams.length === 1 ? "equipo" : "equipos"}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as "all" | TeamCategory)}
            className="h-9 rounded-lg bg-card border border-border/60 px-2.5 text-xs sm:text-sm"
          >
            <option value="all">Todas las categorías</option>
            {TEAM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TEAM_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-9 rounded-lg bg-card border border-border/60 pl-8 pr-3 text-xs sm:text-sm"
            >
              <option value="name">Nombre</option>
              <option value="matches">Cantidad de partidos</option>
              <option value="league">Liga</option>
              <option value="activity">Última actividad</option>
              <option value="created">Fecha de creación</option>
            </select>
          </div>
          <div className="flex items-center rounded-lg border border-border/60 bg-card p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`size-8 rounded-md flex items-center justify-center transition-colors ${
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista en grilla"
              aria-label="Vista en grilla"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`size-8 rounded-md flex items-center justify-center transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vista en lista"
              aria-label="Vista en lista"
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ========== Teams grid / list ========== */}
      {filteredTeams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">
          {teams.length === 0
            ? "Aún no hay equipos cargados."
            : "Ningún equipo coincide con los filtros."}
        </div>
      ) : viewMode === "grid" ? (
        <ul className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pagedTeams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              league={t.leagueId ? leagueById.get(t.leagueId) : undefined}
              stats={teamStats.get(t.id) ?? { count: 0, lastAt: 0, nextAt: null }}
              onOpen={() => setSelected(t.id)}
              canEdit={canEdit}
              isActive={activeTeam?.id === t.id}
            />
          ))}
        </ul>
      ) : (
        <ul className="rounded-2xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
          {pagedTeams.map((t) => (
            <TeamListRow
              key={t.id}
              team={t}
              league={t.leagueId ? leagueById.get(t.leagueId) : undefined}
              stats={teamStats.get(t.id) ?? { count: 0, lastAt: 0, nextAt: null }}
              onOpen={() => setSelected(t.id)}
              isActive={activeTeam?.id === t.id}
            />
          ))}
        </ul>
      )}

      {/* Pagination — load more */}
      {pagedTeams.length < filteredTeams.length && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
            Cargar más ({filteredTeams.length - pagedTeams.length} restantes)
          </Button>
        </div>
      )}

      {/* ========== Detail panel (below grid) ========== */}
      {activeTeam && (
        <section className="mt-6 rounded-2xl bg-card border border-border/60 p-5 scroll-mt-24" id="team-detail">
          <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => canEdit && teamLogoFileRef.current?.click()}
                className="relative group rounded-lg overflow-hidden shrink-0"
                title={canEdit ? "Cambiar escudo" : ""}
                disabled={!canEdit}
              >
                <TeamBadge team={activeTeam} size="lg" />
                {canEdit && (
                  <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="size-4 text-white" />
                  </span>
                )}
              </button>
              <input
                ref={teamLogoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const data = await fileToCompressedDataUrl(f);
                    mut.updateTeam.mutate({ id: activeTeam.id, logoUrl: data });
                  } catch {
                    alert("No se pudo procesar la imagen.");
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                {editingTeam ? (
                  <div className="flex flex-col gap-1.5">
                    <Input
                      className="h-8 text-base font-bold"
                      value={editTeamName}
                      onChange={(e) => setEditTeamName(e.target.value.slice(0, 60))}
                      placeholder="Nombre del equipo"
                    />
                    <Input
                      className="h-7 text-xs uppercase tracking-widest font-bold w-28"
                      value={editTeamShort}
                      maxLength={4}
                      onChange={(e) => setEditTeamShort(e.target.value.toUpperCase())}
                      placeholder="Abrev."
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="font-bold text-xl truncate">{activeTeam.name}</h2>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest">
                      {activeTeam.shortName} · {activeTeam.players.length} jugadores
                    </p>
                  </>
                )}
                {activeTeam.logoUrl && !editingTeam && canEdit && (
                  <button
                    onClick={() => mut.updateTeam.mutate({ id: activeTeam.id, logoUrl: null })}
                    className="text-[10px] text-muted-foreground hover:text-destructive mt-1"
                  >
                    Quitar escudo
                  </button>
                )}
              </div>
            </div>

            {editingTeam && (
              <div className="flex flex-wrap gap-1.5 sm:basis-full">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold w-full">
                  Color
                </span>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => mut.updateTeam.mutate({ id: activeTeam.id, color: c })}
                    className={`size-7 rounded-md ring-offset-2 ring-offset-card transition-all ${
                      activeTeam.color === c ? "ring-2 ring-foreground scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <select
                value={activeTeam.leagueId ?? ""}
                disabled={!canEdit || leagues.length === 0}
                onChange={(e) => {
                  const newLeagueId = e.target.value || null;
                  mut.updateTeam.mutate({ id: activeTeam.id, leagueId: newLeagueId });
                  if (newLeagueId && filterLeague !== "all" && filterLeague !== newLeagueId) {
                    setFilterLeague(newLeagueId);
                  } else if (!newLeagueId && filterLeague !== "all") {
                    setFilterLeague("none");
                  }
                }}
                className="flex-1 sm:flex-none bg-background border border-input rounded-md px-3 py-2 text-sm min-w-0"
                title={leagues.length === 0 ? "Creá una liga en la sección Ligas primero" : "Liga del equipo"}
              >
                <option value="">Sin liga</option>
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select
                value={activeTeam.gender ?? ""}
                disabled={!canEdit}
                onChange={(e) => {
                  const v = e.target.value;
                  mut.updateTeam.mutate({
                    id: activeTeam.id,
                    gender: v === "M" || v === "F" ? v : null,
                  });
                }}
                className="flex-1 sm:flex-none bg-background border border-input rounded-md px-3 py-2 text-sm min-w-0"
                title="Género del equipo"
              >
                <option value="">Sin género</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
              <select
                value={activeTeam.category ?? ""}
                disabled={!canEdit}
                onChange={(e) => {
                  const v = e.target.value as "" | TeamCategory;
                  mut.updateTeam.mutate({ id: activeTeam.id, category: v || null });
                }}
                className="flex-1 sm:flex-none bg-background border border-input rounded-md px-3 py-2 text-sm min-w-0"
                title="Categoría del equipo"
              >
                <option value="">Sin categoría</option>
                {TEAM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TEAM_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>

              {canEdit && (
                editingTeam ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        const n = editTeamName.trim();
                        const sn = editTeamShort.trim();
                        if (!n || !sn) {
                          alert("Nombre y abreviatura son obligatorios.");
                          return;
                        }
                        mut.updateTeam.mutate({ id: activeTeam.id, name: n, shortName: sn });
                        setEditingTeam(false);
                      }}
                    >
                      Guardar
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingTeam(false)} title="Cancelar">
                      <X className="size-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditTeamName(activeTeam.name);
                        setEditTeamShort(activeTeam.shortName);
                        setEditingTeam(true);
                      }}
                    >
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(activeTeam.id)}
                    >
                      <Trash2 className="size-3.5" /> Eliminar
                    </Button>
                  </>
                )
              )}
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} title="Cerrar detalle">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {canEdit && (
            <div className="grid sm:grid-cols-[auto_1fr_90px_130px_auto] gap-2 mb-4 items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="size-11 rounded-full bg-secondary/40 hover:bg-secondary border border-border/60 flex items-center justify-center overflow-hidden"
                aria-label="Subir foto"
              >
                {pPhoto ? (
                  <img src={pPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="size-4 text-muted-foreground" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setPPhoto(await fileToCompressedDataUrl(f));
                  } catch {
                    alert("No se pudo procesar la imagen.");
                  }
                  e.target.value = "";
                }}
              />
              <Input
                placeholder="Nombre del jugador"
                value={pName}
                onChange={(e) => setPName(e.target.value.slice(0, 60))}
              />
              <Input
                type="number"
                placeholder="#"
                value={pNum}
                onChange={(e) => setPNum(e.target.value ? parseInt(e.target.value) : "")}
              />
              <select
                value={pPos}
                onChange={(e) => setPPos(e.target.value as PlayerPosition | "")}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9"
              >
                <option value="">Posición</option>
                {PLAYER_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {PLAYER_POSITION_LABEL[pos]}
                  </option>
                ))}
              </select>
              <Button
                disabled={!pName || !pNum || mut.createPlayer.isPending}
                onClick={async () => {
                  try {
                    await mut.createPlayer.mutateAsync({
                      teamId: activeTeam.id,
                      name: pName,
                      number: Number(pNum),
                      photoUrl: pPhoto,
                      position: pPos || null,
                    });
                    setPName("");
                    setPNum("");
                    setPPhoto(undefined);
                    setPPos("");
                  } catch {
                    /* shown via lastError */
                  }
                }}
              >
                {mut.createPlayer.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}{" "}
                Agregar
              </Button>
            </div>
          )}

          <input
            ref={editFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              const pid = editingPlayerId;
              e.target.value = "";
              if (!f || !pid) return;
              try {
                const data = await fileToCompressedDataUrl(f);
                mut.updatePlayer.mutate({ id: pid, photoUrl: data });
              } catch {
                alert("No se pudo procesar la imagen.");
              }
              setEditingPlayerId(null);
            }}
          />

          <ul className="grid sm:grid-cols-2 gap-2">
            {activeTeam.players.map((p) => {
              const isEditing = editingPlayerId === p.id;
              return (
                <li key={p.id} className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2">
                  <button
                    type="button"
                    title={canEdit ? "Cambiar foto" : ""}
                    disabled={!canEdit}
                    onClick={() => {
                      setEditingPlayerId(p.id);
                      editFileRef.current?.click();
                    }}
                    className="size-10 rounded-full overflow-hidden bg-background border border-border flex items-center justify-center shrink-0"
                  >
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {isEditing && canEdit ? (
                    <>
                      <Input
                        type="number"
                        className="w-16 h-9 text-center"
                        defaultValue={p.number}
                        onBlur={(e) => {
                          const num = parseInt(e.target.value);
                          if (!isNaN(num) && num > 0)
                            mut.updatePlayer.mutate({ id: p.id, number: num });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const num = parseInt((e.target as HTMLInputElement).value);
                            if (!isNaN(num) && num > 0)
                              mut.updatePlayer.mutate({ id: p.id, number: num });
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <Input
                          className="h-8 text-sm"
                          defaultValue={p.name}
                          onBlur={(e) => mut.updatePlayer.mutate({ id: p.id, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              mut.updatePlayer.mutate({
                                id: p.id,
                                name: (e.target as HTMLInputElement).value,
                              });
                          }}
                        />
                        <select
                          value={p.position ?? ""}
                          onChange={(e) =>
                            mut.updatePlayer.mutate({
                              id: p.id,
                              position: (e.target.value || null) as PlayerPosition | null,
                            })
                          }
                          className="bg-background border border-input rounded-md px-2 py-0.5 text-xs h-7"
                        >
                          <option value="">Sin posición</option>
                          {PLAYER_POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>
                              {PLAYER_POSITION_LABEL[pos]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => setEditingPlayerId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Listo
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="size-9 rounded-md bg-background border border-border flex items-center justify-center font-bold scoreboard-digit text-primary shrink-0">
                        {p.number}
                      </div>
                      <button
                        onClick={() => canEdit && setEditingPlayerId(p.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="truncate font-medium flex items-center gap-1">
                          {p.name}
                          {!p.position && (
                            <AlertTriangle className="size-3 text-amber-500 shrink-0" aria-label="Sin posición asignada" />
                          )}
                        </div>
                        <div className={`text-[11px] ${p.position ? "text-muted-foreground" : "text-amber-600 font-medium"}`}>
                          {p.position
                            ? PLAYER_POSITION_LABEL[p.position as PlayerPosition]
                            : "Asignar posición"}
                        </div>
                      </button>
                    </>
                  )}

                  {p.photoUrl && !isEditing && canEdit && (
                    <button
                      onClick={() => mut.updatePlayer.mutate({ id: p.id, photoUrl: null })}
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      Quitar foto
                    </button>
                  )}
                  {!isEditing && canEdit && (
                    <button
                      onClick={() => mut.deletePlayer.mutate({ id: p.id })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              );
            })}
            {activeTeam.players.length === 0 && (
              <li className="col-span-full text-center py-10 text-sm text-muted-foreground">
                Sin jugadores cargados.
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ========== New team dialog ========== */}
      <Dialog open={showNewTeam} onOpenChange={setShowNewTeam}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-primary" /> Nuevo equipo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                className="size-14 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/60 flex items-center justify-center overflow-hidden shrink-0"
                aria-label="Subir escudo"
                title="Escudo del equipo"
              >
                {logo ? (
                  <img src={logo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="size-4 text-muted-foreground" />
                )}
              </button>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setLogo(await fileToCompressedDataUrl(f));
                  } catch {
                    alert("No se pudo procesar la imagen.");
                  }
                  e.target.value = "";
                }}
              />
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                />
                <Input
                  placeholder="Abreviatura (3 letras)"
                  maxLength={4}
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <select
              value={newLeagueId}
              onChange={(e) => setNewLeagueId(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value="">Sin liga</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as "" | "M" | "F")}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm"
              >
                <option value="">Sin género</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as "" | TeamCategory)}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm"
              >
                <option value="">Sin categoría</option>
                {TEAM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TEAM_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-7 rounded-md ring-offset-2 ring-offset-card transition-all ${
                    color === c ? "ring-2 ring-foreground scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowNewTeam(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={!name || !shortName || busy}
              onClick={async () => {
                try {
                  const res = await mut.createTeam.mutateAsync({
                    leagueId: newLeagueId || null,
                    name,
                    shortName,
                    color,
                    logoUrl: logo,
                    gender: newGender || null,
                    category: newCategory || null,
                  });
                  resetNewTeamForm();
                  setShowNewTeam(false);
                  setSelected(res.id);
                } catch {
                  /* shown via lastError */
                }
              }}
            >
              {mut.createTeam.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}{" "}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== Delete team dialog ========== */}
      <Dialog open={!!deletingTeam} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Eliminar equipo
            </DialogTitle>
          </DialogHeader>
          {deletingTeam && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40">
                <TeamBadge team={deletingTeam} size="sm" />
                <div className="min-w-0">
                  <div className="font-bold truncate">{deletingTeam.name}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">
                    {deletingTeam.shortName} · {deletingTeam.players.length} jugadores
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground">
                Esta acción es <span className="text-destructive font-semibold">permanente</span>.
                Solo un admin puede eliminar equipos.
              </p>
              <div className="rounded-lg border border-border/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                  Liga afectada
                </div>
                {affectedLeague ? (
                  <div className="text-sm">
                    <span className="font-semibold">{affectedLeague.name}</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Sin liga asignada.</div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={mut.deleteTeam.isPending}
              onClick={async () => {
                if (!deletingTeam) return;
                try {
                  await mut.deleteTeam.mutateAsync({ id: deletingTeam.id });
                  if (selected === deletingTeam.id) setSelected(null);
                  setEditingTeam(false);
                  setDeleteTarget(null);
                } catch {
                  /* shown via lastError */
                }
              }}
            >
              {mut.deleteTeam.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}{" "}
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

/* ============================================================
   Presentational helpers
============================================================ */

function Chip({
  active,
  onClick,
  icon,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-glow"
          : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      {accent && !active && (
        <span className="size-1.5 rounded-full" style={{ backgroundColor: accent }} />
      )}
      {icon}
      {label}
    </button>
  );
}

function TeamCard({
  team,
  league,
  stats,
  onOpen,
  canEdit,
  isActive,
}: {
  team: CloudTeam;
  league: CloudLeague | undefined;
  stats: { count: number; lastAt: number; nextAt: number | null };
  onOpen: () => void;
  canEdit: boolean;
  isActive: boolean;
}) {
  const active = stats.count > 0;
  return (
    <li>
      <div
        className={`group relative rounded-2xl bg-card border transition-all overflow-hidden ${
          isActive
            ? "border-primary shadow-glow"
            : "border-border/60 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-elevated"
        }`}
      >
        {/* League tag */}
        {league && (
          <div
            className="px-3.5 py-1.5 text-[10px] uppercase tracking-widest font-bold text-white/95 truncate"
            style={{ backgroundColor: league.color || "hsl(var(--primary) / 0.55)" }}
          >
            {league.name}
            {league.season ? ` · ${league.season}` : ""}
          </div>
        )}
        <button type="button" onClick={onOpen} className="w-full text-left p-3.5">
          <div className="flex items-start gap-3">
            <TeamBadge team={team} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-base leading-tight truncate">{team.name}</div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">
                {team.shortName}
                {team.gender ? ` · ${TEAM_GENDER_LABEL[team.gender]}` : ""}
                {team.category ? ` · ${TEAM_CATEGORY_LABEL[team.category]}` : ""}
              </div>
            </div>
          </div>

          {/* Meta stats */}
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BarChart3 className="size-3.5" />
              <span className="tabular-nums font-bold text-foreground">{stats.count}</span> partidos
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              <span className="tabular-nums font-bold text-foreground">{team.players.length}</span> jug.
            </span>
            <span
              className={`ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold ${
                active ? "text-success" : "text-muted-foreground"
              }`}
            >
              <span className={`size-1.5 rounded-full ${active ? "bg-success" : "bg-muted-foreground/60"}`} />
              {active ? "Activo" : "Sin actividad"}
            </span>
          </div>

          {/* Activity summary */}
          {(stats.lastAt || stats.nextAt) && (
            <div className="mt-2.5 pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
              {stats.nextAt ? (
                <span>
                  <span className="text-accent font-semibold">Próximo:</span>{" "}
                  {formatDate(stats.nextAt)}
                </span>
              ) : stats.lastAt ? (
                <span>
                  <span className="text-primary font-semibold">Último:</span>{" "}
                  hace {formatRelative(stats.lastAt)}
                </span>
              ) : null}
            </div>
          )}
        </button>

        {/* Quick actions overlay */}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onOpen}
            className="size-7 rounded-md bg-background/80 border border-border/60 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground"
            title={canEdit ? "Editar" : "Ver"}
            aria-label={canEdit ? "Editar" : "Ver"}
          >
            {canEdit ? <Pencil className="size-3.5" /> : <Users className="size-3.5" />}
          </button>
        </div>
      </div>
    </li>
  );
}

function TeamListRow({
  team,
  league,
  stats,
  onOpen,
  isActive,
}: {
  team: CloudTeam;
  league: CloudLeague | undefined;
  stats: { count: number; lastAt: number; nextAt: number | null };
  onOpen: () => void;
  isActive: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          isActive ? "bg-secondary" : "hover:bg-secondary/40"
        }`}
      >
        <TeamBadge team={team} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{team.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {team.shortName}
            {league ? ` · ${league.name}` : " · sin liga"}
            {team.gender ? ` · ${TEAM_GENDER_LABEL[team.gender]}` : ""}
            {team.category ? ` · ${TEAM_CATEGORY_LABEL[team.category]}` : ""}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
          <span className="inline-flex items-center gap-1">
            <BarChart3 className="size-3.5" />
            <span className="tabular-nums font-bold text-foreground">{stats.count}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            <span className="tabular-nums font-bold text-foreground">{team.players.length}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold w-24 justify-end ${
              stats.count > 0 ? "text-success" : "text-muted-foreground"
            }`}
          >
            <span className={`size-1.5 rounded-full ${stats.count > 0 ? "bg-success" : "bg-muted-foreground/60"}`} />
            {stats.count > 0 ? "Activo" : "Sin actividad"}
          </span>
        </div>
      </button>
    </li>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "hace instantes";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} día${d === 1 ? "" : "s"}`;
  return new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
