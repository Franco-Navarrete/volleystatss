import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  Flame,
  Lightbulb,
  ListChecks,
  Radar,
  Radio,
  Target,
  TimerReset,
  Users,
  Zap,
} from "lucide-react";

import type { Match, Team } from "@/lib/volley-store";
import { setsWon } from "@/lib/volley-store";
import {
  computeMomentum,
  computeTimeline,
  currentSetRotationDeltas,
  generateInsights,
  receiverMap,
  servePressure,
  winProbabilityCurrentSet,
  type CoachAlert,
  type CoachPriority,
  type CoachRecommendation,
  type Impact,
  type MomentumPoint,
  type RotationDelta,
  type Side,
  type TimelineItem,
} from "@/lib/coach/insights";
import { TeamBadge } from "@/components/TeamBadge";
import { cn } from "@/lib/utils";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
  /** Lado propio del entrenador. Por defecto A. */
  coachSide?: Side;
}

const IMPACT_STYLES: Record<Impact, string> = {
  high: "border-destructive/40 bg-destructive/20 text-white dark:text-white",
  med: "border-warning/60 bg-warning/20 text-white dark:text-white",
  low: "border-primary/40 bg-primary/20 text-white dark:text-white",
};
const IMPACT_LABEL: Record<Impact, string> = { high: "ALTO", med: "MEDIO", low: "BAJO" };

export function CoachLiveDashboard({ match, teamA, teamB, coachSide = "A" }: Props) {
  const insights = useMemo(
    () => generateInsights({ match, teamA, teamB, ownSide: coachSide }),
    [match, teamA, teamB, coachSide],
  );
  const momentum = useMemo(() => computeMomentum(match), [match]);
  const timeline = useMemo(() => computeTimeline(match), [match]);
  const rotOwn = useMemo(() => currentSetRotationDeltas(match, coachSide), [match, coachSide]);
  const rotOpp = useMemo(
    () => currentSetRotationDeltas(match, coachSide === "A" ? "B" : "A"),
    [match, coachSide],
  );
  const receivers = useMemo(() => receiverMap(match, coachSide), [match, coachSide]);
  const rivalServers = useMemo(
    () => servePressure(match, coachSide === "A" ? "B" : "A"),
    [match, coachSide],
  );
  const winProb = useMemo(() => winProbabilityCurrentSet(match), [match]);

  const ownTeam = coachSide === "A" ? teamA : teamB;
  const rivalTeam = coachSide === "A" ? teamB : teamA;

  return (
    <div className="space-y-4 animate-fade-in">
      <TacticalHeader
        match={match}
        teamA={teamA}
        teamB={teamB}
        coachSide={coachSide}
        momentum={momentum}
        winProb={winProb}
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <AlertsPanel alerts={insights.alerts} />
        <RecommendationsPanel recs={insights.recommendations} />
      </div>

      <PrioritiesCard priorities={insights.priorities} />

      <MomentumChart match={match} momentum={momentum} teamA={teamA} teamB={teamB} coachSide={coachSide} />

      <div className="grid lg:grid-cols-2 gap-4">
        <RotationRiskBoard team={ownTeam} rot={rotOwn} title="Mis rotaciones" />
        <RotationRiskBoard team={rivalTeam} rot={rotOpp} title="Rotaciones rival" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ReceiverMapCard team={ownTeam} rows={receivers} />
        <ServePressureCard team={rivalTeam} rows={rivalServers} />
      </div>

      <TimelinePanel items={timeline} teamA={teamA} teamB={teamB} />
    </div>
  );
}

// ─────────────────────────────── Header ───────────────────────────────

