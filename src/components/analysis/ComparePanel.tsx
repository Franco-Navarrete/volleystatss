/**
 * ComparePanel — dos clips lado a lado, sincronizados.
 * Reproducción / pausa / velocidad / frame-a-frame conjuntos.
 * Sin dependencias externas: usa <video> nativo (aplica también a MP4 firmados).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, ChevronsLeft, ChevronsRight, Link2 } from "lucide-react";
import type { Clip } from "@/lib/analysis/clip-service";

interface Props {
  clips: Clip[];
  videoSrc: string | null;
  isYouTube: boolean;
}

export function ComparePanel({ clips, videoSrc, isYouTube }: Props) {
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [synced, setSynced] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const refA = useRef<HTMLVideoElement | null>(null);
  const refB = useRef<HTMLVideoElement | null>(null);

  const A = useMemo(() => clips.find((c) => c.id === aId) ?? null, [clips, aId]);
  const B = useMemo(() => clips.find((c) => c.id === bId) ?? null, [clips, bId]);

  // Seek both to their clip start on selection change.
  useEffect(() => {
    if (refA.current && A) refA.current.currentTime = A.inicioClipMs / 1000;
  }, [A?.id]);
  useEffect(() => {
    if (refB.current && B) refB.current.currentTime = B.inicioClipMs / 1000;
  }, [B?.id]);

  // Apply speed / play state.
  useEffect(() => {
    [refA.current, refB.current].forEach((v) => {
      if (!v) return;
      v.playbackRate = speed;
    });
  }, [speed]);

  const both = (fn: (v: HTMLVideoElement) => void) => {
    if (refA.current) fn(refA.current);
    if (refB.current) fn(refB.current);
  };

  const togglePlay = () => {
    if (playing) {
      both((v) => v.pause());
      setPlaying(false);
    } else {
      both((v) => void v.play().catch(() => undefined));
      setPlaying(true);
    }
  };
  const frame = (dir: -1 | 1) => {
    both((v) => {
      v.pause();
      v.currentTime = Math.max(0, v.currentTime + dir * (1 / 30));
    });
    setPlaying(false);
  };

  if (isYouTube) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
        La comparación lado a lado no está disponible para fuentes YouTube.
        Vincula un archivo MP4 o usa una fuente local para habilitarla.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">Clip A</label>
        <select
          value={aId ?? ""}
          onChange={(e) => setAId(e.target.value || null)}
          className="bg-background/60 border border-border rounded px-2 py-1 text-xs max-w-[240px]"
        >
          <option value="">Seleccionar…</option>
          {clips.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({(c.tMs / 1000).toFixed(0)}s)
            </option>
          ))}
        </select>
        <label className="text-xs text-muted-foreground">Clip B</label>
        <select
          value={bId ?? ""}
          onChange={(e) => setBId(e.target.value || null)}
          className="bg-background/60 border border-border rounded px-2 py-1 text-xs max-w-[240px]"
        >
          <option value="">Seleccionar…</option>
          {clips.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({(c.tMs / 1000).toFixed(0)}s)
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={synced ? "default" : "outline"}
            onClick={() => setSynced((s) => !s)}
          >
            <Link2 className="size-3 mr-1" /> Sync
          </Button>
          <Button size="sm" variant="outline" onClick={() => frame(-1)}>
            <ChevronsLeft className="size-3" />
          </Button>
          <Button size="sm" variant="default" onClick={togglePlay}>
            {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => frame(1)}>
            <ChevronsRight className="size-3" />
          </Button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-background/60 border border-border rounded px-2 py-1 text-xs"
          >
            {[0.25, 0.5, 1, 1.25, 1.5, 2].map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ClipPane
          label="A"
          clip={A}
          videoSrc={videoSrc}
          videoRef={refA}
          onTimeUpdate={(t) => {
            if (!synced || !A || !B || !refB.current) return;
            const delta = t - A.inicioClipMs / 1000;
            const target = B.inicioClipMs / 1000 + delta;
            if (Math.abs(refB.current.currentTime - target) > 0.15) {
              refB.current.currentTime = target;
            }
          }}
        />
        <ClipPane
          label="B"
          clip={B}
          videoSrc={videoSrc}
          videoRef={refB}
        />
      </div>
    </div>
  );
}

function ClipPane({
  label,
  clip,
  videoSrc,
  videoRef,
  onTimeUpdate,
}: {
  label: string;
  clip: Clip | null;
  videoSrc: string | null;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (t: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
      <div className="px-2 py-1 text-xs bg-background/60 border-b border-border flex items-center justify-between">
        <span className="font-semibold">Clip {label}</span>
        <span className="text-muted-foreground truncate">{clip?.title ?? "—"}</span>
      </div>
      <div className="aspect-video bg-black">
        {clip && videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            playsInline
            className="w-full h-full"
            onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">
            Selecciona un clip
          </div>
        )}
      </div>
    </div>
  );
}
