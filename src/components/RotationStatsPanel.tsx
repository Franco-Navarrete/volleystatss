import { useMemo, useState } from "react";
import type { Match, Team } from "@/lib/volley-store";
import {
  computeRotationStats,
  bestRotation,
  worstRotation,
  type SideRotationStats,
} from "@/lib/rotation-stats";
import {
  computeSetterPositionStats,
  bestSetterZone,
  worstSetterZone,
  type SideSetterStats,
} from "@/lib/setter-position";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
  setNumber?: number;
  compact?: boolean;
}

type Mode = "rotation" | "setter";

/** Formato unificado que consume la tabla: rótulo + PF/PC + flag current. */
interface Row { label: string; pf: number; pc: number; isCurrent: boolean; key: string | number; }
interface NormalizedSide { rows: Row[]; currentLabel: string; }

function fromRotation(s: SideRotationStats): NormalizedSide {
  return {
    currentLabel: `R${s.current}`,
    rows: s.buckets.map((b) => ({
      key: b.rotation,
      label: `R${b.rotation}`,
      pf: b.pf, pc: b.pc,
      isCurrent: b.rotation === s.current,
    })),
  };
}
function fromSetter(s: SideSetterStats): NormalizedSide {
  return {
    currentLabel: `A${s.current}`,
    rows: s.buckets.map((b) => ({
      key: b.zone,
      label: `A${b.zone}`,
      pf: b.pf, pc: b.pc,
      isCurrent: b.zone === s.current,
    })),
  };
}

export function RotationStatsPanel({ match, teamA, teamB, setNumber, compact }: Props) {
  const [mode, setMode] = useState<Mode>("rotation");

  const rotStats = useMemo(() => computeRotationStats(match), [match]);
  const setterStats = useMemo(
    () => computeSetterPositionStats(match, teamA, teamB),
    [match, teamA, teamB],
  );

  const targetSet = setNumber ?? match.currentSet;
  const rot = rotStats.find((s) => s.setNumber === targetSet) ?? rotStats[rotStats.length - 1];
  const set = setterStats.find((s) => s.setNumber === targetSet) ?? setterStats[setterStats.length - 1];
  if (!rot || !set) return null;

  const A = mode === "rotation" ? fromRotation(rot.A) : fromSetter(set.A);
  const B = mode === "rotation" ? fromRotation(rot.B) : fromSetter(set.B);
  // Reutilizamos best/worst específicos para preservar iconografía visual.
  const bestA = mode === "rotation" ? bestRotation(rot.A) : bestSetterZone(set.A);
  const worstA = mode === "rotation" ? worstRotation(rot.A) : worstSetterZone(set.A);
  const bestB = mode === "rotation" ? bestRotation(rot.B) : bestSetterZone(set.B);
  const worstB = mode === "rotation" ? worstRotation(rot.B) : worstSetterZone(set.B);
  const bestKeyA = bestA ? ("rotation" in bestA ? bestA.rotation : bestA.zone) : null;
  const worstKeyA = worstA ? ("rotation" in worstA ? worstA.rotation : worstA.zone) : null;
  const bestKeyB = bestB ? ("rotation" in bestB ? bestB.rotation : bestB.zone) : null;
  const worstKeyB = worstB ? ("rotation" in worstB ? worstB.rotation : worstB.zone) : null;

  return (
    <div className="space-y-3">
      {/* Selector Rotación / Posición armadora */}
      <div className="inline-flex rounded-md border border-border/60 bg-secondary/40 p-0.5 text-[10px] uppercase tracking-widest font-bold">
        <button
          onClick={() => setMode("rotation")}
          className={`px-3 py-1 rounded ${mode === "rotation" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >Rotación</button>
        <button
          onClick={() => setMode("setter")}
          className={`px-3 py-1 rounded ${mode === "setter" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >Posición armadora</button>
      </div>

      <div className={`grid ${compact ? "md:grid-cols-2" : "lg:grid-cols-2"} gap-3`}>
        <SideTable
          team={teamA}
          side={A}
          bestKey={bestKeyA}
          worstKey={worstKeyA}
          compact={compact}
          mode={mode}
        />
        <SideTable
          team={teamB}
          side={B}
          bestKey={bestKeyB}
          worstKey={worstKeyB}
          compact={compact}
          mode={mode}
        />
      </div>
    </div>
  );
}

function SideTable({
  team, side, bestKey, worstKey, compact, mode,
}: {
  team: Team;
  side: NormalizedSide;
  bestKey: number | null;
  worstKey: number | null;
  compact?: boolean;
  mode: Mode;
}) {
  const title = mode === "rotation" ? "Rotaciones" : "Pos. armadora";
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/60" style={{ background: `${team.color}22` }}>
        <span className="size-5 rounded text-white text-[10px] font-black flex items-center justify-center" style={{ background: team.color }}>
          {team.shortName}
        </span>
        <h3 className="font-bold text-xs truncate flex-1">{title} · {team.name}</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Actual <span className="scoreboard-digit text-primary text-sm">{side.currentLabel}</span>
        </span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[9px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
          <tr>
            <th className="text-left py-1.5 px-3">{mode === "rotation" ? "Rot" : "Arm"}</th>
            <th className="text-center">PF</th>
            <th className="text-center">PC</th>
            <th className="text-center">Dif</th>
            <th className="text-center px-3">%</th>
          </tr>
        </thead>
        <tbody>
          {side.rows.map((r) => {
            const total = r.pf + r.pc;
            const diff = r.pf - r.pc;
            const pct = total > 0 ? (r.pf / total) * 100 : 0;
            const isBest = bestKey !== null && r.key === bestKey && total > 0;
            const isWorst = worstKey !== null && r.key === worstKey && total > 0 && bestKey !== worstKey;
            return (
              <tr key={r.key} className={`border-t border-border/40 ${r.isCurrent ? "bg-primary/10" : ""}`}>
                <td className="py-1 px-3 font-bold">
                  {r.label}
                  {r.isCurrent && <span className="ml-1 text-[9px] text-primary">●</span>}
                </td>
                <td className="text-center tabular-nums">{r.pf}</td>
                <td className="text-center tabular-nums">{r.pc}</td>
                <td className={`text-center tabular-nums font-bold ${diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {total === 0 ? "—" : (diff > 0 ? `+${diff}` : `${diff}`)}
                </td>
                <td className={`text-center tabular-nums px-3 font-bold ${isBest ? "text-success" : isWorst ? "text-destructive" : ""}`}>
                  {total > 0 ? `${pct.toFixed(0)}%` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
