// Cliente de grabación en vivo — captura webcam/HDMI/USB con MediaRecorder,
// sube chunks de 5s a match-videos/live/{matchId}/{sessionId}/{idx}.webm
// y mantiene el manifiesto en public.live_recordings.
import { supabase } from "@/integrations/supabase/client";
import { upsertMatchVideoUpload } from "@/hooks/use-match-video";

export type LiveStatus = "idle" | "starting" | "recording" | "paused" | "finalizing" | "error";

export interface LiveChunk {
  index: number;
  path: string;
  size: number;
  startedAtMs: number; // ms desde recordingStartedAt
  durationMs: number;
}

export interface LiveSession {
  id: string; // row id de live_recordings
  sessionId: string;
  matchId: string;
  ownerId: string;
  storagePrefix: string;
  startedAt: number; // performance.now() cuando arrancó REC
  startedWallClock: number; // Date.now()
}

const BUCKET = "match-videos";
const CHUNK_MS = 5000;

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

export async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    // Need a temp permission grant to get labeled devices.
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null);
    const all = await navigator.mediaDevices.enumerateDevices();
    tmp?.getTracks().forEach((t) => t.stop());
    return all.filter((d) => d.kind === "videoinput");
  } catch {
    return [];
  }
}

export async function openStream(opts: { deviceId?: string; audio: boolean }): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({
    video: opts.deviceId ? { deviceId: { exact: opts.deviceId } } : true,
    audio: opts.audio,
  });
}

export interface LiveRecorderCallbacks {
  onChunkUploaded?: (chunk: LiveChunk, totalMs: number) => void;
  onChunkRecorded?: (bufferedBytes: number, bufferedMs: number) => void;
  onError?: (err: Error) => void;
  onStatusChange?: (status: LiveStatus) => void;
}

export class LiveRecorder {
  private mr: MediaRecorder | null = null;
  private stream: MediaStream;
  private session: LiveSession | null = null;
  private chunks: LiveChunk[] = [];
  private localBlobs: Blob[] = [];
  private nextIdx = 0;
  private uploadQueue: Promise<void> = Promise.resolve();
  private mime: string;
  private status: LiveStatus = "idle";
  private cb: LiveRecorderCallbacks;
  private saveLocal: boolean;
  private fileHandle: FileSystemFileHandle | null = null;
  private fileWriter: FileSystemWritableFileStream | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private cloudEnabled = true;

  constructor(stream: MediaStream, cb: LiveRecorderCallbacks = {}, opts: { saveLocal?: boolean; fileHandle?: FileSystemFileHandle | null } = {}) {
    this.stream = stream;
    this.cb = cb;
    this.mime = pickMime();
    this.saveLocal = opts.saveLocal ?? true;
    this.fileHandle = opts.fileHandle ?? null;
  }

  getStatus() { return this.status; }
  getChunks() { return [...this.chunks]; }
  getSession() { return this.session; }
  getMime() { return this.mime; }
  getStartedAtMs(): number | null { return this.session?.startedAt ?? null; }

  private setStatus(s: LiveStatus) {
    this.status = s;
    this.cb.onStatusChange?.(s);
  }

  async start(matchId: string) {
    if (this.status !== "idle") throw new Error("Recorder ya iniciado");
    this.setStatus("starting");

    const sessionId = crypto.randomUUID();
    const storagePrefix = `live/${matchId}/${sessionId}`;
    const startedWallClock = Date.now();
    let ownerId = "local";
    let rowId: string = sessionId;

    // Cloud session (best-effort — si falla, seguimos grabando local)
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error("sin sesión");
      const { data: row, error } = await supabase
        .from("live_recordings")
        .insert({
          match_id: matchId,
          session_id: sessionId,
          owner_id: user.id,
          status: "active",
          storage_prefix: storagePrefix,
          chunk_manifest: [],
        })
        .select("*")
        .single();
      if (error || !row) throw new Error(error?.message ?? "insert falló");
      ownerId = user.id;
      rowId = row.id as string;
    } catch (e) {
      console.warn("[LiveRecorder] cloud deshabilitado, grabando solo local:", (e as Error).message);
      this.cloudEnabled = false;
    }

    // Abrir writer al archivo local si nos dieron un handle
    if (this.fileHandle) {
      try {
        this.fileWriter = await this.fileHandle.createWritable();
      } catch (e) {
        console.warn("[LiveRecorder] no se pudo abrir writer local:", e);
        this.fileWriter = null;
      }
    }

    this.session = {
      id: rowId,
      sessionId,
      matchId,
      ownerId,
      storagePrefix,
      startedAt: performance.now(),
      startedWallClock,
    };

