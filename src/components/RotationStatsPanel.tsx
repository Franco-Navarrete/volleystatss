import { useMemo } from "react";
import type { Match, Team } from "@/lib/volley-store";
import {
  computeRotationStats,
  bestRotation,
  worstRotation,
  type SideRotationStats,
} from "@/lib/rotation-stats";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
  /** Optional: limit to a single set; otherwise shows current set. */
  setNumber?: number;
  /** Compact = used in the live panel. */
  compact?: boolean;
}

export function RotationStatsPanel({ match, teamA, teamB, setNumber, compact }: Props) {
  const allStats = useMemo(() => computeRotationStats(match), [match]);
  const targetSet = setNumber ?? match.currentSet;
  const setStats = allStats.find((s) => s.setNumber === targetSet) ?? allStats[allStats.length - 1];
  if (!setStats) return null;

  return (
    <div className={`grid ${compact ? "md:grid-cols-2" : "lg:grid-cols-2"} gap-3`}>
      <SideTable team={teamA} stats={setStats.A} compact={compact} />
      <SideTable team={teamB} stats={setStats.B} compact={compact} />
    </div>
  );
}

function SideTable({ team, stats, compact }: { team: Team; stats: SideRotationStats; compact?: boolean }) {
  const best = bestRotation(stats);
  const worst = worstRotation(stats);
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/60" style={{ background: `${team.color}22` }}>
        <span className="size-5 rounded text-white text-[10px] font-black flex items-center justify-center" style={{ background: team.color }}>
          {team.shortName}
        </span>
        <h3 className="font-bold text-xs truncate flex-1">Rotaciones · {team.name}</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Actual <span className="scoreboard-digit text-primary text-sm">R{stats.current}</span>
        </span>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[9px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
          <tr>
            <th className="text-left py-1.5 px-3">Rot</th>
            <th className="text-center">PF</th>
            <th className="text-center">PC</th>
            <th className="text-center">Dif</th>
            <th className="text-center px-3">%</th>
          </tr>
        </thead>
        <tbody>
          {stats.buckets.map((b) => {
            const total = b.pf + b.pc;
            const diff = b.pf - b.pc;
            const pct = total > 0 ? (b.pf / total) * 100 : 0;
            const isCurrent = b.rotation === stats.current;
            const isBest = best && b.rotation === best.rotation && total > 0;
            const isWorst = worst && b.rotation === worst.rotation && total > 0 && best?.rotation !== worst.rotation;
            return (
              <tr key={b.rotation} className={`border-t border-border/40 ${isCurrent ? "bg-primary/10" : ""}`}>
                <td className="py-1 px-3 font-bold">
                  R{b.rotation}
                  {isCurrent && <span className="ml-1 text-[9px] text-primary">●</span>}
                </td>
                <td className="text-center tabular-nums">{b.pf}</td>
                <td className="text-center tabular-nums">{b.pc}</td>
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
      {!compact && (best || worst) && (
        <div className="px-3 py-2 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between gap-2">
          {best && <span>Mejor: <strong className="text-success">R{best.rotation}</strong> ({best.pf}-{best.pc})</span>}
          {worst && best?.rotation !== worst.rotation && <span>Peor: <strong className="text-destructive">R{worst.rotation}</strong> ({worst.pf}-{worst.pc})</span>}
        </div>
      )}
    </div>
  );
}
