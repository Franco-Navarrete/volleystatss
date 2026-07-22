import { useMemo, useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Match, Team } from "@/lib/volley-store";
import {
  buildEnrichedAttacks,
  aggregateAttacks,
  ORIGIN_ZONES,
  ORIGIN_ZONE_LABEL,
  type OriginZone,
  type HeatmapAgg,
  type HeatmapFilters,
  type ZoneBucket,
} from "@/lib/attack-heatmap";
import { SETTER_ZONES, type SetterZone } from "@/lib/setter-position";
import { Flame } from "lucide-react";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
}

type GroupMode = "rotation" | "setter";

/** 3×3 destino: 4-3-2 pegado a la red, 5-6-1 al fondo. */
const DEST_ROWS: number[][] = [
  [4, 3, 2],
  [7, 8, 9],
  [5, 6, 1],
];

/** 2×3 origen desde la perspectiva del atacante: red arriba. */
const ORIGIN_ROWS: OriginZone[][] = [
  [4, 3, 2],
  [5, 6, 1],
];

function heatColor(count: number, max: number, teamColor: string): string {
  if (count === 0 || max === 0) return "transparent";
  const intensity = 0.15 + (count / max) * 0.75;
  return `color-mix(in oklch, ${teamColor} ${Math.round(intensity * 100)}%, transparent)`;
}

function efficiency(b: ZoneBucket): number {
  if (b.count === 0) return 0;
  return Math.round(((b.positives - b.negatives) / b.count) * 100);
}

