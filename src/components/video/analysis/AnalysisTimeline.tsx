import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { MARK_COLORS, type VideoMark, buildRallyBlocks, MARK_LABEL } from "@/lib/video-marks";
import { useAnalysisStore, CUSTOM_MARKER_META, type CustomMarker } from "@/lib/video/analysis-store";
import { cn } from "@/lib/utils";

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

interface Props {
  marks: VideoMark[];
  currentMs: number;
  totalMs: number;
  matchId: string;
  onSeek: (ms: number) => void;
}

const TIMELINE_EMPTY_MARKERS: CustomMarker[] = [];

export function AnalysisTimeline({ marks, currentMs, totalMs, matchId, onSeek }: Props) {
  const zoom = useAnalysisStore((s) => s.zoom);
  const centerMs = useAnalysisStore((s) => s.centerMs);
  const setZoom = useAnalysisStore((s) => s.setZoom);
  const setCenterMs = useAnalysisStore((s) => s.setCenterMs);
  const resetView = useAnalysisStore((s) => s.resetView);
  const selectedMarkId = useAnalysisStore((s) => s.selectedMarkId);
  const selectMark = useAnalysisStore((s) => s.selectMark);
  const markers = useAnalysisStore((s) => s.markersByMatch[matchId]) ?? TIMELINE_EMPTY_MARKERS;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<{ x: number; mark?: VideoMark; marker?: CustomMarker } | null>(null);

  const total = Math.max(totalMs, currentMs + 5000, ...marks.map((m) => m.tMs), 60_000);
  const viewportMs = total / zoom;
  const focusMs = zoom > 1 ? centerMs || currentMs : total / 2;
  const startMs = Math.max(0, Math.min(total - viewportMs, focusMs - viewportMs / 2));
  const endMs = startMs + viewportMs;

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (zoom <= 1) return;
    if (currentMs < startMs || currentMs > endMs) {
      setCenterMs(currentMs);
    }
  }, [currentMs, zoom, startMs, endMs, setCenterMs]);

  useEffect(() => {
    if (!selectedMarkId) return;
    const m = marks.find((x) => x.id === selectedMarkId);
    if (!m) return;
    if (zoom > 1 && (m.tMs < startMs || m.tMs > endMs)) {
      setCenterMs(m.tMs);
    }
  }, [selectedMarkId, marks, zoom, startMs, endMs, setCenterMs]);

  const msToX = useCallback(
    (ms: number) => ((ms - startMs) / viewportMs) * width,
    [startMs, viewportMs, width],
  );
  const xToMs = useCallback(
    (x: number) => startMs + (x / width) * viewportMs,
    [startMs, viewportMs, width],
  );

  const rallyBlocks = useMemo(() => buildRallyBlocks(marks), [marks]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cursorMs = xToMs(x);
    const factor = e.deltaY < 0 ? 1.25 : 0.8;
    const nz = Math.max(1, Math.min(200, zoom * factor));
    setZoom(nz);
    const newViewport = total / nz;
    const newStart = cursorMs - (x / width) * newViewport;
    setCenterMs(Math.max(0, newStart + newViewport / 2));
  };

  const dragRef = useRef<{ x: number; center: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, center: focusMs };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.x;
      const dMs = -(dx / width) * viewportMs;
      setCenterMs(Math.max(0, dragRef.current.center + dMs));
      return;
    }
    let bestMark: VideoMark | undefined;
    let bestDist = 8;
    for (const m of marks) {
      const mx = msToX(m.tMs);
      const d = Math.abs(mx - px);
      if (d < bestDist) { bestDist = d; bestMark = m; }
    }
    let bestMarker: CustomMarker | undefined;
    if (!bestMark) {
      for (const cm of markers) {
        const mx = msToX(cm.tMs);
        const d = Math.abs(mx - px);
        if (d < 8) { bestMarker = cm; break; }
      }
    }
    setHover({ x: px, mark: bestMark, marker: bestMarker });
  };
  const onMouseUp = () => { dragRef.current = null; };
  const onMouseLeave = () => { dragRef.current = null; setHover(null); };

  const onClick = (e: React.MouseEvent) => {
    if (dragRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best: VideoMark | undefined;
    let bestDist = 8;
    for (const m of marks) {
      const mx = msToX(m.tMs);
      const d = Math.abs(mx - px);
      if (d < bestDist) { bestDist = d; best = m; }
    }
    if (best) {
      selectMark(best.id);
      onSeek(best.inicioClipMs);
      return;
    }
    onSeek(xToMs(px));
  };

  const layers = [
    { id: "video", label: "VIDEO", color: "oklch(0.62 0.24 240)" },
    { id: "sets", label: "SETS", color: "#facc15" },
    { id: "rallies", label: "RALLIES", color: "rgba(255,255,255,0.2)" },
    { id: "actions", label: "ACCIONES", color: "oklch(0.62 0.24 150)" },
    { id: "scout", label: "SCOUT", color: "oklch(0.62 0.24 25)" },
    { id: "clips", label: "CLIPS", color: "#a855f7" },
    { id: "comments", label: "IA", color: "#06b6d4" },
  ];

  return (
    <div className="bg-card/40 border border-border rounded-lg flex flex-col overflow-hidden select-none h-full">
      <div className="px-3 py-1.5 border-b border-border/40 flex items-center justify-between bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black tracking-tighter text-muted-foreground">TIMELINE</span>
          <div className="flex items-center gap-2">
             <span className="text-[11px] tabular-nums font-mono bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{fmt(currentMs)}</span>
             <span className="text-white/20">/</span>
             <span className="text-[11px] tabular-nums font-mono text-muted-foreground">{fmt(total)}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/20 rounded border border-white/5">
            <span className="text-[10px] text-muted-foreground font-bold">ZOOM</span>
            <span className="text-[10px] font-mono tabular-nums">{zoom.toFixed(1)}x</span>
          </div>
          <button
            className="text-[10px] font-bold px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors uppercase tracking-tight"
            onClick={resetView}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-20 shrink-0 border-r border-border/40 bg-black/20 flex flex-col">
          {layers.map(layer => (
            <div 
              key={layer.id} 
              className="flex-1 border-b border-border/20 px-2 flex items-center gap-1.5"
            >
              <div className="size-1.5 rounded-full" style={{ backgroundColor: layer.color }} />
              <span className="text-[8px] font-black text-muted-foreground tracking-tighter">{layer.label}</span>
            </div>
          ))}
          <div className="h-4" />
        </div>

        <div 
          ref={wrapRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
        >
          <div className="absolute inset-0 pointer-events-none">
            {(() => {
              const step = viewportMs > 600_000 ? 60_000 : viewportMs > 120_000 ? 30_000 : 10_000;
              const ticks: number[] = [];
              const first = Math.ceil(startMs / step) * step;
              for (let t = first; t < endMs; t += step) ticks.push(t);
              return ticks.map((t) => (
                <div 
                  key={t} 
                  className="absolute top-0 bottom-0 border-l border-white/5" 
                  style={{ left: msToX(t) }}
                >
                  <span className="absolute bottom-0 left-0.5 text-[8px] text-muted-foreground/40 tabular-nums font-mono">
                    {fmt(t)}
                  </span>
                </div>
              ));
            })()}
          </div>

          <div className="absolute inset-0 flex flex-col">
            {layers.map(layer => (
              <div key={layer.id} className="flex-1 relative border-b border-border/10">
                {layer.id === "rallies" && rallyBlocks.map((rb) => {
                  const left = msToX(rb.startMs);
                  const w = msToX(rb.endMs) - left;
                  if (left + w < 0 || left > width) return null;
                  const isSelectedRally = marks.find((m) => m.id === selectedMarkId)?.rallyId === rb.index;
                  return (
                    <div
                      key={rb.index}
                      className={cn(
                        "absolute top-1 bottom-1 rounded-sm border transition-colors",
                        isSelectedRally ? "bg-primary/20 border-primary/40" : "bg-white/[0.03] border-white/5"
                      )}
                      style={{ left, width: Math.max(2, w) }}
                    />
                  );
                })}

                {layer.id === "sets" && marks.filter(m => m.kind === "set_start" || (m.kind as any) === "set_end").map(m => {
                  const x = msToX(m.tMs);
                  if (x < 0 || x > width) return null;
                  return (
                    <div 
                      key={m.id}
                      className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/50"
                      style={{ left: x }}
                    />
                  );
                })}

                {layer.id === "actions" && marks.filter(m => m.kind === "point" || m.kind === "error").map(m => {
                  const x = msToX(m.tMs);
                  if (x < 0 || x > width) return null;
                  const color = MARK_COLORS[m.kind];
                  const isSel = selectedMarkId === m.id;
                  return (
                    <div 
                      key={m.id}
                      className={cn(
                        "absolute top-1.5 bottom-1.5 w-1 rounded-full transition-all",
                        isSel ? "scale-x-150 ring-2 ring-primary/40" : ""
                      )}
                      style={{ left: x - 1, backgroundColor: color }}
                    />
                  );
                })}

                {layer.id === "video" && (
                   <div 
                     className="absolute inset-y-0 w-px bg-white/20" 
                     style={{ left: msToX(currentMs) }}
                   />
                )}
              </div>
            ))}
          </div>

          <div
            className="absolute -top-1 -bottom-1 w-[2px] bg-red-500 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)] z-30"
            style={{ left: msToX(currentMs) }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500" />
          </div>

          {hover && !dragRef.current && (
            <div
              className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-20"
              style={{ left: hover.x }}
            >
              <div className="absolute top-0 left-2 text-[8px] tabular-nums font-mono bg-black/80 text-white/60 px-1 rounded">
                {fmt(xToMs(hover.x))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
