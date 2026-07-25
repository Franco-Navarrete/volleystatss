import { useCallback, useEffect, useRef, useState } from "react";
import {
  openCamera,
  openLinked,
  openLocalFile,
  openScreen,
  openWindow,
  type VideoSource,
  type VideoSourceKind,
} from "@/lib/video/providers";
import { toast } from "sonner";

export type SourceStatus = "idle" | "active" | "interrupted";

export interface OpenOptions {
  file?: File;
  cameraDeviceId?: string;
  audio?: boolean;
  linkedSrc?: string;
  linkedLabel?: string;
}

/**
 * Administra la fuente de video activa del reproductor Scouting.
 * - Reemplaza la fuente en caliente sin destruir el store del scout.
 * - Detecta cuando el usuario cierra la compartición (track ended) y marca
 *   `status = "interrupted"` para ofrecer un botón "Reconectar".
 */
export function useVideoSource() {
  const [source, setSource] = useState<VideoSource | null>(null);
  const [status, setStatus] = useState<SourceStatus>("idle");
  const lastKindRef = useRef<VideoSourceKind | null>(null);
  const lastOptsRef = useRef<OpenOptions>({});
  const unsubEndedRef = useRef<(() => void) | null>(null);

  const cleanupPrev = useCallback(() => {
    unsubEndedRef.current?.();
    unsubEndedRef.current = null;
  }, []);

  const stopCurrent = useCallback(() => {
    cleanupPrev();
    setSource((prev) => {
      prev?.stop();
      return null;
    });
    setStatus("idle");
  }, [cleanupPrev]);

  const setActive = useCallback((next: VideoSource) => {
    cleanupPrev();
    setSource((prev) => {
      if (prev && prev.id !== next.id) prev.stop();
      return next;
    });
    setStatus("active");
    unsubEndedRef.current = next.onEnded(() => {
      // La compartición se cortó desde el navegador: NO destruimos el store,
      // sólo marcamos interrupción para mostrar el botón "Reconectar".
      setStatus("interrupted");
      toast.warning("Captura interrumpida — reconectá para continuar.");
    });
  }, [cleanupPrev]);

  const open = useCallback(async (kind: VideoSourceKind, opts: OpenOptions = {}) => {
    lastKindRef.current = kind;
    lastOptsRef.current = opts;
    try {
      let next: VideoSource;
      switch (kind) {
        case "file":
          if (!opts.file) throw new Error("Archivo no provisto");
          next = openLocalFile(opts.file);
          break;
        case "camera":
          next = await openCamera({ deviceId: opts.cameraDeviceId, audio: opts.audio });
          break;
        case "window":
          next = await openWindow(opts.audio ?? true);
          break;
        case "screen":
          next = await openScreen(opts.audio ?? true);
          break;
        case "linked":
          if (!opts.linkedSrc) throw new Error("Sin video vinculado");
          next = openLinked(opts.linkedSrc, opts.linkedLabel);
          break;
        default:
          throw new Error(`Fuente desconocida: ${kind}`);
      }
      setActive(next);
      return next;
    } catch (err) {
      const e = err as Error & { name?: string };
      if (e?.name === "NotAllowedError") {
        toast.error("Permiso denegado.");
      } else if (e?.name !== "AbortError") {
        toast.error(e.message || "No se pudo abrir la fuente.");
      }
      return null;
    }
  }, [setActive]);

  const reconnect = useCallback(async () => {
    const kind = lastKindRef.current;
    if (!kind) return null;
    return open(kind, lastOptsRef.current);
  }, [open]);

  useEffect(() => () => {
    unsubEndedRef.current?.();
    // No detenemos el stream al desmontar si sigue vivo en el player;
    // el player mismo hace cleanup vía srcObject=null. El stop explícito lo
    // hace stopCurrent() o el reemplazo por otra fuente.
  }, []);

  return { source, status, open, reconnect, stop: stopCurrent };
}
