import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useVolley, setsWon } from "@/lib/volley-store";
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
import { ClipsPanel } from "@/components/video/ClipsPanel";
import { useMatchSessionStore } from "@/lib/match-session/store";
import { MatchSessionService } from "@/lib/match-session/services/match-session-service";
import type { SessionStatus, SessionVideoKind } from "@/lib/match-session/types";
import { SessionStatusBadge } from "@/components/session/SessionStatusBadge";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft, Star, Trash2, Upload, Link2, Crosshair, Video as VideoIcon,
  BarChart3, Sparkles, Play, Radio, Camera, Monitor, MonitorSmartphone,
  FileVideo, Circle, ListChecks, Clock, ChevronDown, Rocket,
  Timer, Film, Layers, Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/video/$matchId/")({
  head: () => ({
    meta: [
      { title: "Match Center — RALLY" },
      { name: "description", content: "Dashboard operativo del partido: video, scouting, grabación y análisis en un mismo lugar." },
      { property: "og:title", content: "Match Center — RALLY" },
      { property: "og:description", content: "Dashboard operativo del partido con video sincronizado, scouting y análisis." },
    ],
  }),
  component: MatchCenter,
});

const ALL_KINDS: VideoMarkKind[] = ["serve", "reception", "attack", "block", "defense", "error", "point", "timeout", "sub", "sanction"];