export function AttackHeatmap({ match, teamA, teamB }: Props) {
  const enriched = useMemo(
    () => buildEnrichedAttacks(match, teamA, teamB),
    [match, teamA, teamB],
  );

  const [setFilter, setSetFilter] = useState<string>("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("rotation");
  const [groupValue, setGroupValue] = useState<string>("all"); // "all" | "1".."6"
  const [playerA, setPlayerA] = useState<string>("all");
  const [playerB, setPlayerB] = useState<string>("all");

  const filters: HeatmapFilters = {
    setNumber: setFilter === "all" ? "all" as const : Number(setFilter),
    rotation: groupMode === "rotation" && groupValue !== "all" ? Number(groupValue) : "all",
    setterZone: groupMode === "setter" && groupValue !== "all" ? (Number(groupValue) as SetterZone) : "all",
  };

  const aggA = useMemo(
    () => aggregateAttacks(enriched, "A", { ...filters, playerId: playerA === "all" ? "all" : playerA }),
    [enriched, filters.setNumber, filters.rotation, filters.setterZone, playerA],
  );
  const aggB = useMemo(
    () => aggregateAttacks(enriched, "B", { ...filters, playerId: playerB === "all" ? "all" : playerB }),
    [enriched, filters.setNumber, filters.rotation, filters.setterZone, playerB],
  );

  const availableSets = useMemo(
    () => [...new Set(enriched.map((a) => a.setNumber))].sort((a, b) => a - b),
    [enriched],
  );


  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <FilterSelect
          label="Set"
          value={setFilter}
          onChange={setSetFilter}
          options={[{ value: "all", label: "Todo el partido" }, ...availableSets.map((n) => ({ value: String(n), label: `Set ${n}` }))]}
        />
        <FilterSelect
          label="Rotación"
          value={rotFilter}
          onChange={setRotFilter}
          options={[
            { value: "all", label: "Todas" },
            ...[1, 2, 3, 4, 5, 6].map((r) => ({ value: String(r), label: `R${r}` })),
          ]}
        />
        <FilterSelect
          label={`Jugadora · ${teamA.shortName ?? "A"}`}
          value={playerA}
          onChange={setPlayerA}
          options={[
            { value: "all", label: "Todas" },
            ...teamA.players.map((p) => ({ value: p.id, label: `#${p.number} ${p.name}` })),
          ]}
        />
        <FilterSelect
          label={`Jugadora · ${teamB.shortName ?? "B"}`}
          value={playerB}
          onChange={setPlayerB}
          options={[
            { value: "all", label: "Todas" },
            ...teamB.players.map((p) => ({ value: p.id, label: `#${p.number} ${p.name}` })),
          ]}
        />
      </div>

      {/* Indicador zona predominante */}
      <div className="grid sm:grid-cols-2 gap-2">
        <PredominantBanner team={teamA} agg={aggA} />
        <PredominantBanner team={teamB} agg={aggB} />
      </div>

      {/* Mapas de calor — ORIGEN */}
      <div className="grid sm:grid-cols-2 gap-3">
        <OriginCourt team={teamA} agg={aggA} />
        <OriginCourt team={teamB} agg={aggB} />
      </div>

      {/* Mapas de calor — DESTINO */}
      <div className="grid sm:grid-cols-2 gap-3">
        <DestinationCourt team={teamA} agg={aggA} label={`${teamA.shortName ?? teamA.name} ataca hacia`} />
        <DestinationCourt team={teamB} agg={aggB} label={`${teamB.shortName ?? teamB.name} ataca hacia`} />
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1 truncate">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function PredominantBanner({ team, agg }: { team: Team; agg: HeatmapAgg }) {
  return (
    <div
      className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3"
      style={{ borderLeft: `4px solid ${team.color}` }}
    >
      <div className="size-9 rounded-full flex items-center justify-center" style={{ background: team.color }}>
        <Flame className="size-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Zona predominante · {team.shortName ?? team.name}</div>
        {agg.topZone ? (
          <div className="font-bold text-sm truncate">
            {ORIGIN_ZONE_LABEL[agg.topZone]} <span className="text-muted-foreground font-normal">· {agg.topZonePct}% ({agg.total} ataques)</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Sin ataques registrados.</div>
        )}
      </div>
    </div>
  );
}

function OriginCourt({ team, agg }: { team: Team; agg: HeatmapAgg }) {
  const max = Math.max(...ORIGIN_ZONES.map((z) => agg.origin[z].count));
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="size-3 rounded-full" style={{ background: team.color }} />
        <span className="text-sm font-bold truncate">{team.name}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Origen</span>
      </div>
      <div
        className="relative w-full aspect-[3/2] rounded-md overflow-hidden border-2 border-foreground/20"
        style={{
          background: "repeating-linear-gradient(135deg, oklch(0.72 0.09 60) 0 12px, oklch(0.68 0.10 55) 12px 24px)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white shadow z-10" />
        <div className="grid grid-rows-2 h-full">
          {ORIGIN_ROWS.map((row, r) => (
            <div key={r} className="grid grid-cols-3 gap-[2px] p-[2px]">
              {row.map((z) => {
                const b = agg.origin[z];
                const pct = agg.total > 0 ? Math.round((b.count / agg.total) * 100) : 0;
                const isTop = agg.topZone === z && b.count > 0;
                return (
                  <div
                    key={z}
                    className={`relative rounded-md flex flex-col items-center justify-center text-white border-2 transition ${
                      isTop ? "border-white ring-2 ring-white/80" : "border-white/30"
                    }`}
                    style={{ background: heatColor(b.count, max, team.color) }}
                  >
                    <div className="text-[9px] uppercase tracking-widest font-bold opacity-90">Z{z}</div>
                    <div className="scoreboard-digit text-xl font-black leading-none">{b.count}</div>
                    <div className="text-[10px] font-bold opacity-90">{pct}%</div>
                    {b.count > 0 && (
                      <div className="text-[9px] opacity-90 mt-0.5 tabular-nums">
                        Ef: {efficiency(b)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <ZoneLegend agg={agg} />
    </div>
  );
}

function DestinationCourt({ team, agg, label }: { team: Team; agg: HeatmapAgg; label: string }) {
  const max = Math.max(...Object.values(agg.destination).map((b) => b.count));
  const destTotal = Object.values(agg.destination).reduce((s, b) => s + b.count, 0);
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="size-3 rounded-full" style={{ background: team.color }} />
        <span className="text-sm font-bold truncate">{label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Destino</span>
      </div>
      <div
        className="relative w-full aspect-[3/2] rounded-md overflow-hidden border-2 border-foreground/20"
        style={{
          background: "repeating-linear-gradient(135deg, oklch(0.72 0.09 60) 0 12px, oklch(0.68 0.10 55) 12px 24px)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-white shadow z-10" />
        <div className="grid grid-rows-3 h-full">
          {DEST_ROWS.map((row, r) => (
            <div key={r} className="grid grid-cols-3 gap-[2px] p-[2px]">
              {row.map((d) => {
                const b = agg.destination[d];
                const pct = destTotal > 0 ? Math.round((b.count / destTotal) * 100) : 0;
                return (
                  <div
                    key={d}
                    className="relative rounded-md flex flex-col items-center justify-center text-white border-2 border-white/30"
                    style={{ background: heatColor(b.count, max, team.color) }}
                  >
                    <div className="text-[9px] font-bold opacity-80">{d}</div>
                    <div className="scoreboard-digit text-base font-black leading-none">{b.count || ""}</div>
                    {b.count > 0 && <div className="text-[9px] opacity-90">{pct}%</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {destTotal === 0 && (
        <p className="text-[11px] text-muted-foreground mt-2 text-center">Sin dirección de ataque registrada.</p>
      )}
    </div>
  );
}

function ZoneLegend({ agg }: { agg: HeatmapAgg }) {
  if (agg.total === 0) {
    return <p className="text-[11px] text-muted-foreground mt-2 text-center">Sin ataques con zona registrada.</p>;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      <span className="tabular-nums">Total: <span className="text-foreground font-bold">{agg.total}</span></span>
      <span className="tabular-nums text-success">+ {agg.positives}</span>
      <span className="tabular-nums">/ {agg.neutrals}</span>
      <span className="tabular-nums text-destructive">− {agg.negatives}</span>
      <span className="tabular-nums ml-auto">Eficiencia global: <span className="text-foreground font-bold">{agg.total > 0 ? Math.round(((agg.positives - agg.negatives) / agg.total) * 100) : 0}%</span></span>
    </div>
  );
}
