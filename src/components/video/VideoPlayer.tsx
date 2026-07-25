import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { MARK_COLORS, type VideoMark } from "@/lib/video-marks";
import { Button } from "@/components/ui/button";
import { Pause, Play, Maximize, ChevronsLeft, ChevronsRight, Gauge, AlertTriangle, RefreshCw } from "lucide-react";
import { VideoHUD } from "@/components/video/VideoHUD";
import type { VideoSource } from "@/lib/video/providers";

export interface VideoPlayerHandle {
  seekMs: (ms: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentMs: () => number;
  getDurationSec: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}


interface Props {
  src: string;
  marks: VideoMark[];
  isYouTube?: boolean;
  stream?: MediaStream | null;
  onTimeUpdate?: (ms: number) => void;
  onDurationChange?: (sec: number) => void;
  /** Fuente activa (para HUD / chip). Opcional para no romper usos existentes. */
  source?: VideoSource | null;
  /** Estado de grabación externa (LiveRecorder) para pintar el badge REC. */
  recStatus?: "idle" | "recording" | "paused" | "finalizing";
  /** Tiempo transcurrido a mostrar en el HUD (ms). */
  hudElapsedMs?: number;
  /** true si la captura fue interrumpida (usuario cerró la compartición). */
  interrupted?: boolean;
  onReconnect?: () => void;
}


const SPEEDS = [0.25, 0.5, 1, 1.25, 1.5, 2];

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { src, marks, isYouTube, stream, onTimeUpdate, onDurationChange, source, recStatus, hudElapsedMs, interrupted, onReconnect },
  ref,
) {

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [hoverMark, setHoverMark] = useState<VideoMark | null>(null);

  useImperativeHandle(ref, () => ({
    seekMs: (ms) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, ms / 1000);
      void v.play().catch(() => undefined);
    },
    play: () => { void videoRef.current?.play(); },
    pause: () => { videoRef.current?.pause(); },
    getCurrentMs: () => (videoRef.current?.currentTime ?? 0) * 1000,
    getDurationSec: () => videoRef.current?.duration ?? 0,
    getVideoElement: () => videoRef.current,
  }), []);


  // Apply MediaStream via srcObject (Screen Capture / camera)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) {
      v.srcObject = stream;
      v.muted = true; // avoid echo when sharing tab audio
      void v.play().catch(() => undefined);
    } else {
      v.srcObject = null;
    }
    return () => {
      if (v && v.srcObject === stream) v.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => { setCurrent(v.currentTime); onTimeUpdate?.(v.currentTime * 1000); };
    const onDur = () => { setDuration(v.duration); onDurationChange?.(v.duration); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [onTimeUpdate, onDurationChange, src, stream]);


  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const v = videoRef.current;
      if (!v) return;
      if (e.code === "Space") { e.preventDefault(); if (v.paused) void v.play(); else v.pause(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - (e.shiftKey ? 1 : 5)); }
      else if (e.code === "ArrowRight") { e.preventDefault(); v.currentTime = Math.min(v.duration || 1e9, v.currentTime + (e.shiftKey ? 1 : 5)); }
      else if (e.key === ",") { e.preventDefault(); v.pause(); v.currentTime = Math.max(0, v.currentTime - 1 / 30); }
      else if (e.key === ".") { e.preventDefault(); v.pause(); v.currentTime = v.currentTime + 1 / 30; }
      else if (e.key === "j") { setSpeed((s) => { const i = Math.max(0, SPEEDS.indexOf(s) - 1); const n = SPEEDS[i]!; v.playbackRate = n; return n; }); }
      else if (e.key === "l") { setSpeed((s) => { const i = Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s) + 1); const n = SPEEDS[i]!; v.playbackRate = n; return n; }); }
      else if (e.key === "f") { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  const seek = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, sec);
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  const totalMs = duration * 1000;
  const pct = totalMs > 0 ? (current * 1000 / totalMs) * 100 : 0;

  return (
    <div ref={wrapRef} className="flex flex-col gap-2 bg-black rounded-lg overflow-hidden">
      <div className="relative bg-black aspect-video">
        {isYouTube && !stream ? (
          <iframe
            src={src}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title="video"
          />
        ) : (
          <video
            ref={videoRef}
            src={stream ? undefined : src}
            className="absolute inset-0 w-full h-full bg-black"
            preload="metadata"
            playsInline
            controls={false}
          />
        )}

      </div>

      {/* Timeline with markers */}
      {!isYouTube && !stream && (
        <div className="px-3 pb-2 pt-1 bg-black/60">
          <div
            className="relative h-8 bg-white/5 rounded cursor-pointer group"
            onClick={(e) => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const p = (e.clientX - r.left) / r.width;
              seek(p * duration);
            }}
          >
            {/* progress */}
            <div className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${pct}%` }} />
            {/* playhead */}
            <div className="absolute top-0 bottom-0 w-[2px] bg-primary" style={{ left: `${pct}%` }} />
            {/* markers */}
            {marks.map((m) => {
              const left = totalMs > 0 ? (m.tMs / totalMs) * 100 : 0;
              if (left < 0 || left > 100) return null;
              return (
                <button
                  key={m.id}
                  type="button"
                  className="absolute top-1 h-6 w-[3px] rounded-sm hover:h-full hover:w-[5px] transition-all"
                  style={{ left: `${left}%`, background: MARK_COLORS[m.kind] }}
                  onClick={(e) => { e.stopPropagation(); seek(m.tMs / 1000); }}
                  onMouseEnter={() => setHoverMark(m)}
                  onMouseLeave={() => setHoverMark(null)}
                  title={`${m.fundamento} · ${m.playerName ?? ""} · ${m.result ?? ""}`}
                />
              );
            })}
            {hoverMark && (
              <div
                className="absolute -top-14 z-10 pointer-events-none bg-card border border-border rounded-md px-2 py-1 text-[11px] shadow-elevated"
                style={{ left: `${totalMs > 0 ? (hoverMark.tMs / totalMs) * 100 : 0}%`, transform: "translateX(-50%)" }}
              >
                <div className="font-semibold">{hoverMark.fundamento}</div>
                <div className="text-muted-foreground">
                  {hoverMark.playerName ? `#${hoverMark.playerNumber ?? "?"} ${hoverMark.playerName}` : hoverMark.team ?? ""}
                </div>
                <div className="text-muted-foreground">{hoverMark.result} · {formatTime(hoverMark.tMs / 1000)}</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-white/90">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { const v = videoRef.current; if (!v) return; if (v.paused) void v.play(); else v.pause(); }}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime -= 1 / 30; } }} title="Frame anterior (,)">
              <ChevronsLeft className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime += 1 / 30; } }} title="Frame siguiente (.)">
              <ChevronsRight className="size-4" />
            </Button>
            <div className="tabular-nums text-white/70 min-w-[100px]">
              {formatTime(current)} / {formatTime(duration)}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Gauge className="size-3 text-white/60" />
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${speed === s ? "bg-primary text-primary-foreground" : "text-white/60 hover:bg-white/10"}`}
                >
                  {s}x
                </button>
              ))}
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white/90" onClick={toggleFullscreen} title="Pantalla completa (F)">
                <Maximize className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
