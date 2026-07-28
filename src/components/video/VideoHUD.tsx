import type { VideoSource } from "@/lib/video/providers";
import { AppWindow, Camera, FileVideo, Film, Monitor, Radio, Clock, Activity, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";


interface Props {
  source: VideoSource | null;
  playing?: boolean;
  recStatus?: "idle" | "recording" | "paused" | "finalizing";
  /** Tiempo transcurrido a mostrar (ms). Si no se provee, se oculta. */
  elapsedMs?: number;
}

/**
 * Barra superior semitransparente que se superpone al reproductor con
 * información de estado en vivo. Sólo lectura — no despacha eventos.
 */
export function VideoHUD({ source, playing, recStatus = "idle", elapsedMs }: Props) {
  const Icon =
    source?.kind === "camera" ? Camera :
    source?.kind === "window" ? AppWindow :
    source?.kind === "screen" ? Monitor :
    source?.kind === "file" ? FileVideo :
    Film;

  const isRec = recStatus === "recording" || recStatus === "paused" || recStatus === "finalizing";
  const quality = source?.meta.height ? (source.meta.height >= 1080 ? "HD" : source.meta.height >= 720 ? "720p" : "SD") : null;

  return (
    <div className="pointer-events-none absolute top-0 left-0 right-0 p-4 flex flex-col gap-2 bg-gradient-to-b from-black/80 via-black/20 to-transparent">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white">
          <Icon className="size-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider truncate max-w-[200px]">
            {source?.label ?? "Sin fuente"}
          </span>
        </div>

        {isRec && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/90 backdrop-blur-md text-white shadow-lg shadow-red-900/20">
            <span className={`size-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] ${recStatus === "recording" ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-black uppercase tracking-tighter">
              {recStatus === "paused" ? "PAUSADO" : recStatus === "finalizing" ? "FINALIZANDO" : "REC ● LIVE"}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 pointer-events-auto">
          {source?.meta.width && (
            <div className="px-2 py-1 rounded bg-black/40 backdrop-blur text-[10px] font-mono text-white/70 border border-white/5">
              {source.meta.width}x{source.meta.height} {source.meta.frameRate ? `· ${Math.round(source.meta.frameRate)}fps` : ""}
            </div>
          )}
          {quality && (
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] font-black tracking-widest px-1.5 py-0 h-5">
              {quality}
            </Badge>
          )}
        </div>
      </div>
      
      {typeof elapsedMs === "number" && (
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-xl">
            <Clock className="size-3 text-primary" />
            <span className="text-sm font-black scoreboard-digit tabular-nums text-white">
              {formatClock(elapsedMs)}
            </span>
          </div>
          <div className="px-2 py-1 rounded bg-black/40 backdrop-blur text-[9px] font-bold text-white/50 uppercase tracking-widest">
            Tiempo de sesión
          </div>
        </div>
      )}
    </div>
  );
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
