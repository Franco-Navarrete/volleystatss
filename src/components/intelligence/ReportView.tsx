// Rally Intelligence — Dashboard interactivo profesional.
// Layout: Resumen Analista → Executive Cards → Rally Index Hero (con impacto,
// comparaciones y estado por fundamento) → Pestañas (Radar, Tendencias,
// Timeline, Simulador, Prioridades, Riesgos, Coach Insights, Compartir).

import { useMemo, useState } from "react";
import type { MatchAnalysis, Importance, Trend, IndexStatus, RallyIndexItem } from "@/lib/intelligence/analysis";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Cell,
} from "recharts";
import {
  Trophy, Target, Shield, Zap, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Sparkles, Dumbbell, MessageCircleQuestion, Lightbulb,
  Award, HeartHandshake, ClipboardList, Activity, Brain, TimerReset,
  Share2, Copy, MessageCircle, FileText, SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";

// ---------------- Tokens de estado ----------------

const IMP_COLOR: Record<Importance, string> = {
  baja: "bg-secondary/60 text-foreground border-border/60",
  media: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  alta: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  muy_alta: "bg-red-500/15 text-red-300 border-red-500/40",
};
const IMP_LABEL: Record<Importance, string> = {
  baja: "Baja", media: "Media", alta: "Alta", muy_alta: "Muy Alta",
};

const STATUS_META: Record<IndexStatus, { label: string; text: string; bar: string; ring: string; bg: string }> = {
  excellent: { label: "Excelente", text: "text-emerald-400", bar: "bg-emerald-500", ring: "ring-emerald-500/40", bg: "bg-emerald-500/10" },
  good:      { label: "Bueno",     text: "text-lime-400",    bar: "bg-lime-500",    ring: "ring-lime-500/40",    bg: "bg-lime-500/10" },
  regular:   { label: "Regular",   text: "text-amber-300",   bar: "bg-amber-400",   ring: "ring-amber-500/40",   bg: "bg-amber-500/10" },
  low:       { label: "Bajo",      text: "text-orange-300",  bar: "bg-orange-400",  ring: "ring-orange-500/40",  bg: "bg-orange-500/10" },
  critical:  { label: "Crítico",   text: "text-red-400",     bar: "bg-red-500",     ring: "ring-red-500/40",     bg: "bg-red-500/10" },
};

function statusOf(score: number): IndexStatus {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "regular";
  if (score >= 35) return "low";
  return "critical";
}

function TrendIcon({ t }: { t?: Trend }) {
  if (t === "up") return <TrendingUp className="size-3.5 text-emerald-400" />;
  if (t === "down") return <TrendingDown className="size-3.5 text-red-400" />;
  return <Minus className="size-3.5 text-muted-foreground" />;
}

function scoreColor(score: number) { return STATUS_META[statusOf(score)].text; }
function scoreBar(score: number) { return STATUS_META[statusOf(score)].bar; }

// ---------------- Bloques ----------------

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-4 flex flex-col gap-1 bg-card/60 border-border/60">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function AwardCard({ icon, label, name, detail }: { icon: ReactNode; label: string; name?: string; detail?: string }) {
  if (!name) return null;
  return (
    <Card className="p-4 flex items-start gap-3 bg-gradient-to-br from-card to-card/40 border-border/60">
      <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-semibold truncate">{name}</div>
        {detail && <div className="text-xs text-muted-foreground truncate">{detail}</div>}
      </div>
    </Card>
  );
}

function AnalystSummaryCard({ analysis, summaryMd }: { analysis: MatchAnalysis; summaryMd?: string }) {
  const useAi = summaryMd && summaryMd.trim().length > 0 && !summaryMd.startsWith("_No fue posible");
  return (
    <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card/40 space-y-2">
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
          <Brain className="size-4" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {useAi ? "Resumen del Analista · IA" : "Resumen del Analista"}
          </div>
          <div className="font-semibold">Lectura ejecutiva del partido</div>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {useAi ? summaryMd : analysis.analystSummary}
      </p>
    </Card>
  );
}