function TacticalHeader({
  match,
  teamA,
  teamB,
  coachSide,
  momentum,
  winProb,
}: {
  match: Match;
  teamA: Team;
  teamB: Team;
  coachSide: Side;
  momentum: ReturnType<typeof computeMomentum>;
  winProb: { A: number; B: number };
}) {
  const set = match.sets.find((s) => s.number === match.currentSet);
  const w = setsWon(match);
  const start = match.setStartTimes?.[match.currentSet];
  const elapsed = start ? Math.floor((Date.now() - start) / 60000) : null;
  const serving = match.servingSide;
  const streak = momentum.streak;

  return (
    <section className="rounded-2xl border border-border/60 bg-gradient-surface shadow-elevated overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        <TeamLine team={teamA} score={set?.scoreA ?? 0} sets={w.a} serving={serving === "A"} align="left" />
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Set {match.currentSet}
            {elapsed !== null && <> · {elapsed} min</>}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-primary font-bold mt-1">EN VIVO</div>
        </div>
        <TeamLine team={teamB} score={set?.scoreB ?? 0} sets={w.b} serving={serving === "B"} align="right" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-t border-border/60 text-xs">
        <MiniStat label="Parcial últimos 10" value={`${momentum.parcial.A}-${momentum.parcial.B}`} />
        <MiniStat
          label="Racha"
          value={streak ? `${streak.length}× ${streak.side === coachSide ? "propia" : "rival"}` : "–"}
          tone={streak && streak.side !== coachSide && streak.length >= 3 ? "danger" : "default"}
        />
        <MiniStat label="Prob. victoria set" value={`${coachSide === "A" ? winProb.A : winProb.B}%`} />
        <MiniStat label="Saque" value={serving === coachSide ? "Propio" : "Rival"} />
      </div>

      <Last10Strip last10={momentum.last10} coachSide={coachSide} />
    </section>
  );
}

function TeamLine({
  team, score, sets, serving, align,
}: { team: Team; score: number; sets: number; serving: boolean; align: "left" | "right" }) {
  return (
    <div className={cn("flex items-center gap-3 min-w-0", align === "right" && "flex-row-reverse text-right")}>
      <TeamBadge team={team} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate flex items-center gap-1.5">
          {align === "left" && serving && <span className="size-2 rounded-full bg-primary animate-pulse" />}
          <span className="truncate">{team.shortName}</span>
          {align === "right" && serving && <span className="size-2 rounded-full bg-primary animate-pulse" />}
        </div>
        <div className="scoreboard-digit text-4xl sm:text-5xl font-black leading-none text-primary tabular-nums">
          {score}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Sets {sets}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className={cn("scoreboard-digit font-black text-base tabular-nums", tone === "danger" && "text-destructive")}>{value}</div>
    </div>
  );
}

