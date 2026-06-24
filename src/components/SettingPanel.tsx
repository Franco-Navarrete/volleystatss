import { useMemo } from "react";
import {
  type Match,
  type Team,
  SETTING_QUALITIES,
  SETTING_ATTACK_ZONES,
  SETTING_QUALITY_LABEL,
  SETTING_ATTACK_ZONE_LABEL,
  SETTING_ATTACK_RESULT_LABEL,
  type SettingQuality,
  type SettingAttackZone,
  type SettingAttackResult,
} from "@/lib/volley-store";
import {
  getSettingEvents,
  computeSetterDistribution,
  computeReceptionToSetting,
  computeSettingToAttack,
  topSetter,
  trendAfterBadReception,
  bestCombo,
} from "@/lib/setting-stats";
import { Crown, Sparkles, TrendingUp } from "lucide-react";

const ATTACK_RESULTS: SettingAttackResult[] = ["point", "continuity", "error", "blocked"];

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const safePct = (num: number, den: number) => (den > 0 ? pct(num / den) : "—");

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
  setNumber?: number;
}

export function SettingPanel({ match, teamA, teamB, setNumber }: Props) {
  const dataA = useMemo(() => buildTeamData(match, "A", setNumber), [match, setNumber]);
  const dataB = useMemo(() => buildTeamData(match, "B", setNumber), [match, setNumber]);

  if (dataA.events.length === 0 && dataB.events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        Sin armados cargados todavía. Tocá <span className="font-semibold text-foreground">Armado</span> en el planillero para registrar la cadena recepción → armado → ataque.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <TeamSettingCard team={teamA} data={dataA} />
      <TeamSettingCard team={teamB} data={dataB} />
    </div>
  );
}

type TeamData = ReturnType<typeof buildTeamData>;

function buildTeamData(match: Match, side: "A" | "B", setNumber?: number) {
  const events = getSettingEvents(match, side, setNumber);
  const distribution = computeSetterDistribution(events);
  const receptionToSetting = computeReceptionToSetting(events);
  const settingToAttack = computeSettingToAttack(events);
  const main = topSetter(events);
  const trend = trendAfterBadReception(events);
  const combo = bestCombo(events);
  return { events, distribution, receptionToSetting, settingToAttack, main, trend, combo };
}

