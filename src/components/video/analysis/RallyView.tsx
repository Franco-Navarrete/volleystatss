/**
 * Vista Rally — muestra la cadena de acciones del rally seleccionado
 * (o del rally actual del video si no hay selección).
 */
import { useMemo } from "react";
import { MARK_COLORS, type VideoMark } from "@/lib/video-marks";
import { useAnalysisStore } from "@/lib/video/analysis-store";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  marks: VideoMark[];
  currentMs: number;
  onSeek: (ms: number) => void;
}

export function RallyView({ marks, currentMs, onSeek }: Props) {
  const selectedMarkId = useAnalysisStore((s) => s.selectedMarkId);
  const selectMark = useAnalysisStore((s) => s.selectMark);

  // Determinar rally activo: si hay selección, usarla; si no, el rally cuyo rango incluya currentMs.
  const activeRallyId = useMemo(() => {
    if (selectedMarkId) {
      const m = marks.find((x) => x.id === selectedMarkId);
      if (m) return m.rallyId;
    }
    // último cuyo primer evento ≤ currentMs
    let last = 0;
    for (const m of marks) {
      if (m.tMs <= currentMs) last = m.rallyId;
      else break;
    }
    return last;
  }, [marks, selectedMarkId, currentMs]);

  const rallies = useMemo(() => {
    const map = new Map<number, VideoMark[]>();
    for (const m of marks) {
      const arr = map.get(m.rallyId) ?? [];
      arr.push(m);
      map.set(m.rallyId, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [marks]);

  const goPrev = () => {
    const idx = rallies.findIndex(([id]) => id === activeRallyId);
    if (idx > 0) {
      const [, arr] = rallies[idx - 1]!;
      const first = arr[0];
      if (first) { selectMark(first.id); onSeek(first.inicioClipMs); }
    }
  };
  const goNext = () => {
    const idx = rallies.findIndex(([id]) => id === activeRallyId);
    if (idx >= 0 && idx < rallies.length - 1) {
      const [, arr] = rallies[idx + 1]!;
      const first = arr[0];
      if (first) { selectMark(first.id); onSeek(first.inicioClipMs); }
    }
  };

  const active = rallies.find(([id]) => id === activeRallyId);

  return (
    <div className="bg-card/40 border border-border rounded-lg flex flex-col min-h-[240px] max-h-[420px]">
      <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between text-[11px]">
        <div className="uppercase tracking-widest text-muted-foreground">
          Rally #{activeRallyId + 1} de {rallies.length}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="p-1 rounded hover:bg-primary/10" title="Rally anterior"><ChevronUp className="size-3.5" /></button>
          <button onClick={goNext} className="p-1 rounded hover:bg-primary/10" title="Rally siguiente"><ChevronDown className="size-3.5" /></button>
        </div>
      </div>
      <div className="overflow-y-auto p-2 flex-1">
        {!active && (
          <div className="text-xs text-muted-foreground text-center py-8">Sin acciones aún en este partido.</div>
        )}
        {active && (
          <ol className="flex flex-col gap-1.5">
            {active[1].map((m, i) => {
              const isSel = selectedMarkId === m.id;
              const color = MARK_COLORS[m.kind] ?? "#94a3b8";
              return (
                <li key={m.id} className="flex items-center gap-2">
                  <div className="text-[10px] text-muted-foreground tabular-nums w-4">{i + 1}</div>
                  <button
                    onClick={() => { selectMark(m.id); onSeek(m.inicioClipMs); }}
                    className={`flex-1 flex items-center gap-2 rounded border py-1.5 px-2 text-left text-xs transition-colors ${isSel ? "border-primary bg-primary/10" : "border-border/60 bg-background/40 hover:border-primary/50"}`}
                  >
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="font-semibold truncate">{m.fundamento}</span>
                    <span className="text-muted-foreground truncate flex-1">
                      {m.playerName ? `#${m.playerNumber ?? "?"} ${m.playerName}` : m.team ?? ""}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{(m.tMs / 1000).toFixed(1)}s</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