function Last10Strip({ last10, coachSide }: { last10: Side[]; coachSide: Side }) {
  const cells = Array.from({ length: 10 }, (_, i) => last10[i]);
  return (
    <div className="px-4 py-2 border-t border-border/60 flex items-center gap-1">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mr-2">Últimos 10</span>
      {cells.map((s, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 h-2 rounded",
            !s && "bg-border/40",
            s === coachSide && "bg-primary",
            s && s !== coachSide && "bg-destructive/70",
          )}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────── Alerts / Recs ───────────────────────

function AlertsPanel({ alerts }: { alerts: CoachAlert[] }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <Brain className="size-4 text-primary" />
        <h3 className="font-bold text-xs uppercase tracking-wider">IA · Situación actual</h3>
      </header>
      <div className="p-3 space-y-2">
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No se detectan alertas tácticas en este momento.
          </p>
        ) : (
          alerts.map((a) => (
            <div key={a.id} className={cn("rounded-lg border px-3 py-2 animate-fade-in", IMPACT_STYLES[a.impact])}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight">{a.title}</div>
                  <div className="text-xs text-white/90 dark:text-white/80 mt-0.5">{a.detail}</div>
                </div>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-background/60">{IMPACT_LABEL[a.impact]}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RecommendationsPanel({ recs }: { recs: CoachRecommendation[] }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <Lightbulb className="size-4 text-primary" />
        <h3 className="font-bold text-xs uppercase tracking-wider">¿Qué haría Rally?</h3>
      </header>
      <div className="p-3 space-y-2">
        {recs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            Sin recomendaciones específicas. Mantené el plan.
          </p>
        ) : (
          recs.map((r) => (
            <div key={r.id} className="rounded-lg border border-primary/40 bg-primary/20 px-3 py-2 animate-fade-in">
              <div className="flex items-start gap-2">
                <Target className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold leading-tight text-white dark:text-white">{r.title}</div>
                  <div className="text-xs text-white/90 dark:text-white/80 mt-0.5">{r.detail}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────── Prioridades ─────────────────────────

function PrioritiesCard({ priorities }: { priorities: CoachPriority[] }) {
  if (priorities.length === 0) return null;
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <ListChecks className="size-4 text-primary" />
        <h3 className="font-bold text-xs uppercase tracking-wider">Qué corregir ahora</h3>
      </header>
      <ol className="divide-y divide-border/40">
        {priorities.map((p, i) => (
          <li key={p.id} className="px-4 py-2.5 flex items-center gap-3">
            <span className="scoreboard-digit font-black text-primary text-lg w-6 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{p.title}</div>
              <div className="text-[11px] text-muted-foreground truncate">{p.detail}</div>
            </div>
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded", IMPACT_STYLES[p.impact])}>
              {IMPACT_LABEL[p.impact]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─────────────────────────────── Momentum ────────────────────────────

function MomentumChart({
  momentum, teamA, teamB, coachSide,
}: {
  match: Match;
  momentum: ReturnType<typeof computeMomentum>;
  teamA: Team;
  teamB: Team;
  coachSide: Side;
}) {
  const points = momentum.points.slice(-15);
  const markers = momentum.markers.filter((m) => m.index >= (momentum.points.length - 15));
  if (points.length === 0) {
    return null;
  }
  const maxAbs = Math.max(3, ...points.map((p) => Math.abs(p.delta)));
  const width = 100;
  const height = 60;
  const step = width / Math.max(1, points.length - 1);
  const yFor = (delta: number) => height / 2 - (delta / maxAbs) * (height / 2 - 4);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${yFor(p.delta).toFixed(2)}`)
    .join(" ");

  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <Flame className="size-4 text-primary" />
        <h3 className="font-bold text-xs uppercase tracking-wider">Momentum · últimos {points.length} rallies</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">↑ {(coachSide === "A" ? teamA : teamB).shortName}</span>
      </header>
      <div className="p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
          <line x1={0} y1={height / 2} x2={width} y2={height / 2} className="stroke-border" strokeWidth={0.3} />
          <path d={path} fill="none" className="stroke-primary" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle
              key={p.timestamp}
              cx={(i * step).toFixed(2)}
              cy={yFor(p.delta).toFixed(2)}
              r={p.scoringSide === coachSide ? 1.2 : 1.2}
              className={p.scoringSide === coachSide ? "fill-primary" : "fill-destructive"}
            />
          ))}
          {markers.map((m) => {
            const pi = points.findIndex((p) => p.index === m.index);
            const x = pi >= 0 ? pi * step : 0;
            return (
              <line
                key={m.timestamp}
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                strokeDasharray="1 1"
                className={m.kind === "timeout" ? "stroke-warning" : "stroke-info"}
                strokeWidth={0.3}
              />
            );
          })}
        </svg>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-primary" />{(coachSide === "A" ? teamA : teamB).shortName}</span>
          <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" />{(coachSide === "A" ? teamB : teamA).shortName}</span>
          <span>| TO · Cambio</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────── Rotaciones ──────────────────────────

function RotationRiskBoard({ team, rot, title }: { team: Team; rot: { rows: RotationDelta[]; currentRot: number }; title: string }) {
  const riskColor: Record<RotationDelta["risk"], string> = {
    critical: "bg-destructive/20 border-destructive/50 text-destructive",
    warn: "bg-warning/15 border-warning/40",
    ok: "bg-background/40 border-border/60",
    elite: "bg-success/15 border-success/40 text-success",
  };
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60" style={{ background: `${team.color}22` }}>
        <Radar className="size-4" />
        <h3 className="font-bold text-xs uppercase tracking-wider truncate flex-1">{title} · {team.shortName}</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Actual <span className="scoreboard-digit text-primary text-sm">R{rot.currentRot}</span>
        </span>
      </header>
      <div className="grid grid-cols-3 gap-2 p-3">
        {rot.rows.map((r) => (
          <div key={r.rotation} className={cn("rounded-lg border p-2 text-center", riskColor[r.risk], r.isCurrent && "ring-2 ring-primary")}>
            <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">R{r.rotation}</div>
            <div className="scoreboard-digit font-black text-lg tabular-nums">
              {r.diff > 0 ? `+${r.diff}` : r.diff}
            </div>
            <div className="text-[10px] tabular-nums text-muted-foreground">{r.pf}-{r.pc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────── Receiver map ────────────────────────

function ReceiverMapCard({ team, rows }: { team: Team; rows: ReturnType<typeof receiverMap> }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60">
        <Users className="size-4 text-primary" />
        <h3 className="font-bold text-xs uppercase tracking-wider truncate">Recepción · {team.shortName}</h3>
      </header>
      <div className="p-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Sin recepciones en este set.</p>
        ) : (
          rows.map((r) => {
            const player = team.players.find((p) => p.id === r.playerId);
            if (!player) return null;
            const size = 20 + Math.round((r.total / max) * 24);
            const tone = r.positivity >= 60 ? "bg-success/20 text-success border-success/40"
              : r.positivity >= 40 ? "bg-warning/20 text-warning border-warning/40"
              : "bg-destructive/20 text-destructive border-destructive/40";
            return (
              <div key={r.playerId} className="flex items-center gap-2">
                <div
                  className={cn("shrink-0 rounded-full border flex items-center justify-center scoreboard-digit font-black tabular-nums", tone)}
                  style={{ width: size, height: size, fontSize: `${Math.max(10, size * 0.4)}px` }}
                >
                  {player.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{player.name}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {r.total} rec · <span className="text-success">#{r.doublePositive} +{r.positive}</span> · 0{r.neutral} · <span className="text-destructive">-{r.negative} ={r.doubleNegative} ≠{r.overpass}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="scoreboard-digit font-black text-base tabular-nums">{r.positivity.toFixed(0)}%</div>
                  <div className="text-[9px] text-muted-foreground uppercase">+</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────── Serve pressure (rival) ──────────────

function ServePressureCard({ team, rows }: { team: Team; rows: ReturnType<typeof servePressure> }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60">
        <Radio className="size-4 text-primary" />
        <h3 className="font-bold text-xs uppercase tracking-wider truncate">Saque rival · {team.shortName}</h3>
      </header>
      <div className="p-3">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Sin aces ni errores de saque en el set.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[9px] uppercase text-muted-foreground">
              <tr>
                <th className="text-left py-1">Sacador</th>
                <th className="text-center">Aces</th>
                <th className="text-center">Errores</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const player = team.players.find((p) => p.id === r.playerId);
                return (
                  <tr key={r.playerId ?? "unknown"} className="border-t border-border/40">
                    <td className="py-1.5">{player ? `#${player.number} ${player.name}` : "—"}</td>
                    <td className="text-center tabular-nums font-bold text-primary">{r.aces}</td>
                    <td className="text-center tabular-nums text-destructive">{r.errors}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────── Timeline ────────────────────────────

function TimelinePanel({ items, teamA, teamB }: { items: TimelineItem[]; teamA: Team; teamB: Team }) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(-12);
  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <TimerReset className="size-4 text-primary" />
        <h3 className="font-bold text-xs uppercase tracking-wider">Timeline del set</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-1"
        >
          {open ? "Ver últimos" : "Ver todo"} <ChevronDown className={cn("size-3 transition", open && "rotate-180")} />
        </button>
      </header>
      <div className="p-3 flex flex-wrap gap-1.5">
        {shown.map((it) => {
          const team = it.side === "A" ? teamA : teamB;
          const isDanger = it.kind === "error";
          const isAce = it.kind === "ace";
          const isDec = it.kind === "decisive";
          const isSpec = it.kind === "timeout" || it.kind === "sub";
          return (
            <span
              key={it.id}
              title={`${team.shortName} · ${it.label}${it.scoreA !== undefined ? ` · ${it.scoreA}-${it.scoreB}` : ""}`}
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold",
                isSpec && "border-warning/50 bg-warning/10 text-warning",
                isAce && "border-primary/50 bg-primary/10 text-primary",
                isDanger && "border-destructive/40 bg-destructive/10 text-destructive",
                isDec && "border-primary bg-primary text-primary-foreground",
                !isSpec && !isAce && !isDanger && !isDec && "border-border/60 bg-background/40",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ background: team.color }} />
              {it.label}
              {it.scoreA !== undefined && (
                <span className="tabular-nums opacity-70">{it.scoreA}-{it.scoreB}</span>
              )}
            </span>
          );
        })}
        {shown.length === 0 && (
          <span className="text-xs text-muted-foreground">Sin eventos aún.</span>
        )}
      </div>
    </section>
  );
}

// Re-export para conveniencia
export { computeMomentum, type MomentumPoint, type Impact, Zap };
