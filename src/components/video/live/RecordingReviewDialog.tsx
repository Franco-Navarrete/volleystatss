/**
 * Dialog "Analizar grabación": reproduce el buffer de video que
 * LiveRecorder está acumulando en RAM, sin detener la captura.
 *
 * - Reproductor secundario basado en un Blob URL del buffer actual.
 * - Todas las herramientas de análisis (AnalysisPanel) funcionan igual
 *   que en /scout — timeline, tabla, rally, frames, atajos.
 * - Botón "Actualizar buffer" y auto-refresh (opcional) para incorporar
 *   los últimos segundos grabados manteniendo el tiempo de reproducción.
 * - No toca el MediaRecorder ni el scouting: solo consume la memoria ya
 *   buffereada por el recorder.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { AnalysisPanel } from "@/components/video/analysis/AnalysisPanel";
import { KeyboardShortcutsPanel } from "@/components/video/analysis/KeyboardShortcutsPanel";
import type { LiveRecorder } from "@/lib/live-recording";
import type { VideoMark } from "@/lib/video-marks";
import { RefreshCw, Radio } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recorder: LiveRecorder | null;
  matchId: string;
  marks: VideoMark[];
  /** Ms grabados en vivo (para saber cuánto falta por bufferar). */
  liveElapsedMs: number;
  bufferedMs: number;
  bufferedBytes: number;
}

export function RecordingReviewDialog({
  open, onOpenChange, recorder, matchId, marks, liveElapsedMs, bufferedMs, bufferedBytes,
}: Props) {
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const [src, setSrc] = useState<string>("");
  const [currentMs, setCurrentMs] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Crear un Blob URL del buffer actual. Si `preserveMs` se pasa, retoma allí.
  const refreshBuffer = useMemo(() => {
    return (preserveMs?: number) => {
      if (!recorder) return;
      const blob = recorder.getReviewBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setSrc((prev) => {
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 5000);
        return url;
      });
      if (preserveMs != null) {
        // Reintentar el seek varias veces hasta que el nuevo blob tenga la duración cargada.
        const target = preserveMs;
        let tries = 0;
        const trySeek = () => {
          const p = playerRef.current;
          if (!p) return;
          const durMs = p.getDurationSec() * 1000;
          if (durMs >= target - 100 || tries++ > 20) {
            p.seekMs(Math.min(durMs, target));
          } else {
            setTimeout(trySeek, 200);
          }
        };
        setTimeout(trySeek, 200);
      }
    };
  }, [recorder]);

  // Al abrir el dialog, cargar el buffer inicial y saltar cerca del final.
  useEffect(() => {
    if (!open) return;
    const blob = recorder?.getReviewBlob();
    if (!blob) { setSrc(""); return; }
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => { URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-refresh cuando el usuario está pausado cerca del final del buffer.
  useEffect(() => {
    if (!open || !autoRefresh || !recorder) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const durMs = p.getDurationSec() * 1000;
      const curMs = p.getCurrentMs();
      const bufMs = recorder.getBufferedMs();
      // Si estamos en los últimos 3s del buffer y hay al menos 5s nuevos, refrescar.
      if (bufMs - durMs >= 5000 && durMs - curMs <= 3000) {
        refreshBuffer(curMs);
      }
    }, 4000);
    return () => window.clearInterval(id);
  }, [open, autoRefresh, recorder, refreshBuffer]);

  const lagMs = Math.max(0, liveElapsedMs - bufferedMs);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-auto p-0">
        <DialogHeader className="px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              🎥 Analizar grabación
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-red-400 font-normal">
                <Radio className="size-3 animate-pulse" /> Captura en curso
              </span>
            </DialogTitle>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                Buffer: {(bufferedMs / 1000).toFixed(0)}s · {(bufferedBytes / 1e6).toFixed(1)} MB
              </span>
              {lagMs > 0 && (
                <span className="text-yellow-400 tabular-nums">(en vivo va {(lagMs / 1000).toFixed(0)}s adelante)</span>
              )}
              <label className="flex items-center gap-1 ml-2">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                auto
              </label>
              <Button size="sm" variant="outline" onClick={() => refreshBuffer(playerRef.current?.getCurrentMs())}>
                <RefreshCw className="size-3 mr-1" /> Actualizar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 flex flex-col gap-3">
          {src ? (
            <VideoPlayer
              ref={playerRef}
              src={src}
              marks={marks}
              onTimeUpdate={(ms) => {
                setCurrentMs(ms);
                const v = playerRef.current?.getVideoElement();
                setIsPlaying(!!v && !v.paused);
              }}
              onDurationChange={setDurationSec}
            />
          ) : (
            <div className="aspect-video bg-card/40 border border-dashed border-border rounded-lg grid place-items-center text-sm text-muted-foreground">
              El buffer todavía está vacío. Esperá los primeros segundos de grabación (~5s).
            </div>
          )}
          <AnalysisPanel
            matchId={matchId}
            marks={marks}
            currentMs={currentMs}
            totalMs={Math.max(durationSec * 1000, bufferedMs)}
            onSeek={(ms) => playerRef.current?.seekMs(Math.max(0, ms))}
            onSelectMark={(m) => playerRef.current?.seekMs(Math.max(0, m.inicioClipMs))}
            playerRef={playerRef}
            isPlaying={isPlaying}
          />
          <KeyboardShortcutsPanel active={open} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
