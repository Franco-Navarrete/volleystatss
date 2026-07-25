import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Circle, Square, Pause, Play, Camera, RefreshCcw, MonitorUp } from "lucide-react";
import { LiveRecorder, listVideoInputDevices, openStream, type LiveStatus, type LiveChunk } from "@/lib/live-recording";
import { toast } from "sonner";

interface Props {
  matchId: string;
  onStarted: (startedAtMs: number) => void;
  onStopped: () => void;
  onTick?: (elapsedMs: number) => void;
}

export function LiveCameraPanel({ matchId, onStarted, onStopped, onTick }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<LiveRecorder | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [audio, setAudio] = useState(true);
  const [source, setSource] = useState<"camera" | "screen">("camera");
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chunkCount, setChunkCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const startedRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Enumerate devices
  useEffect(() => {
    void listVideoInputDevices().then((d) => {
      setDevices(d);
      if (d.length && !deviceId) setDeviceId(d[0].deviceId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachPreview = useCallback(async () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const s = await openStream({ deviceId, audio });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo acceder a la cámara. Revisa permisos.");
    }
  }, [deviceId, audio]);

  useEffect(() => {
    if (status === "idle") void attachPreview();
    return () => {
      if (status === "idle") streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [deviceId, audio, status, attachPreview]);

  // Elapsed ticker
  useEffect(() => {
    if (status !== "recording") return;
    const id = window.setInterval(() => {
      if (startedRef.current != null) {
        const e = performance.now() - startedRef.current;
        setElapsedMs(e);
        onTick?.(e);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [status, onTick]);

  const start = async () => {
    if (!streamRef.current) await attachPreview();
    if (!streamRef.current) return;
    const rec = new LiveRecorder(streamRef.current, {
      onStatusChange: setStatus,
      onChunkUploaded: (c: LiveChunk, total) => {
        setChunkCount((n) => n + 1);
        setTotalBytes((b) => b + c.size);
        void total;
      },
      onError: (err) => toast.error(`Grabación: ${err.message}`),
    });
    recorderRef.current = rec;
    try {
      await rec.start(matchId);
      startedRef.current = rec.getStartedAtMs();
      if (startedRef.current != null) onStarted(startedRef.current);
      toast.success("REC iniciado");
    } catch (e) {
      toast.error((e as Error).message);
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

  const isRec = status === "recording" || status === "paused" || status === "finalizing";

  const mm = Math.floor(elapsedMs / 60000);
  const ss = Math.floor((elapsedMs % 60000) / 1000);
  const cs = Math.floor((elapsedMs % 1000) / 10);
  const clock = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;

  return (
    <div className="bg-black rounded-lg overflow-hidden border border-border flex flex-col">
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-contain" />
        {isRec && (
          <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur">
            <span className={`inline-block size-2 rounded-full bg-red-500 ${status === "recording" ? "animate-pulse" : ""}`} />
            <span className="text-xs font-bold text-white tabular-nums">{clock}</span>
            <span className="text-[10px] text-white/70">{chunkCount} chunks · {(totalBytes / 1e6).toFixed(1)} MB</span>
          </div>
        )}
        {status === "idle" && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/60 text-[10px] text-white/80">Vista previa</div>
        )}
      </div>

      <div className="p-2 flex flex-wrap items-center gap-2 bg-card/40">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Camera className="size-4 text-muted-foreground" />
          <select
            value={deviceId ?? ""}
            onChange={(e) => setDeviceId(e.target.value || undefined)}
            disabled={isRec}
            className="text-xs bg-background border border-border rounded px-2 py-1 flex-1 min-w-0 truncate"
          >
            {devices.length === 0 && <option value="">Sin cámaras detectadas</option>}
            {devices.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Cámara ${i + 1}`}
              </option>
            ))}
          </select>
          <Button size="sm" variant="ghost" onClick={() => void listVideoInputDevices().then(setDevices)} title="Actualizar dispositivos">
            <RefreshCcw className="size-3" />
          </Button>
          <label className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} disabled={isRec} />
            Audio
          </label>
        </div>

        {!isRec ? (
          <Button size="sm" onClick={start} className="bg-red-600 hover:bg-red-700 text-white">
            <Circle className="size-3 mr-1 fill-white" /> REC
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={togglePause}>
              {status === "paused" ? <Play className="size-3" /> : <Pause className="size-3" />}
            </Button>
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="size-3 mr-1 fill-white" /> Stop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
