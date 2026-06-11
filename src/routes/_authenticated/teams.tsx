import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { useVolley, PLAYER_POSITIONS, PLAYER_POSITION_LABEL, type PlayerPosition } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Pencil, Plus, Trash2, UserPlus, Users, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "Equipos · RALLY" }] }),
  component: TeamsPage,
});

const COLORS = ["#ff7a3d", "#3ec1d3", "#ffd23f", "#9b5de5", "#43d27a", "#ff5d8f", "#5d9cec", "#f48c06"];
const MAX_PHOTO_BYTES = 800 * 1024; // 800 KB after compression

/** Resize/compress an image file to a square ~256px JPEG dataURL. */
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
    canvas.width = target; canvas.height = target;
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
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const addTeam = useVolley((s) => s.addTeam);
  const updateTeam = useVolley((s) => s.updateTeam);
  const removeTeam = useVolley((s) => s.removeTeam);
  const addPlayer = useVolley((s) => s.addPlayer);
  const updatePlayer = useVolley((s) => s.updatePlayer);
  const removePlayer = useVolley((s) => s.removePlayer);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [newLeagueId, setNewLeagueId] = useState<string>("");
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

  const activeTeam = teams.find((t) => t.id === selected) ?? teams[0];

  return (
    <AppShell>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold">Equipos</h1>
          <p className="text-muted-foreground text-sm">Cargá equipos, asigná liga y plantilla con fotos.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="rounded-2xl bg-card border border-border/60 p-5">
          <h2 className="font-bold flex items-center gap-2 mb-4"><Users className="size-4" /> Equipos</h2>
          <ul className="space-y-1.5 mb-5">
            {teams.map((t) => {
              const isActive = activeTeam?.id === t.id;
              const league = leagues.find((l) => l.id === t.leagueId);
              return (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? "bg-secondary" : "hover:bg-secondary/50"}`}
                  >
                    <TeamBadge team={t} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.players.length} jug · {league?.name ?? "sin liga"}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nuevo equipo</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                className="size-11 rounded-lg bg-secondary/40 hover:bg-secondary border border-border/60 flex items-center justify-center overflow-hidden shrink-0"
                aria-label="Subir escudo"
                title="Escudo del equipo"
              >
                {logo
                  ? <img src={logo} alt="" className="w-full h-full object-cover" />
                  : <Camera className="size-4 text-muted-foreground" />}
              </button>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try { setLogo(await fileToCompressedDataUrl(f)); }
                  catch { alert("No se pudo procesar la imagen."); }
                  e.target.value = "";
                }}
              />
              <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} />
            </div>
            <Input placeholder="Abreviatura (3 letras)" maxLength={4} value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase())} />
            <select
              value={newLeagueId}
              onChange={(e) => setNewLeagueId(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm"
            >
              <option value="">Sin liga</option>
              {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`size-6 rounded-md ring-offset-2 ring-offset-card transition-all ${color === c ? "ring-2 ring-foreground scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button
              className="w-full"
              disabled={!name || !shortName}
              onClick={() => {
                const id = addTeam({ name, shortName, color, leagueId: newLeagueId || undefined, logoUrl: logo });
                setName(""); setShortName(""); setNewLeagueId(""); setLogo(undefined); setSelected(id);
              }}
            >
              <Plus className="size-4" /> Crear equipo
            </Button>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-2xl bg-card border border-border/60 p-5">
          {activeTeam ? (
            <>
              <div className="flex items-center gap-4 mb-5">
                <button
                  type="button"
                  onClick={() => teamLogoFileRef.current?.click()}
                  className="relative group rounded-lg overflow-hidden"
                  title="Cambiar escudo"
                >
                  <TeamBadge team={activeTeam} size="lg" />
                  <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="size-4 text-white" />
                  </span>
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
                      updateTeam(activeTeam.id, { logoUrl: data });
                    } catch { alert("No se pudo procesar la imagen."); }
                  }}
                />
                <div className="flex-1">
                  <h2 className="font-bold text-xl">{activeTeam.name}</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{activeTeam.shortName} · {activeTeam.players.length} jugadores</p>
                  {activeTeam.logoUrl && (
                    <button
                      onClick={() => updateTeam(activeTeam.id, { logoUrl: undefined })}
                      className="text-[10px] text-muted-foreground hover:text-destructive mt-1"
                    >
                      Quitar escudo
                    </button>
                  )}
                </div>
                <select
                  value={activeTeam.leagueId ?? ""}
                  onChange={(e) => updateTeam(activeTeam.id, { leagueId: e.target.value || undefined })}
                  className="bg-background border border-input rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Sin liga</option>
                  {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { if (confirm(`¿Eliminar ${activeTeam.name}?`)) { removeTeam(activeTeam.id); setSelected(null); } }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              <div className="grid sm:grid-cols-[auto_1fr_90px_130px_auto] gap-2 mb-4 items-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="size-11 rounded-full bg-secondary/40 hover:bg-secondary border border-border/60 flex items-center justify-center overflow-hidden"
                  aria-label="Subir foto"
                >
                  {pPhoto
                    ? <img src={pPhoto} alt="" className="w-full h-full object-cover" />
                    : <Camera className="size-4 text-muted-foreground" />}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try { setPPhoto(await fileToCompressedDataUrl(f)); }
                    catch { alert("No se pudo procesar la imagen."); }
                    e.target.value = "";
                  }}
                />
                <Input placeholder="Nombre del jugador" value={pName} onChange={(e) => setPName(e.target.value.slice(0, 60))} />
                <Input type="number" placeholder="#" value={pNum} onChange={(e) => setPNum(e.target.value ? parseInt(e.target.value) : "")} />
                <select
                  value={pPos}
                  onChange={(e) => setPPos(e.target.value as PlayerPosition | "")}
                  className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9"
                >
                  <option value="">Posición</option>
                  {PLAYER_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{PLAYER_POSITION_LABEL[pos]}</option>
                  ))}
                </select>
                <Button
                  disabled={!pName || !pNum}
                  onClick={() => {
                    addPlayer(activeTeam.id, { name: pName, number: Number(pNum), photoUrl: pPhoto, position: pPos || undefined });
                    setPName(""); setPNum(""); setPPhoto(undefined); setPPos("");
                  }}
                >
                  <UserPlus className="size-4" /> Agregar
                </Button>
              </div>

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
                    updatePlayer(activeTeam.id, pid, { photoUrl: data });
                  } catch { alert("No se pudo procesar la imagen."); }
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
                        title="Cambiar foto"
                        onClick={() => { setEditingPlayerId(p.id); editFileRef.current?.click(); }}
                        className="size-10 rounded-full overflow-hidden bg-background border border-border flex items-center justify-center shrink-0"
                      >
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                          : <Camera className="size-4 text-muted-foreground" />}
                      </button>

                      {isEditing ? (
                        <>
                          <Input
                            type="number"
                            className="w-16 h-9 text-center"
                            defaultValue={p.number}
                            onBlur={(e) => {
                              const num = parseInt(e.target.value);
                              if (!isNaN(num) && num > 0) updatePlayer(activeTeam.id, p.id, { number: num });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const num = parseInt((e.target as HTMLInputElement).value);
                                if (!isNaN(num) && num > 0) updatePlayer(activeTeam.id, p.id, { number: num });
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <Input
                              className="h-8 text-sm"
                              defaultValue={p.name}
                              onBlur={(e) => updatePlayer(activeTeam.id, p.id, { name: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") updatePlayer(activeTeam.id, p.id, { name: (e.target as HTMLInputElement).value });
                              }}
                            />
                            <select
                              value={p.position ?? ""}
                              onChange={(e) => updatePlayer(activeTeam.id, p.id, { position: (e.target.value || undefined) as PlayerPosition | undefined })}
                              className="bg-background border border-input rounded-md px-2 py-0.5 text-xs h-7"
                            >
                              <option value="">Sin posición</option>
                              {PLAYER_POSITIONS.map((pos) => (
                                <option key={pos} value={pos}>{PLAYER_POSITION_LABEL[pos]}</option>
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
                          <div className="size-9 rounded-md bg-background border border-border flex items-center justify-center font-bold scoreboard-digit text-primary shrink-0">{p.number}</div>
                          <button
                            onClick={() => setEditingPlayerId(p.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {p.position ? PLAYER_POSITION_LABEL[p.position] : "Sin posición"}
                            </div>
                          </button>
                        </>
                      )}

                      {p.photoUrl && !isEditing && (
                        <button
                          onClick={() => updatePlayer(activeTeam.id, p.id, { photoUrl: undefined })}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          Quitar foto
                        </button>
                      )}
                      {!isEditing && (
                        <button onClick={() => removePlayer(activeTeam.id, p.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
                {activeTeam.players.length === 0 && (
                  <li className="col-span-full text-center py-10 text-sm text-muted-foreground">Sin jugadores cargados.</li>
                )}
              </ul>
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">Creá un equipo para empezar.</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
