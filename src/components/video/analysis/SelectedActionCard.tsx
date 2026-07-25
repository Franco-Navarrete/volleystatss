/**
 * Tarjeta "Jugada seleccionada" — se muestra bajo el video cuando hay una acción
 * seleccionada. Incluye datos clave y accesos rápidos a los extremos del rally.
 */
import { useMemo } from "react";
import { MARK_COLORS, MARK_LABEL, type VideoMark } from "@/lib/video-marks";
import { useAnalysisStore } from "@/lib/video/analysis-store";
import { Play, Rewind, FastForward, X } from "lucide-react";
import type { VideoPlayerHandle } from "@/components/video/VideoPlayer";

interface Props {
  marks: VideoMark[];
  playerRef: React.RefObject<VideoPlayerHandle | null>;
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function SelectedActionCard({ marks, playerRef }: Props) {
  const selectedMarkId = useAnalysisStore((s) => s.selectedMarkId);
  const selectMark = useAnalysisStore((s) => s.selectMark);
  const prerollMs = useAnalysisStore((s) => s.prerollMs);

  const mark = useMemo(
    () => marks.find((m) => m.id === selectedMarkId) ?? null,
    [marks, selectedMarkId],
  );

  const rally = useMemo(() => {
    if (!mark) return null;
    const rallyMarks = marks.filter((m) => m.rallyId === mark.rallyId);
    if (!rallyMarks.length) return null;
    const startMs = Math.max(0, rallyMarks[0]!.tMs - prerollMs);
    const endMs = rallyMarks[rallyMarks.length - 1]!.tMs + 2000;
    return { startMs, endMs, first: rallyMarks[0]!, last: rallyMarks[rallyMarks.length - 1]! };
  }, [mark, marks, prerollMs]);

  if (!mark) return null;

  const color = MARK_COLORS[mark.kind] ?? "#94a3b8";
  const label = MARK_LABEL[mark.kind] ?? mark.fundamento;

  const seekTo = (ms: number) => playerRef.current?.seekMs(Math.max(0, ms));

  return (
    <div
      className="bg-card border rounded-lg px-3 py-2 flex flex-wrap items-center gap-3 text-xs shadow-elevated"
      style={{ borderColor: color + "88" }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-1 h-8 rounded-sm" style={{ background: color }} />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Jugada seleccionada</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="font-semibold truncate">
              {mark.playerName
                ? `#${mark.playerNumber ?? "?"} ${mark.playerName}`
                : mark.team ?? "—"}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: color + "33", color }}
            >
              {label}
            </span>
            <span className="text-muted-foreground">{mark.result ?? "—"}</span>
            <span className="text-muted-foreground tabular-nums">
              {fmt(mark.tMs)} · Set {mark.setNumber} · Rally #{mark.rallyId + 1}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {rally && (
          <button
            onClick={() => seekTo(rally.startMs)}
            title="Ir al inicio del rally"
            className="h-8 px-2 rounded-md bg-background/60 border border-border/60 hover:border-primary/60 flex items-center gap-1"
          >
            <Rewind className="size-3.5" /> Inicio rally
          </button>
        )}
        <button
          onClick={() => { seekTo(Math.max(0, mark.tMs - prerollMs)); void playerRef.current?.getVideoElement()?.play(); }}
          title="Reproducir clip"
          className="h-8 px-2 rounded-md bg-primary text-primary-foreground hover:brightness-110 flex items-center gap-1"
        >
          <Play className="size-3.5" /> Clip
        </button>
        {rally && (
          <button
            onClick={() => seekTo(rally.endMs)}
            title="Ir al final del rally"
            className="h-8 px-2 rounded-md bg-background/60 border border-border/60 hover:border-primary/60 flex items-center gap-1"
          >
            Fin rally <FastForward className="size-3.5" />
          </button>
        )}
        <button
          onClick={() => selectMark(null)}
          title="Cerrar"
          className="h-8 w-8 grid place-items-center rounded-md text-muted-foreground hover:bg-background/60"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
