import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppWindow, Camera, FileVideo, Film, Monitor, RefreshCw, Video } from "lucide-react";
import { listCameras, type VideoSource, type VideoSourceKind } from "@/lib/video/providers";

interface Props {
  /** Fuente activa actualmente (para el chip de estado). */
  current: VideoSource | null;
  /** Si el partido tiene un video vinculado disponible. */
  hasLinked?: boolean;
  /** Etiqueta de "Cambiar fuente" (por defecto). */
  buttonLabel?: string;
  onPick: (kind: VideoSourceKind, opts: { file?: File; cameraDeviceId?: string }) => void;
  disabled?: boolean;
}

/**
 * Selector unificado de fuente de video.
 * Un único botón "Cambiar fuente" que despliega Archivo · Ventana · Pantalla · Cámara.
 */
export function VideoSourcePicker({ current, hasLinked, buttonLabel = "Cambiar fuente", onPick, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    void listCameras().then(setCams);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={disabled} className="h-8">
            <Video className="size-3.5 mr-1.5" />
            {current ? buttonLabel : "Elegir fuente"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Fuente de video
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hasLinked && (
            <DropdownMenuItem onClick={() => onPick("linked", {})}>
              <Film className="size-4 mr-2" /> Video vinculado
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <FileVideo className="size-4 mr-2" /> Archivo local
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPick("window", {})}>
            <AppWindow className="size-4 mr-2" /> Compartir ventana
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPick("screen", {})}>
            <Monitor className="size-4 mr-2" /> Compartir pantalla
          </DropdownMenuItem>
          {cams.length <= 1 ? (
            <DropdownMenuItem onClick={() => onPick("camera", { cameraDeviceId: cams[0]?.deviceId })}>
              <Camera className="size-4 mr-2" /> Cámara
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Camera className="size-4 mr-2" /> Cámara
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {cams.map((c, i) => (
                  <DropdownMenuItem key={c.deviceId || i} onClick={() => onPick("camera", { cameraDeviceId: c.deviceId })}>
                    {c.label || `Cámara ${i + 1}`}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void listCameras().then(setCams)}>
                  <RefreshCw className="size-3.5 mr-2" /> Actualizar dispositivos
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick("file", { file: f });
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Chip visible bajo el reproductor: 🟢 Fuente: <label>.
 */
export function VideoSourceChip({ source, interrupted }: { source: VideoSource | null; interrupted?: boolean }) {
  if (!source) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        Fuente: sin seleccionar
      </div>
    );
  }
  const dot = interrupted ? "bg-yellow-400 animate-pulse" : "bg-emerald-500";
  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className={`size-2 rounded-full ${dot}`} />
      Fuente: <span className="text-foreground font-medium truncate max-w-[320px]">{source.label}</span>
      {source.meta.width && source.meta.height && (
        <span className="text-muted-foreground/70">
          · {source.meta.width}×{source.meta.height}
          {source.meta.frameRate ? ` @ ${Math.round(source.meta.frameRate)}fps` : ""}
        </span>
      )}
    </div>
  );
}
