/**
 * Tabla interactiva de acciones con virtualización simple por rebanado (window-based).
 * - Fila resaltada = selectedMarkId de useAnalysisStore.
 * - Click en fila → saltar a inicioClipMs y seleccionar acción.
 * - Compatible con partidos largos (>3h): renderiza solo la ventana visible.
 */
import { useEffect, useMemo, useRef } from "react";
import { MARK_COLORS, MARK_LABEL, type VideoMark } from "@/lib/video-marks";
import { useAnalysisStore } from "@/lib/video/analysis-store";

interface Props {
  marks: VideoMark[];
  currentMs: number;
  onSelect: (m: VideoMark) => void;
}

const ROW_H = 30;
const OVERSCAN = 8;

export function ActionsTableVirtual({ marks, currentMs, onSelect }: Props) {
  const selectedMarkId = useAnalysisStore((s) => s.selectedMarkId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const [range, setRange] = useVisibleRange(scrollRef, marks.length);

  // Auto-scroll a la fila seleccionada.
  useEffect(() => {
    if (!selectedMarkId) return;
    const row = rowRefs.current.get(selectedMarkId);
    if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedMarkId]);

  // Auto-scroll a la acción actual mientras se reproduce (sin selección explícita).
  const currentPlayingId = useMemo(() => {
    if (selectedMarkId) return null;
    let best: string | null = null;
    let bestDelta = 2000;
    for (const m of marks) {
      const d = Math.abs(m.tMs - currentMs);
      if (d < bestDelta) { bestDelta = d; best = m.id; }
    }
    return best;
  }, [marks, currentMs, selectedMarkId]);

  useEffect(() => {
    if (!currentPlayingId) return;
    const row = rowRefs.current.get(currentPlayingId);
    if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPlayingId]);

  // Ordenar por tiempo descendente para mostrar las más recientes arriba,
  // pero mantener índices consistentes.
  const ordered = useMemo(() => [...marks].reverse(), [marks]);
  const total = ordered.length;
  const paddingTop = Math.max(0, (range[0] - OVERSCAN) * ROW_H);
  const paddingBottom = Math.max(0, (total - Math.min(total, range[1] + OVERSCAN)) * ROW_H);
  const slice = ordered.slice(Math.max(0, range[0] - OVERSCAN), Math.min(total, range[1] + OVERSCAN));

  // silence unused
  void setRange;

  return (
    <div className="bg-card/40 border border-border rounded-lg flex flex-col h-full overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border/60 text-[10px] uppercase font-black tracking-widest text-muted-foreground flex items-center justify-between bg-black/20">
        <span>Acciones</span>
        <span className="text-foreground tabular-nums opacity-60">{total}</span>
      </div>

      <div ref={scrollRef} className="overflow-y-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1 font-medium">t</th>
              <th className="px-2 py-1 font-medium">Set</th>
              <th className="px-2 py-1 font-medium">Rally</th>
              <th className="px-2 py-1 font-medium">Jugadora</th>
              <th className="px-2 py-1 font-medium">Fundamento</th>
              <th className="px-2 py-1 font-medium">Resultado</th>
              <th className="px-2 py-1 font-medium">Marc.</th>
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={7} /></tr>}
            {slice.map((m) => {
              const isSel = selectedMarkId === m.id;
              const isCurrent = !isSel && Math.abs(m.tMs - currentMs) < 1500;
              const color = MARK_COLORS[m.kind] ?? "#94a3b8";
              return (
                <tr
                  key={m.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(m.id, el);
                    else rowRefs.current.delete(m.id);
                  }}
                  onClick={() => onSelect(m)}
                  className={`cursor-pointer border-t border-border/40 hover:bg-primary/10 ${isSel ? "bg-primary/25 outline outline-1 outline-primary" : isCurrent ? "bg-primary/10" : ""}`}
                  style={{ height: ROW_H }}
                >
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{(m.tMs / 1000).toFixed(1)}s</td>
                  <td className="px-2 py-1 tabular-nums">{m.setNumber}</td>
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">#{m.rallyId + 1}</td>
                  <td className="px-2 py-1 truncate max-w-[120px]">{m.playerNumber != null ? `#${m.playerNumber} ` : ""}{m.playerName ?? "—"}</td>
                  <td className="px-2 py-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: color + "33", color }}>
                      {MARK_LABEL[m.kind] ?? m.fundamento}
                    </span>
                  </td>
                  <td className="px-2 py-1 truncate max-w-[140px]">{m.result ?? "—"}</td>
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{m.score}</td>
                </tr>
              );
            })}
            {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={7} /></tr>}
            {total === 0 && (
              <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground text-xs">Sin acciones aún. Registrá desde el panel derecho.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function useVisibleRange(ref: React.RefObject<HTMLDivElement | null>, total: number) {
  const [range, setRange] = useStatePair<[number, number]>([0, 40]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = Math.floor(el.scrollTop / ROW_H);
      const visible = Math.ceil(el.clientHeight / ROW_H);
      setRange([start, Math.min(total, start + visible)]);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [ref, total, setRange]);
  return [range, setRange] as const;
}

// tiny useState alias to satisfy tsgo with tuple typing
import { useState as useStatePair } from "react";
