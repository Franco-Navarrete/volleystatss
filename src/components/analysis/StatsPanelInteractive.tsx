/**
 * StatsPanelInteractive — tarjetas y tablas clickeables.
 * Cada valor aplica un filtro al store global (useFilterStore) y muestra
 * automáticamente esos clips en la biblioteca y timeline.
 */
import { useMemo } from "react";
import type { Clip } from "@/lib/analysis/clip-service";
import { StatisticsService } from "@/lib/analysis/statistics-service";
import { useFilterStore } from "@/lib/analysis/filter-service";
import { MARK_COLORS, MARK_LABEL, type VideoMarkKind } from "@/lib/video-marks";

interface Props {
  clips: Clip[]; // ya filtrados en la vista principal, pero recibimos todo el catálogo aquí
  onWantClipsTab: () => void;
}

export function StatsPanelInteractive({ clips, onWantClipsTab }: Props) {
  const patch = useFilterStore((s) => s.patch);
  const summary = useMemo(() => StatisticsService.summary(clips), [clips]);
  const byFund = useMemo(() => StatisticsService.byFundamento(clips), [clips]);
  const byResult = useMemo(() => StatisticsService.byResult(clips), [clips]);
  const byPlayer = useMemo(() => StatisticsService.byPlayer(clips).slice(0, 12), [clips]);
  const byZone = useMemo(() => StatisticsService.byZone(clips), [clips]);

  const applyFund = (k: VideoMarkKind) => {
    patch({ fundamentos: [k] });
    onWantClipsTab();
  };
  const applyResult = (r: string) => {
    patch({ results: [r] });
    onWantClipsTab();
  };
  const applyPlayer = (id: string) => {
    patch({ playerId: id });
    onWantClipsTab();
  };
  const applyZone = (z: number) => {
    patch({ zoneOrigin: z });
    onWantClipsTab();
  };

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <KPI label="Acciones" value={summary.total} />
      <KPI label="Positivos" value={summary.positives} accent="text-emerald-400" />
      <KPI label="Errores" value={summary.errors} accent="text-red-400" />
      <KPI
        label="Eficiencia"
        value={`${(summary.efficiency * 100).toFixed(1)}%`}
        accent={summary.efficiency >= 0 ? "text-emerald-400" : "text-red-400"}
      />

      <Card title="Por fundamento" className="col-span-2 md:col-span-2">
        <table className="w-full text-xs">
          <tbody>
            {byFund.map((b) => (
              <tr
                key={b.key}
                onClick={() => applyFund(b.key)}
                className="cursor-pointer hover:bg-primary/10"
              >
                <td className="py-1 flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: MARK_COLORS[b.key] }}
                  />
                  {MARK_LABEL[b.key]}
                </td>
                <td className="text-right tabular-nums">{b.count}</td>
                <td className="text-right text-emerald-400 tabular-nums">{b.positives}</td>
                <td className="text-right text-red-400 tabular-nums">{b.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Por resultado" className="col-span-2 md:col-span-2">
        <div className="flex flex-wrap gap-1.5">
          {byResult.slice(0, 20).map((b) => (
            <button
              key={b.key}
              onClick={() => applyResult(b.key)}
              className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-background/60 hover:border-primary/60"
            >
              {b.label} · {b.count}
            </button>
          ))}
          {byResult.length === 0 && (
            <span className="text-xs text-muted-foreground">Sin datos</span>
          )}
        </div>
      </Card>

      <Card title="Por jugadora (top 12)" className="col-span-2 md:col-span-2">
        <div className="flex flex-col gap-1">
          {byPlayer.map((b) => (
            <button
              key={b.key}
              onClick={() => applyPlayer(b.key)}
              className="flex items-center gap-2 text-xs hover:bg-primary/10 rounded px-1"
            >
              <span className="flex-1 truncate text-left">{b.label}</span>
              <span className="tabular-nums">{b.count}</span>
              <span className="text-emerald-400 tabular-nums w-8 text-right">+{b.positives}</span>
              <span className="text-red-400 tabular-nums w-8 text-right">-{b.errors}</span>
            </button>
          ))}
          {byPlayer.length === 0 && (
            <span className="text-xs text-muted-foreground">Sin datos</span>
          )}
        </div>
      </Card>

      <Card title="Por zona" className="col-span-2 md:col-span-2">
        <div className="grid grid-cols-3 gap-1">
          {byZone.map((b) => (
            <button
              key={b.key}
              onClick={() => applyZone(Number(b.key))}
              className="rounded-md border border-border bg-background/60 py-2 text-center hover:border-primary/60"
            >
              <div className="text-[10px] text-muted-foreground">{b.label}</div>
              <div className="text-lg font-bold">{b.count}</div>
            </button>
          ))}
          {byZone.length === 0 && (
            <span className="text-xs text-muted-foreground col-span-3">Sin datos por zona</span>
          )}
        </div>
      </Card>
    </div>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-card/40 border border-border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-black ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function Card({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-card/40 border border-border rounded-lg p-3 ${className ?? ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
