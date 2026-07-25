/**
 * Barra de reproducción profesional bajo el video.
 * Evento anterior · -5s · Frame anterior · Play/Pausa · Frame siguiente · +5s · Evento siguiente
 * Usa la sincronización existente (playerRef + useAnalysisStore).
 */
import { useMemo } from "react";
import type { VideoMark } from "@/lib/video-marks";
import { useAnalysisStore } from "@/lib/video/analysis-store";
import type { VideoPlayerHandle } from "@/components/video/VideoPlayer";
import {
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from "lucide-react";

interface Props {
  playerRef: React.RefObject<VideoPlayerHandle | null>;
  marks: VideoMark[];
  currentMs: number;
  isPlaying: boolean;
}

const FRAME = 1000 / 30;

export function PlaybackControls({ playerRef, marks, currentMs, isPlaying }: Props) {
  const prerollMs = useAnalysisStore((s) => s.prerollMs);
  const selectMark = useAnalysisStore((s) => s.selectMark);

  const sorted = useMemo(() => [...marks].sort((a, b) => a.tMs - b.tMs), [marks]);

  const seekTo = (ms: number) => playerRef.current?.seekMs(Math.max(0, ms));

  const goPrevEvent = () => {
    const prev = [...sorted].reverse().find((m) => m.tMs < currentMs - 200);
    if (!prev) return;
    selectMark(prev.id);
    seekTo(Math.max(0, prev.tMs - prerollMs));
  };
  const goNextEvent = () => {
    const next = sorted.find((m) => m.tMs > currentMs + 200);
    if (!next) return;
    selectMark(next.id);
    seekTo(Math.max(0, next.tMs - prerollMs));
  };

  const togglePlay = () => {
    const v = playerRef.current?.getVideoElement();
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  };

  return (
    <div className="flex items-center justify-center gap-1.5 bg-card/60 border border-border rounded-lg px-2 py-1.5">
      <Btn onClick={goPrevEvent} title="Evento anterior (J)">
        <SkipBack className="size-4" /> <span className="hidden sm:inline text-[11px]">Evento</span>
      </Btn>
      <Btn onClick={() => seekTo(currentMs - 5000)} title="Retroceder 5 segundos (←)">
        <Rewind className="size-4" /> <span className="hidden sm:inline text-[11px]">-5s</span>
      </Btn>
      <Btn onClick={() => { playerRef.current?.pause(); seekTo(currentMs - FRAME); }} title="Frame anterior (,)">
        <ChevronLeft className="size-4" />
      </Btn>
      <button
        onClick={togglePlay}
        title="Play / Pausa (K / Espacio)"
        className="h-9 w-9 grid place-items-center rounded-md bg-primary text-primary-foreground hover:brightness-110"
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <Btn onClick={() => { playerRef.current?.pause(); seekTo(currentMs + FRAME); }} title="Frame siguiente (.)">
        <ChevronRight className="size-4" />
      </Btn>
      <Btn onClick={() => seekTo(currentMs + 5000)} title="Adelantar 5 segundos (→)">
        <span className="hidden sm:inline text-[11px]">+5s</span> <FastForward className="size-4" />
      </Btn>
      <Btn onClick={goNextEvent} title="Evento siguiente (L)">
        <span className="hidden sm:inline text-[11px]">Evento</span> <SkipForward className="size-4" />
      </Btn>
    </div>
  );
}

function Btn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="h-9 px-2 min-w-9 grid place-items-center rounded-md bg-background/60 border border-border/60 text-foreground/90 hover:border-primary/60 hover:bg-primary/10 flex-row inline-flex gap-1"
    >
      {children}
    </button>
  );
}
