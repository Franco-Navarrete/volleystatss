// Rally Intelligence — vista rica de un informe de partido.
// Renderiza dashboard + índice Rally + fortalezas/debilidades + gráficos
// + prioridades + plan de entrenamiento + riesgos + predicciones + cierre.

import type { MatchAnalysis, Importance, Trend } from "@/lib/intelligence/analysis";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import {
  Trophy, Target, Shield, Zap, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Sparkles, Dumbbell, MessageCircleQuestion, Lightbulb,
  Award, HeartHandshake, ClipboardList,
} from "lucide-react";
import type { ReactNode } from "react";

const IMP_COLOR: Record<Importance, string> = {
  baja: "bg-secondary/60 text-foreground border-border/60",
  media: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  alta: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  muy_alta: "bg-red-500/15 text-red-300 border-red-500/40",
};
const IMP_LABEL: Record<Importance, string> = {
  baja: "Baja", media: "Media", alta: "Alta", muy_alta: "Muy Alta",
};

function TrendIcon({ t }: { t?: Trend }) {
  if (t === "up") return <TrendingUp className="size-3.5 text-emerald-400" />;
  if (t === "down") return <TrendingDown className="size-3.5 text-red-400" />;
  return <Minus className="size-3.5 text-muted-foreground" />;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-300";
  if (score >= 40) return "text-orange-300";
  return "text-red-400";
}

function scoreBarColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 55) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-500";
}

// ---------------- Sub-componentes ----------------

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-4 flex flex-col gap-1 bg-card/60 border-border/60">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        <span>{label}</span>
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
      <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-semibold truncate">{name}</div>
        {detail && <div className="text-xs text-muted-foreground truncate">{detail}</div>}
      </div>
    </Card>
  );
}

function RallyIndexPanel({ analysis }: { analysis: MatchAnalysis }) {
  const { overall, breakdown } = analysis.rallyIndex;
  return (
    <Card className="p-5 space-y-4 bg-card/60 border-border/60">
      <div className="flex items-end gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Índice Rally</div>
          <div className={`text-6xl font-bold leading-none ${scoreColor(overall)}`}>{overall}<span className="text-2xl text-muted-foreground">/100</span></div>
        </div>
        <div className="text-sm text-muted-foreground pb-2">
          Calificación global derivada de 10 fundamentos ponderados.
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {breakdown.map((b) => (
          <div key={b.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{b.label}</span>
              <span className={`font-semibold ${scoreColor(b.score)}`}>{b.score}</span>
            </div>
            <div className="h-2 rounded bg-secondary/60 overflow-hidden">
              <div className={`h-full ${scoreBarColor(b.score)}`} style={{ width: `${b.score}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground">{b.detail}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

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
              {s.evidence.comparisonLabel && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendIcon t={s.evidence.trend} />
                  {s.evidence.comparisonLabel}: {s.evidence.comparisonDelta ?? 0 > 0 ? "+" : ""}{s.evidence.comparisonDelta}
                </div>
              )}
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
          <div className="text-sm font-semibold mb-2">Radar de jugadoras (top 5)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={buildRadarData(analysis)}>
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
function buildRadarData(a: MatchAnalysis) {
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
        <span className="font-semibold">Prioridades para trabajar</span>
      </div>
      <ol className="space-y-2">
        {analysis.priorities.map((p, i) => (
          <li key={p.id} className="flex gap-3 items-start">
            <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-2">
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

function CoachSection({ analysis }: { analysis: MatchAnalysis }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
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

function ExecutiveConclusion({ analysis, summaryMd }: { analysis: MatchAnalysis; summaryMd?: string }) {
  const d = analysis.dashboard;
  return (
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
  );
}

// ---------------- Componente principal ----------------

export function ReportView({ analysis, summaryMd }: { analysis: MatchAnalysis; summaryMd?: string }) {
  const d = analysis.dashboard;
  return (
    <div className="space-y-5">
      {/* Header + dashboard ejecutivo */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold">{analysis.teamName} <span className="text-muted-foreground font-normal">vs</span> {analysis.opponentName}</h2>
          <Badge variant="outline" className={
            d.result === "victoria" ? "border-emerald-500/40 text-emerald-300" :
            d.result === "derrota" ? "border-red-500/40 text-red-300" : ""
          }>{d.result.toUpperCase()}</Badge>
          <span className="text-sm text-muted-foreground">{d.scoreline}</span>
          <span className="text-sm text-muted-foreground">· {d.date}</span>
          {d.durationMin !== null && <span className="text-sm text-muted-foreground">· {d.durationMin} min</span>}
          {d.competition && <span className="text-sm text-muted-foreground">· {d.competition}</span>}
        </div>
      </div>

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

      {/* Pestañas con el resto del informe */}
      <Tabs defaultValue="indice" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="indice">Índice Rally</TabsTrigger>
          <TabsTrigger value="fd">Fortalezas / Debilidades</TabsTrigger>
          <TabsTrigger value="tend">Tendencias y gráficos</TabsTrigger>
          <TabsTrigger value="comp">Comparación</TabsTrigger>
          <TabsTrigger value="prior">Prioridades y plan</TabsTrigger>
          <TabsTrigger value="riesgos">Riesgos y predicciones</TabsTrigger>
          <TabsTrigger value="coach">Preguntas y recomendaciones</TabsTrigger>
          <TabsTrigger value="concl">Conclusión</TabsTrigger>
        </TabsList>

        <TabsContent value="indice" className="mt-4"><RallyIndexPanel analysis={analysis} /></TabsContent>
        <TabsContent value="fd" className="mt-4"><StrengthsAndWeaknesses analysis={analysis} /></TabsContent>
        <TabsContent value="tend" className="mt-4"><TrendsPanel analysis={analysis} /></TabsContent>
        <TabsContent value="comp" className="mt-4"><ComparisonPanel analysis={analysis} /></TabsContent>
        <TabsContent value="prior" className="mt-4 space-y-4">
          <PrioritiesPanel analysis={analysis} />
          <TrainingPlanPanel analysis={analysis} />
        </TabsContent>
        <TabsContent value="riesgos" className="mt-4"><RisksAndPredictions analysis={analysis} /></TabsContent>
        <TabsContent value="coach" className="mt-4"><CoachSection analysis={analysis} /></TabsContent>
        <TabsContent value="concl" className="mt-4"><ExecutiveConclusion analysis={analysis} summaryMd={summaryMd} /></TabsContent>
      </Tabs>
    </div>
  );
}
