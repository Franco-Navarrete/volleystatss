import { useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Match, Team } from "@/lib/volley-store";
import {
  computeServeAnalytics,
  SERVE_ZONES,
  SERVE_ZONE_LABEL,
  findPlayer,
  type ServeAnalytics,
  type ServeFilters,
  type SideAnalytics,
  type ServeZone,
  type ReceiverStats,
  type ServePattern,
  type ServeRecommendation,
} from "@/lib/coach/serve-heatmap";
import { AlertTriangle, Crosshair, Flame, Lightbulb, Radar, Target, TrendingUp, Zap } from "lucide-react";

/** Vista para pintar el color del heatmap por zona. */
type ViewMode = "frequency" | "efficacy" | "aces" | "errors" | "recNeg" | "recPerfect";

const VIEW_LABEL: Record<ViewMode, string> = {
  frequency: "Frecuencia",
  efficacy: "Eficacia",
  aces: "Aces",
  errors: "Errores",
  recNeg: "Recepción −",
  recPerfect: "Recepción #",
};

/** Layout 2×3 para la cancha del receptor (misma disposición que AttackHeatmap origin). */
const RECEIVER_ROWS: ServeZone[][] = [
  [4, 3, 2],
  [5, 6, 1],
];

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
}

export function ServeHeatmapPanel({ match, teamA, teamB }: Props) {
  const [view, setView] = useState<ViewMode>("frequency");

  // Filtros básicos combinables (los más útiles en vivo).
  const [setFilter, setSetFilter] = useState<string>("all");
  const [serverRot, setServerRot] = useState<string>("all");
  const [receiverRot, setReceiverRot] = useState<string>("all");
  const [serverA, setServerA] = useState<string>("all");
  const [serverB, setServerB] = useState<string>("all");
  const [outcome, setOutcome] = useState<string>("all");

  const availableSets = useMemo(
    () => [...new Set(match.events.map((e) => e.setNumber))].sort((a, b) => a - b),
    [match.events],
  );

  const filtersBase: ServeFilters = {
    setNumber: setFilter === "all" ? "all" : Number(setFilter),
    serverRotation: serverRot === "all" ? "all" : Number(serverRot),
    receiverRotation: receiverRot === "all" ? "all" : Number(receiverRot),
    outcome: outcome as ServeFilters["outcome"],
  };

  // Recomputamos dos analíticas: una por lado sacador con el filtro de jugador correspondiente.
  const analyticsA = useMemo(
    () => computeServeAnalytics(match, teamA, teamB, { ...filtersBase, serverId: serverA === "all" ? "all" : serverA }),
    [match, teamA, teamB, filtersBase.setNumber, filtersBase.serverRotation, filtersBase.receiverRotation, filtersBase.outcome, serverA],
  );
  const analyticsB = useMemo(
    () => computeServeAnalytics(match, teamA, teamB, { ...filtersBase, serverId: serverB === "all" ? "all" : serverB }),
    [match, teamA, teamB, filtersBase.setNumber, filtersBase.serverRotation, filtersBase.receiverRotation, filtersBase.outcome, serverB],
  );
  // Para patrones/predicción globales usamos analytics sin filtro de sacador.
  const analyticsGlobal = useMemo(
    () => computeServeAnalytics(match, teamA, teamB, filtersBase),
    [match, teamA, teamB, filtersBase.setNumber, filtersBase.serverRotation, filtersBase.receiverRotation, filtersBase.outcome],
  );

  return (
    <div className="space-y-5">
      {/* Modo de visualización */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(VIEW_LABEL) as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-md border transition ${
              view === v
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <FilterSelect
          label="Set" value={setFilter} onChange={setSetFilter}
          options={[{ value: "all", label: "Todos" }, ...availableSets.map((n) => ({ value: String(n), label: `Set ${n}` }))]}
        />
        <FilterSelect
          label="Rot. sacador" value={serverRot} onChange={setServerRot}
          options={[{ value: "all", label: "Todas" }, ...[1, 2, 3, 4, 5, 6].map((r) => ({ value: String(r), label: `R${r}` }))]}
        />
        <FilterSelect
          label="Rot. receptor" value={receiverRot} onChange={setReceiverRot}
          options={[{ value: "all", label: "Todas" }, ...[1, 2, 3, 4, 5, 6].map((r) => ({ value: String(r), label: `R${r}` }))]}
        />
        <FilterSelect
          label="Resultado" value={outcome} onChange={setOutcome}
          options={[
            { value: "all", label: "Todos" },
            { value: "ace", label: "Ace" },
            { value: "error", label: "Error" },
            { value: "in_play", label: "En juego" },
          ]}
        />
        <FilterSelect
          label={`Sacador · ${teamA.shortName ?? "A"}`} value={serverA} onChange={setServerA}
          options={[{ value: "all", label: "Todos" }, ...teamA.players.map((p) => ({ value: p.id, label: `#${p.number} ${p.name}` }))]}
        />
        <FilterSelect
          label={`Sacador · ${teamB.shortName ?? "B"}`} value={serverB} onChange={setServerB}
          options={[{ value: "all", label: "Todos" }, ...teamB.players.map((p) => ({ value: p.id, label: `#${p.number} ${p.name}` }))]}
        />
      </div>

      {/* KPIs por equipo */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ServeKpis team={teamA} rivalTeam={teamB} sideAnalytics={analyticsA.A} />
        <ServeKpis team={teamB} rivalTeam={teamA} sideAnalytics={analyticsB.B} />
      </div>

      {/* Canchas rivales (dónde cae el saque) */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ReceiverCourt
          serverTeam={teamA} receiverTeam={teamB}
          sideAnalytics={analyticsA.A} view={view}
        />
        <ReceiverCourt
          serverTeam={teamB} receiverTeam={teamA}
          sideAnalytics={analyticsB.B} view={view}
        />
      </div>

      {/* Mapa de receptores */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ReceiversMap serverTeam={teamA} receiverTeam={teamB} sideAnalytics={analyticsA.A} />
        <ReceiversMap serverTeam={teamB} receiverTeam={teamA} sideAnalytics={analyticsB.B} />
      </div>

      {/* Patrones + Predicción */}
      <div className="grid lg:grid-cols-2 gap-3">
        <PatternsPanel patterns={analyticsGlobal.patterns} teamA={teamA} teamB={teamB} />
        <PredictionPanel analytics={analyticsGlobal} teamA={teamA} teamB={teamB} />
      </div>

      {/* Recomendaciones */}
      <RecommendationsPanel recommendations={analyticsGlobal.recommendations} teamA={teamA} teamB={teamB} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sub-componentes

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1 truncate">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ServeKpis({ team, rivalTeam, sideAnalytics }: { team: Team; rivalTeam: Team; sideAnalytics: SideAnalytics }) {
  const items: { label: string; value: string; icon: React.ReactNode }[] = [];
  items.push({ label: "Total", value: String(sideAnalytics.total), icon: <Target className="size-3.5" /> });
  items.push({ label: "Aces", value: String(sideAnalytics.aces), icon: <Zap className="size-3.5 text-success" /> });
  items.push({ label: "Errores", value: String(sideAnalytics.errors), icon: <AlertTriangle className="size-3.5 text-destructive" /> });
  items.push({ label: "Eficacia", value: `${sideAnalytics.efficacy}%`, icon: <TrendingUp className="size-3.5" /> });
  items.push({
    label: "Zona +usada",
    value: sideAnalytics.topZone ? `Z${sideAnalytics.topZone}` : "—",
    icon: <Flame className="size-3.5" />,
  });
  items.push({
    label: "Zona +efectiva",
    value: sideAnalytics.bestEfficacyZone ? `Z${sideAnalytics.bestEfficacyZone}` : "—",
    icon: <Crosshair className="size-3.5" />,
  });
  items.push({
    label: "Más buscada",
    value: sideAnalytics.topTarget ? shortPlayer(rivalTeam, sideAnalytics.topTarget.playerId) : "—",
    icon: <Radar className="size-3.5" />,
  });
  items.push({
    label: "Más evitada",
    value: sideAnalytics.avoidedPlayer ? shortPlayer(rivalTeam, sideAnalytics.avoidedPlayer.playerId) : "—",
    icon: <Radar className="size-3.5 opacity-60" />,
  });

  return (
    <div
      className="rounded-lg border border-border/60 bg-card p-3"
      style={{ borderLeft: `4px solid ${team.color}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="size-3 rounded-full" style={{ background: team.color }} />
        <span className="text-sm font-bold truncate">Saques · {team.shortName ?? team.name}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((it) => (
          <div key={it.label} className="rounded-md bg-muted/40 p-1.5 flex flex-col items-center text-center">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
              {it.icon}
              <span className="truncate">{it.label}</span>
            </div>
            <div className="scoreboard-digit text-sm font-black leading-tight tabular-nums truncate max-w-full">{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function shortPlayer(team: Team, id: string): string {
  const p = findPlayer(team, id);
  return p ? `#${p.number}` : "—";
}

function valueForView(z: { count: number; pct: number; aces: number; errors: number; efficacy: number; positives: number; perfects: number; negatives: number }, view: ViewMode): number {
  switch (view) {
    case "frequency": return z.count;
    case "efficacy": return z.efficacy;
    case "aces": return z.aces;
    case "errors": return z.errors;
    case "recNeg": return z.negatives;
    case "recPerfect": return z.perfects;
  }
}

function heatColor(v: number, max: number, base: string, negative = false): string {
  if (max <= 0 || v === 0) return "transparent";
  const norm = Math.max(0, Math.min(1, v / max));
  const intensity = 0.15 + norm * 0.75;
  // Modo negativo (errores, recepción −) usa color destructivo.
  const color = negative ? "var(--destructive)" : base;
  return `color-mix(in oklch, ${color} ${Math.round(intensity * 100)}%, transparent)`;
}

function ReceiverCourt({
  serverTeam, receiverTeam, sideAnalytics, view,
}: {
  serverTeam: Team;
  receiverTeam: Team;
  sideAnalytics: SideAnalytics;
  view: ViewMode;
}) {
  const values = SERVE_ZONES.map((z) => valueForView(sideAnalytics.zones[z], view));
  const max = Math.max(...values);
  const negativeMode = view === "errors" || view === "recNeg";

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="size-3 rounded-full" style={{ background: serverTeam.color }} />
        <span className="text-sm font-bold truncate">
          {serverTeam.shortName ?? serverTeam.name} saca hacia {receiverTeam.shortName ?? receiverTeam.name}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          {VIEW_LABEL[view]}
        </span>
      </div>
      <div
        className="relative w-full aspect-[3/2] rounded-md overflow-hidden border-2 border-foreground/20"
        style={{
          background: "repeating-linear-gradient(135deg, oklch(0.72 0.09 60) 0 12px, oklch(0.68 0.10 55) 12px 24px)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white shadow z-10" />
        <div className="grid grid-rows-2 h-full">
          {RECEIVER_ROWS.map((row, r) => (
            <div key={r} className="grid grid-cols-3 gap-[2px] p-[2px]">
              {row.map((z) => {
                const b = sideAnalytics.zones[z];
                const v = valueForView(b, view);
                const bg = heatColor(v, max, serverTeam.color, negativeMode);
                const isTop = max > 0 && v === max && v > 0;
                return (
                  <div
                    key={z}
                    className={`relative rounded-md flex flex-col items-center justify-center text-white border-2 transition ${
                      isTop ? "border-white ring-2 ring-white/80" : "border-white/30"
                    }`}
                    style={{ background: bg }}
                  >
                    <div className="text-[9px] uppercase tracking-widest font-bold opacity-90">{SERVE_ZONE_LABEL[z]}</div>
                    <div className="scoreboard-digit text-xl font-black leading-none">{b.count}</div>
                    <div className="text-[10px] font-bold opacity-90">{b.pct}%</div>
                    {b.count > 0 && (
                      <div className="text-[9px] opacity-90 mt-0.5 tabular-nums text-center leading-tight">
                        A{b.aces}·E{b.errors}
                        <br />
                        Ef {b.efficacy}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {sideAnalytics.total === 0 && (
        <p className="text-[11px] text-muted-foreground mt-2 text-center">Sin saques registrados con este filtro.</p>
      )}
    </div>
  );
}

function ReceiversMap({
  serverTeam, receiverTeam, sideAnalytics,
}: { serverTeam: Team; receiverTeam: Team; sideAnalytics: SideAnalytics }) {
  const maxCount = Math.max(1, ...sideAnalytics.receivers.map((r) => r.count));
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Target className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-bold truncate">
          Receptores · {receiverTeam.shortName ?? receiverTeam.name}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          bajo saque de {serverTeam.shortName ?? serverTeam.name}
        </span>
      </div>
      {sideAnalytics.receivers.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-6">Sin recepciones registradas.</p>
      ) : (
        <ul className="space-y-1.5">
          {sideAnalytics.receivers.slice(0, 8).map((r) => {
            const player = findPlayer(receiverTeam, r.playerId);
            const size = 24 + Math.round((r.count / maxCount) * 32); // 24..56 px
            const qColor = qualityColor(r.quality);
            return (
              <li key={r.playerId} className="flex items-center gap-2.5">
                <div
                  className="flex-none rounded-full flex items-center justify-center text-white font-black shadow"
                  style={{
                    width: size, height: size, background: qColor,
                    fontSize: `${Math.max(9, Math.round(size / 4))}px`,
                  }}
                  title={`Recepciones: ${r.count} · Calidad ${r.quality}`}
                >
                  {player ? `#${player.number}` : "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{player?.name ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums truncate">
                    {r.count} rec · # {r.perfect} · + {r.positive} · 0 {r.neutral} · − {r.negative} · ≠ {r.errors}
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Calidad</div>
                  <div className="scoreboard-digit text-sm font-black leading-none tabular-nums">{r.quality}%</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function qualityColor(q: number): string {
  if (q >= 75) return "oklch(0.65 0.17 145)"; // verde
  if (q >= 55) return "oklch(0.75 0.14 90)"; // amarillo
  if (q >= 35) return "oklch(0.70 0.16 50)"; // naranja
  return "oklch(0.62 0.20 25)"; // rojo
}

function PatternsPanel({ patterns, teamA, teamB }: { patterns: ServePattern[]; teamA: Team; teamB: Team }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Radar className="size-4 text-primary" />
        <h3 className="text-sm font-bold">Patrones detectados</h3>
      </div>
      {patterns.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-4 text-center">
          Se necesitan al menos 5 saques por equipo para detectar patrones.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {patterns.map((p) => {
            const team = p.side === "A" ? teamA : teamB;
            return (
              <li key={p.id} className="rounded-md border border-border/50 bg-muted/30 p-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="size-2 rounded-full" style={{ background: team.color }} />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold truncate">
                    {team.shortName ?? team.name} saca
                  </span>
                  <ImpactPill impact={p.impact} />
                </div>
                <div className="text-xs font-bold">{p.title}</div>
                <div className="text-[11px] text-muted-foreground">{p.detail}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ImpactPill({ impact }: { impact: "high" | "med" | "low" }) {
  const cls = impact === "high"
    ? "bg-destructive/15 text-destructive"
    : impact === "med"
    ? "bg-warning/15 text-warning"
    : "bg-muted text-muted-foreground";
  const label = impact === "high" ? "Alto" : impact === "med" ? "Medio" : "Bajo";
  return (
    <span className={`ml-auto text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}

function PredictionPanel({ analytics, teamA, teamB }: { analytics: ServeAnalytics; teamA: Team; teamB: Team }) {
  const p = analytics.prediction;
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Crosshair className="size-4 text-primary" />
        <h3 className="text-sm font-bold">Predicción del próximo saque</h3>
      </div>
      {!p ? (
        <p className="text-[11px] text-muted-foreground py-4 text-center">
          Datos insuficientes para predecir. Registra al menos 3 saques del equipo actual.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
            Saca {(p.serverSide === "A" ? teamA : teamB).shortName ?? p.serverSide}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/40 p-2">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Zona</div>
              <div className="scoreboard-digit text-lg font-black">{p.zone ? SERVE_ZONE_LABEL[p.zone] : "—"}</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">{p.zoneConfidence}% probabilidad</div>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Objetivo</div>
              <div className="scoreboard-digit text-lg font-black">
                {p.targetPlayerId ? shortPlayer(p.serverSide === "A" ? teamB : teamA, p.targetPlayerId) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">{p.targetConfidence}% confianza</div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{p.explanation}</p>
        </div>
      )}
    </div>
  );
}

function RecommendationsPanel({
  recommendations, teamA, teamB,
}: { recommendations: ServeRecommendation[]; teamA: Team; teamB: Team }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="size-4 text-primary" />
        <h3 className="text-sm font-bold">Recomendaciones tácticas</h3>
      </div>
      {recommendations.length === 0 ? (
        <p className="text-[11px] text-muted-foreground py-4 text-center">Sin recomendaciones por ahora.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-1.5">
          {recommendations.map((r) => {
            const team = r.side === "A" ? teamA : teamB;
            return (
              <li key={r.id} className="rounded-md border border-border/50 bg-muted/30 p-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="size-2 rounded-full" style={{ background: team.color }} />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold truncate">
                    Para {team.shortName ?? team.name}
                  </span>
                  <ImpactPill impact={r.impact} />
                </div>
                <div className="text-xs font-bold">{r.title}</div>
                <div className="text-[11px] text-muted-foreground">{r.detail}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
