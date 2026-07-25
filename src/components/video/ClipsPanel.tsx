import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Download, Cloud, Trash2, Film, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { MARK_COLORS, MARK_LABEL, type VideoMark, type VideoMarkKind } from "@/lib/video-marks";
import {
  clipsFromMarks,
  playVirtualClip,
  recordClipFromVideo,
  uploadClip,
  downloadBlob,
  listStoredClips,
  getSignedClipUrl,
  deleteStoredClip,
  type StoredClip,
} from "@/lib/clips";

interface Props {
  matchId: string;
  marks: VideoMark[];
  playerRef: RefObject<VideoPlayerHandle | null>;
  disabled?: boolean;
  disabledReason?: string;
}

const CLIP_KINDS: VideoMarkKind[] = ["serve", "reception", "attack", "block", "defense", "error", "point"];

function fmt(t: number) {
  const s = Math.max(0, Math.round(t));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function ClipsPanel({ matchId, marks, playerRef, disabled, disabledReason }: Props) {
  const [preroll, setPreroll] = useState(4);
  const [postroll, setPostroll] = useState(6);
  const [kinds, setKinds] = useState<Set<VideoMarkKind>>(new Set(CLIP_KINDS));
  const [stored, setStored] = useState<StoredClip[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");

  const filteredMarks = useMemo(() => marks.filter((m) => kinds.has(m.kind)), [marks, kinds]);
  const clips = useMemo(
    () => clipsFromMarks(filteredMarks, { prerollSec: preroll, postrollSec: postroll }),
    [filteredMarks, preroll, postroll],
  );

  const refreshStored = async () => {
    setLoadingList(true);
    try { setStored(await listStoredClips(matchId)); }
    finally { setLoadingList(false); }
  };

  useEffect(() => { void refreshStored(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [matchId]);

  const play = (startMs: number, endMs: number) => {
    const v = playerRef.current?.getVideoElement();
    if (!v) { toast.error("El reproductor no está listo"); return; }
    playVirtualClip(v, startMs, endMs);
  };

  const exportClip = async (id: string, startMs: number, endMs: number, label: string) => {
    if (disabled) { toast.error(disabledReason ?? "Exportación no disponible"); return; }
    const v = playerRef.current?.getVideoElement();
    if (!v) { toast.error("El reproductor no está listo"); return; }
    setExportingId(id);
    const loading = toast.loading(`Grabando clip (${Math.round((endMs - startMs) / 1000)}s)…`);
    try {
      const blob = await recordClipFromVideo(v, startMs / 1000, endMs / 1000);
      const hint = label.slice(0, 40).replace(/\s+/g, "-");
      downloadBlob(blob, `${hint}-${Date.now()}.webm`);
      try {
        await uploadClip(matchId, blob, hint);
        toast.success("Clip exportado y guardado en la nube", { id: loading });
        void refreshStored();
      } catch (e) {
        console.warn("Upload clip failed", e);
        toast.success("Clip descargado. No pude subirlo a la nube.", { id: loading });
      }
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || "No se pudo exportar el clip", { id: loading });
    } finally {
      setExportingId(null);
    }
  };

  const openStored = async (path: string, name: string) => {
    const url = await getSignedClipUrl(path);
    if (!url) { toast.error("No se pudo abrir el clip"); return; }
    setPreviewUrl(url);
    setPreviewName(name);
  };

  const removeStored = async (path: string) => {
    if (!confirm("¿Eliminar este clip guardado?")) return;
    await deleteStoredClip(path);
    toast.success("Clip eliminado");
    void refreshStored();
  };

  return (
    <div className="bg-card/40 border border-border rounded-lg">
      <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Film className="size-3.5" /> Clips
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{clips.length} auto · {stored.length} guardados</span>
      </div>

      <div className="p-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Ajustes */}
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Preroll <span className="text-foreground tabular-nums">{preroll}s</span></div>
            <Slider value={[preroll]} min={0} max={15} step={1} onValueChange={(v) => setPreroll(v[0] ?? 4)} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Postroll <span className="text-foreground tabular-nums">{postroll}s</span></div>
            <Slider value={[postroll]} min={1} max={20} step={1} onValueChange={(v) => setPostroll(v[0] ?? 6)} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Tipos</div>
            <div className="flex flex-wrap gap-1">
              {CLIP_KINDS.map((k) => {
                const on = kinds.has(k);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      const next = new Set(kinds);
                      if (on) next.delete(k); else next.add(k);
                      setKinds(next);
                    }}
                    className="text-[10px] px-2 py-1 rounded border transition-colors"
                    style={{
                      borderColor: MARK_COLORS[k],
                      background: on ? MARK_COLORS[k] + "33" : "transparent",
                      color: on ? "white" : "var(--color-muted-foreground)",
                    }}
                  >{MARK_LABEL[k]}</button>
                );
              })}
            </div>
          </div>
          {disabled && (
            <div className="text-[11px] text-amber-400/90 border border-amber-400/30 bg-amber-400/10 rounded px-2 py-1">
              {disabledReason ?? "Exportar requiere un video local o subido (no YouTube)."} Reproducir sí funciona.
            </div>
          )}
        </div>

        {/* Auto clips */}
        <div className="min-h-[200px] max-h-[380px] overflow-y-auto rounded border border-border/50">
          {clips.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No hay acciones registradas todavía.</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {clips.map((c) => {
                const dur = Math.round((c.endMs - c.startMs) / 1000);
                return (
                  <li key={c.id} className="px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-primary/5">
                    <span className="w-1 h-6 rounded-sm shrink-0" style={{ background: MARK_COLORS[c.mark.kind] }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{c.label}</div>
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        {fmt(c.startMs / 1000)}–{fmt(c.endMs / 1000)} · {dur}s · Set {c.mark.setNumber} · {c.mark.score}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => play(c.startMs, c.endMs)} title="Reproducir">
                      <Play className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={exportingId === c.id || disabled}
                      onClick={() => void exportClip(c.id, c.startMs, c.endMs, c.label)}
                      title="Exportar y guardar"
                    >
                      {exportingId === c.id ? <RefreshCw className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Guardados */}
      <div className="border-t border-border/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Cloud className="size-3.5" /> Guardados en la nube
          </div>
          <Button size="sm" variant="ghost" onClick={() => void refreshStored()} disabled={loadingList}>
            <RefreshCw className={`size-3.5 mr-1 ${loadingList ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
        {stored.length === 0 ? (
          <div className="text-xs text-muted-foreground">Todavía no exportaste ningún clip.</div>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {stored.map((s) => (
              <li key={s.path} className="text-xs flex items-center gap-2 bg-background/40 border border-border/40 rounded px-2 py-1.5">
                <Film className="size-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground">{(s.size / 1024 / 1024).toFixed(1)} MB</div>
                </div>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => void openStored(s.path, s.name)} title="Ver">
                  <Play className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={() => void removeStored(s.path)} title="Eliminar">
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="w-full max-w-3xl bg-card border border-border rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <div className="text-sm truncate">{previewName}</div>
              <Button size="sm" variant="ghost" onClick={() => setPreviewUrl(null)}>Cerrar</Button>
            </div>
            <video src={previewUrl} controls autoPlay className="w-full aspect-video bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}
