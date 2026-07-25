/**
 * Módulo Post-Partido — capa aditiva de análisis profesional.
 *
 * Consume:
 *   - buildVideoMarks (existente) → base de acciones sincronizadas.
 *   - ClipService (nuevo) → enriquece marks con metadata (nombre, fav, tags).
 *   - FilterService (nuevo) → filtros combinables globales.
 *   - PlaylistService (nuevo) → colecciones nombradas.
 *   - StatisticsService (nuevo) → agregados clickeables.
 *   - AnalysisPanel (existente) → timeline + tabla + rally + marcadores.
 *   - VideoPlayer (existente) → reproducción única.
 *
 * NO reemplaza `scout` ni `index`. Es una ruta paralela.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useVolley } from "@/lib/volley-store";
import { useMatchVideo, getSignedVideoUrl } from "@/hooks/use-match-video";
import { buildVideoMarks, type VideoMark } from "@/lib/video-marks";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { AnalysisPanel } from "@/components/video/analysis/AnalysisPanel";
import { KeyboardShortcutsPanel } from "@/components/video/analysis/KeyboardShortcutsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Film, Filter, ListMusic, GitCompareArrows, BarChart3, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import { useAnalysisStore } from "@/lib/video/analysis-store";
import { ClipService, useClipMetaStore, type Clip } from "@/lib/analysis/clip-service";
import { useFilterStore, FilterService } from "@/lib/analysis/filter-service";
import { usePlaylistStore } from "@/lib/analysis/playlist-service";

import { AnalysisFilters } from "@/components/analysis/AnalysisFilters";
import { ClipsLibrary } from "@/components/analysis/ClipsLibrary";
import { PlaylistsPanel } from "@/components/analysis/PlaylistsPanel";
import { ComparePanel } from "@/components/analysis/ComparePanel";
import { StatsPanelInteractive } from "@/components/analysis/StatsPanelInteractive";
import { AnalysisDashboard } from "@/components/analysis/AnalysisDashboard";
import { ExportBar } from "@/components/analysis/ExportBar";

export const Route = createFileRoute("/_authenticated/video/$matchId/analysis")({
  head: () => ({
    meta: [
      { title: "Análisis Post-Partido — RALLY" },
      {
        name: "description",
        content:
          "Biblioteca de clips, filtros avanzados, playlists, comparación y estadísticas interactivas.",
      },
    ],
  }),
  component: AnalysisRoute,
});

type MainTab = "clips" | "playlists" | "compare" | "stats" | "dashboard";

function AnalysisRoute() {
  const { matchId } = Route.useParams();
  const match = useVolley((s) => s.matches.find((m) => m.id === matchId));
  const teams = useVolley((s) => s.teams);
  const { video } = useMatchVideo(matchId);

  const teamA = teams.find((t) => t.id === match?.teamAId);
  const teamB = teams.find((t) => t.id === match?.teamBId);

  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tab, setTab] = useState<MainTab>("clips");

  useEffect(() => {
    const v = playerRef.current?.getVideoElement();
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => { v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); };
  }, [videoSrc]);

  // Config global (compartido con scout).
  const prerollMs = useAnalysisStore((s) => s.prerollMs);
  const postrollMs = useAnalysisStore((s) => s.postrollMs);
  const selectMark = useAnalysisStore((s) => s.selectMark);
  const markersByMatch = useAnalysisStore((s) => s.markersByMatch);

  // Metadata de clips.
  const metaByClip = useClipMetaStore(
    (s) => s.metaByMatch[matchId] ?? ({} as Record<string, import("@/lib/analysis/clip-service").ClipMeta>),
  );

  // Filtros y playlists.
  const filters = useFilterStore((s) => s.filters);
  const playlists = usePlaylistStore(
    (s) => s.playlistsByMatch[matchId] ?? [],
  );
  const addClipToPlaylist = usePlaylistStore((s) => s.addClip);
  const createPlaylist = usePlaylistStore((s) => s.create);

  // Resolver fuente de video.
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

  const isYouTube = useMemo(
    () => !!videoSrc && /youtube\.com|youtu\.be/.test(videoSrc),
    [videoSrc],
  );
  const displaySrc = useMemo(() => {
    if (!videoSrc) return "";
    if (!isYouTube) return videoSrc;
    const m = videoSrc.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1&modestbranding=1&rel=0` : videoSrc;
  }, [videoSrc, isYouTube]);

  // Base de marks + enriquecimiento a clips.
  const marks = useMemo<VideoMark[]>(() => {
    if (!match) return [];
    return buildVideoMarks(match, teamA, teamB, video?.sync_offset_ms ?? 0);
  }, [match, teamA, teamB, video?.sync_offset_ms]);

  const allClips = useMemo<Clip[]>(
    () => ClipService.enrich(matchId, marks, prerollMs, postrollMs, metaByClip),
    [matchId, marks, prerollMs, postrollMs, metaByClip],
  );

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === filters.playlistId) ?? null,
    [playlists, filters.playlistId],
  );

  const filteredClips = useMemo(() => {
    const playlistClipIds = activePlaylist
      ? new Set(activePlaylist.clipIds)
      : undefined;
    const markerTimestamps = filters.markersOnly
      ? new Set((markersByMatch[matchId] ?? []).map((m) => m.tMs))
      : undefined;
    return FilterService.apply(allClips, filters, {
      playlistClipIds,
      markerTimestamps,
    });
  }, [allClips, filters, activePlaylist, markersByMatch, matchId]);

  // Reproducción secuencial (playlists).
  const queueRef = useRef<Clip[]>([]);
  const queueIdxRef = useRef(0);

  const playOne = useCallback((c: Clip) => {
    selectMark(c.id);
    playerRef.current?.seekMs(Math.max(0, c.tMs - prerollMs));
  }, [prerollMs, selectMark]);

  const playSequence = useCallback((cs: Clip[]) => {
    if (!cs.length) return;
    queueRef.current = cs;
    queueIdxRef.current = 0;
    playOne(cs[0]);
    toast.info(`Reproduciendo ${cs.length} clips en secuencia`);
  }, [playOne]);

  // Avanza en la cola cuando termina el clip virtual.
  useEffect(() => {
    if (queueRef.current.length === 0) return;
    const current = queueRef.current[queueIdxRef.current];
    if (!current) return;
    if (currentMs >= current.finClipMs - 100) {
      queueIdxRef.current += 1;
      const next = queueRef.current[queueIdxRef.current];
      if (next) playOne(next);
      else { queueRef.current = []; queueIdxRef.current = 0; playerRef.current?.pause(); }
    }
  }, [currentMs, playOne]);

  // "A playlist" desde una tarjeta.
  const handleAddToPlaylist = useCallback((c: Clip) => {
    let target = playlists[0];
    if (!target) target = createPlaylist(matchId, "Mi playlist");
    addClipToPlaylist(matchId, target.id, c.id);
    toast.success(`Añadido a "${target.name}"`);
  }, [playlists, createPlaylist, addClipToPlaylist, matchId]);

  const onSelectMarkFromPanel = useCallback((m: VideoMark) => {
    selectMark(m.id);
    playerRef.current?.seekMs(Math.max(0, m.tMs - prerollMs));
  }, [prerollMs, selectMark]);

  if (!match) {
    return (
      <AppShell>
        <div className="text-center py-20 text-muted-foreground">
          Partido no encontrado.{" "}
          <Link to="/video" className="text-primary underline">Volver a la biblioteca</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/video/$matchId" params={{ matchId }} className="p-2 rounded-md hover:bg-secondary/50">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">
                Análisis — {teamA?.name ?? "A"} vs {teamB?.name ?? "B"}
              </h1>
              <div className="text-xs text-muted-foreground">
                {allClips.length} acciones · {filteredClips.length} con filtros
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/video/$matchId/scout" params={{ matchId }}>
                <Film className="size-4 mr-1" /> Volver a Scouting
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* IZQUIERDA — video + timeline compartido */}
          <div className="flex flex-col gap-3 min-w-0">
            {displaySrc ? (
              <VideoPlayer
                ref={playerRef}
                src={displaySrc}
                marks={allClips}
                isYouTube={isYouTube}
                onTimeUpdate={setCurrentMs}
                onDurationChange={setDurationSec}
              />
            ) : (
              <div className="aspect-video bg-card/40 border border-dashed border-border rounded-lg grid place-items-center text-sm text-muted-foreground">
                Vincula un video en la sección "Video" del partido para habilitar el análisis.
              </div>
            )}
            <AnalysisPanel
              matchId={matchId}
              marks={allClips}
              currentMs={currentMs}
              totalMs={Math.max(durationSec * 1000, ...allClips.map((c) => c.tMs), 60_000)}
              onSeek={(ms) => playerRef.current?.seekMs(ms)}
              onSelectMark={onSelectMarkFromPanel}
              playerRef={playerRef}
              isPlaying={isPlaying}
            />
          </div>

          {/* DERECHA — filtros permanentes */}
          <aside className="flex flex-col gap-3 min-w-0">
            <AnalysisFilters
              clips={allClips}
              playlists={playlists.map((p) => ({ id: p.id, name: p.name }))}
            />
            <ExportBar matchId={matchId} clips={filteredClips} playlist={activePlaylist} />
          </aside>
        </div>

        {/* INFERIOR — pestañas del módulo */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as MainTab)}>
          <TabsList>
            <TabsTrigger value="clips">
              <Film className="size-3 mr-1" /> Biblioteca
            </TabsTrigger>
            <TabsTrigger value="playlists">
              <ListMusic className="size-3 mr-1" /> Playlists
            </TabsTrigger>
            <TabsTrigger value="compare">
              <GitCompareArrows className="size-3 mr-1" /> Comparar
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="size-3 mr-1" /> Estadísticas
            </TabsTrigger>
            <TabsTrigger value="dashboard">
              <LayoutDashboard className="size-3 mr-1" /> Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clips" className="mt-3">
            <ClipsLibrary
              matchId={matchId}
              clips={filteredClips}
              videoSrc={displaySrc || null}
              isYouTube={isYouTube}
              currentMs={currentMs}
              onPlay={playOne}
              onAddToPlaylist={handleAddToPlaylist}
            />
          </TabsContent>

          <TabsContent value="playlists" className="mt-3">
            <PlaylistsPanel
              matchId={matchId}
              clips={allClips}
              onPlayClip={playOne}
              onPlaySequence={playSequence}
            />
          </TabsContent>

          <TabsContent value="compare" className="mt-3">
            <ComparePanel
              clips={filteredClips.length ? filteredClips : allClips}
              videoSrc={videoSrc}
              isYouTube={isYouTube}
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-3">
            <StatsPanelInteractive
              clips={filteredClips}
              onWantClipsTab={() => setTab("clips")}
            />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-3">
            <AnalysisDashboard
              clips={filteredClips}
              onWantClipsTab={() => setTab("clips")}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
