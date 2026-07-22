import { useMemo } from "react";
import type { Match, Team } from "@/lib/volley-store";
import { buildEnrichedAttacks, ORIGIN_ZONE_LABEL, type OriginZone } from "@/lib/attack-heatmap";
import { SETTER_ZONES, type SetterZone } from "@/lib/setter-position";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
}

/** Zonas de origen mostradas en el orden pedido: Z4, Z3, Z2, Pipe (6), Z1, Z5. */
const DISPLAY_ORDER: OriginZone[] = [4, 3, 2, 6, 1, 5];

interface RowData { zone: OriginZone; count: number; pct: number; positives: number; negatives: number; }
interface SetterRow { setter: SetterZone; total: number; rows: RowData[]; efficiency: number; }

function computeMatrix(match: Match, teamA: Team, teamB: Team, side: "A" | "B"): SetterRow[] {
  const attacks = buildEnrichedAttacks(match, teamA, teamB).filter((a) => a.side === side);
  return SETTER_ZONES.map((sz) => {
    const filtered = attacks.filter((a) => a.setterZone === sz && a.origin !== null);
    const total = filtered.length;
    const byZone = new Map<OriginZone, { count: number; pos: number; neg: number }>();
    for (const z of DISPLAY_ORDER) byZone.set(z, { count: 0, pos: 0, neg: 0 });
    let positives = 0, negatives = 0;
    for (const a of filtered) {
      const b = byZone.get(a.origin as OriginZone)!;
      b.count++;
      if (a.result === "positive") { b.pos++; positives++; }
      else if (a.result === "negative") { b.neg++; negatives++; }
    }
    const rows: RowData[] = DISPLAY_ORDER.map((z) => {
      const b = byZone.get(z)!;
      return {
        zone: z,
        count: b.count,
        pct: total > 0 ? Math.round((b.count / total) * 100) : 0,
        positives: b.pos,
        negatives: b.neg,
      };
    });
    const efficiency = total > 0 ? Math.round(((positives - negatives) / total) * 100) : 0;
    return { setter: sz, total, rows, efficiency };
  });
}

export function SetterDistributionCard({ match, teamA, teamB }: Props) {
  const dataA = useMemo(() => computeMatrix(match, teamA, teamB, "A"), [match, teamA, teamB]);
  const dataB = useMemo(() => computeMatrix(match, teamA, teamB, "B"), [match, teamA, teamB]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <SideCard team={teamA} data={dataA} />
      <SideCard team={teamB} data={dataB} />
    </div>
  );
}

function SideCard({ team, data }: { team: Team; data: SetterRow[] }) {
  const grandTotal = data.reduce((s, r) => s + r.total, 0);
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-border/60" style={{ background: `${team.color}22` }}>
        <span className="size-5 rounded text-white text-[10px] font-black flex items-center justify-center" style={{ background: team.color }}>
          {team.shortName}
        </span>
        <h3 className="font-bold text-xs truncate flex-1">Distribución ofensiva · Pos. armadora</h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">{grandTotal} ataques</span>
      </div>

      {grandTotal === 0 ? (
        <p className="text-xs text-muted-foreground p-4 text-center">Sin ataques registrados con posición de armadora.</p>
      ) : (
        <div className="divide-y divide-border/40">
          {data.filter((r) => r.total > 0).map((r) => (
            <div key={r.setter} className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="size-7 rounded-md text-white font-black text-xs flex items-center justify-center"
                  style={{ background: team.color }}
                >
                  A{r.setter}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex-1">
                  Armadora en zona {r.setter}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {r.total} · <span className={r.efficiency >= 25 ? "text-success" : r.efficiency < 0 ? "text-destructive" : ""}>Ef {r.efficiency}%</span>
                </span>
              </div>
              <div className="space-y-1">
                {r.rows.filter((c) => c.count > 0).map((c) => (
                  <div key={c.zone} className="flex items-center gap-2 text-xs">
                    <span className="w-14 shrink-0 font-bold">{ORIGIN_ZONE_LABEL[c.zone]}</span>
                    <div className="flex-1 h-4 rounded bg-secondary/50 overflow-hidden relative">
                      <div
                        className="h-full transition-all"
                        style={{ width: `${c.pct}%`, background: team.color }}
                      />
                    </div>
                    <span className="tabular-nums w-10 text-right font-bold">{c.pct}%</span>
                    <span className="tabular-nums w-8 text-right text-muted-foreground">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
