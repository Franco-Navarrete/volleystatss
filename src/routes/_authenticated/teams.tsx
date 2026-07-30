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
import { useCanCreateTeam } from "@/hooks/use-team-permissions";
import { useAuthUser, useIsAdmin } from "@/hooks/use-auth";
import { useGenderPreference } from "@/hooks/use-gender-preference";
import { getTerminology } from "@/lib/terminology";
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
  ArrowLeft,
  ArrowUpDown,
  Building2,
  BarChart3,
  Camera,
  Check,
  CloudOff,
  LayoutGrid,
  List,
  Loader2,
  Lock,
  Mars,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Shield,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Venus,
  Volleyball,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "Equipos · RALLY" }] }),
  component: TeamsPage,
});

import { TEAM_COLORS_HEX } from "@/lib/team-colors";
import { useMyClub } from "@/hooks/use-my-club";
import { MyClubDialog } from "@/components/MyClubDialog";
const COLORS = TEAM_COLORS_HEX;
const MAX_PHOTO_BYTES = 800 * 1024;
const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SortKey =
  | "name"
  | "name_desc"
  | "matches"
  | "matches_asc"
  | "league"
  | "created"
  | "activity";
type ViewMode = "grid" | "list" | "clubs";
type GenderChip = "all" | "F" | "M";
type StatusChip = "all" | "active" | "no_league";

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
  const { user: authUser } = useAuthUser();
  const { isAdmin } = useIsAdmin();
  const currentUserId = authUser?.id;

  const teamsQ = useCloudTeams();
  const { globalGender } = useGenderPreference();
  const t = getTerminology(globalGender);
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
  const legacyCanEdit = perms.allowed;
  const { allowed: canCreate } = useCanCreateTeam();
  const myClubQ = useMyClub();
  const myClub = myClubQ.data ?? null;
  const needsClubFirst = canCreate && !isAdmin && !myClub;
  const [showClubDialog, setShowClubDialog] = useState(false);
  const canManage = (t?: { ownerId?: string } | null) =>
    isAdmin || (!!t && !!currentUserId && t.ownerId === currentUserId);
  // Retained for global admin-only operations (e.g. auto-migration of legacy leagues).
  const canEdit = isAdmin || legacyCanEdit;
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
  const [newGender, setNewGender] = useState<"" | "M" | "F" | "X">("");
  const [newCategory, setNewCategory] = useState<"" | TeamCategory>("");
  const [newClub, setNewClub] = useState("");
  const [newSecondaryColor, setNewSecondaryColor] = useState<string>("");
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

  // ============ Club drill-down (view mode: "clubs") ============
  const [openClubKey, setOpenClubKey] = useState<string | null>(null);
  const [openClubCategory, setOpenClubCategory] = useState<string | null>(null);
  const [quickAddByTeam, setQuickAddByTeam] = useState<
    Record<string, { name: string; num: string; pos: PlayerPosition | "" }>
  >({});
  const getQuickAdd = (id: string) =>
    quickAddByTeam[id] ?? { name: "", num: "", pos: "" as PlayerPosition | "" };
  const patchQuickAdd = (
    id: string,
    patch: Partial<{ name: string; num: string; pos: PlayerPosition | "" }>,
  ) =>
    setQuickAddByTeam((s) => ({
      ...s,
      [id]: { ...getQuickAdd(id), ...patch },
    }));
  const resetQuickAdd = (id: string) =>
    setQuickAddByTeam((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });

  // ============ Browsing controls ============
  const [query, setQuery] = useState("");
  const [filterLeague, setFilterLeague] = useState<string>(() => {
    if (typeof localStorage === "undefined") return "all";
    return localStorage.getItem("vstats:leagues:selected") || "all";
  });
  const [filterGender, setFilterGender] = useState<GenderChip>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | TeamCategory>("all");
  const [filterStatus, setFilterStatus] = useState<StatusChip>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [leagueSearch, setLeagueSearch] = useState("");
  const isMobile = useIsMobile();

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
  }, [query, filterLeague, filterGender, filterCategory, filterStatus, sortBy]);

  // Manejar selección por URL
  const search = Route.useSearch();
  const queryTeamId = (search as any).teamId as string | undefined;
  useEffect(() => {
    if (queryTeamId && !selected) {
      setSelected(queryTeamId);
    }
  }, [queryTeamId, selected]);

  // Auto-scroll to detail panel when a team is selected
  useEffect(() => {
    if (!selected) return;
    if (typeof window === "undefined") return;
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById("team-detail");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [selected]);

  const leagueById = useMemo(() => new Map(leagues.map((l) => [l.id, l])), [leagues]);

  // Team counts per league (for the filter panel)
  const teamsPerLeague = useMemo(() => {
    const m = new Map<string, number>();
    let noLeague = 0;
    for (const t of teams) {
      if (t.leagueId) m.set(t.leagueId, (m.get(t.leagueId) ?? 0) + 1);
      else noLeague++;
    }
    return { byId: m, noLeague };
  }, [teams]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    const stat = (id: string) => teamStats.get(id) ?? { count: 0, lastAt: 0, nextAt: null };
    let list = teams.filter((t) => {
      // Si el usuario es entrenador (no admin), filtrar estrictamente sus equipos
      // El campo ownerId debe coincidir con el ID del usuario actual.
      if (!isAdmin && currentUserId && t.ownerId !== currentUserId) return false;

      if (filterLeague === "none" && t.leagueId) return false;
      if (filterLeague !== "all" && filterLeague !== "none" && t.leagueId !== filterLeague) return false;
      if (filterGender !== "all" && t.gender !== filterGender) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterStatus === "no_league" && t.leagueId) return false;
      if (filterStatus === "active" && stat(t.id).count === 0) return false;
      if (q) {
        const league = t.leagueId ? leagueById.get(t.leagueId)?.name ?? "" : "";
        const hay = [t.name, t.shortName, league].join(" ").toLowerCase();
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
  }, [teams, filterLeague, filterGender, filterCategory, filterStatus, query, sortBy, leagueById, teamStats]);

  const totalPages = Math.max(1, Math.ceil(filteredTeams.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTeams = filteredTeams.slice(0, currentPage * PAGE_SIZE);

  // Group filtered teams by club (fallback to team.club string or "Sin club")
  type ClubGroup = {
    key: string;
    name: string;
    logoUrl?: string;
    teams: CloudTeam[];
  };
  const clubGroups = useMemo<ClubGroup[]>(() => {
    const map = new Map<string, ClubGroup>();
    for (const t of filteredTeams) {
      const key = t.clubId ?? `name:${(t.clubName ?? t.club ?? "").trim().toLowerCase() || `team:${t.id}`}`;
      const name = t.clubName ?? t.club ?? (t.clubId ? "Club" : "Sin club");
      const g = map.get(key);
      if (g) {
        g.teams.push(t);
        if (!g.logoUrl && t.clubLogoUrl) g.logoUrl = t.clubLogoUrl;
      } else {
        map.set(key, { key, name, logoUrl: t.clubLogoUrl, teams: [t] });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTeams]);

  const openClub = openClubKey ? clubGroups.find((c) => c.key === openClubKey) ?? null : null;
  const openClubCategories = useMemo(() => {
    if (!openClub) return [] as { key: string; label: string; count: number }[];
    const categoryLabel = (key: string) => {
      if (key === "__none__") return "Sin categoría";
      const base = TEAM_CATEGORY_LABEL[key as TeamCategory];
      if (globalGender === "femenino") {
        return base.replace("Masculino", "Femenino").replace("Libre", "Femenino");
      }
      return base;
    };
    const counts = new Map<string, number>();
    for (const t of openClub.teams) {
      const key = t.category ?? "__none__";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const all: { key: string; label: string; count: number }[] = TEAM_CATEGORIES.map((c) => ({
      key: c,
      label: categoryLabel(c),
      count: counts.get(c) ?? 0,
    }));
    if ((counts.get("__none__") ?? 0) > 0) {
      all.push({ key: "__none__", label: categoryLabel("__none__"), count: counts.get("__none__") ?? 0 });
    }
    return all;
  }, [openClub]);

  const openClubCategoryTeams = useMemo(() => {
    if (!openClub || !openClubCategory) return [] as CloudTeam[];
    return openClub.teams.filter(
      (t) => (t.category ?? "__none__") === openClubCategory,
    );
  }, [openClub, openClubCategory]);

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
    setNewClub("");
    setNewSecondaryColor("");
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
          {canCreate && myClub && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowClubDialog(true)}
              title="Editar mi club"
            >
              <Shield className="size-4" /> {myClub.name}
            </Button>
          )}
          {canCreate && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (needsClubFirst) {
                  setShowClubDialog(true);
                  return;
                }
                resetNewTeamForm();
                setShowNewTeam(true);
              }}
            >
              <Plus className="size-4" /> {needsClubFirst ? "Crear mi club" : "Crear equipo"}
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

      {/* ========== Toolbar: Filtros button + result count + view toggle ========== */}
      {(() => {
        const activeCount =
          (filterGender !== "all" ? 1 : 0) +
          (filterLeague !== "all" ? 1 : 0) +
          (filterCategory !== "all" ? 1 : 0) +
          (filterStatus !== "all" ? 1 : 0) +
          (sortBy !== "name" ? 1 : 0);
        const genderLabel =
          filterGender === "F" ? "Femenino" : filterGender === "M" ? "Masculino" : null;
        const leagueLabel =
          filterLeague === "none"
            ? "Sin liga"
            : filterLeague !== "all"
              ? leagueById.get(filterLeague)?.name ?? null
              : null;
        const categoryLabel =
          filterCategory !== "all" ? TEAM_CATEGORY_LABEL[filterCategory] : null;
        const statusLabel =
          filterStatus === "active"
            ? "Activos"
            : filterStatus === "no_league"
              ? "Sin liga"
              : null;
        const sortLabel = sortBy !== "name" ? SORT_LABELS[sortBy] : null;
        const anyChip =
          !!(genderLabel || leagueLabel || categoryLabel || statusLabel || sortLabel);

        return (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="h-10 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3.5 text-sm font-semibold hover:border-primary/50 hover:bg-secondary/40 transition-colors"
              >
                <SlidersHorizontal className="size-4" />
                Filtros
                {activeCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold tabular-nums">
                    {activeCount}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-2">
                <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold hidden xs:block">
                  <span className="tabular-nums text-foreground font-bold">
                    {filteredTeams.length}
                  </span>{" "}
                  {filteredTeams.length === 1 ? "equipo" : "equipos"}
                </div>
                <div className="flex items-center rounded-lg border border-border/60 bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`size-8 rounded-md flex items-center justify-center transition-colors ${
                      viewMode === "grid"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
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
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Vista en lista"
                    aria-label="Vista en lista"
                  >
                    <List className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("clubs")}
                    className={`size-8 rounded-md flex items-center justify-center transition-colors ${
                      viewMode === "clubs"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Vista por club"
                    aria-label="Vista por club"
                  >
                    <Building2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {anyChip && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {genderLabel && (
                  <ActiveChip
                    label={genderLabel}
                    onClear={() => setFilterGender("all")}
                  />
                )}
                {leagueLabel && (
                  <ActiveChip
                    label={leagueLabel}
                    onClear={() => setFilterLeague("all")}
                  />
                )}
                {categoryLabel && (
                  <ActiveChip
                    label={categoryLabel}
                    onClear={() => setFilterCategory("all")}
                  />
                )}
                {statusLabel && (
                  <ActiveChip
                    label={statusLabel}
                    onClear={() => setFilterStatus("all")}
                  />
                )}
                {sortLabel && (
                  <ActiveChip
                    label={`Orden: ${sortLabel}`}
                    onClear={() => setSortBy("name")}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFilterGender("all");
                    setFilterLeague("all");
                    setFilterCategory("all");
                    setFilterStatus("all");
                    setSortBy("name");
                  }}
                  className="ml-1 h-7 px-2.5 rounded-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                >
                  Limpiar todos
                </button>
              </div>
            )}
          </>
        );
      })()}

      {/* ========== Filters Sheet (right on desktop, bottom on mobile) ========== */}
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
              onClick={() => {
                setFilterGender("all");
                setFilterLeague("all");
                setFilterCategory("all");
                setFilterStatus("all");
                setSortBy("name");
              }}
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Restablecer
            </button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Género */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Género
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                <SegBtn
                  active={filterGender === "all"}
                  onClick={() => setFilterGender("all")}
                  icon={<Volleyball className="size-3.5" />}
                  label="Todos"
                />
                <SegBtn
                  active={filterGender === "F"}
                  onClick={() => setFilterGender("F")}
                  icon={<Venus className="size-3.5" />}
                  label="Femenino"
                />
                <SegBtn
                  active={filterGender === "M"}
                  onClick={() => setFilterGender("M")}
                  icon={<Mars className="size-3.5" />}
                  label="Masculino"
                />
              </div>
            </section>

            {/* Liga */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Liga
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {leagues.length} disponibles
                </span>
              </div>
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
                  active={filterLeague === "all"}
                  onClick={() => setFilterLeague("all")}
                  label="Todas"
                  count={teams.length}
                />
                <LeagueRow
                  active={filterLeague === "none"}
                  onClick={() => setFilterLeague("none")}
                  label="Sin liga"
                  count={teamsPerLeague.noLeague}
                  muted
                />
                {leagues
                  .filter((l) =>
                    !leagueSearch.trim() ||
                    l.name.toLowerCase().includes(leagueSearch.trim().toLowerCase()),
                  )
                  .map((l) => (
                    <LeagueRow
                      key={l.id}
                      active={filterLeague === l.id}
                      onClick={() => setFilterLeague(l.id)}
                      label={l.name + (l.season ? ` · ${l.season}` : "")}
                      count={teamsPerLeague.byId.get(l.id) ?? 0}
                      accent={l.color}
                    />
                  ))}
                {leagueSearch.trim() &&
                  leagues.filter((l) =>
                    l.name.toLowerCase().includes(leagueSearch.trim().toLowerCase()),
                  ).length === 0 && (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Sin resultados
                    </div>
                  )}
              </div>
            </section>

            {/* Categoría */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Categoría
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <PillBtn
                  active={filterCategory === "all"}
                  onClick={() => setFilterCategory("all")}
                  label="Todas"
                />
                {TEAM_CATEGORIES.map((c) => (
                  <PillBtn
                    key={c}
                    active={filterCategory === c}
                    onClick={() => setFilterCategory(c)}
                    label={TEAM_CATEGORY_LABEL[c]}
                  />
                ))}
              </div>
            </section>

            {/* Estado */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Estado
              </h3>
              <div className="grid grid-cols-3 gap-1.5">
                <SegBtn
                  active={filterStatus === "all"}
                  onClick={() => setFilterStatus("all")}
                  label="Todos"
                />
                <SegBtn
                  active={filterStatus === "active"}
                  onClick={() => setFilterStatus("active")}
                  label="Activos"
                />
                <SegBtn
                  active={filterStatus === "no_league"}
                  onClick={() => setFilterStatus("no_league")}
                  label="Sin liga"
                />
              </div>
            </section>

            {/* Ordenar por */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Ordenar por
              </h3>
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
            </section>
          </div>

          <SheetFooter className="px-5 py-3 border-t border-border/60 bg-card flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setFilterGender("all");
                setFilterLeague("all");
                setFilterCategory("all");
                setFilterStatus("all");
                setSortBy("name");
              }}
            >
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setShowFilters(false)}>
              Mostrar {filteredTeams.length}{" "}
              {filteredTeams.length === 1 ? "equipo" : "equipos"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>


      {/* ========== Teams grid / list ========== */}
      {filteredTeams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
          {teams.length === 0 ? (
            <>
              <div className="text-base font-medium text-foreground">
                Todavía no creaste ningún equipo.
              </div>
              {canCreate && (
                <Button
                  onClick={() => {
                    resetNewTeamForm();
                    setShowNewTeam(true);
                  }}
                  className="gap-1.5"
                >
                  <Plus className="size-4" /> Crear mi primer equipo
                </Button>
              )}
            </>
          ) : (
            "Ningún equipo coincide con los filtros."
          )}
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
              canEdit={canManage(t)}
              isActive={activeTeam?.id === t.id}
            />
          ))}
        </ul>
      ) : viewMode === "list" ? (
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
      ) : (
        <ul className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clubGroups.map((g) => (
            <li key={g.key}>
              <button
                type="button"
                onClick={() => {
                  setOpenClubKey(g.key);
                  setOpenClubCategory(null);
                }}
                className="w-full text-left rounded-2xl bg-card border border-border/60 p-4 hover:border-primary/50 hover:bg-secondary/30 transition-colors flex items-center gap-3"
              >
                <div className="size-12 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shrink-0 ring-1 ring-white/10">
                  {g.logoUrl ? (
                    <img src={g.logoUrl} alt={g.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold truncate">{g.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.teams.length} {g.teams.length === 1 ? "equipo" : "equipos"}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {clubGroups.length === 0 && (
            <li className="col-span-full text-center text-sm text-muted-foreground py-8">
              No hay clubes que coincidan con los filtros.
            </li>
          )}
        </ul>
      )}

      {/* ========== Club drill-down Dialog ========== */}
      <Dialog
        open={!!openClubKey}
        onOpenChange={(o) => {
          if (!o) {
            setOpenClubKey(null);
            setOpenClubCategory(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {openClubCategory && (
                <button
                  type="button"
                  onClick={() => setOpenClubCategory(null)}
                  className="size-7 rounded-md hover:bg-secondary flex items-center justify-center"
                  aria-label="Volver"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <span className="truncate">
                {openClub?.name ?? "Club"}
                {openClubCategory && openClubCategory !== "__none__"
                  ? ` · ${TEAM_CATEGORY_LABEL[openClubCategory as TeamCategory] ?? openClubCategory}`
                  : openClubCategory === "__none__"
                    ? " · Sin categoría"
                    : ""}
              </span>
            </DialogTitle>
          </DialogHeader>

          {!openClubCategory ? (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Categorías
              </div>
              {openClubCategories.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Este club no tiene equipos.
                </div>
              ) : (
                <ul className="grid gap-2">
                  {openClubCategories.map((c) => (
                    <li key={c.key}>
                      <button
                        type="button"
                        onClick={() => setOpenClubCategory(c.key)}
                        className="w-full text-left rounded-xl border border-border/60 bg-card/50 px-4 py-3 hover:border-primary/50 hover:bg-secondary/40 flex items-center justify-between gap-3"
                      >
                        <span className="font-medium">{c.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.count} {c.count === 1 ? "equipo" : "equipos"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {openClubCategoryTeams.map((t) => (
                <div key={t.id} className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
                    <TeamBadge team={t} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.players.length} {t.players.length === 1 ? "jugadora" : "jugadoras"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelected(t.id);
                        setOpenClubKey(null);
                        setOpenClubCategory(null);
                      }}
                    >
                      Abrir
                    </Button>
                  </div>
                  {t.players.length > 0 && (
                    <ul className="divide-y divide-border/30">
                      {[...t.players]
                        .sort((a, b) => a.number - b.number)
                        .map((p) => (
                          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                            <div
                              className="size-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                              style={{ background: t.color }}
                            >
                              {p.photoUrl ? (
                                <img src={p.photoUrl} alt={p.name} className="size-full object-cover" />
                              ) : (
                                <span>#{p.number}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{p.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                #{p.number}
                                {p.position ? ` · ${PLAYER_POSITION_LABEL[p.position as PlayerPosition] ?? p.position}` : ""}
                              </div>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                  {canManage(t) && (() => {
                    const qa = getQuickAdd(t.id);
                    const canSubmit = !!qa.name.trim() && !!qa.num && !mut.createPlayer.isPending;
                    const submit = async () => {
                      if (!canSubmit) return;
                      try {
                        await mut.createPlayer.mutateAsync({
                          teamId: t.id,
                          name: qa.name.trim(),
                          number: Number(qa.num),
                          position: qa.pos || null,
                        });
                        resetQuickAdd(t.id);
                      } catch {
                        /* handled globally */
                      }
                    };
                    return (
                      <div className="px-3 py-2 border-t border-border/40 bg-secondary/20 grid grid-cols-[1fr_64px_110px_auto] gap-2 items-center">
                        <Input
                          placeholder="Nombre"
                          value={qa.name}
                          onChange={(e) => patchQuickAdd(t.id, { name: e.target.value.slice(0, 60) })}
                          className="h-8 text-sm"
                        />
                        <Input
                          type="number"
                          placeholder="#"
                          value={qa.num}
                          onChange={(e) => patchQuickAdd(t.id, { num: e.target.value })}
                          className="h-8 text-sm"
                        />
                        <select
                          value={qa.pos}
                          onChange={(e) => patchQuickAdd(t.id, { pos: e.target.value as PlayerPosition | "" })}
                          className="bg-background border border-input rounded-md px-2 h-8 text-sm"
                        >
                          <option value="">Posición</option>
                          {PLAYER_POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>
                              {PLAYER_POSITION_LABEL[pos]}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={submit} disabled={!canSubmit} title="Agregar jugadora">
                          {mut.createPlayer.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <UserPlus className="size-4" />
                          )}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              ))}
              {openClubCategoryTeams.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-4 py-6 text-center space-y-3">
                  <div className="text-sm text-muted-foreground">
                    No hay equipos en esta categoría.
                  </div>
                  {canCreate && openClub && openClubCategory && openClubCategory !== "__none__" && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!openClub || !openClubCategory) return;
                        const cat = openClubCategory as TeamCategory;
                        const label = TEAM_CATEGORY_LABEL[cat];
                        const baseColor = openClub.teams[0]?.color ?? "#3b82f6";
                        const secondary = openClub.teams[0]?.secondaryColor ?? null;
                        const gender = openClub.teams[0]?.gender ?? null;
                        const leagueId = openClub.teams[0]?.leagueId ?? null;
                        try {
                          await mut.createTeam.mutateAsync({
                            name: `${openClub.name} ${label}`.slice(0, 80),
                            shortName: label.slice(0, 8),
                            color: baseColor,
                            secondaryColor: secondary,
                            category: cat,
                            gender,
                            leagueId,
                          });
                        } catch {
                          /* handled globally */
                        }
                      }}
                      disabled={mut.createTeam.isPending}
                    >
                      {mut.createTeam.isPending ? (
                        <Loader2 className="size-4 animate-spin mr-1" />
                      ) : (
                        <UserPlus className="size-4 mr-1" />
                      )}
                      Crear equipo {TEAM_CATEGORY_LABEL[openClubCategory as TeamCategory]}
                    </Button>
                  )}
                </div>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Pagination — load more */}
      {pagedTeams.length < filteredTeams.length && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
            Cargar más ({filteredTeams.length - pagedTeams.length} restantes)
          </Button>
        </div>
      )}

      {/* ========== Detail panel (below grid) ========== */}
      {activeTeam && (() => { const canManageActive = canManage(activeTeam); return (
        <section className="mt-6 rounded-2xl bg-card border border-border/60 p-5 scroll-mt-24" id="team-detail">
          <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => canManageActive && teamLogoFileRef.current?.click()}
                className="relative group rounded-lg overflow-hidden shrink-0"
                title={canManageActive ? "Cambiar escudo" : ""}
                disabled={!canManageActive}
              >
                <TeamBadge team={activeTeam} size="lg" />
                {canManageActive && (
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
                {activeTeam.logoUrl && !editingTeam && canManageActive && (
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
                disabled={!canManageActive || leagues.length === 0}
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
                disabled={!canManageActive}
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
                disabled={!canManageActive}
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

              {canManageActive && (
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

          {canManageActive && (
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
                    title={canManageActive ? "Cambiar foto" : ""}
                    disabled={!canManageActive}
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

                  {isEditing && canManageActive ? (
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
                        onClick={() => canManageActive && setEditingPlayerId(p.id)}
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

                  {p.photoUrl && !isEditing && canManageActive && (
                    <button
                      onClick={() => mut.updatePlayer.mutate({ id: p.id, photoUrl: null })}
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      Quitar foto
                    </button>
                  )}
                  {!isEditing && canManageActive && (
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
      ); })()}

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
            {myClub && (
              <div className="rounded-md border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Shield className="size-3.5" /> Se asignará al club <span className="font-semibold text-foreground">{myClub.name}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as "" | "M" | "F" | "X")}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm"
              >
                <option value="">Sin género</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
                <option value="X">Mixto</option>
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
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Color principal
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
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                Color secundario (opcional)
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setNewSecondaryColor("")}
                  className={`size-7 rounded-md border border-border/60 flex items-center justify-center text-[10px] ${
                    newSecondaryColor === "" ? "ring-2 ring-foreground scale-110" : ""
                  }`}
                  title="Sin color secundario"
                >
                  —
                </button>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewSecondaryColor(c)}
                    className={`size-7 rounded-md ring-offset-2 ring-offset-card transition-all ${
                      newSecondaryColor === c ? "ring-2 ring-foreground scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
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
                    secondaryColor: newSecondaryColor || null,
                    club: newClub.trim() || null,
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
      <MyClubDialog open={showClubDialog} onOpenChange={setShowClubDialog} />
    </AppShell>
  );
}

/* ============================================================
   Presentational helpers
============================================================ */

const SORT_LABELS: Record<SortKey, string> = {
  name: "Nombre A-Z",
  name_desc: "Nombre Z-A",
  matches: "Mayor cantidad de partidos",
  matches_asc: "Menor cantidad de partidos",
  activity: "Última actividad",
  created: "Fecha de creación",
  league: "Liga",
};

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
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
        style={{ background: accent || (muted ? "hsl(var(--muted-foreground) / 0.3)" : "hsl(var(--primary) / 0.6)") }}
      />
      <span className={`flex-1 min-w-0 truncate ${muted ? "text-muted-foreground" : ""}`}>
        {label}
      </span>
      <span className="text-[11px] tabular-nums font-bold text-muted-foreground">
        ({count})
      </span>
      {active && <Check className="size-4 text-primary shrink-0" />}
    </button>
  );
}



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
