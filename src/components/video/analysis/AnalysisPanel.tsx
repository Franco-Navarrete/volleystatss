/**
 * Panel de análisis: Tabs (Acciones | Rally | Marcadores) + timeline zoomable.
 * Se monta debajo del reproductor y comparte estado (useAnalysisStore).
 */
import { useEffect, useMemo, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { VideoMark } from "@/lib/video-marks";
import { useAnalysisStore } from "@/lib/video/analysis-store";
import { AnalysisTimeline } from "@/components/video/analysis/AnalysisTimeline";
import { ActionsTableVirtual } from "@/components/video/analysis/ActionsTableVirtual";
import { RallyView } from "@/components/video/analysis/RallyView";
import { CustomMarkersPanel } from "@/components/video/analysis/CustomMarkersPanel";

interface Props {
  matchId: string;
  marks: VideoMark[];
  currentMs: number;
  totalMs: number;
  onSeek: (ms: number) => void;
  /** Llamado al seleccionar una fila / marca: recibe inicio y fin del clip virtual. */
  onSelectMark: (m: VideoMark) => void;
}

export function AnalysisPanel({ matchId, marks, currentMs, totalMs, onSeek, onSelectMark }: Props) {
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);
  const prerollMs = useAnalysisStore((s) => s.prerollMs);
  const postrollMs = useAnalysisStore((s) => s.postrollMs);
  const setPreroll = useAnalysisStore((s) => s.setPreroll);
  const setPostroll = useAnalysisStore((s) => s.setPostroll);
  const autoPause = useAnalysisStore((s) => s.autoPauseAtEnd);
  const setAutoPause = useAnalysisStore((s) => s.setAutoPauseAtEnd);

  // Enriquecer clip window con la config actual del store (sobrescribe defaults del builder).
  const enriched = useMemo(
    () => marks.map((m) => ({
      ...m,
      inicioClipMs: Math.max(0, m.tMs - prerollMs),
      finClipMs: m.tMs + postrollMs,
    })),
    [marks, prerollMs, postrollMs],
  );

  const lastCurrentRef = useRef(currentMs);
  useEffect(() => { lastCurrentRef.current = currentMs; }, [currentMs]);

  return (
    <div className="flex flex-col gap-2">
      <AnalysisTimeline
        marks={enriched}
        currentMs={currentMs}
        totalMs={totalMs}
        matchId={matchId}
        onSeek={onSeek}
      />

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground bg-card/40 border border-border rounded-lg px-3 py-1.5">
        <label className="flex items-center gap-1.5">
          Preroll
          <input
            type="number" min={0.5} max={30} step={0.5}
            value={(prerollMs / 1000).toFixed(1)}
            onChange={(e) => setPreroll(Number(e.target.value) * 1000)}
            className="w-14 bg-background/60 border border-border rounded px-1 py-0.5 text-xs tabular-nums"
          /> s
        </label>
        <label className="flex items-center gap-1.5">
          Postroll
          <input
            type="number" min={0.5} max={30} step={0.5}
            value={(postrollMs / 1000).toFixed(1)}
            onChange={(e) => setPostroll(Number(e.target.value) * 1000)}
            className="w-14 bg-background/60 border border-border rounded px-1 py-0.5 text-xs tabular-nums"
          /> s
        </label>
        <label className="flex items-center gap-1.5 ml-auto">
          <input type="checkbox" checked={autoPause} onChange={(e) => setAutoPause(e.target.checked)} />
          Pausa al final del clip
        </label>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="acciones">Acciones</TabsTrigger>
          <TabsTrigger value="rally">Rally</TabsTrigger>
          <TabsTrigger value="marcadores">Marcadores</TabsTrigger>
        </TabsList>
        <TabsContent value="acciones" className="mt-2">
          <ActionsTableVirtual marks={enriched} currentMs={currentMs} onSelect={onSelectMark} />
        </TabsContent>
        <TabsContent value="rally" className="mt-2">
          <RallyView marks={enriched} currentMs={currentMs} onSeek={onSeek} />
        </TabsContent>
        <TabsContent value="marcadores" className="mt-2">
          <CustomMarkersPanel matchId={matchId} currentMs={currentMs} onSeek={onSeek} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
