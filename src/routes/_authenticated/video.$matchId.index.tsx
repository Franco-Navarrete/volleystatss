import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useVolley } from "@/lib/volley-store";
import {
  useMatchVideo,
  upsertMatchVideoUrl,
  upsertMatchVideoUpload,
  updateSyncOffset,
  updateVideoMeta,
  deleteMatchVideo,
  getSignedVideoUrl,
  uploadMatchVideo,
} from "@/hooks/use-match-video";
import { buildRallyBlocks, buildVideoMarks, MARK_COLORS, MARK_LABEL, type VideoMark, type VideoMarkKind } from "@/lib/video-marks";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Star, Trash2, Upload, Link2, Crosshair, Video as VideoIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/video/$matchId/")({
  head: () => ({
    meta: [
      { title: "Workspace de video — RALLY" },
      { name: "description", content: "Reproductor sincronizado con el scout: cada acción salta al instante exacto del video." },
    ],
  }),
  component: VideoWorkspace,
});

const ALL_KINDS: VideoMarkKind[] = ["serve", "reception", "attack", "block", "defense", "error", "point", "timeout", "sub", "sanction"];

function VideoWorkspace() {
  const { matchId } = Route.useParams();
  const match = useVolley((s) => s.matches.find((m) => m.id === matchId));
  const teams = useVolley((s) => s.teams);
  const { video, reload } = useMatchVideo(matchId);
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState(0);

  // Filters
  const [kindFilter, setKindFilter] = useState<Set<VideoMarkKind>>(new Set(ALL_KINDS));
  const [setFilter, setSetFilter] = useState<number | "all">("all");
  const [sideFilter, setSideFilter] = useState<"all" | "A" | "B">("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<number | "all">("all");

  const teamA = teams.find((t) => t.id === match?.teamAId);
  const teamB = teams.find((t) => t.id === match?.teamBId);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!video) { setVideoSrc(null); return; }
      if (video.source === "url" && video.external_url) {
        setVideoSrc(video.external_url);
        return;
      }
      if (video.source === "upload" && video.storage_path) {
        const url = await getSignedVideoUrl(video.storage_path, 60 * 60 * 4);
        if (!cancelled) setVideoSrc(url);
      }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [video?.id, video?.source, video?.external_url, video?.storage_path]);

  const isYouTube = useMemo(() => {
    if (!videoSrc) return false;
    return /youtube\.com|youtu\.be/.test(videoSrc);
  }, [videoSrc]);

  const displaySrc = useMemo(() => {
    if (!videoSrc) return "";
    if (!isYouTube) return videoSrc;
    const id = extractYouTubeId(videoSrc);
    if (!id) return videoSrc;
    return `https://www.youtube.com/embed/${id}?enablejsapi=1&modestbranding=1&rel=0`;
  }, [videoSrc, isYouTube]);

  const allMarks = useMemo(() => {
    if (!match) return [];
    return buildVideoMarks(match, teamA, teamB, video?.sync_offset_ms ?? 0);
  }, [match, teamA, teamB, video?.sync_offset_ms]);

  const marks = useMemo(() => {
    return allMarks.filter((m) => {
      if (!kindFilter.has(m.kind)) return false;
      if (setFilter !== "all" && m.setNumber !== setFilter) return false;
      if (sideFilter !== "all" && m.side !== sideFilter) return false;
      if (playerFilter !== "all" && m.playerId !== playerFilter) return false;
      if (zoneFilter !== "all" && m.zone !== zoneFilter) return false;
      return true;
    });
  }, [allMarks, kindFilter, setFilter, sideFilter, playerFilter, zoneFilter]);

  const rallies = useMemo(() => buildRallyBlocks(allMarks), [allMarks]);
  const activeRallyIdx = useMemo(() => rallies.findIndex((r) => currentMs >= r.startMs && currentMs <= r.endMs), [rallies, currentMs]);

  const seekToMark = (m: VideoMark) => {
    playerRef.current?.seekMs(Math.max(0, m.tMs - 500));
  };

  const markFirstServe = async () => {
    if (!playerRef.current || !match) return;
    if (!match.events.length) { toast.error("El partido aún no tiene eventos cargados."); return; }
    const currentSec = playerRef.current.getCurrentMs() / 1000;
    // t_ms(firstEvent) should equal currentSec*1000 → offset = currentSec*1000
    await updateSyncOffset(matchId, currentSec * 1000);
    await reload();
    toast.success(`Sincronizado: primer saque en ${currentSec.toFixed(2)}s`);
  };

  const applyUrl = async () => {
    const u = urlInput.trim();
    if (!u) return;
    try {
      await upsertMatchVideoUrl(matchId, u);
      setUrlInput("");
      await reload();
      toast.success("Video vinculado por URL.");
    } catch (e) {
      toast.error("No se pudo guardar la URL: " + (e as Error).message);
    }
  };

  const applyUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadMatchVideo(matchId, file);
      await upsertMatchVideoUpload(matchId, path);
      await reload();
      toast.success("Video subido.");
    } catch (e) {
      toast.error("Error al subir: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const nudgeOffset = async (deltaMs: number) => {
    if (!video) return;
    await updateSyncOffset(matchId, (video.sync_offset_ms ?? 0) + deltaMs);
    await reload();
  };

  const toggleFav = async () => {
    if (!video) return;
    await updateVideoMeta(matchId, { favorite: !video.favorite });
    await reload();
  };

  const removeVideo = async () => {
    if (!video) return;
    if (!window.confirm("¿Eliminar el video vinculado al partido?")) return;
    await deleteMatchVideo(matchId, video.storage_path);
    await reload();
    setVideoSrc(null);
    toast.success("Video eliminado.");
  };

  if (!match) {
    return (
      <AppShell>
        <div className="text-center py-20 text-muted-foreground">
          Partido no encontrado. <Link to="/video" className="text-primary underline">Volver a la biblioteca</Link>
        </div>
      </AppShell>
    );
  }

  const availablePlayers = [
    ...(teamA?.players ?? []).map((p) => ({ ...p, teamName: teamA?.name ?? "" })),
    ...(teamB?.players ?? []).map((p) => ({ ...p, teamName: teamB?.name ?? "" })),
  ];

  const uniqueSets = Array.from(new Set(allMarks.map((m) => m.setNumber))).sort();
  const uniqueZones = Array.from(new Set(allMarks.map((m) => m.zone).filter((z): z is number => z != null))).sort();

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/video" className="p-2 rounded-md hover:bg-secondary/50"><ArrowLeft className="size-4" /></Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{teamA?.name ?? "—"} vs {teamB?.name ?? "—"}</h1>
              <div className="text-xs text-muted-foreground">
                {match.category ?? ""} · {new Date(match.scheduledAt).toLocaleString()} · {allMarks.length} acciones
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/video/$matchId/live" params={{ matchId }}>
              <Button size="sm" variant="default" className="bg-red-600 hover:bg-red-700 text-white" title="Grabar con cámara en tiempo real">
                <Crosshair className="size-4 mr-1" /> Scouting en Vivo (cámara)
              </Button>
            </Link>
            {video && (
              <>
                <Link to="/video/$matchId/scout" params={{ matchId }}>
                  <Button size="sm" variant="outline" title="Scouting sobre video pregrabado">
                    <Crosshair className="size-4 mr-1" /> Scouting sobre video
                  </Button>
                </Link>

                <Button size="sm" variant="ghost" onClick={toggleFav} title="Favorito">
                  <Star className={`size-4 ${video.favorite ? "fill-primary text-primary" : ""}`} />
                </Button>
                <Button size="sm" variant="ghost" onClick={removeVideo} title="Eliminar video">
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </header>

        {!video && (
          <div className="bg-card/40 border border-border rounded-lg p-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-sm font-semibold mb-1 flex items-center gap-2"><Link2 className="size-4" /> Vincular por URL (YouTube, MP4, HLS)</div>
              <div className="text-xs text-muted-foreground mb-2">
                Pegá un link de YouTube (<code>youtube.com/watch?v=…</code> o <code>youtu.be/…</code>), un MP4/WebM directo, Bunny o Cloudflare Stream.
                Después usá <strong>“Scouting sobre video”</strong> para registrar acciones con atajos.
                <br />
                <span className="text-amber-500">Nota:</span> YouTube reproduce por embed y no permite auto-pausar ni precisión de frame.
              </div>
              <div className="flex gap-2">
                <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                <Button onClick={() => void applyUrl()}>Vincular</Button>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-1 flex items-center gap-2"><Upload className="size-4" /> Subir archivo</div>
              <div className="text-xs text-muted-foreground mb-2">MP4/WebM. Almacenado privado; sólo lo ven usuarios con acceso a la liga.</div>
              <label className="flex items-center gap-2">
                <Input type="file" accept="video/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void applyUpload(f); }} />
              </label>
              {uploading && <div className="text-xs text-muted-foreground mt-1">Subiendo… no cierres la pestaña.</div>}
            </div>
          </div>
        )}

        {video && videoSrc && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <div className="flex flex-col gap-3">
              <VideoPlayer
                ref={playerRef}
                src={displaySrc}
                marks={marks}
                isYouTube={isYouTube}
                onTimeUpdate={setCurrentMs}
                onDurationChange={(sec) => {
                  if (!video.duration_sec || Math.abs((video.duration_sec ?? 0) - sec) > 1) {
                    void updateVideoMeta(matchId, { duration_sec: sec });
                  }
                }}
              />

              {/* Sync bar */}
              <div className="bg-card/40 border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => void markFirstServe()} disabled={isYouTube}>
                  <Crosshair className="size-4 mr-1" /> Marcar primer saque
                </Button>
                <div className="text-xs text-muted-foreground">Offset: <span className="tabular-nums text-foreground">{((video.sync_offset_ms ?? 0) / 1000).toFixed(2)}s</span></div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => void nudgeOffset(-1000)}>−1s</Button>
                  <Button size="sm" variant="outline" onClick={() => void nudgeOffset(-100)}>−0.1s</Button>
                  <Button size="sm" variant="outline" onClick={() => void nudgeOffset(-10)}>−10ms</Button>
                  <Button size="sm" variant="outline" onClick={() => void nudgeOffset(10)}>+10ms</Button>
                  <Button size="sm" variant="outline" onClick={() => void nudgeOffset(100)}>+0.1s</Button>
                  <Button size="sm" variant="outline" onClick={() => void nudgeOffset(1000)}>+1s</Button>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Slider
                    value={[(video.sync_offset_ms ?? 0) / 1000]}
                    min={-10}
                    max={Math.max(60, (video.duration_sec ?? 60))}
                    step={0.01}
                    onValueChange={(v) => { void updateSyncOffset(matchId, (v[0] ?? 0) * 1000).then(() => void reload()); }}
                  />
                </div>
              </div>

              {/* Rally strip */}
              {rallies.length > 0 && (
                <div className="bg-card/40 border border-border rounded-lg p-3">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Rallies ({rallies.length})</div>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {rallies.map((r) => {
                      const durMs = Math.max(200, r.endMs - r.startMs);
                      const w = Math.min(80, Math.max(16, durMs / 200));
                      const active = r.index === activeRallyIdx;
                      return (
                        <button
                          key={r.index}
                          onClick={() => playerRef.current?.seekMs(Math.max(0, r.startMs))}
                          title={`Rally ${r.index + 1} · Set ${r.setNumber} · ${r.scoreAfter} · ${Math.round(durMs / 1000)}s`}
                          className={`shrink-0 h-8 rounded ${active ? "ring-2 ring-primary" : ""}`}
                          style={{
                            width: `${w}px`,
                            background: r.winnerSide === "A" ? "oklch(0.72 0.17 155 / 0.55)" : "oklch(0.62 0.24 25 / 0.55)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions panel */}
            <aside className="flex flex-col gap-3 min-w-0">
              <div className="bg-card/40 border border-border rounded-lg p-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Filtros</div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {ALL_KINDS.map((k) => {
                    const on = kindFilter.has(k);
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          const next = new Set(kindFilter);
                          if (on) next.delete(k); else next.add(k);
                          setKindFilter(next);
                        }}
                        className="text-[10px] px-2 py-1 rounded border transition-colors"
                        style={{
                          borderColor: MARK_COLORS[k],
                          background: on ? MARK_COLORS[k] + "33" : "transparent",
                          color: on ? "white" : "var(--color-muted-foreground)",
                        }}
                      >
                        {MARK_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <select value={setFilter} onChange={(e) => setSetFilter(e.target.value === "all" ? "all" : Number(e.target.value))} className="bg-input border border-border rounded px-2 py-1">
                    <option value="all">Todos los sets</option>
                    {uniqueSets.map((s) => <option key={s} value={s}>Set {s}</option>)}
                  </select>
                  <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value as "all" | "A" | "B")} className="bg-input border border-border rounded px-2 py-1">
                    <option value="all">Ambos equipos</option>
                    <option value="A">{teamA?.name ?? "A"}</option>
                    <option value="B">{teamB?.name ?? "B"}</option>
                  </select>
                  <select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} className="bg-input border border-border rounded px-2 py-1 col-span-2">
                    <option value="all">Todas las jugadoras</option>
                    {availablePlayers.map((p) => (
                      <option key={p.id} value={p.id}>#{p.number ?? "?"} {p.name} — {p.teamName}</option>
                    ))}
                  </select>
                  <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value === "all" ? "all" : Number(e.target.value))} className="bg-input border border-border rounded px-2 py-1 col-span-2">
                    <option value="all">Todas las zonas</option>
                    {uniqueZones.map((z) => <option key={z} value={z}>Zona {z}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-card/40 border border-border rounded-lg flex-1 min-h-[300px] flex flex-col">
                <div className="px-3 py-2 border-b border-border/60 text-xs uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                  <span>Acciones</span>
                  <span className="text-foreground tabular-nums">{marks.length}</span>
                </div>
                <div className="overflow-y-auto max-h-[560px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-2 py-1 font-medium">t</th>
                        <th className="px-2 py-1 font-medium">Set</th>
                        <th className="px-2 py-1 font-medium">Jugadora</th>
                        <th className="px-2 py-1 font-medium">Fundamento</th>
                        <th className="px-2 py-1 font-medium">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((m) => {
                        const isCurrent = Math.abs(m.tMs - currentMs) < 1500;
                        return (
                          <tr
                            key={m.id}
                            onClick={() => seekToMark(m)}
                            className={`cursor-pointer border-t border-border/40 hover:bg-primary/10 ${isCurrent ? "bg-primary/15" : ""}`}
                          >
                            <td className="px-2 py-1 tabular-nums text-muted-foreground">{formatT(m.tMs / 1000)}</td>
                            <td className="px-2 py-1">{m.setNumber}</td>
                            <td className="px-2 py-1">
                              <span className="inline-flex items-center gap-1">
                                <span className="size-2 rounded-full" style={{ background: m.side === "A" ? "oklch(0.72 0.17 155)" : m.side === "B" ? "oklch(0.62 0.24 25)" : "gray" }} />
                                {m.playerName ? `#${m.playerNumber ?? "?"} ${m.playerName}` : m.team ?? "—"}
                              </span>
                            </td>
                            <td className="px-2 py-1">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-1 h-3 rounded-sm" style={{ background: MARK_COLORS[m.kind] }} />
                                {m.fundamento}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-muted-foreground">{m.result ?? "—"} <span className="ml-1 tabular-nums text-[10px]">{m.score}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {marks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-xs">No hay acciones con los filtros actuales.</div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {video && videoSrc && marks.length > 0 && (
          <ClipsPanel
            matchId={matchId}
            marks={marks}
            playerRef={playerRef}
            disabled={isYouTube}
            disabledReason={isYouTube ? "Exportar clips requiere un video local o subido (YouTube no permite capturar el stream)." : undefined}
          />
        )}


        {video && !videoSrc && (
          <div className="text-center py-20 text-muted-foreground">
            <VideoIcon className="size-8 mx-auto mb-2" />
            Cargando video…
          </div>
        )}

        <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
          <strong>Atajos:</strong> Espacio (play/pausa) · ← → (±5s, Shift ±1s) · , . (frame) · J/L (velocidad) · F (pantalla completa)
        </div>
      </div>
    </AppShell>
  );
}

function formatT(sec: number) {
  if (!isFinite(sec)) sec = 0;
  const sign = sec < 0 ? "-" : "";
  sec = Math.abs(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return sign + (h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`);
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m?.[1] ?? null;
}
