import type { VideoSource } from "@/lib/video/providers";
import { AppWindow, Camera, FileVideo, Film, Monitor } from "lucide-react";

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
    <div className="pointer-events-none absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white text-[11px]">
        <Icon className="size-3.5" />
        <span className="font-medium truncate max-w-[220px]">{source?.label ?? "Sin fuente"}</span>
      </div>

      {isRec && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-600/90 backdrop-blur text-white text-[11px] font-bold uppercase tracking-wide">
          <span className={`size-2 rounded-full bg-white ${recStatus === "recording" ? "animate-pulse" : ""}`} />
          {recStatus === "paused" ? "Pausado" : recStatus === "finalizing" ? "Finalizando" : "REC"}
        </div>
      )}

      {!isRec && source && (
        <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white/80 text-[11px]">
          {playing ? "Reproduciendo" : "Pausado"}
        </div>
      )}

      {typeof elapsedMs === "number" && (
        <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[11px] tabular-nums font-semibold">
          {formatClock(elapsedMs)}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {source?.meta.width && source?.meta.height && (
          <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white/80 text-[10px] tabular-nums">
            {source.meta.width}×{source.meta.height}
            {source.meta.frameRate ? ` · ${Math.round(source.meta.frameRate)}fps` : ""}
          </div>
        )}
        {quality && (
          <div className="px-2 py-1 rounded-full bg-emerald-600/80 backdrop-blur text-white text-[10px] font-bold">
            {quality}
          </div>
        )}
      </div>
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
