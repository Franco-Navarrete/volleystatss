/**
 * Línea de tiempo profesional zoomable/paneable.
 *
 * - Cada evento se pinta con el color del fundamento.
 * - Hover: tooltip con jugadora, fundamento, resultado y tiempo.
 * - Click en evento: selecciona la acción (via useAnalysisStore) y salta el video.
 * - Rueda del mouse: zoom sobre el cursor.
 * - Arrastrar: pan horizontal.
 * - Marcadores manuales (estrella / fuego / warn / nota) se pintan encima.
 * - Bloques de rally (buildRallyBlocks) se pintan como bandas de fondo.
 */
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { MARK_COLORS, type VideoMark, buildRallyBlocks } from "@/lib/video-marks";
import { useAnalysisStore, CUSTOM_MARKER_META, type CustomMarker } from "@/lib/video/analysis-store";

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

  // Al iniciar reproducción / cambiar currentMs, auto-follow si zoom activo.
  useEffect(() => {
    if (zoom <= 1) return;
    if (currentMs < startMs || currentMs > endMs) {
      setCenterMs(currentMs);
    }
  }, [currentMs, zoom, startMs, endMs, setCenterMs]);

  // Al seleccionar una marca, centrar la timeline sobre ella si está fuera de vista.
  useEffect(() => {
    if (!selectedMarkId) return;
    const m = marks.find((x) => x.id === selectedMarkId);
    if (!m) return;
    if (zoom > 1 && (m.tMs < startMs || m.tMs > endMs)) {
      setCenterMs(m.tMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarkId]);

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
    // mantener cursor bajo el mouse
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
    // hover detection: nearest mark within 6px
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
    // click sobre marca si está cerca
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

  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <div className="bg-card/40 border border-border rounded-lg p-2 select-none">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex items-center justify-between">
        <span>Línea de tiempo</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums">{fmt(currentMs)} / {fmt(total)}</span>
          <span className="text-foreground/70 tabular-nums">{zoom.toFixed(1)}×</span>
          <button
            className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border hover:border-primary/60"
            onClick={resetView}
            title="Ver todo el partido"
          >
            reset
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative h-14 bg-background/60 rounded overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {/* Bandas de rally alternadas para dar contexto visual */}
        {rallyBlocks.map((rb) => {
          const left = msToX(rb.startMs);
          const w = msToX(rb.endMs) - left;
          if (left + w < 0 || left > width) return null;
          const isSelectedRally = marks.find((m) => m.id === selectedMarkId)?.rallyId === rb.index;
          return (
            <div
              key={rb.index}
              className="absolute top-0 bottom-0"
              style={{
                left,
                width: Math.max(1, w),
                background: isSelectedRally
                  ? "oklch(0.62 0.24 25 / 0.14)"
                  : rb.index % 2 === 0
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(255,255,255,0.045)",
              }}
            />
          );
        })}

        {/* Ticks cada 30s (o más si viewport grande) */}
        {(() => {
          const step = viewportMs > 600_000 ? 60_000 : viewportMs > 120_000 ? 30_000 : 10_000;
          const ticks: number[] = [];
          const first = Math.ceil(startMs / step) * step;
          for (let t = first; t < endMs; t += step) ticks.push(t);
          return ticks.map((t) => (
            <div key={t} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: msToX(t) }}>
              <span className="absolute bottom-0 left-0.5 text-[9px] text-muted-foreground/80 tabular-nums">{fmt(t)}</span>
            </div>
          ));
        })()}

        {/* Marcas de scouting */}
        {marks.map((m) => {
          const x = msToX(m.tMs);
          if (x < -2 || x > width + 2) return null;
          const color = MARK_COLORS[m.kind] ?? "#94a3b8";
          const isSel = selectedMarkId === m.id;
          return (
            <div
              key={m.id}
              className="absolute top-1"
              style={{
                left: x - 1.5,
                width: isSel ? 5 : 3,
                height: 40,
                background: color,
                borderRadius: 2,
                boxShadow: isSel ? `0 0 8px ${color}` : undefined,
              }}
            />
          );
        })}

        {/* Marcadores manuales */}
        {markers.map((cm) => {
          const x = msToX(cm.tMs);
          if (x < 0 || x > width) return null;
          const meta = CUSTOM_MARKER_META[cm.kind];
          return (
            <div
              key={cm.id}
              className="absolute -top-1 text-xs pointer-events-none"
              style={{ left: x - 6, color: meta.color }}
              title={`${meta.emoji} ${cm.text || meta.label}`}
            >
              {meta.emoji}
            </div>
          );
        })}

        {/* Playhead (rojo, siempre visible) */}
        <div
          className="absolute -top-1 -bottom-1 w-[2px] bg-red-500 pointer-events-none shadow-[0_0_6px_rgba(239,68,68,0.9)] z-20"
          style={{ left: msToX(currentMs) }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
        </div>

        {/* Indicador de tiempo bajo el cursor */}
        {hover && !dragRef.current && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none"
            style={{ left: hover.x }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] tabular-nums bg-background/90 border border-border rounded px-1 whitespace-nowrap">
              {fmt(xToMs(hover.x))}
            </div>
          </div>
        )}
        {hover && (hover.mark || hover.marker) && (
          <div
            className="absolute -top-16 z-10 pointer-events-none bg-card border border-border rounded-md px-2 py-1 text-[11px] shadow-elevated whitespace-nowrap"
            style={{ left: hover.x, transform: "translateX(-50%)" }}
          >
            {hover.mark && (
              <>
                <div className="font-semibold">{hover.mark.fundamento}</div>
                <div className="text-muted-foreground">
                  {hover.mark.playerName
                    ? `#${hover.mark.playerNumber ?? "?"} ${hover.mark.playerName}`
                    : hover.mark.team ?? ""}
                </div>
                <div className="text-muted-foreground">
                  {hover.mark.result ?? ""} · {fmt(hover.mark.tMs)}
                </div>
              </>
            )}
            {hover.marker && (
              <>
                <div className="font-semibold">
                  {CUSTOM_MARKER_META[hover.marker.kind].emoji}{" "}
                  {hover.marker.text || CUSTOM_MARKER_META[hover.marker.kind].label}
                </div>
                <div className="text-muted-foreground">{fmt(hover.marker.tMs)}</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground/80 mt-1">
        Rueda: zoom · Arrastrar: mover · Click: saltar · Reset: ver todo el partido
      </div>
    </div>
  );
}
