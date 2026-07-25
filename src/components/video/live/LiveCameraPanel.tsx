import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Circle, Square, Pause, Play } from "lucide-react";
import { LiveRecorder, type LiveStatus, type LiveChunk } from "@/lib/live-recording";
import { toast } from "sonner";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { VideoSourcePicker, VideoSourceChip } from "@/components/video/VideoSourcePicker";
import { useVideoSource } from "@/hooks/use-video-source";

interface Props {
  matchId: string;
  onStarted: (startedAtMs: number) => void;
  onStopped: () => void;
  onTick?: (elapsedMs: number) => void;
}

/**
 * Panel de captura en vivo con arquitectura de proveedores.
 * La grabación (LiveRecorder) es independiente del origen: cámara,
 * ventana o pantalla producen el mismo `MediaStream` que se pasa al recorder.
 */
export function LiveCameraPanel({ matchId, onStarted, onStopped, onTick }: Props) {
  const { source, status: srcStatus, open, reconnect } = useVideoSource();
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const recorderRef = useRef<LiveRecorder | null>(null);
  const startedRef = useRef<number | null>(null);
  const [recStatus, setRecStatus] = useState<LiveStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [audio, setAudio] = useState(true);

  // Elapsed ticker
  useEffect(() => {
    if (recStatus !== "recording") return;
    const id = window.setInterval(() => {
      if (startedRef.current != null) {
        const e = performance.now() - startedRef.current;
        setElapsedMs(e);
        onTick?.(e);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [recStatus, onTick]);

  // Pausar automáticamente la grabación si se interrumpe la captura;
  // reanudar cuando el usuario reconecta.
  useEffect(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (srcStatus === "interrupted" && rec.getStatus() === "recording") {
      rec.pause();
    } else if (srcStatus === "active" && rec.getStatus() === "paused") {
      rec.resume();
    }
  }, [srcStatus]);

  const isRec = recStatus === "recording" || recStatus === "paused" || recStatus === "finalizing";

  const start = async () => {
    if (!source?.stream) {
      toast.error("Elegí una fuente con video en vivo antes de grabar (Cámara, Ventana o Pantalla).");
      return;
    }

    // File System Access API: preguntamos dónde guardar.
    let fileHandle: FileSystemFileHandle | null = null;
    const anyWin = window as unknown as {
      showSaveFilePicker?: (opts: {
        suggestedName?: string;
        types?: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<FileSystemFileHandle>;
    };
    if (typeof anyWin.showSaveFilePicker === "function") {
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        fileHandle = await anyWin.showSaveFilePicker({
          suggestedName: `rally-live-${matchId}-${ts}.webm`,
          types: [{ description: "Video WebM", accept: { "video/webm": [".webm"] } }],
        });
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") {
          toast.info("Grabación cancelada");
          return;
        }
      }
    } else {
      toast.info("Este navegador no permite elegir carpeta; se descargará al finalizar.");
    }

    const rec = new LiveRecorder(
      source.stream,
      {
        onStatusChange: setRecStatus,
        onChunkUploaded: (c: LiveChunk) => {
          setChunkCount((n) => n + 1);
          setTotalBytes((b) => b + c.size);
        },
        onError: (err) => toast.error(`Grabación: ${err.message}`),
      },
      { fileHandle },
    );
    recorderRef.current = rec;
    try {
      await rec.start(matchId);
      startedRef.current = rec.getStartedAtMs();
      if (startedRef.current != null) onStarted(startedRef.current);
      toast.success(fileHandle ? "REC iniciado · guardando en tu archivo" : "REC iniciado");
    } catch (e) {
      toast.error((e as Error).message || "No se pudo iniciar la grabación");
    }
  };

  const stop = async () => {
    if (!recorderRef.current) return;
    const res = await recorderRef.current.stop();
    recorderRef.current = null;
    startedRef.current = null;
    setElapsedMs(0);
    onStopped();
    toast.success(`Finalizado · ${res.chunks.length} chunks`);
  };

  const togglePause = () => {
    const r = recorderRef.current; if (!r) return;
    if (r.getStatus() === "recording") r.pause();
    else if (r.getStatus() === "paused") r.resume();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 bg-card/40 border border-border rounded-lg p-2">
        <VideoSourcePicker
          current={source}
          onPick={(kind, opts) => void open(kind, { ...opts, audio })}
          disabled={false}
        />
        <label className="text-[11px] flex items-center gap-1 text-muted-foreground">
          <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} disabled={isRec} />
          Audio
        </label>
        {!isRec ? (
          <Button size="sm" onClick={start} className="ml-auto bg-red-600 hover:bg-red-700 text-white">
            <Circle className="size-3 mr-1 fill-white" /> REC
          </Button>
        ) : (
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={togglePause}>
              {recStatus === "paused" ? <Play className="size-3" /> : <Pause className="size-3" />}
            </Button>
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="size-3 mr-1 fill-white" /> Stop
            </Button>
          </div>
        )}
      </div>

      <VideoPlayer
        ref={playerRef}
        src=""
        marks={[]}
        source={source}
        recStatus={recStatus}
        hudElapsedMs={isRec ? elapsedMs : undefined}
        interrupted={srcStatus === "interrupted"}
        onReconnect={() => void reconnect()}
      />

      <div className="flex items-center justify-between gap-2 px-1">
        <VideoSourceChip source={source} interrupted={srcStatus === "interrupted"} />
        {isRec && (
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {chunkCount} chunks · {(totalBytes / 1e6).toFixed(1)} MB
          </div>
        )}
      </div>
    </div>
  );
}
