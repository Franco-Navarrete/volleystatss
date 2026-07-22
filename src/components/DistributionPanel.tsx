import { useMemo, useState } from "react";
import type { Match, Team } from "@/lib/volley-store";
import {
  buildEnrichedAttacks,
  ORIGIN_ZONE_LABEL,
  type OriginZone,
  type AttackPhase,
  type EnrichedAttack,
} from "@/lib/attack-heatmap";
import { SETTER_ZONES, type SetterZone } from "@/lib/setter-position";
import { Crown, Target, TrendingUp } from "lucide-react";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
}

const DISPLAY_ORDER: OriginZone[] = [4, 3, 2, 6, 1, 5];
const SETTER_FILTER: (SetterZone | "all")[] = ["all", ...SETTER_ZONES];

const PHASE_META: Record<AttackPhase, { title: string; subtitle: string; short: string }> = {
  K1: {
    title: "Ataque de Rotación",
    subtitle: "Distribuciones realizadas después de una recepción.",
    short: "K1",
  },
  K2: {
    title: "Contraataque",
    subtitle: "Distribuciones realizadas después de una defensa.",
    short: "K2",
  },
};

export function DistributionPanel({ match, teamA, teamB }: Props) {
  const [phase, setPhase] = useState<AttackPhase | null>(null);
  const [setter, setSetter] = useState<SetterZone | "all">("all");

  const attacksA = useMemo(
    () => buildEnrichedAttacks(match, teamA, teamB).filter((a) => a.side === "A"),
    [match, teamA, teamB],
  );
  const attacksB = useMemo(
    () => buildEnrichedAttacks(match, teamA, teamB).filter((a) => a.side === "B"),
    [match, teamA, teamB],
  );

  if (phase === null) {
    return <PhasePicker onPick={setPhase} />;
  }

  return (
    <div className="space-y-4">
      <Header phase={phase} onChange={setPhase} />
      <SetterSelector value={setter} onChange={setSetter} phase={phase} attacksA={attacksA} attacksB={attacksB} />
      <div className="grid lg:grid-cols-2 gap-4">
        <TeamCard team={teamA} attacks={attacksA} phase={phase} setter={setter} />
        <TeamCard team={teamB} attacks={attacksB} phase={phase} setter={setter} />
      </div>
    </div>
  );
}

/* ============================================================
   Pantalla inicial · selector de análisis
   ============================================================ */