function RallyIndexHero({ analysis }: { analysis: MatchAnalysis }) {
  const { overall, breakdown } = analysis.rallyIndex;
  const st = STATUS_META[statusOf(overall)];
  return (
    <Card className={`p-5 space-y-5 border-border/60 ${st.bg}`}>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Índice Rally</div>
          <div className={`text-6xl font-bold leading-none ${st.text}`}>
            {overall}<span className="text-2xl text-muted-foreground">/100</span>
          </div>
          <div className={`text-sm font-semibold mt-1 ${st.text}`}>{st.label}</div>
        </div>
        <div className="text-sm text-muted-foreground pb-2 max-w-lg">
          Calificación global derivada de 10 fundamentos ponderados por su impacto real en el resultado.
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {breakdown.map((b) => <IndexRow key={b.key} item={b} />)}
      </div>
    </Card>
  );
}

function IndexRow({ item }: { item: RallyIndexItem }) {
  const st = STATUS_META[item.status ?? statusOf(item.score)];
  return (
    <div className={`p-3 rounded-lg border border-border/50 bg-card/40 space-y-1.5`}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block size-2 rounded-full ${st.bar}`} />
          <span className="font-medium truncate">{item.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.trend && <TrendIcon t={item.trend} />}
          <span className={`font-bold ${st.text}`}>{item.score}</span>
        </div>
      </div>
      <div className="h-1.5 rounded bg-secondary/60 overflow-hidden">
        <div className={`h-full ${st.bar}`} style={{ width: `${item.score}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{item.detail}</span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {typeof item.impact === "number" && (
            <span title="Peso del fundamento en el resultado">Imp. {item.impact}%</span>
          )}
          {typeof item.confidence === "number" && (
            <span title="Confianza según volumen de datos">Conf. {item.confidence}%</span>
          )}
          {typeof item.seasonDelta === "number" && item.seasonDelta !== 0 && (
            <span className={item.seasonDelta > 0 ? "text-emerald-400" : "text-red-400"}>
              {item.seasonDelta > 0 ? "+" : ""}{item.seasonDelta} vs prom.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactPanel({ analysis }: { analysis: MatchAnalysis }) {
  const data = analysis.impactBreakdown.slice(0, 8);
  return (
    <Card className="p-4 bg-card/60 space-y-2">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <span className="font-semibold">Impacto por fundamento en el resultado</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border) / 0.4)" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => `${v}%`} />
            <Bar dataKey="impact" radius={[4, 4, 4, 4]}>
              {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ---------------- Radar comparativo ----------------

function RadarPanel({ analysis }: { analysis: MatchAnalysis }) {
  const [showRival, setShowRival] = useState(true);
  const [showSeason, setShowSeason] = useState(true);
  return (
    <Card className="p-4 bg-card/60 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <span className="font-semibold">Radar del rendimiento</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <ToggleChip color="bg-primary" active label="Equipo" onClick={() => {}} disabled />
          <ToggleChip color="bg-red-500" active={showRival} label="Rival" onClick={() => setShowRival((v) => !v)} />
          <ToggleChip color="bg-amber-500" active={showSeason} label="Prom. temporada" onClick={() => setShowSeason((v) => !v)} />
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer>
          <RadarChart data={analysis.radarCompare}>
            <PolarGrid stroke="hsl(var(--border) / 0.6)" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} angle={30} domain={[0, 100]} />
            <Radar name="Equipo" dataKey="equipo" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
            {showRival && <Radar name="Rival" dataKey="rival" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />}
            {showSeason && <Radar name="Temporada" dataKey="temporada" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} />}
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ToggleChip({ label, active, color, onClick, disabled }: { label: string; active: boolean; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition ${active ? "border-border bg-background" : "border-border/40 bg-transparent text-muted-foreground line-through"}`}
    >
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </button>
  );
}

// ---------------- Timeline ----------------

const TIMELINE_META = {
  run: { color: "border-emerald-500/40 bg-emerald-500/5", icon: <TrendingUp className="size-3.5 text-emerald-400" /> },
  opp_run: { color: "border-red-500/40 bg-red-500/5", icon: <TrendingDown className="size-3.5 text-red-400" /> },
  timeout: { color: "border-sky-500/40 bg-sky-500/5", icon: <TimerReset className="size-3.5 text-sky-400" /> },
  lead_change: { color: "border-amber-500/40 bg-amber-500/5", icon: <Activity className="size-3.5 text-amber-400" /> },
  peak: { color: "border-primary/40 bg-primary/5", icon: <Sparkles className="size-3.5 text-primary" /> },
  drop: { color: "border-orange-500/40 bg-orange-500/5", icon: <AlertTriangle className="size-3.5 text-orange-300" /> },
} as const;

function TimelinePanel({ analysis }: { analysis: MatchAnalysis }) {
  return (
    <Card className="p-4 bg-card/60 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <span className="font-semibold">Línea de tiempo del partido</span>
        <Badge variant="outline" className="ml-auto">{analysis.timeline.length} eventos</Badge>
      </div>
      {analysis.timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin eventos destacados registrados.</p>
      ) : (
        <ol className="relative border-l border-border/60 pl-4 space-y-2">
          {analysis.timeline.map((ev, i) => {
            const meta = TIMELINE_META[ev.kind];
            return (
              <li key={i} className={`relative rounded-md border p-2 ${meta.color}`}>
                <span className="absolute -left-[22px] top-2 size-3 rounded-full bg-background border-2 border-border" />
                <div className="flex items-center gap-2 text-sm font-medium">
                  {meta.icon}
                  <span>{ev.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Set {ev.setNumber} · {ev.scoreFor}-{ev.scoreAgainst}</span>
                </div>
                <div className="text-xs text-muted-foreground">{ev.detail}</div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

// ---------------- Simulador "¿qué pasaría si...?" ----------------

function SimulatorPanel({ analysis }: { analysis: MatchAnalysis }) {
  const initial = useMemo(() => {
    const map = new Map(analysis.rallyIndex.breakdown.map((b) => [b.key, b.score]));
    return map;
  }, [analysis]);
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(initial));
  const [locked, setLocked] = useState<Set<string>>(new Set());

  const overall = Math.round(
    analysis.rallyIndex.breakdown.reduce((a, b) => a + (values[b.key] ?? b.score), 0) /
      analysis.rallyIndex.breakdown.length,
  );
  const baseline = analysis.rallyIndex.overall;
  const delta = overall - baseline;
  // Impacto derivado en probabilidad de victoria (aprox.): overall ≥ 65 → alta.
  const victoryProb = Math.max(0, Math.min(100, Math.round(30 + (overall - 40) * 1.4)));

  const focusKeys = ["reception", "attack", "serve", "block", "k1", "k2"];
  const focus = analysis.rallyIndex.breakdown.filter((b) => focusKeys.includes(b.key));

  function reset() {
    setValues(Object.fromEntries(initial));
    setLocked(new Set());
  }

  return (
    <Card className="p-4 bg-card/60 space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-primary" />
        <span className="font-semibold">¿Qué pasaría si…?</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>Reiniciar</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-3 bg-background/40 border-border/50">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Índice Rally simulado</div>
          <div className={`text-3xl font-bold ${scoreColor(overall)}`}>{overall}<span className="text-sm text-muted-foreground">/100</span></div>
          <div className={`text-xs ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
            {delta > 0 ? "+" : ""}{delta} vs actual ({baseline})
          </div>
        </Card>
        <Card className="p-3 bg-background/40 border-border/50">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Prob. victoria estimada</div>
          <div className="text-3xl font-bold">{victoryProb}%</div>
          <div className="h-1.5 rounded bg-secondary/60 overflow-hidden mt-2">
            <div className={`h-full ${scoreBar(victoryProb)}`} style={{ width: `${victoryProb}%` }} />
          </div>
        </Card>
        <Card className="p-3 bg-background/40 border-border/50">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Lectura del simulador</div>
          <p className="text-sm">
            {delta >= 8
              ? "Los ajustes propuestos mejorarían sensiblemente el rendimiento y la probabilidad de victoria."
              : delta >= 3
              ? "Los ajustes propuestos generarían una mejora clara aunque acotada."
              : delta <= -5
              ? "Estos cambios reducirían el rendimiento respecto al partido real."
              : "Los ajustes propuestos apenas moverían el resultado."}
          </p>
        </Card>
      </div>

      <div className="space-y-3">
        {focus.map((b) => {
          const cur = values[b.key] ?? b.score;
          const isLocked = locked.has(b.key);
          return (
            <div key={b.key} className="p-3 rounded-lg border border-border/50 bg-background/30 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.label}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Actual <span className="text-foreground font-semibold">{b.score}</span></span>
                  <span>Simulado <span className={`font-semibold ${scoreColor(cur)}`}>{cur}</span></span>
                </span>
              </div>
              <Slider
                value={[cur]}
                min={0} max={100} step={1}
                disabled={isLocked}
                onValueChange={(v) => setValues((prev) => ({ ...prev, [b.key]: v[0] }))}
              />
              <div className="flex items-center justify-end">
                <button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => {
                  setLocked((s) => { const n = new Set(s); if (n.has(b.key)) n.delete(b.key); else n.add(b.key); return n; });
                }}>{isLocked ? "Editar" : "Fijar"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------- Fortalezas / Debilidades ----------------

function EvidenceRow({ metrics }: { metrics: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {metrics.map((m) => (
        <div key={m.label} className="px-2 py-1 rounded-md bg-secondary/50 border border-border/40 text-xs">
          <span className="text-muted-foreground mr-1">{m.label}:</span>
          <span className="font-semibold">{m.value}</span>
        </div>
      ))}
    </div>
  );
}

function StrengthsAndWeaknesses({ analysis }: { analysis: MatchAnalysis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm uppercase tracking-widest text-muted-foreground">
          <Sparkles className="size-4 text-emerald-400" /> Fortalezas ({analysis.strengths.length})
        </h3>
        {analysis.strengths.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin fortalezas destacadas con evidencia suficiente.</p>
        ) : (
          analysis.strengths.map((s) => (
            <Card key={s.id} className="p-4 space-y-2 border-emerald-500/20 bg-emerald-500/[0.04]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-emerald-300/80">{s.category}</div>
                  <div className="font-semibold">{s.title}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={IMP_COLOR[s.importance]} variant="outline">Importancia {IMP_LABEL[s.importance]}</Badge>
                  <span className="text-[10px] text-muted-foreground">Confianza {s.confidence}%</span>
                </div>
              </div>
              <EvidenceRow metrics={s.evidence.metrics} />
              <p className="text-sm">{s.conclusion}</p>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm uppercase tracking-widest text-muted-foreground">
          <AlertTriangle className="size-4 text-amber-400" /> Debilidades ({analysis.weaknesses.length})
        </h3>
        {analysis.weaknesses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin debilidades relevantes detectadas.</p>
        ) : (
          analysis.weaknesses.map((w) => (
            <Card key={w.id} className="p-4 space-y-2 border-amber-500/20 bg-amber-500/[0.04]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-amber-300/80">{w.category}</div>
                  <div className="font-semibold">{w.title}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={IMP_COLOR[w.impact]} variant="outline">Impacto {IMP_LABEL[w.impact]}</Badge>
                  <span className="text-[10px] text-muted-foreground">Confianza {w.confidence}%</span>
                </div>
              </div>
              <EvidenceRow metrics={w.evidence.metrics} />
              <p className="text-sm"><span className="text-muted-foreground">Consecuencia:</span> {w.consequence}</p>
              <p className="text-sm"><span className="text-muted-foreground">Acción:</span> {w.conclusion}</p>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}

function TrendsPanel({ analysis }: { analysis: MatchAnalysis }) {
  const setData = analysis.setTrends.map((s) => ({ ...s, set: `Set ${s.setNumber}` }));
  const zoneData = analysis.attackZones.map((z) => ({ zone: z.label, ataques: z.count, puntos: z.points, errores: z.errors }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4 bg-card/60">
        <div className="text-sm font-semibold mb-2">Evolución set a set</div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={setData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border) / 0.4)" strokeDasharray="3 3" />
              <XAxis dataKey="set" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="attackEff" name="Ataque %" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="receptionEff" name="Recepción %" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 bg-card/60">
        <div className="text-sm font-semibold mb-2">Distribución de ataques por zona</div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={zoneData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border) / 0.4)" strokeDasharray="3 3" />
              <XAxis dataKey="zone" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ataques" name="Intentos" fill="#6366f1" />
              <Bar dataKey="puntos" name="Puntos" fill="#10b981" />
              <Bar dataKey="errores" name="Errores" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-4 bg-card/60">
        <div className="text-sm font-semibold mb-2">Errores por set</div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={setData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border) / 0.4)" strokeDasharray="3 3" />
              <XAxis dataKey="set" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="serveErrors" name="Err. saque" fill="#f97316" />
              <Bar dataKey="attackErrors" name="Err. ataque" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {analysis.playerRadar.length > 0 && (
        <Card className="p-4 bg-card/60">
          <div className="text-sm font-semibold mb-2">Radar de jugadoras (top 3)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={buildPlayerRadarData(analysis)}>
                <PolarGrid stroke="hsl(var(--border) / 0.6)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} angle={30} domain={[0, 100]} />
                {analysis.playerRadar.slice(0, 3).map((p, i) => (
                  <Radar key={p.name} name={p.name} dataKey={p.name} stroke={RADAR_COLORS[i]} fill={RADAR_COLORS[i]} fillOpacity={0.15} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

const RADAR_COLORS = ["#10b981", "#6366f1", "#f59e0b"];
function buildPlayerRadarData(a: MatchAnalysis) {
  const axes = ["attack", "block", "ace", "reception", "discipline"] as const;
  const label: Record<(typeof axes)[number], string> = {
    attack: "Ataque", block: "Bloqueo", ace: "Saque", reception: "Recepción", discipline: "Disciplina",
  };
  return axes.map((ax) => {
    const row: Record<string, number | string> = { axis: label[ax] };
    a.playerRadar.slice(0, 3).forEach((p) => (row[p.name] = p[ax]));
    return row;
  });
}

function ComparisonPanel({ analysis }: { analysis: MatchAnalysis }) {
  const c = analysis.comparison;
  return (
    <Card className="p-4 bg-card/60">
      <div className="text-sm font-semibold mb-2">Comparación con {c.label}</div>
      {c.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Se necesita al menos un partido finalizado previo para comparar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left py-1">Métrica</th>
                <th className="text-right py-1">Este partido</th>
                <th className="text-right py-1">Referencia</th>
                <th className="text-right py-1">Δ</th>
                <th className="text-right py-1">Tend.</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.metric} className="border-t border-border/40">
                  <td className="py-1.5">{r.metric}</td>
                  <td className="text-right font-semibold">{r.current}</td>
                  <td className="text-right text-muted-foreground">{r.reference}</td>
                  <td className={`text-right ${r.delta > 0 ? "text-emerald-400" : r.delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {r.delta > 0 ? "+" : ""}{r.delta}
                  </td>
                  <td className="text-right"><span className="inline-flex justify-end"><TrendIcon t={r.trend} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TrainingPlanPanel({ analysis }: { analysis: MatchAnalysis }) {
  const plan = analysis.trainingPlan;
  return (
    <Card className="p-4 bg-card/60 space-y-3">
      <div className="flex items-center gap-2">
        <Dumbbell className="size-4 text-primary" />
        <span className="font-semibold">Plan de entrenamiento sugerido</span>
        <Badge variant="outline" className="ml-auto">{plan.totalMinutes} min</Badge>
      </div>
      <ul className="space-y-2">
        {plan.blocks.map((b) => (
          <li key={b.focus} className="flex gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30">
            <div className="text-lg font-bold text-primary w-12 shrink-0">{b.minutes}'</div>
            <div className="min-w-0">
              <div className="font-medium">{b.focus}</div>
              <div className="text-xs text-muted-foreground mb-1">Motivado por: {b.reason}</div>
              <div className="flex flex-wrap gap-1.5">
                {b.drills.map((d) => (
                  <span key={d} className="text-[11px] px-2 py-0.5 rounded bg-background border border-border/50">{d}</span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PrioritiesPanel({ analysis }: { analysis: MatchAnalysis }) {
  if (analysis.priorities.length === 0) return null;
  return (
    <Card className="p-4 bg-card/60 space-y-2">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-primary" />
        <span className="font-semibold">¿Qué debería entrenar primero?</span>
      </div>
      <ol className="space-y-2">
        {analysis.priorities.map((p, i) => (
          <li key={p.id} className="flex gap-3 items-start">
            <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{p.title}</span>
                <Badge className={IMP_COLOR[p.level]} variant="outline">Prioridad {IMP_LABEL[p.level]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.reason}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function RisksAndPredictions({ analysis }: { analysis: MatchAnalysis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/60 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-red-400" />
          <span className="font-semibold">Riesgos detectados</span>
        </div>
        {analysis.risks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin riesgos relevantes en este partido.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.risks.map((r) => (
              <li key={r.title} className="p-2 rounded border border-border/40 bg-secondary/30">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{r.title}</span>
                  <Badge className={IMP_COLOR[r.level]} variant="outline">{IMP_LABEL[r.level]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{r.detail}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 bg-card/60 space-y-2">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-amber-400" />
          <span className="font-semibold">Predicciones</span>
        </div>
        {analysis.predictions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tendencias suficientes para proyectar.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {analysis.predictions.map((p, i) => (
              <li key={i} className="p-2 rounded border border-border/40 bg-secondary/30">
                <div className="text-muted-foreground italic">{p.premise}</div>
                <div>{p.outcome}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-muted-foreground italic">* Estimaciones basadas en las tendencias del partido actual.</p>
      </Card>
    </div>
  );
}

function CoachInsightsPanel({ analysis }: { analysis: MatchAnalysis }) {
  const ci = analysis.coachInsights;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-card/60 space-y-2 md:col-span-2">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-primary" />
          <span className="font-semibold">Coach Insights</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InsightBlock title="¿Por qué este resultado?" text={ci.whyResult} tone="primary" />
          <InsightBlock title="Fundamento que explica el resultado" text={ci.fundamentalDrivingResult} tone="amber" />
          <InsightBlock title="Decisión táctica que funcionó" text={ci.keyDecisionThatWorked} tone="emerald" />
          <InsightBlock title="Decisión a reconsiderar" text={ci.decisionToReconsider} tone="red" />
        </div>
      </Card>

      <Card className="p-4 bg-card/60 space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="size-4 text-primary" />
          <span className="font-semibold">Preguntas para el entrenador</span>
        </div>
        {analysis.coachQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin preguntas críticas para revisar.</p>
        ) : (
          <ul className="space-y-1.5 text-sm list-disc pl-4">
            {analysis.coachQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        )}
      </Card>
      <Card className="p-4 bg-card/60 space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-400" />
          <span className="font-semibold">Recomendaciones</span>
        </div>
        <div className="space-y-2 text-sm">
          {(["inmediata", "mediano_plazo", "estrategica"] as const).map((h) => {
            const items = analysis.recommendations.filter((r) => r.horizon === h);
            if (items.length === 0) return null;
            const label = h === "inmediata" ? "Inmediatas" : h === "mediano_plazo" ? "Mediano plazo" : "Estratégicas";
            return (
              <div key={h}>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
                <ul className="list-disc pl-4">
                  {items.map((r, i) => <li key={i}>{r.text}</li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function InsightBlock({ title, text, tone }: { title: string; text: string; tone: "primary" | "amber" | "emerald" | "red" }) {
  const cls = tone === "primary" ? "border-primary/30 bg-primary/5"
    : tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/5"
    : tone === "amber" ? "border-amber-500/30 bg-amber-500/5"
    : "border-red-500/30 bg-red-500/5";
  return (
    <div className={`p-3 rounded-lg border ${cls}`}>
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-0.5">{title}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function SharePanel({ analysis, summaryMd }: { analysis: MatchAnalysis; summaryMd?: string }) {
  const d = analysis.dashboard;
  const url = typeof window !== "undefined" ? window.location.href : "";
  const summaryText =
    `Rally Intelligence — ${analysis.teamName} vs ${analysis.opponentName}\n` +
    `${d.result.toUpperCase()} · ${d.scoreline}\n` +
    `Índice Rally: ${d.rallyIndex}/100\n` +
    `Fortaleza: ${d.topStrength}\n` +
    `Debilidad: ${d.topWeakness}\n` +
    (summaryMd ? `\n${summaryMd}` : `\n${analysis.analystSummary}`);

  const copy = async () => { try { await navigator.clipboard.writeText(summaryText); } catch { /* ignore */ } };
  const copyUrl = async () => { try { await navigator.clipboard.writeText(url); } catch { /* ignore */ } };
  const wa = `https://wa.me/?text=${encodeURIComponent(summaryText + (url ? `\n${url}` : ""))}`;

  const exportPdf = async (format: "executive" | "full") => {
    const { downloadIntelligencePdf } = await import("@/lib/intelligence/intelligence-pdf");
    await downloadIntelligencePdf(analysis, format, summaryMd);
  };

  return (
    <Card className="p-4 bg-card/60 space-y-4">
      <div className="flex items-center gap-2">
        <Share2 className="size-4 text-primary" />
        <span className="font-semibold">Compartir informe</span>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Exportar a PDF</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => exportPdf("executive")}
            className="text-left rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 p-3 transition"
          >
            <div className="flex items-center gap-2 font-semibold">
              <FileText className="size-4 text-primary" /> Informe ejecutivo
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              2–3 páginas · resumen, índice, fortalezas, MVP, prioridades y conclusión.
            </div>
          </button>
          <button
            onClick={() => exportPdf("full")}
            className="text-left rounded-lg border border-border hover:bg-secondary/40 p-3 transition"
          >
            <div className="flex items-center gap-2 font-semibold">
              <FileText className="size-4" /> Informe técnico completo
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              10–20 páginas · portada, índice, capítulos por fundamento, radar, rotaciones, riesgos y plan.
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Compartir resumen</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copy} className="gap-2"><Copy className="size-4" /> Copiar resumen</Button>
          <Button variant="outline" onClick={copyUrl} className="gap-2"><Copy className="size-4" /> Copiar enlace</Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /> WhatsApp</a>
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------- Componente principal ----------------

export function ReportView({ analysis, summaryMd }: { analysis: MatchAnalysis; summaryMd?: string }) {
  const d = analysis.dashboard;
  const resultTone =
    d.result === "victoria" ? "border-emerald-500/40 text-emerald-300" :
    d.result === "derrota" ? "border-red-500/40 text-red-300" : "";
  return (
    <div className="space-y-5">
      {/* Encabezado ejecutivo */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold">{analysis.teamName} <span className="text-muted-foreground font-normal">vs</span> {analysis.opponentName}</h2>
          <Badge variant="outline" className={resultTone}>{d.result.toUpperCase()}</Badge>
          <span className="text-sm text-muted-foreground">{d.scoreline}</span>
          <span className="text-sm text-muted-foreground">· {d.date}</span>
          {d.durationMin !== null && <span className="text-sm text-muted-foreground">· {d.durationMin} min</span>}
          {d.competition && <span className="text-sm text-muted-foreground">· {d.competition}</span>}
        </div>
      </div>

      {/* 1. Resumen del analista */}
      <AnalystSummaryCard analysis={analysis} summaryMd={summaryMd} />

      {/* 2. Executive cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard icon={<Trophy className="size-3.5" />} label="Índice Rally" value={<span className={scoreColor(d.rallyIndex)}>{d.rallyIndex}<span className="text-sm text-muted-foreground">/100</span></span>} sub="Rendimiento global del equipo" />
        <StatCard icon={<Sparkles className="size-3.5" />} label="Fortaleza principal" value={<span className="text-emerald-400">{d.topStrength}</span>} />
        <StatCard icon={<AlertTriangle className="size-3.5" />} label="Debilidad principal" value={<span className="text-amber-300">{d.topWeakness}</span>} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <AwardCard icon={<Award className="size-4" />} label="MVP" name={d.awards.mvp?.name} detail={d.awards.mvp?.detail} />
        <AwardCard icon={<Target className="size-4" />} label="Mejor atacante" name={d.awards.bestAttacker?.name} detail={d.awards.bestAttacker?.detail} />
        <AwardCard icon={<Shield className="size-4" />} label="Mejor receptora" name={d.awards.bestReceiver?.name} detail={d.awards.bestReceiver?.detail} />
        <AwardCard icon={<Zap className="size-4" />} label="Mejor sacador" name={d.awards.bestServer?.name} detail={d.awards.bestServer?.detail} />
        <AwardCard icon={<HeartHandshake className="size-4" />} label="Más eficiente" name={d.awards.mostEfficient?.name} detail={d.awards.mostEfficient?.detail} />
      </div>

      {/* 3. Rally Index protagonista */}
      <RallyIndexHero analysis={analysis} />

      {/* Pestañas del resto del informe */}
      <Tabs defaultValue="radar" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="radar">Radar</TabsTrigger>
          <TabsTrigger value="impact">Impacto</TabsTrigger>
          <TabsTrigger value="fd">Fortalezas / Debilidades</TabsTrigger>
          <TabsTrigger value="tend">Tendencias</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="sim">Simulador</TabsTrigger>
          <TabsTrigger value="prior">Prioridades y plan</TabsTrigger>
          <TabsTrigger value="riesgos">Riesgos y predicciones</TabsTrigger>
          <TabsTrigger value="coach">Coach Insights</TabsTrigger>
          <TabsTrigger value="comp">Comparación</TabsTrigger>
          <TabsTrigger value="share">Compartir</TabsTrigger>
        </TabsList>

        <TabsContent value="radar" className="mt-4"><RadarPanel analysis={analysis} /></TabsContent>
        <TabsContent value="impact" className="mt-4"><ImpactPanel analysis={analysis} /></TabsContent>
        <TabsContent value="fd" className="mt-4"><StrengthsAndWeaknesses analysis={analysis} /></TabsContent>
        <TabsContent value="tend" className="mt-4"><TrendsPanel analysis={analysis} /></TabsContent>
        <TabsContent value="timeline" className="mt-4"><TimelinePanel analysis={analysis} /></TabsContent>
        <TabsContent value="sim" className="mt-4"><SimulatorPanel analysis={analysis} /></TabsContent>
        <TabsContent value="prior" className="mt-4 space-y-4">
          <PrioritiesPanel analysis={analysis} />
          <TrainingPlanPanel analysis={analysis} />
        </TabsContent>
        <TabsContent value="riesgos" className="mt-4"><RisksAndPredictions analysis={analysis} /></TabsContent>
        <TabsContent value="coach" className="mt-4"><CoachInsightsPanel analysis={analysis} /></TabsContent>
        <TabsContent value="comp" className="mt-4"><ComparisonPanel analysis={analysis} /></TabsContent>
        <TabsContent value="share" className="mt-4"><SharePanel analysis={analysis} summaryMd={summaryMd} /></TabsContent>
      </Tabs>

      {/* Cierre ejecutivo */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 via-card to-card/40 border-primary/30 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
          <span className="font-semibold">Conclusión ejecutiva</span>
          <div className={`ml-auto text-3xl font-bold ${scoreColor(d.rallyIndex)}`}>{d.rallyIndex}<span className="text-sm text-muted-foreground">/100</span></div>
        </div>
        <div className="grid gap-2 md:grid-cols-3 text-sm">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Resultado</div>
            <div className="font-semibold capitalize">{d.result} · {d.scoreline}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Fortaleza clave</div>
            <div className="font-semibold text-emerald-400">{d.topStrength}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Foco de mejora</div>
            <div className="font-semibold text-amber-300">{d.topWeakness}</div>
          </div>
        </div>
        {summaryMd && (
          <>
            <Separator />
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{summaryMd}</div>
          </>
        )}
      </Card>
    </div>
  );
}
