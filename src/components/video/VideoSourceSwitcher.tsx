import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Film, FileVideo, Camera, AppWindow, Monitor, X } from "lucide-react";
import { toast } from "sonner";

export type VideoSourceKind = "linked" | "file" | "camera" | "window" | "screen";

interface Props {
  /** True si el partido tiene un video vinculado disponible (upload/URL). */
  hasLinked: boolean;
  current: VideoSourceKind;
  onChange: (kind: VideoSourceKind, payload: { src?: string | null; stream?: MediaStream | null }) => void;
}

/**
 * Selector de fuente de video para el modo Scouting.
 * - linked: usa el video ya asociado al partido (upload / URL).
 * - file:   archivo local vía <input type="file">.
 * - camera: getUserMedia (webcam / captura HDMI que aparezca como videoinput).
 * - window: getDisplayMedia con hint "window".
 * - screen: getDisplayMedia con hint "monitor".
 *
 * Todas producen un video reproducible dentro del reproductor actual y el
 * scouting sigue usando `player.currentTime` para sincronizar acciones.
 */
export function VideoSourceSwitcher({ hasLinked, current, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const activeObjectUrlRef = useRef<string | null>(null);
  const [busy, setBusy] = useState<VideoSourceKind | null>(null);

  const stopActive = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
    }
    if (activeObjectUrlRef.current) {
      URL.revokeObjectURL(activeObjectUrlRef.current);
      activeObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => stopActive(), [stopActive]);

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    stopActive();
    const url = URL.createObjectURL(f);
    activeObjectUrlRef.current = url;
    onChange("file", { src: url, stream: null });
    toast.success(`Archivo local cargado · ${f.name}`);
    e.target.value = "";
  };

  const openCamera = async () => {
    try {
      setBusy("camera");
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stopActive();
      activeStreamRef.current = s;
      onChange("camera", { src: null, stream: s });
      toast.success("Cámara conectada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo acceder a la cámara. Revisa los permisos.");
    } finally {
      setBusy(null);
    }
  };

  const openDisplay = async (surface: "window" | "monitor") => {
    const md = navigator.mediaDevices as MediaDevices & {
      getDisplayMedia?: (opts?: MediaStreamConstraints & { video?: { displaySurface?: string } | boolean }) => Promise<MediaStream>;
    };
    if (typeof md.getDisplayMedia !== "function") {
      toast.error("Este navegador no soporta compartir pantalla.");
      return;
    }
    try {
      setBusy(surface === "window" ? "window" : "screen");
      const s = await md.getDisplayMedia({
        video: { displaySurface: surface },
        audio: true,
      } as MediaStreamConstraints);
      stopActive();
      activeStreamRef.current = s;
      // Si el usuario detiene desde el chip del navegador, volvemos a "linked" o file.
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (activeStreamRef.current === s) {
          activeStreamRef.current = null;
          onChange(hasLinked ? "linked" : "file", { src: null, stream: null });
          toast.info("Se detuvo la compartición de pantalla.");
        }
      });
      onChange(surface === "window" ? "window" : "screen", { src: null, stream: s });
      toast.success(surface === "window" ? "Ventana compartida" : "Pantalla compartida");
    } catch (err) {
      if ((err as DOMException)?.name !== "NotAllowedError") console.error(err);
      // usuario canceló → no cambiamos nada
    } finally {
      setBusy(null);
    }
  };

  const useLinked = () => {
    stopActive();
    onChange("linked", { src: null, stream: null });
  };

  const Btn = ({
    kind,
    icon,
    label,
    onClick,
    disabled,
  }: {
    kind: VideoSourceKind;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <Button
      size="sm"
      variant={current === kind ? "default" : "outline"}
      onClick={onClick}
      disabled={disabled || busy !== null}
      className="h-8"
      title={label}
    >
      {icon}
      <span className="ml-1 text-xs">{label}</span>
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-card/40 border border-border rounded-lg p-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground pr-1">Fuente</span>
      <Btn kind="linked" icon={<Film className="size-3.5" />} label="Vinculado" onClick={useLinked} disabled={!hasLinked} />
      <Btn kind="file" icon={<FileVideo className="size-3.5" />} label="Archivo" onClick={pickFile} />
      <Btn kind="camera" icon={<Camera className="size-3.5" />} label="Cámara" onClick={openCamera} />
      <Btn kind="window" icon={<AppWindow className="size-3.5" />} label="Ventana" onClick={() => void openDisplay("window")} />
      <Btn kind="screen" icon={<Monitor className="size-3.5" />} label="Pantalla" onClick={() => void openDisplay("monitor")} />
      {(current === "camera" || current === "window" || current === "screen" || current === "file") && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 ml-auto text-xs"
          onClick={useLinked}
          disabled={!hasLinked}
          title="Volver al video vinculado"
        >
          <X className="size-3 mr-1" /> Cerrar fuente
        </Button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onFileChosen}
      />
    </div>
  );
}
