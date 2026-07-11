import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { PLAYER_POSITIONS, PLAYER_POSITION_LABEL, TEAM_CATEGORIES, TEAM_CATEGORY_LABEL, TEAM_GENDER_LABEL, useVolley, type PlayerPosition, type TeamCategory } from "@/lib/volley-store";
import { GenderFilter, type GenderFilterValue } from "@/components/GenderFilter";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Camera,
  CloudOff,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "Equipos · RALLY" }] }),
  component: TeamsPage,
});

const COLORS = ["#ff7a3d", "#3ec1d3", "#ffd23f", "#9b5de5", "#43d27a", "#ff5d8f", "#5d9cec", "#f48c06"];
const MAX_PHOTO_BYTES = 800 * 1024;

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
  // Union of server + store leagues so filter shows every league visible on the Ligas page,
  // even when RLS trims listLeagues to a subset for this user.
  const leagues = useMemo<CloudLeague[]>(() => {
    const byId = new Map<string, CloudLeague>();
    for (const l of cloudLeagues) byId.set(l.id, l);
    for (const l of storeLeagues) {
      if (!byId.has(l.id)) {
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
  // Only leagues with valid UUIDs can be persisted server-side. Local-only leagues
  // (non-UUID ids) would be coerced to null by the server validator, so we hide them
  // from the assign selectors to avoid a silent no-op.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const assignableLeagues = useMemo(
    () => leagues.filter((l) => UUID_RE.test(l.id)),
    [leagues],
  );
  const perms = useCanManageTeams();
  const canEdit = perms.allowed;

  const mut = useTeamMutations();

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [newLeagueId, setNewLeagueId] = useState<string>("");
  const [newGender, setNewGender] = useState<"" | "M" | "F">("");
  const [newCategory, setNewCategory] = useState<"" | TeamCategory>("");

  const [selected, setSelected] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pNum, setPNum] = useState<number | "">("");
  const [pPos, setPPos] = useState<PlayerPosition | "">("");
  const [pPhoto, setPPhoto] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);
  const logoFileRef = useRef<HTMLInputElement | null>(null);
  const teamLogoFileRef = useRef<HTMLInputElement | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamShort, setEditTeamShort] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [filterLeague, setFilterLeague] = useState<string>(() => {
    if (typeof localStorage === "undefined") return "all";
    return localStorage.getItem("vstats:leagues:selected") || "all";
  });
  const [filterGender, setFilterGender] = useState<GenderFilterValue>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | TeamCategory>("all");

  // Sync selection with the Ligas page (shared localStorage key)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "vstats:leagues:selected" && e.newValue) {
        setFilterLeague(e.newValue);
      }
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

  // If the saved league no longer exists, reset to "all"
  useEffect(() => {
    if (filterLeague === "all" || filterLeague === "none") return;
    if (leagues.length && !leagues.find((l) => l.id === filterLeague)) {
      setFilterLeague("all");
    }
  }, [leagues, filterLeague]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      if (filterLeague === "none" && t.leagueId) return false;
      if (filterLeague !== "all" && filterLeague !== "none" && t.leagueId !== filterLeague) return false;
      if (filterGender !== "all" && t.gender !== filterGender) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      return true;
    });
  }, [teams, filterLeague, filterGender, filterCategory]);

  const activeTeam: CloudTeam | undefined = teams.find((t) => t.id === selected) ?? filteredTeams[0] ?? teams[0];
  const deletingTeam = teams.find((t) => t.id === deleteTarget) ?? null;
  const affectedLeague = deletingTeam
    ? leagues.find((l) => l.id === deletingTeam.leagueId) ?? null
    : null;

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

  // Loading inicial
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

  return (
    <AppShell>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h1 className="text-3xl font-extrabold">Equipos</h1>
          <p className="text-muted-foreground text-sm">
            Equipos y jugadores compartidos en el servidor.
            {!canEdit && " Solo lectura: pedile a un admin permiso para gestionar equipos."}
          </p>
        </div>
        {busy && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Guardando…
          </div>
        )}
      </div>

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

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="rounded-2xl bg-card border border-border/60 p-5">
          <h2 className="font-bold flex items-center gap-2 mb-3">
            <Users className="size-4" /> Equipos
          </h2>

          <div className="space-y-2 mb-4">
            <select
              value={filterLeague}
              onChange={(e) => setFilterLeague(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-xs"
            >
              <option value="all">Todas las ligas</option>
              <option value="none">Sin liga</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.season ? ` ${l.season}` : ""}
                </option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as "all" | TeamCategory)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-xs"
            >
              <option value="all">Todas las categorías</option>
              {TEAM_CATEGORIES.map((c) => (
                <option key={c} value={c}>{TEAM_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
            <GenderFilter value={filterGender} onChange={setFilterGender} />
          </div>

          <ul className="space-y-1.5 mb-5">
            {filteredTeams.map((t) => {
              const isActive = activeTeam?.id === t.id;
              const league = leagues.find((l) => l.id === t.leagueId);
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <TeamBadge team={t} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.players.length} jug · {league?.name ?? "sin liga"}
                        {t.gender ? ` · ${TEAM_GENDER_LABEL[t.gender]}` : ""}
                        {t.category ? ` · ${TEAM_CATEGORY_LABEL[t.category]}` : ""}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {filteredTeams.length === 0 && (
              <li className="text-sm text-muted-foreground py-6 text-center">
                {teams.length === 0 ? "Aún no hay equipos." : "Ningún equipo coincide con los filtros."}
              </li>
            )}
          </ul>

          {canEdit && (
            <div className="space-y-2 border-t border-border/60 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nuevo equipo
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => logoFileRef.current?.click()}
                  className="size-11 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/60 flex items-center justify-center overflow-hidden shrink-0"
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
                <Input
                  placeholder="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 60))}
                />
              </div>
              <Input
                placeholder="Abreviatura (3 letras)"
                maxLength={4}
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
              />
              <select
                value={newLeagueId}
                onChange={(e) => setNewLeagueId(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
              >
                <option value="">Sin liga</option>
                {assignableLeagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as "" | "M" | "F")}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
              >
                <option value="">Sin género</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as "" | TeamCategory)}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
              >
                <option value="">Sin categoría</option>
                {TEAM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{TEAM_CATEGORY_LABEL[c]}</option>
                ))}
              </select>

              <div className="flex flex-wrap gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`size-6 rounded-md ring-offset-2 ring-offset-card transition-all ${
                      color === c ? "ring-2 ring-foreground scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button
                className="w-full"
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
                    setName("");
                    setShortName("");
                    setNewLeagueId("");
                    setNewGender("");
                    setNewCategory("");

                    setLogo(undefined);
                    setSelected(res.id);
                  } catch {
                    /* error shown via lastError */
                  }
                }}
              >
                {mut.createTeam.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}{" "}
                Crear equipo
              </Button>
            </div>
          )}
        </section>

        <section className="lg:col-span-2 rounded-2xl bg-card border border-border/60 p-5">
          {activeTeam ? (
            <>
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
                        onClick={() =>
                          mut.updateTeam.mutate({ id: activeTeam.id, logoUrl: null })
                        }
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

                <div className="flex items-center gap-2 sm:ml-auto">
                  <select
                    value={activeTeam.leagueId ?? ""}
                    disabled={!canEdit || assignableLeagues.length === 0}
                    onChange={(e) => {
                      const newLeagueId = e.target.value || null;
                      mut.updateTeam.mutate({
                        id: activeTeam.id,
                        leagueId: newLeagueId,
                      });
                      // Keep the team visible: sync sidebar filter with the new assignment
                      if (newLeagueId && filterLeague !== "all" && filterLeague !== newLeagueId) {
                        setFilterLeague(newLeagueId);
                      } else if (!newLeagueId && filterLeague !== "all") {
                        setFilterLeague("none");
                      }
                    }}
                    className="flex-1 sm:flex-none bg-background border border-input rounded-md px-3 py-2 text-sm min-w-0"
                    title={assignableLeagues.length === 0 ? "Creá una liga en la sección Ligas primero" : "Liga del equipo"}
                  >
                    <option value="">Sin liga</option>
                    {assignableLeagues.map((l) => (
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
                      mut.updateTeam.mutate({
                        id: activeTeam.id,
                        category: v || null,
                      });
                    }}
                    className="flex-1 sm:flex-none bg-background border border-input rounded-md px-3 py-2 text-sm min-w-0"
                    title="Categoría del equipo"
                  >
                    <option value="">Sin categoría</option>
                    {TEAM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{TEAM_CATEGORY_LABEL[c]}</option>
                    ))}
                  </select>

                  {canEdit &&
                    (editingTeam ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            const name = editTeamName.trim();
                            const shortName = editTeamShort.trim();
                            if (!name || !shortName) {
                              alert("Nombre y abreviatura son obligatorios.");
                              return;
                            }
                            mut.updateTeam.mutate({ id: activeTeam.id, name, shortName });
                            setEditingTeam(false);
                          }}
                        >
                          Guardar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingTeam(false)}
                          title="Cancelar"
                        >
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
                    ))}
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
                    <li
                      key={p.id}
                      className="flex items-center gap-3 bg-secondary/40 rounded-lg px-3 py-2"
                    >
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
                              onBlur={(e) =>
                                mut.updatePlayer.mutate({ id: p.id, name: e.target.value })
                              }
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
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              {canEdit && leagues.length > 0
                ? "Creá un equipo para empezar."
                : "Aún no hay equipos."}
            </div>
          )}
        </section>
      </div>

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
