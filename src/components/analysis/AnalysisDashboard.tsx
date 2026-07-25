/**
 * AnalysisDashboard — vista de gráficos rápida. Cada gráfico actúa como filtro.
 */
import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import type { Clip } from "@/lib/analysis/clip-service";
import { StatisticsService } from "@/lib/analysis/statistics-service";
import { useFilterStore } from "@/lib/analysis/filter-service";
import { MARK_COLORS, MARK_LABEL, type VideoMarkKind } from "@/lib/video-marks";

interface Props {
  clips: Clip[];
  onWantClipsTab: () => void;
}

export function AnalysisDashboard({ clips, onWantClipsTab }: Props) {
  const patch = useFilterStore((s) => s.patch);

  const byFund = useMemo(
    () =>
      StatisticsService.byFundamento(clips).map((b) => ({
        key: b.key,
        label: MARK_LABEL[b.key],
        count: b.count,
        pos: b.positives,
        err: b.errors,
        color: MARK_COLORS[b.key],
      })),
    [clips],
  );

  const bySet = useMemo(
    () =>
      StatisticsService.bySet(clips).map((b) => ({
        set: b.label,
        acciones: b.count,
        positivas: b.positives,
        errores: b.errors,
      })),
    [clips],
  );

  const byRot = useMemo(
    () =>
      StatisticsService.byRotation(clips).map((b) => ({
        rot: b.label,
        acciones: b.count,
      })),
    [clips],
  );

  const pointsPie = useMemo(() => {
    const s = StatisticsService.summary(clips);
    return [
      { name: "Positivos", value: s.positives, color: "#22c55e" },
      { name: "Errores", value: s.errors, color: "#ef4444" },
      { name: "Neutros", value: Math.max(0, s.total - s.positives - s.errors), color: "#64748b" },
    ];
  }, [clips]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ChartCard title="Distribución por fundamento">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={byFund}
            onClick={(e) => {
              const p = e?.activePayload?.[0]?.payload as { key: VideoMarkKind } | undefined;
              if (p?.key) {
                patch({ fundamentos: [p.key] });
                onWantClipsTab();
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count">
              {byFund.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Eficacia (positivos / errores)">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pointsPie} dataKey="value" nameKey="name" outerRadius={80} label>
              {pointsPie.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Rendimiento por set">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart
            data={bySet}
            onClick={(e) => {
              const p = e?.activePayload?.[0]?.payload as { set: string } | undefined;
              if (p) {
                const n = Number(String(p.set).replace(/\D/g, ""));
                if (n) {
                  patch({ sets: [n] });
                  onWantClipsTab();
                }
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="set" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="acciones" stroke="#38bdf8" strokeWidth={2} />
            <Line type="monotone" dataKey="positivas" stroke="#22c55e" strokeWidth={2} />
            <Line type="monotone" dataKey="errores" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribución por rotación">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byRot}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="rot" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="acciones" fill="#a855f7" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Heatmap (próximamente)" className="md:col-span-2">
        <div className="grid grid-cols-3 grid-rows-3 gap-1 aspect-[16/9]">
          {[4, 3, 2, 7, 8, 9, 5, 6, 1].map((z) => {
            const c = clips.filter((cl) => cl.zone === z).length;
            const max = Math.max(1, ...clips.map(() => 0), c);
            const intensity = Math.min(1, c / (max || 1));
            return (
              <button
                key={z}
                onClick={() => {
                  patch({ zoneOrigin: z });
                  onWantClipsTab();
                }}
                className="rounded border border-border grid place-items-center text-xs font-bold"
                style={{
                  background: `rgba(249, 115, 22, ${0.15 + intensity * 0.75})`,
                }}
              >
                Z{z} · {c}
              </button>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
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