function PhasePicker({ onPick }: { onPick: (p: AttackPhase) => void }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 max-w-2xl mx-auto">
      <div className="text-center mb-5">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Distribución</h3>
        <p className="text-sm text-muted-foreground mt-1">Seleccione el análisis.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {(["K1", "K2"] as AttackPhase[]).map((p) => {
          const meta = PHASE_META[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              className="text-left rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/50 transition-all p-4 group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="size-8 rounded-lg bg-primary/15 text-primary font-black text-sm flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {meta.short}
                </span>
                <span className="font-bold">{meta.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{meta.subtitle}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Header con toggle de fase
   ============================================================ */

function Header({ phase, onChange }: { phase: AttackPhase; onChange: (p: AttackPhase | null) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 rounded-lg bg-secondary/40 border border-border/60 p-1">
        {(["K1", "K2"] as AttackPhase[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
              phase === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {PHASE_META[p].short} · {PHASE_META[p].title}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground font-bold"
      >
        Cambiar análisis
      </button>
    </div>
  );
}

/* ============================================================
   Selector de posición de armadora
   ============================================================ */

function SetterSelector({
  value,
  onChange,
  phase,
  attacksA,
  attacksB,
}: {
  value: SetterZone | "all";
  onChange: (v: SetterZone | "all") => void;
  phase: AttackPhase;
  attacksA: EnrichedAttack[];
  attacksB: EnrichedAttack[];
}) {
  const counts = useMemo(() => {
    const map = new Map<SetterZone | "all", number>();
    map.set("all", 0);
    SETTER_ZONES.forEach((z) => map.set(z, 0));
    let total = 0;
    for (const a of [...attacksA, ...attacksB]) {
      if (a.phase !== phase) continue;
      total++;
      if (a.setterZone) map.set(a.setterZone, (map.get(a.setterZone) ?? 0) + 1);
    }
    map.set("all", total);
    return map;
  }, [attacksA, attacksB, phase]);

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
        Posición de la armadora
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SETTER_FILTER.map((opt) => {
          const label = opt === "all" ? "Todas" : `A${opt}`;
          const count = counts.get(opt) ?? 0;
          const active = value === opt;
          const disabled = opt !== "all" && count === 0;
          return (
            <button
              key={String(opt)}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors tabular-nums ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/60 hover:border-primary/50"
              } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {label}
              <span className={`ml-1.5 text-[10px] font-normal ${active ? "opacity-80" : "text-muted-foreground"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Tarjeta por equipo
   ============================================================ */

interface ZoneStat {
  zone: OriginZone;
  count: number;
  pct: number;
  positives: number;
  negatives: number;
  efficiency: number;
}

interface PlayerStat {
  playerId: string;
  count: number;
  pct: number;
  positives: number;
  negatives: number;
  efficiency: number;
}

function aggregate(attacks: EnrichedAttack[]) {
  const total = attacks.length;
  const byZone = new Map<OriginZone, { count: number; pos: number; neg: number }>();
  const byPlayer = new Map<string, { count: number; pos: number; neg: number }>();
  for (const z of DISPLAY_ORDER) byZone.set(z, { count: 0, pos: 0, neg: 0 });

  for (const a of attacks) {
    if (a.origin) {
      const b = byZone.get(a.origin);
      if (b) {
        b.count++;
        if (a.result === "positive") b.pos++;
        else if (a.result === "negative") b.neg++;
      }
    }
    if (a.playerId) {
      const p = byPlayer.get(a.playerId) ?? { count: 0, pos: 0, neg: 0 };
      p.count++;
      if (a.result === "positive") p.pos++;
      else if (a.result === "negative") p.neg++;
      byPlayer.set(a.playerId, p);
    }
  }

  const zones: ZoneStat[] = DISPLAY_ORDER.map((z) => {
    const b = byZone.get(z)!;
    return {
      zone: z,
      count: b.count,
      pct: total > 0 ? Math.round((b.count / total) * 100) : 0,
      positives: b.pos,
      negatives: b.neg,
      efficiency: b.count > 0 ? Math.round(((b.pos - b.neg) / b.count) * 100) : 0,
    };
  });

  const players: PlayerStat[] = [...byPlayer.entries()]
    .map(([playerId, v]) => ({
      playerId,
      count: v.count,
      pct: total > 0 ? Math.round((v.count / total) * 100) : 0,
      positives: v.pos,
      negatives: v.neg,
      efficiency: v.count > 0 ? Math.round(((v.pos - v.neg) / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topZone = [...zones].sort((a, b) => b.count - a.count).find((z) => z.count > 0) ?? null;
  const topPlayer = players[0] ?? null;

  return { total, zones, players, topZone, topPlayer };
}

function TeamCard({
  team,
  attacks,
  phase,
  setter,
}: {
  team: Team;
  attacks: EnrichedAttack[];
  phase: AttackPhase;
  setter: SetterZone | "all";
}) {
  const data = useMemo(() => {
    const filtered = attacks.filter(
      (a) => a.phase === phase && (setter === "all" || a.setterZone === setter),
    );
    return aggregate(filtered);
  }, [attacks, phase, setter]);

  const playerLabel = (id: string) => {
    const p = team.players.find((x) => x.id === id);
    return p ? `#${p.number} ${p.name}` : id;
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <header
        className="px-3 py-2 flex items-center gap-2 border-b border-border/60"
        style={{ background: `${team.color}22` }}
      >
        <span
          className="size-6 rounded text-white text-[10px] font-black flex items-center justify-center"
          style={{ background: team.color }}
        >
          {team.shortName}
        </span>
        <h3 className="font-bold text-sm truncate flex-1">{team.name}</h3>
        <span className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-primary/15 text-primary">
          {setter === "all" ? "Todas" : `A${setter}`} · {phase}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{data.total} ataques</span>
      </header>

      {data.total === 0 ? (
        <p className="text-xs text-muted-foreground p-6 text-center">
          Sin datos para esta combinación de armadora y fase.
        </p>
      ) : (
        <div className="p-3 space-y-4">
          {/* Zonas de origen */}
          <div>
            <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
              Distribución por zona
            </h4>
            <div className="space-y-1.5">
              {data.zones
                .filter((z) => z.count > 0)
                .sort((a, b) => b.count - a.count)
                .map((z) => (
                  <div key={z.zone} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 font-bold">{ORIGIN_ZONE_LABEL[z.zone]}</span>
                    <div className="flex-1 h-5 rounded bg-secondary/50 overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${z.pct}%`, background: team.color }}
                      />
                    </div>
                    <span className="tabular-nums w-10 text-right font-bold">{z.pct}%</span>
                    <span className="tabular-nums w-8 text-right text-muted-foreground">{z.count}</span>
                    <span
                      className={`tabular-nums w-12 text-right text-[10px] font-bold ${
                        z.efficiency >= 25 ? "text-success" : z.efficiency < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {z.efficiency >= 0 ? "+" : ""}
                      {z.efficiency}%
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Atacantes */}
          {data.players.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                Frecuencia por atacante
              </h4>
              <div className="space-y-1">
                {data.players.slice(0, 6).map((p) => (
                  <div key={p.playerId} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate">{playerLabel(p.playerId)}</span>
                    <div className="h-1.5 w-24 rounded bg-secondary/50 overflow-hidden">
                      <div className="h-full" style={{ width: `${p.pct}%`, background: team.color }} />
                    </div>
                    <span className="tabular-nums w-10 text-right font-bold">{p.pct}%</span>
                    <span className="tabular-nums w-8 text-right text-muted-foreground">{p.count}</span>
                    <span
                      className={`tabular-nums w-12 text-right text-[10px] font-bold ${
                        p.efficiency >= 25 ? "text-success" : p.efficiency < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {p.efficiency >= 0 ? "+" : ""}
                      {p.efficiency}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          <div className="grid sm:grid-cols-2 gap-2">
            {data.topZone && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 flex items-start gap-2">
                <Target className="size-4 text-primary mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="text-[10px] uppercase tracking-widest text-primary font-bold">Zona predominante</div>
                  <div className="font-bold">{ORIGIN_ZONE_LABEL[data.topZone.zone]}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {data.topZone.pct}% · {data.topZone.count} balones
                  </div>
                </div>
              </div>
            )}
            {data.topPlayer && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 flex items-start gap-2">
                <Crown className="size-4 text-success mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="text-[10px] uppercase tracking-widest text-success font-bold">Atacante principal</div>
                  <div className="font-bold truncate">{playerLabel(data.topPlayer.playerId)}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {data.topPlayer.pct}% · {data.topPlayer.count} balones
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Insight táctico */}
          {data.topZone && data.topZone.pct >= 40 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
              <TrendingUp className="size-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs leading-snug">
                Cuando la armadora está en{" "}
                <span className="font-bold">
                  {setter === "all" ? "cualquier posición" : `A${setter}`}
                </span>{" "}
                durante {PHASE_META[phase].title.toLowerCase()}, distribuye el{" "}
                <span className="font-bold">{data.topZone.pct}%</span> hacia{" "}
                <span className="font-bold">{ORIGIN_ZONE_LABEL[data.topZone.zone]}</span>.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