function TeamSettingCard({ team, data }: { team: Team; data: TeamData }) {
  const playerLabel = (id: string) => {
    const p = team.players.find((x) => x.id === id);
    return p ? `#${p.number} ${p.name}` : id;
  };

  if (data.events.length === 0) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <header className="flex items-center gap-2 mb-2">
          <span className="size-3 rounded-full" style={{ background: team.color }} />
          <h3 className="font-bold">{team.name}</h3>
        </header>
        <p className="text-sm text-muted-foreground">Sin armados registrados.</p>
      </section>
    );
  }

  const main = data.main;
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
      <header className="flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ background: team.color }} />
        <h3 className="font-bold">{team.name}</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          {data.events.length} armados
        </span>
      </header>

      {/* Armadora principal */}
      {main && (
        <div className="rounded-xl bg-gradient-primary/10 border border-primary/30 p-3 flex items-center gap-3">
          <Crown className="size-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-primary font-bold">Armadora principal</div>
            <div className="font-bold truncate">{playerLabel(main.setterId)}</div>
          </div>
          <div className="text-right scoreboard-digit tabular-nums">
            <div className="text-2xl font-black text-primary leading-none">{pct(main.share)}</div>
            <div className="text-[10px] text-muted-foreground">{main.total} armados</div>
          </div>
        </div>
      )}

      {/* Distribución por armador */}
      <div>
        <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Por armador</h4>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[420px]">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="text-left p-1.5">Jugadora</th>
                <th className="text-right p-1.5">Tot</th>
                {SETTING_ATTACK_ZONES.map((z) => (
                  <th key={z} className="text-right p-1.5">{SETTING_ATTACK_ZONE_LABEL[z]}</th>
                ))}
                <th className="text-right p-1.5">++/+</th>
                <th className="text-right p-1.5">Efic.</th>
              </tr>
            </thead>
            <tbody>
              {[...data.distribution.values()]
                .sort((a, b) => b.total - a.total)
                .map((s) => (
                  <tr key={s.setterId} className="border-b border-border/20">
                    <td className="p-1.5 font-semibold truncate max-w-[120px]">{playerLabel(s.setterId)}</td>
                    <td className="p-1.5 text-right scoreboard-digit tabular-nums">{s.total}</td>
                    {SETTING_ATTACK_ZONES.map((z) => (
                      <td key={z} className="p-1.5 text-right tabular-nums text-muted-foreground">
                        {s.byZone[z] > 0 ? `${s.byZone[z]} (${pct(s.byZone[z] / s.total)})` : "—"}
                      </td>
                    ))}
                    <td className="p-1.5 text-right tabular-nums">{pct(s.positiveRate)}</td>
                    <td className={`p-1.5 text-right tabular-nums font-bold ${s.efficiency >= 0.3 ? "text-success" : s.efficiency < 0 ? "text-destructive" : ""}`}>
                      {pct(s.efficiency)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recepción → Armado */}
      <Matrix
        title="Recepción → Armado"
        rows={SETTING_QUALITIES}
        cols={SETTING_QUALITIES}
        rowLabel={(q) => `Rec. ${q}`}
        colLabel={(q) => `Arm. ${q}`}
        cell={(rec, set) => data.receptionToSetting[rec][set]}
      />

      {/* Armado → Ataque */}
      <Matrix
        title="Armado → Resultado del ataque"
        rows={SETTING_QUALITIES}
        cols={ATTACK_RESULTS}
        rowLabel={(q) => `Arm. ${q}`}
        colLabel={(r) => SETTING_ATTACK_RESULT_LABEL[r]}
        cell={(q, r) => data.settingToAttack[q][r]}
      />

      {/* Combo más eficiente + tendencia */}
      <div className="grid sm:grid-cols-2 gap-2">
        {data.combo && (
          <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-start gap-2">
            <Sparkles className="size-4 text-success mt-0.5 shrink-0" />
            <div className="text-xs">
              <div className="text-[10px] uppercase tracking-widest text-success font-bold">Combo más eficiente</div>
              <div className="font-semibold">
                Rec. {data.combo.reception} → Arm. {data.combo.setting} → Punto
              </div>
              <div className="text-muted-foreground">
                {pct(data.combo.rate)} de eficacia · {data.combo.count} jugadas
              </div>
            </div>
          </div>
        )}
        {data.trend && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
            <TrendingUp className="size-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs">
              <div className="text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-400 font-bold">Tendencia con recepción mala</div>
              <div className="font-semibold">
                {pct(data.trend.rate)} de pelotas → {SETTING_ATTACK_ZONE_LABEL[data.trend.zone]}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Matrix<R extends string, C extends string>({
  title,
  rows,
  cols,
  rowLabel,
  colLabel,
  cell,
}: {
  title: string;
  rows: readonly R[];
  cols: readonly C[];
  rowLabel: (r: R) => string;
  colLabel: (c: C) => string;
  cell: (r: R, c: C) => number;
}) {
  const rowTotals = rows.map((r) => cols.reduce((acc, c) => acc + cell(r, c), 0));
  const grand = rowTotals.reduce((a, b) => a + b, 0);
  if (grand === 0) return null;
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">{title}</h4>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs min-w-[360px]">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr className="border-b border-border/40">
              <th className="text-left p-1.5"></th>
              {cols.map((c) => (
                <th key={c} className="text-right p-1.5">{colLabel(c)}</th>
              ))}
              <th className="text-right p-1.5">Tot</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const tot = rowTotals[i];
              if (tot === 0) return null;
              return (
                <tr key={r} className="border-b border-border/20">
                  <td className="p-1.5 font-semibold">{rowLabel(r)}</td>
                  {cols.map((c) => {
                    const v = cell(r, c);
                    return (
                      <td key={c} className="p-1.5 text-right tabular-nums text-muted-foreground">
                        {v > 0 ? `${v} (${safePct(v, tot)})` : "—"}
                      </td>
                    );
                  })}
                  <td className="p-1.5 text-right tabular-nums font-bold">{tot}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Avoid unused-export lint on the helper types
export type { TeamData };
type _UnusedSettingQuality = SettingQuality;
type _UnusedSettingZone = SettingAttackZone;
