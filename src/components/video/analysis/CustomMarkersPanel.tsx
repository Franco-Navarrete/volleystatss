/**
 * Marcadores manuales independientes del scouting.
 * Se guardan en useAnalysisStore por matchId.
 */
import { useState } from "react";
import { CUSTOM_MARKER_META, useAnalysisStore, type CustomMarkerKind } from "@/lib/video/analysis-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

interface Props {
  matchId: string;
  currentMs: number;
  onSeek: (ms: number) => void;
}

const KINDS: CustomMarkerKind[] = ["star", "fire", "warn", "note"];

export function CustomMarkersPanel({ matchId, currentMs, onSeek }: Props) {
  const markers = useAnalysisStore((s) => s.markersByMatch[matchId]) ?? EMPTY_MARKERS;
  const addMarker = useAnalysisStore((s) => s.addMarker);
  const removeMarker = useAnalysisStore((s) => s.removeMarker);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<CustomMarkerKind>("star");

  const commit = () => {
    addMarker({ matchId, tMs: currentMs, kind, text: text.trim() });
    setText("");
  };

  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <div className="bg-card/40 border border-border rounded-lg flex flex-col min-h-[240px] max-h-[420px]">
      <div className="px-3 py-2 border-b border-border/60 text-[10px] uppercase tracking-widest text-muted-foreground">
        Marcadores del entrenador
      </div>
      <div className="p-2 border-b border-border/60 flex flex-col gap-2">
        <div className="grid grid-cols-4 gap-1">
          {KINDS.map((k) => {
            const meta = CUSTOM_MARKER_META[k];
            const active = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                title={meta.label}
                className={`rounded border text-lg py-1.5 transition-colors ${active ? "border-primary bg-primary/10" : "border-border/60 bg-background/40 hover:border-primary/40"}`}
              >
                {meta.emoji}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            placeholder={`Nota @ ${fmt(currentMs)}`}
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={commit}>Añadir</Button>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {markers.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">Sin marcadores. Agregá jugadas destacadas para revisarlas después.</div>
        )}
        <ul className="flex flex-col">
          {markers.map((m) => {
            const meta = CUSTOM_MARKER_META[m.kind];
            return (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2 border-t border-border/40 hover:bg-primary/5">
                <span className="text-base" style={{ color: meta.color }}>{meta.emoji}</span>
                <button onClick={() => onSeek(m.tMs)} className="flex-1 text-left">
                  <div className="text-xs font-semibold truncate">{m.text || meta.label}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{fmt(m.tMs)}</div>
                </button>
                <button onClick={() => removeMarker(matchId, m.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
