/**
 * Video source providers — capa común usada por el reproductor de Scouting.
 *
 * Cada provider expone `open()` y devuelve un `VideoSource` con la misma
 * forma, para que el resto del sistema (scout, timeline, clips, sync) no
 * dependa del origen (archivo local, cámara, ventana o pantalla).
 */

export type VideoSourceKind = "file" | "camera" | "window" | "screen" | "linked";

export interface VideoSourceMeta {
  width?: number;
  height?: number;
  frameRate?: number;
  deviceLabel?: string;
  displaySurface?: string;
  fileName?: string;
}

export interface VideoSource {
  id: string;
  kind: VideoSourceKind;
  /** Etiqueta legible: "Archivo local · partido.mp4", "Cámara Logitech C920", "Ventana compartida (Chrome)". */
  label: string;
  src?: string | null;
  stream?: MediaStream | null;
  meta: VideoSourceMeta;
  /** Suscribe al evento "captura interrumpida" (track ended). Devuelve unsubscriber. */
  onEnded: (cb: () => void) => () => void;
  stop: () => void;
}

function makeId() {
  return `vs_${Math.random().toString(36).slice(2, 9)}`;
}

function extractStreamMeta(stream: MediaStream): VideoSourceMeta {
  const track = stream.getVideoTracks()[0];
  if (!track) return {};
  const s = track.getSettings();
  return {
    width: s.width,
    height: s.height,
    frameRate: s.frameRate,
    deviceLabel: track.label || undefined,
    displaySurface: (s as MediaTrackSettings & { displaySurface?: string }).displaySurface,
  };
}

function attachEnded(stream: MediaStream): (cb: () => void) => () => void {
  return (cb: () => void) => {
    const track = stream.getVideoTracks()[0];
    if (!track) return () => undefined;
    const handler = () => cb();
    track.addEventListener("ended", handler);
    return () => track.removeEventListener("ended", handler);
  };
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((t) => t.stop());
}

// ---------- Local file ----------
export function openLocalFile(file: File): VideoSource {
  const url = URL.createObjectURL(file);
  return {
    id: makeId(),
    kind: "file",
    label: `Archivo local · ${file.name}`,
    src: url,
    stream: null,
    meta: { fileName: file.name },
    onEnded: () => () => undefined,
    stop: () => URL.revokeObjectURL(url),
  };
}

// ---------- Camera ----------
export interface CameraOpts { deviceId?: string; audio?: boolean }
export async function openCamera(opts: CameraOpts = {}): Promise<VideoSource> {
  const constraints: MediaStreamConstraints = {
    video: opts.deviceId ? { deviceId: { exact: opts.deviceId } } : true,
    audio: !!opts.audio,
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const meta = extractStreamMeta(stream);
  return {
    id: makeId(),
    kind: "camera",
    label: meta.deviceLabel ? `Cámara ${meta.deviceLabel}` : "Cámara",
    src: null,
    stream,
    meta,
    onEnded: attachEnded(stream),
    stop: () => stopStream(stream),
  };
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === "videoinput");
  } catch {
    return [];
  }
}

// ---------- Display (window / screen) ----------
async function openDisplay(surface: "window" | "monitor", audio: boolean): Promise<MediaStream> {
  const md = navigator.mediaDevices as MediaDevices & {
    getDisplayMedia?: (o?: MediaStreamConstraints & { video?: { displaySurface?: string } | boolean }) => Promise<MediaStream>;
  };
  if (typeof md.getDisplayMedia !== "function") {
    throw new Error("Este navegador no permite capturar pantalla/ventana.");
  }
  return md.getDisplayMedia({
    video: { displaySurface: surface },
    audio,
  } as MediaStreamConstraints);
}

function humanizeDisplayLabel(track: MediaStreamTrack, surface: "window" | "monitor"): string {
  const raw = (track.label || "").trim();
  // Chrome expone algo como "web-contents-media-stream://…" o el título real si el usuario lo permite.
  if (raw && !raw.startsWith("web-contents-media-stream")) return raw;
  return surface === "window" ? "Ventana compartida" : "Pantalla compartida";
}

export async function openWindow(audio = true): Promise<VideoSource> {
  const stream = await openDisplay("window", audio);
  const track = stream.getVideoTracks()[0]!;
  const meta = extractStreamMeta(stream);
  return {
    id: makeId(),
    kind: "window",
    label: humanizeDisplayLabel(track, "window"),
    src: null,
    stream,
    meta,
    onEnded: attachEnded(stream),
    stop: () => stopStream(stream),
  };
}

export async function openScreen(audio = true): Promise<VideoSource> {
  const stream = await openDisplay("monitor", audio);
  const track = stream.getVideoTracks()[0]!;
  const meta = extractStreamMeta(stream);
  return {
    id: makeId(),
    kind: "screen",
    label: humanizeDisplayLabel(track, "monitor"),
    src: null,
    stream,
    meta,
    onEnded: attachEnded(stream),
    stop: () => stopStream(stream),
  };
}

// ---------- Linked (video ya asociado al partido) ----------
export function openLinked(src: string, label = "Video vinculado"): VideoSource {
  return {
    id: makeId(),
    kind: "linked",
    label,
    src,
    stream: null,
    meta: {},
    onEnded: () => () => undefined,
    stop: () => undefined,
  };
}