function MatchCenter() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const match = useVolley((s) => s.matches.find((m) => m.id === matchId));
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const { video, reload } = useMatchVideo(matchId);
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const session = useMatchSessionStore((s) => s.sessions[matchId]);
  const createSession = useMatchSessionStore((s) => s.createSession);

  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [sourceOpen, setSourceOpen] = useState<SessionVideoKind | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);

  const [kindFilter, setKindFilter] = useState<Set<VideoMarkKind>>(new Set(ALL_KINDS));
  const [setFilter, setSetFilter] = useState<number | "all">("all");
  const [sideFilter, setSideFilter] = useState<"all" | "A" | "B">("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [zoneFilter, setZoneFilter] = useState<number | "all">("all");

  const teamA = teams.find((t) => t.id === match?.teamAId);
  const teamB = teams.find((t) => t.id === match?.teamBId);
  const league = leagues.find((l) => l.id === (teamA?.leagueId ?? teamB?.leagueId));

  // Derived session status
  const derivedStatus: SessionStatus = useMemo(() => {
    if (session?.status) return session.status;
    if (!match) return "preparation";
    const finished = match.sets.some((s) => s.finished) && match.status !== "live";
    if (match.status === "live") return "live";
    if (finished && video) return "analysis";
    if (finished) return "finished";
    return "preparation";
  }, [session?.status, match, video]);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!video) { setVideoSrc(null); return; }
      if (video.source === "url" && video.external_url) { setVideoSrc(video.external_url); return; }
      if (video.source === "upload" && video.storage_path) {
        const url = await getSignedVideoUrl(video.storage_path, 60 * 60 * 4);
        if (!cancelled) setVideoSrc(url);
      }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [video?.id, video?.source, video?.external_url, video?.storage_path]);

  const isYouTube = useMemo(() => !!videoSrc && /youtube\.com|youtu\.be/.test(videoSrc), [videoSrc]);
  const displaySrc = useMemo(() => {
    if (!videoSrc) return "";
    if (!isYouTube) return videoSrc;
    const id = extractYouTubeId(videoSrc);
    return id ? `https://www.youtube.com/embed/${id}?enablejsapi=1&modestbranding=1&rel=0` : videoSrc;
  }, [videoSrc, isYouTube]);

  const allMarks = useMemo(() => {
    if (!match) return [];
    return buildVideoMarks(match, teamA, teamB, video?.sync_offset_ms ?? 0);
  }, [match, teamA, teamB, video?.sync_offset_ms]);

  const marks = useMemo(() => allMarks.filter((m) => {
    if (!kindFilter.has(m.kind)) return false;
    if (setFilter !== "all" && m.setNumber !== setFilter) return false;
    if (sideFilter !== "all" && m.side !== sideFilter) return false;
    if (playerFilter !== "all" && m.playerId !== playerFilter) return false;
    if (zoneFilter !== "all" && m.zone !== zoneFilter) return false;
    return true;
  }), [allMarks, kindFilter, setFilter, sideFilter, playerFilter, zoneFilter]);

  const rallies = useMemo(() => buildRallyBlocks(allMarks), [allMarks]);
  const activeRallyIdx = useMemo(
    () => rallies.findIndex((r) => currentMs >= r.startMs && currentMs <= r.endMs),
    [rallies, currentMs],
  );

  const seekToMark = (m: VideoMark) => playerRef.current?.seekMs(Math.max(0, m.tMs - 500));

  const markFirstServe = async () => {
    if (!playerRef.current || !match) return;
    if (!match.events.length) { toast.error("El partido aún no tiene eventos cargados."); return; }
    const currentSec = playerRef.current.getCurrentMs() / 1000;
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
      setSourceOpen(null);
      await reload();
      toast.success("Video vinculado por URL.");
    } catch (e) { toast.error("No se pudo guardar la URL: " + (e as Error).message); }
  };

  const applyUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadMatchVideo(matchId, file);
      await upsertMatchVideoUpload(matchId, path);
      await reload();
      setSourceOpen(null);
      toast.success("Video subido.");
    } catch (e) { toast.error("Error al subir: " + (e as Error).message); }
    finally { setUploading(false); }
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

  const startMatchNow = () => {
    if (!match) return;
    if (!session) {
      createSession({
        id: matchId,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        competition: league?.name,
        category: match.category ?? undefined,
      });
    }
    MatchSessionService.setStatus(matchId, "live");
    navigate({ to: "/video/$matchId/live", params: { matchId } });
  };

  if (!match) {
    return (
      <AppShell>
        <div className="text-center py-20 text-muted-foreground">
          Partido no encontrado. <Link to="/video" className="text-primary underline">Volver al Match Center</Link>
        </div>
      </AppShell>
    );
  }

  const { a: setsA, b: setsB } = setsWon(match);
  const analysisAvailable = !!video && match.sets.some((s) => s.finished);

  const availablePlayers = [
    ...(teamA?.players ?? []).map((p) => ({ ...p, teamName: teamA?.name ?? "" })),
    ...(teamB?.players ?? []).map((p) => ({ ...p, teamName: teamB?.name ?? "" })),
  ];
  const uniqueSets = Array.from(new Set(allMarks.map((m) => m.setNumber))).sort();
  const uniqueZones = Array.from(new Set(allMarks.map((m) => m.zone).filter((z): z is number => z != null))).sort();

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* HEADER */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/video" className="p-2 rounded-md hover:bg-secondary/50 shrink-0" aria-label="Volver">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <TeamCrest team={teamA} />
                <span className="font-bold truncate max-w-[140px] sm:max-w-none">{teamA?.name ?? "—"}</span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">vs</span>
                <span className="font-bold truncate max-w-[140px] sm:max-w-none">{teamB?.name ?? "—"}</span>
                <TeamCrest team={teamB} />
                <span className="text-2xl font-black tabular-nums ml-2">{setsA}–{setsB}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate mt-1">
                {league?.name ? `${league.name} · ` : ""}{match.category ?? "Sin categoría"} · {new Date(match.scheduledAt).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SessionStatusBadge status={derivedStatus} />
            {video && (
              <>
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

        {/* METRICS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBar icon={<ListChecks className="size-4" />} label="Acciones" value={allMarks.length} />
          <MetricBar icon={<Layers className="size-4" />} label="Rallies" value={rallies.length} />
          <MetricBar icon={<Clock className="size-4" />} label="Duración video" value={video?.duration_sec ? formatDur(video.duration_sec) : "—"} />
          <MetricBar icon={<Users className="size-4" />} label="Sets jugados" value={match.sets.filter((s) => s.finished).length} />
        </div>

        {/* PHASE CARD + PRIMARY CTA */}
        <PhaseCard
          status={derivedStatus}
          onStart={startMatchNow}
          matchId={matchId}
          analysisAvailable={analysisAvailable}
        />

        {/* MAIN 3-COLUMN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <VideoSourceSection
            hasVideo={!!video}
            selected={sourceOpen}
            onSelect={setSourceOpen}
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            applyUrl={applyUrl}
            applyUpload={applyUpload}
            uploading={uploading}
            matchId={matchId}
            videoLabel={video ? (video.source === "url" ? video.external_url : "Archivo subido") : null}
          />
          <ScoutSection matchId={matchId} actions={allMarks.length} lastMark={allMarks[allMarks.length - 1]} teamA={teamA} teamB={teamB} />
          <RecordingSection matchId={matchId} isLive={derivedStatus === "live"} />
        </div>

        {/* ANALYSIS SHORTCUTS */}
        <AnalysisSection matchId={matchId} available={analysisAvailable} />

        {/* WORKSPACE (video player + actions table + clips) — only when video is linked */}
        {video && videoSrc && (
          <section className="bg-card/30 border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setWorkspaceOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30"
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                <Film className="size-4 text-primary" />
                Workspace de video · Sincronización, acciones y clips
              </div>
              <ChevronDown className={`size-4 transition-transform ${workspaceOpen ? "rotate-180" : ""}`} />
            </button>

            {workspaceOpen && (
              <div className="p-4 border-t border-border/60 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
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
                              style={{ width: `${w}px`, background: r.winnerSide === "A" ? "oklch(0.72 0.17 155 / 0.55)" : "oklch(0.62 0.24 25 / 0.55)" }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

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

            {workspaceOpen && marks.length > 0 && (
              <div className="p-4 border-t border-border/60">
                <ClipsPanel
                  matchId={matchId}
                  marks={marks}
                  playerRef={playerRef}
                  disabled={isYouTube}
                  disabledReason={isYouTube ? "Exportar clips requiere un video local o subido (YouTube no permite capturar el stream)." : undefined}
                />
              </div>
            )}
          </section>
        )}

        {video && !videoSrc && (
          <div className="text-center py-10 text-muted-foreground">
            <VideoIcon className="size-8 mx-auto mb-2" />
            Cargando video…
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ============ SUBCOMPONENTS ============

function TeamCrest({ team }: { team?: { name: string; color?: string } }) {
  const initials = (team?.name ?? "??").slice(0, 2).toUpperCase();
  return (
    <div
      className="size-8 shrink-0 rounded-md grid place-items-center font-black text-[10px] border border-border/60"
      style={{ background: team?.color ? `${team.color}22` : "hsl(var(--muted))", color: team?.color ?? undefined }}
    >
      {initials}
    </div>
  );
}

function MetricBar({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-card/40 border border-border rounded-lg px-3 py-2 flex items-center gap-3">
      <div className="text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-lg font-black tabular-nums leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function PhaseCard({
  status, onStart, matchId, analysisAvailable,
}: {
  status: SessionStatus;
  onStart: () => void;
  matchId: string;
  analysisAvailable: boolean;
}) {
  if (status === "preparation") {
    return (
      <div className="bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border border-primary/40 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
        <div className="grid place-items-center size-16 sm:size-20 rounded-full bg-primary/20 border border-primary/40 shrink-0">
          <Rocket className="size-8 sm:size-10 text-primary" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="text-[10px] uppercase tracking-widest text-primary font-bold">Preparación</div>
          <h2 className="text-2xl sm:text-3xl font-black mt-1">Todo listo para arrancar</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Al iniciar se crea la Match Session, arranca el cronómetro y se abre el modo En Vivo.
          </p>
        </div>
        <Button size="lg" onClick={onStart} className="gap-2 text-base font-bold px-6 py-6">
          <Play className="size-5 fill-current" /> INICIAR PARTIDO
        </Button>
      </div>
    );
  }
  if (status === "live") {
    return (
      <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <Radio className="size-8 text-destructive" />
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-destructive font-bold">En vivo</div>
            <h2 className="text-xl font-black">Partido en curso</h2>
          </div>
        </div>
        <Link to="/video/$matchId/live" params={{ matchId }}>
          <Button size="lg" variant="destructive" className="gap-2"><Radio className="size-4" /> Continuar en vivo</Button>
        </Link>
      </div>
    );
  }
  if (status === "processing") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-5 flex items-center gap-4">
        <Timer className="size-8 text-amber-500 animate-spin" />
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Procesando</div>
          <h2 className="text-xl font-black">Consolidando datos del partido…</h2>
        </div>
      </div>
    );
  }
  // analysis / finished
  return (
    <div className="bg-card/50 border border-border rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
      <BarChart3 className="size-8 text-primary" />
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-widest text-primary font-bold">{status === "analysis" ? "Análisis disponible" : "Finalizado"}</div>
        <h2 className="text-xl font-black">Partido cerrado</h2>
        <p className="text-xs text-muted-foreground">
          {analysisAvailable ? "Abrí el análisis para revisar clips, playlists y estadísticas." : "Vinculá un video para habilitar el módulo de análisis."}
        </p>
      </div>
      {analysisAvailable && (
        <Link to="/video/$matchId/analysis" params={{ matchId }}>
          <Button size="lg" className="gap-2"><BarChart3 className="size-4" /> Abrir Análisis</Button>
        </Link>
      )}
    </div>
  );
}

const SOURCES: { kind: SessionVideoKind; icon: React.ReactNode; label: string; hint: string }[] = [
  { kind: "file", icon: <FileVideo className="size-5" />, label: "Archivo local", hint: "MP4 / WebM" },
  { kind: "youtube", icon: <Link2 className="size-5" />, label: "URL / YouTube", hint: "YouTube · MP4 · HLS" },
  { kind: "camera", icon: <Camera className="size-5" />, label: "Cámara", hint: "Webcam / IP" },
  { kind: "window", icon: <MonitorSmartphone className="size-5" />, label: "Compartir ventana", hint: "getDisplayMedia" },
  { kind: "screen", icon: <Monitor className="size-5" />, label: "Compartir pantalla", hint: "Pantalla completa" },
];

function VideoSourceSection({
  hasVideo, selected, onSelect, urlInput, setUrlInput, applyUrl, applyUpload, uploading, matchId, videoLabel,
}: {
  hasVideo: boolean;
  selected: SessionVideoKind | null;
  onSelect: (k: SessionVideoKind | null) => void;
  urlInput: string;
  setUrlInput: (v: string) => void;
  applyUrl: () => void;
  applyUpload: (f: File) => void;
  uploading: boolean;
  matchId: string;
  videoLabel: string | null;
}) {
  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Video</div>
          <h3 className="font-bold flex items-center gap-2"><VideoIcon className="size-4 text-primary" /> Origen del video</h3>
        </div>
        {hasVideo && (
          <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-success/15 text-success">Vinculado</span>
        )}
      </div>

      {videoLabel && (
        <div className="text-xs text-muted-foreground truncate bg-muted/40 rounded px-2 py-1.5">
          {videoLabel}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {SOURCES.map((s) => (
          <button
            key={s.kind}
            onClick={() => onSelect(selected === s.kind ? null : s.kind)}
            className={`text-left rounded-lg border p-2.5 transition-all ${selected === s.kind ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-secondary/40"}`}
          >
            <div className="flex items-center gap-2 text-primary">{s.icon}<span className="text-sm font-semibold text-foreground">{s.label}</span></div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.hint}</div>
          </button>
        ))}
      </div>

      {selected === "youtube" && (
        <div className="flex gap-2 pt-1">
          <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
          <Button onClick={applyUrl}>Vincular</Button>
        </div>
      )}
      {selected === "file" && (
        <div className="pt-1">
          <Input type="file" accept="video/*" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) applyUpload(f); }} />
          {uploading && <div className="text-xs text-muted-foreground mt-1">Subiendo… no cierres la pestaña.</div>}
        </div>
      )}
      {(selected === "camera" || selected === "window" || selected === "screen") && (
        <div className="pt-1 flex flex-col gap-2">
          <div className="text-xs text-muted-foreground">
            Las fuentes en vivo se configuran directamente en el modo Scouting en Vivo.
          </div>
          <Link to="/video/$matchId/live" params={{ matchId }}>
            <Button size="sm" variant="outline" className="gap-1 w-full"><Camera className="size-4" /> Abrir Scouting en Vivo</Button>
          </Link>
        </div>
      )}
    </section>
  );
}

function ScoutSection({ matchId, actions, lastMark, teamA, teamB }: {
  matchId: string;
  actions: number;
  lastMark?: VideoMark;
  teamA?: { name: string };
  teamB?: { name: string };
}) {
  const state = actions === 0 ? "Sin iniciar" : "En progreso";
  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 min-h-[280px]">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Scout</div>
        <h3 className="font-bold flex items-center gap-2"><Crosshair className="size-4 text-primary" /> Registro de acciones</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatBlock label="Estado" value={state} />
        <StatBlock label="Acciones" value={actions} />
      </div>

      <div className="bg-muted/40 rounded-lg p-3 text-xs flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Última acción</div>
        {lastMark ? (
          <div className="space-y-0.5">
            <div className="font-semibold">{lastMark.fundamento} {lastMark.result ? `· ${lastMark.result}` : ""}</div>
            <div className="text-muted-foreground">
              {lastMark.playerName ? `#${lastMark.playerNumber ?? "?"} ${lastMark.playerName}` : lastMark.team ?? "—"} · Set {lastMark.setNumber} · {formatT(lastMark.tMs / 1000)}
            </div>
            <div className="text-muted-foreground">
              {lastMark.side === "A" ? teamA?.name : teamB?.name}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">Todavía no hay acciones registradas.</div>
        )}
      </div>

      <div className="flex gap-2">
        <Link to="/video/$matchId/scout" params={{ matchId }} className="flex-1">
          <Button size="sm" variant="outline" className="w-full gap-1"><Crosshair className="size-4" /> Scout sobre video</Button>
        </Link>
        <Link to="/video/$matchId/live" params={{ matchId }} className="flex-1">
          <Button size="sm" className="w-full gap-1"><Radio className="size-4" /> Scout en vivo</Button>
        </Link>
      </div>
    </section>
  );
}

function RecordingSection({ matchId, isLive }: { matchId: string; isLive: boolean }) {
  return (
    <section className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 min-h-[280px]">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Grabación</div>
        <h3 className="font-bold flex items-center gap-2"><Circle className="size-4 text-destructive" /> REC</h3>
      </div>

      <div className="bg-muted/40 rounded-lg p-3 text-xs flex-1 flex flex-col items-center justify-center text-center gap-2">
        <div className={`size-12 rounded-full grid place-items-center ${isLive ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
          <Circle className={`size-5 ${isLive ? "animate-pulse fill-current" : ""}`} />
        </div>
        <div className="font-semibold">{isLive ? "Grabación disponible" : "Sin grabación activa"}</div>
        <div className="text-muted-foreground text-[11px]">
          La captura se maneja desde el modo Scouting en Vivo con File System Access API.
        </div>
      </div>

      <Link to="/video/$matchId/live" params={{ matchId }}>
        <Button size="sm" variant={isLive ? "destructive" : "outline"} className="w-full gap-1">
          <Circle className="size-3 fill-current" /> {isLive ? "Ir a grabación" : "Configurar grabación"}
        </Button>
      </Link>
    </section>
  );
}

function AnalysisSection({ matchId, available }: { matchId: string; available: boolean }) {
  if (!available) {
    return (
      <section className="bg-card/40 border border-dashed border-border rounded-xl p-6 text-center">
        <BarChart3 className="size-8 mx-auto text-muted-foreground/60 mb-2" />
        <div className="text-sm text-muted-foreground">No hay análisis disponible todavía.</div>
        <div className="text-xs text-muted-foreground/80 mt-1">Vinculá un video y finalizá al menos un set para habilitar el módulo.</div>
      </section>
    );
  }
  const items = [
    { to: "/video/$matchId/analysis" as const, icon: <BarChart3 className="size-5" />, label: "Abrir Análisis", desc: "Filtros, tabla y timeline" },
    { to: "/video/$matchId/analysis" as const, icon: <Layers className="size-5" />, label: "Dashboard", desc: "Estadísticas visuales" },
    { to: "/video/$matchId/analysis" as const, icon: <Film className="size-5" />, label: "Timeline", desc: "Navegación cronológica" },
    { to: "/video/$matchId/analysis" as const, icon: <FileVideo className="size-5" />, label: "Clips", desc: "Biblioteca y playlists" },
    { to: "/intelligence" as const, icon: <Sparkles className="size-5" />, label: "Rally Intelligence", desc: "Informe con IA" },
  ];
  return (
    <section className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Análisis</div>
          <h3 className="font-bold flex items-center gap-2"><BarChart3 className="size-4 text-primary" /> Herramientas post-partido</h3>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {items.map((it, i) => (
          <Link key={i} to={it.to} params={{ matchId }} className="rounded-lg border border-border p-3 hover:border-primary/60 hover:bg-primary/5 transition-all">
            <div className="text-primary mb-1">{it.icon}</div>
            <div className="text-sm font-semibold">{it.label}</div>
            <div className="text-[10px] text-muted-foreground">{it.desc}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2">
      <div className="text-lg font-black tabular-nums leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function formatDur(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
