import { supabase } from "@/integrations/supabase/client";
import type { VideoMark, VideoMarkKind } from "@/lib/video-marks";

const BUCKET = "match-videos";

export interface VirtualClip {
  id: string;
  mark: VideoMark;
  startMs: number;
  endMs: number;
  label: string;
}

export interface StoredClip {
  path: string;
  name: string;
  createdAt: string;
  size: number;
}

export function clipsFromMarks(
  marks: VideoMark[],
  opts: { prerollSec: number; postrollSec: number },
): VirtualClip[] {
  return marks.map((m) => {
    const startMs = Math.max(0, m.tMs - opts.prerollSec * 1000);
    const endMs = m.tMs + opts.postrollSec * 1000;
    const who = m.playerName ? `#${m.playerNumber ?? "?"} ${m.playerName}` : m.team ?? "—";
    return {
      id: m.id,
      mark: m,
      startMs,
      endMs,
      label: `${m.fundamento}${m.result ? ` · ${m.result}` : ""} — ${who}`,
    };
  });
}

/**
 * Reproduce un clip virtual: hace seek al inicio, arranca el video y
 * dispara pause al final. Devuelve un cancel() para detener temprano.
 */
export function playVirtualClip(
  video: HTMLVideoElement,
  startMs: number,
  endMs: number,
): () => void {
  video.currentTime = Math.max(0, startMs / 1000);
  void video.play().catch(() => undefined);
  const durationMs = Math.max(500, endMs - startMs);
  const timer = window.setTimeout(() => {
    try { video.pause(); } catch { /* noop */ }
  }, durationMs + 150);
  return () => window.clearTimeout(timer);
}

/**
 * Recorta un fragmento del <video> actual mediante captureStream +
 * MediaRecorder. Devuelve un Blob .webm. Solo funciona con video local /
 * archivo (no YouTube, no MediaStream compartido en vivo).
 */
export async function recordClipFromVideo(
  video: HTMLVideoElement,
  startSec: number,
  endSec: number,
): Promise<Blob> {
  if (typeof (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream !== "function") {
    throw new Error("El navegador no permite capturar el stream del video. Usá Chrome/Edge.");
  }
  const durationSec = Math.max(0.5, endSec - startSec);
  video.currentTime = Math.max(0, startSec);
  await new Promise<void>((resolve) => {
    const onSeeked = () => { video.removeEventListener("seeked", onSeeked); resolve(); };
    video.addEventListener("seeked", onSeeked);
  });

  const stream = (video as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    recorder.onerror = (e) => reject((e as ErrorEvent).error ?? new Error("MediaRecorder error"));
  });

  recorder.start(250);
  void video.play().catch(() => undefined);
  await new Promise((r) => window.setTimeout(r, durationSec * 1000 + 200));
  try { recorder.stop(); } catch { /* noop */ }
  try { video.pause(); } catch { /* noop */ }
  return done;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function uploadClip(matchId: string, blob: Blob, hintName: string): Promise<string> {
  const safe = hintName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${matchId}/clips/${Date.now()}_${safe}.webm`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "video/webm",
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

export async function listStoredClips(matchId: string): Promise<StoredClip[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(`${matchId}/clips`, {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) return [];
  return (data ?? [])
    .filter((f) => f.name.endsWith(".webm"))
    .map((f) => ({
      path: `${matchId}/clips/${f.name}`,
      name: f.name,
      createdAt: (f as { created_at?: string }).created_at ?? "",
      size: (f as { metadata?: { size?: number } }).metadata?.size ?? 0,
    }));
}

export async function getSignedClipUrl(path: string, ttlSec = 600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, ttlSec);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteStoredClip(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

export const KIND_LABELS_ES: Partial<Record<VideoMarkKind, string>> = {
  serve: "Saque",
  reception: "Recepción",
  attack: "Ataque",
  block: "Bloqueo",
  defense: "Defensa",
  error: "Error",
  point: "Punto",
};
