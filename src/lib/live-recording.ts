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

  constructor(stream: MediaStream, cb: LiveRecorderCallbacks = {}, opts: { saveLocal?: boolean } = {}) {
    this.stream = stream;
    this.cb = cb;
    this.mime = pickMime();
    this.saveLocal = opts.saveLocal ?? true;
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
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error("Inicia sesión para grabar");

    const sessionId = crypto.randomUUID();
    const storagePrefix = `live/${matchId}/${sessionId}`;
    const startedWallClock = Date.now();

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
    if (error || !row) throw new Error(error?.message ?? "No se pudo crear la sesión");

    this.session = {
      id: row.id as string,
      sessionId,
      matchId,
      ownerId: user.id,
      storagePrefix,
      startedAt: performance.now(),
      startedWallClock,
    };

    this.mr = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 2_500_000 });
    this.mr.ondataavailable = (ev) => {
      if (!ev.data || ev.data.size === 0 || !this.session) return;
      const idx = this.nextIdx++;
      const chunkStartMs = idx * CHUNK_MS;
      if (this.saveLocal) this.localBlobs.push(ev.data);
      this.enqueueUpload(idx, ev.data, chunkStartMs);
    };
    this.mr.onerror = (ev) => {
      const err = (ev as unknown as { error?: Error }).error ?? new Error("MediaRecorder error");
      this.setStatus("error");
      this.cb.onError?.(err);
    };
    this.mr.start(CHUNK_MS);
    this.setStatus("recording");
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
    // Wait for pending uploads
    await this.uploadQueue;

    const totalMs = Math.max(...this.chunks.map((c) => c.startedAtMs + c.durationMs), 0);
    const mainPath = this.chunks[0]?.path ?? null;

    await supabase.from("live_recordings")
      .update({
        status: "finalized",
        ended_at: new Date().toISOString(),
        duration_ms: totalMs,
        chunk_count: this.chunks.length,
        chunk_manifest: this.chunks as never,
      })
      .eq("id", this.session.id);


    // Registrar como video del partido apuntando al primer chunk (Tanda 2: reproducción concatenada).
    if (mainPath) {
      try { await upsertMatchVideoUpload(this.session.matchId, mainPath); }
      catch (e) { console.warn("[LiveRecorder] upsertMatchVideoUpload", e); }
    }

    this.stream.getTracks().forEach((t) => t.stop());
    this.setStatus("idle");
    return { mainPath, chunks: [...this.chunks] };
  }
}