    this.mr = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 2_500_000 });
    this.mr.ondataavailable = (ev) => {
      if (!ev.data || ev.data.size === 0 || !this.session) return;
      const idx = this.nextIdx++;
      const chunkStartMs = idx * CHUNK_MS;
      if (this.saveLocal && !this.fileWriter) this.localBlobs.push(ev.data);
      if (this.fileWriter) this.enqueueLocalWrite(ev.data);
      if (this.cloudEnabled) this.enqueueUpload(idx, ev.data, chunkStartMs);
      else this.cb.onChunkUploaded?.({ index: idx, path: "", size: ev.data.size, startedAtMs: chunkStartMs, durationMs: CHUNK_MS }, chunkStartMs + CHUNK_MS);
    };
    this.mr.onerror = (ev) => {
      const err = (ev as unknown as { error?: Error }).error ?? new Error("MediaRecorder error");
      this.setStatus("error");
      this.cb.onError?.(err);
    };
    this.mr.start(CHUNK_MS);
    this.setStatus("recording");
  }

  private enqueueLocalWrite(blob: Blob) {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.fileWriter) return;
      try { await this.fileWriter.write(blob); }
      catch (e) { console.warn("[LiveRecorder] write local falló", e); }
    });
  }

  private enqueueUpload(idx: number, blob: Blob, startedAtMs: number) {
    this.uploadQueue = this.uploadQueue.then(async () => {
      if (!this.session) return;
      const ext = this.mime.includes("mp4") ? "mp4" : "webm";
      const path = `${this.session.storagePrefix}/${String(idx).padStart(5, "0")}.${ext}`;
      try {
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
          contentType: this.mime,
          upsert: true,
          cacheControl: "3600",
        });
        if (error) throw error;
        const chunk: LiveChunk = {
          index: idx,
          path,
          size: blob.size,
          startedAtMs,
          durationMs: CHUNK_MS,
        };
        this.chunks.push(chunk);
        const totalMs = Math.max(...this.chunks.map((c) => c.startedAtMs + c.durationMs), 0);
        // Persist manifest (best-effort)
        await supabase.from("live_recordings")
          .update({
            chunk_count: this.chunks.length,
            duration_ms: totalMs,
            chunk_manifest: this.chunks as never,
          })
          .eq("id", this.session.id);
        this.cb.onChunkUploaded?.(chunk, totalMs);

      } catch (err) {
        console.error("[LiveRecorder] upload chunk failed", err);
        this.cb.onError?.(err as Error);
      }
    });
  }

  pause() {
    if (this.mr?.state === "recording") { this.mr.pause(); this.setStatus("paused"); }
  }
  resume() {
    if (this.mr?.state === "paused") { this.mr.resume(); this.setStatus("recording"); }
  }

  async stop(): Promise<{ mainPath: string | null; chunks: LiveChunk[] }> {
    if (!this.mr || !this.session) return { mainPath: null, chunks: [] };
    this.setStatus("finalizing");
    await new Promise<void>((resolve) => {
      this.mr!.onstop = () => resolve();
      if (this.mr!.state !== "inactive") this.mr!.stop();
      else resolve();
    });
    // Wait for pending uploads y writes locales
    await this.uploadQueue;
    await this.writeQueue;

    const totalMs = Math.max(...this.chunks.map((c) => c.startedAtMs + c.durationMs), 0);
    const mainPath = this.chunks[0]?.path ?? null;

    if (this.cloudEnabled) {
      await supabase.from("live_recordings")
        .update({
          status: "finalized",
          ended_at: new Date().toISOString(),
          duration_ms: totalMs,
          chunk_count: this.chunks.length,
          chunk_manifest: this.chunks as never,
        })
        .eq("id", this.session.id);
    }


    // Registrar como video del partido apuntando al primer chunk (Tanda 2: reproducción concatenada).
    if (mainPath && this.cloudEnabled) {
      try { await upsertMatchVideoUpload(this.session.matchId, mainPath); }
      catch (e) { console.warn("[LiveRecorder] upsertMatchVideoUpload", e); }
    }

    // Cerrar archivo local (si el usuario eligió ubicación con showSaveFilePicker)
    if (this.fileWriter) {
      try { await this.fileWriter.close(); }
      catch (e) { console.warn("[LiveRecorder] close writer local falló", e); }
      this.fileWriter = null;
    }

    // Fallback: descargar copia si NO usamos File System Access API
    if (this.saveLocal && this.localBlobs.length > 0) {
      try {
        const ext = this.mime.includes("mp4") ? "mp4" : "webm";
        const full = new Blob(this.localBlobs, { type: this.mime });
        const url = URL.createObjectURL(full);
        const a = document.createElement("a");
        const ts = new Date(this.session.startedWallClock).toISOString().replace(/[:.]/g, "-");
        a.href = url;
        a.download = `rally-live-${this.session.matchId}-${ts}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        console.warn("[LiveRecorder] descarga local falló", e);
      }
    }

    this.stream.getTracks().forEach((t) => t.stop());
    this.setStatus("idle");
    return { mainPath, chunks: [...this.chunks] };
  }
}
