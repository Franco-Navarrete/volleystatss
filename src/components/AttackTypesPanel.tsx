import type { Match, Team } from "@/lib/volley-store";
import {
  attackTypeEffectiveness,
  attackTypeBySetterQuality,
  type AttackTypeEffectivenessRow,
} from "@/lib/attack-type-stats";
import { SETTING_QUALITIES, SETTING_QUALITY_LABEL } from "@/lib/volley-store";
import { getAttackTypeLabel, ALL_ATTACK_TYPES } from "@/lib/formations/attack-types";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
}

/**
 * Panel de tipos de ataque (modo Entrenador):
 *   - Tabla efectividad por tipo (por equipo).
 *   - Distribución porcentual.
 *   - Cruce calidad de armado × tipo.
 */
export function AttackTypesPanel({ match, teamA, teamB }: Props) {
  const rowsA = attackTypeEffectiveness(match, "A");
  const rowsB = attackTypeEffectiveness(match, "B");
  const setterCross = attackTypeBySetterQuality(match);

  const empty =
    rowsA.length === 0 && rowsB.length === 0 && setterCross.size === 0;

  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
        Todavía no hay ataques con tipo cargado. Cargá ataques en modo entrenador
        y elegí el tipo en el diálogo que aparece después de la zona.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-4">
        <EffectivenessTable team={teamA} rows={rowsA} />
        <EffectivenessTable team={teamB} rows={rowsB} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <DistributionBars team={teamA} rows={rowsA} />
        <DistributionBars team={teamB} rows={rowsB} />
      </div>

      <SetterQualityCross cross={setterCross} />
    </div>
  );
}

function EffectivenessTable({ team, rows }: { team: Team; rows: AttackTypeEffectivenessRow[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border/60 flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: team.color }} />
        <span className="text-sm font-bold">{team.name}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Efectividad por tipo
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">Sin datos.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Tipo</th>
              <th className="px-2 py-2 text-right">Int</th>
              <th className="px-2 py-2 text-right">P</th>
              <th className="px-2 py-2 text-right">E</th>
              <th className="px-2 py-2 text-right">%P</th>
              <th className="px-2 py-2 text-right">Ef</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.type} className="border-t border-border/40">
                <td className="px-3 py-1.5 font-semibold">{r.label}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.attempts}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-success">{r.kills}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-destructive">{r.errors}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{Math.round(r.killPct * 100)}%</td>
                <td
                  className={`px-2 py-1.5 text-right tabular-nums font-bold ${
                    r.effectiveness > 0
                      ? "text-success"
                      : r.effectiveness < 0
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {(r.effectiveness * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DistributionBars({ team, rows }: { team: Team; rows: AttackTypeEffectivenessRow[] }) {
  const total = rows.reduce((acc, r) => acc + r.attempts, 0);
  if (!total) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: team.color }} />
        <span className="text-sm font-bold">{team.name}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Distribución
        </span>
      </div>
      {rows.map((r) => {
        const pct = (r.attempts / total) * 100;
        return (
          <div key={r.type} className="text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.attempts} ({pct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div
                className="h-full rounded"
                style={{ width: `${pct}%`, background: team.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SetterQualityCross({
  cross,
}: {
  cross: ReturnType<typeof attackTypeBySetterQuality>;
}) {
  if (cross.size === 0) return null;
  const types = ALL_ATTACK_TYPES.filter((t) =>
    [...cross.values()].some((m) => m.has(t))
  );
  if (types.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border/60">
        <span className="text-sm font-bold">Calidad de armado × tipo de ataque</span>
        <span className="ml-3 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Efectividad (P-E)/Int
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Calidad</th>
              {types.map((t) => (
                <th key={t} className="px-2 py-2 text-right whitespace-nowrap">
                  {getAttackTypeLabel(t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SETTING_QUALITIES.map((q) => {
              const row = cross.get(q);
              if (!row) return null;
              return (
                <tr key={q} className="border-t border-border/40">
                  <td className="px-3 py-1.5 font-semibold">
                    <span className="scoreboard-digit mr-1">{q}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {SETTING_QUALITY_LABEL[q]}
                    </span>
                  </td>
                  {types.map((t) => {
                    const b = row.get(t);
                    if (!b) return <td key={t} className="px-2 py-1.5 text-right text-muted-foreground">—</td>;
                    const denom = b.kills + b.errors;
                    const eff = denom ? (b.kills - b.errors) / denom : 0;
                    return (
                      <td
                        key={t}
                        className={`px-2 py-1.5 text-right tabular-nums font-semibold ${
                          eff > 0 ? "text-success" : eff < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {(eff * 100).toFixed(0)}%
                        <span className="ml-1 text-[9px] text-muted-foreground">({b.attempts})</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
