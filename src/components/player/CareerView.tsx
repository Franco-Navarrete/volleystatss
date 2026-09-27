import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Sparkles, Trophy } from "lucide-react";
import type { Career, CareerPerformance } from "@/lib/player-career.server";

const fmt = (ts: number) => new Date(ts).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function CareerView({ career, compact }: { career: Career; compact?: boolean }) {
  const seasons = career.seasons.map((s) => s.season);
  const [season, setSeason] = useState<number | "all">("all");
  const [teamId, setTeamId] = useState<string>("all");
  const perfs = useMemo(
    () => career.performances.filter((p) => (season === "all" || p.season === season) && (teamId === "all" || p.teamId === teamId)),
    [career, season, teamId],
  );
  const t = perfs.reduce((a, p) => ({ points: a.points + p.points, attack: a.attack + p.attack, block: a.block + p.block, ace: a.ace + p.ace, mvp: a.mvp + (p.wasMvp ? 1 : 0) }), { points: 0, attack: 0, block: 0, ace: 0, mvp: 0 });
  const n = perfs.length || 1;
  const chart = [...perfs].reverse().map((p, i) => ({ i: i + 1, fecha: fmt(p.date), puntos: p.points }));

  if (career.matchesPlayed === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Tu perfil está listo. Cuando juegues un partido registrado en RALLY, tus estadísticas aparecen acá solas.
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {!compact && (seasons.length > 1 || career.teams.length > 1) && (
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={String(season)} onChange={(e) => setSeason(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">Todas las temporadas</option>
            {seasons.map((s) => <option key={s} value={s}>Temporada {s}</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="all">Todos los equipos</option>
            {career.teams.map((tm) => <option key={tm.teamId} value={tm.teamId}>{tm.teamName}</option>)}
          </select>
        </div>
      )}

      <section>
        <H>Acumulado · {perfs.length} {perfs.length === 1 ? "partido" : "partidos"}</H>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Puntos" value={t.points} accent /><Stat label="Ataques" value={t.attack} /><Stat label="Bloqueos" value={t.block} />
          <Stat label="Aces" value={t.ace} /><Stat label="MVP" value={t.mvp} /><Stat label="Recepción" value={`${career.averages.reception.toFixed(0)}%`} />
        </div>
      </section>

      <section>
        <H>Promedio por partido</H>
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Puntos" value={(t.points / n).toFixed(1)} accent /><Stat label="Ataq." value={(t.attack / n).toFixed(1)} />
          <Stat label="Bloq." value={(t.block / n).toFixed(1)} /><Stat label="Aces" value={(t.ace / n).toFixed(1)} />
        </div>
      </section>

      {chart.length > 1 && (
        <section>
          <H>Evolución de puntos</H>
          <div className="h-44 rounded-lg border border-border bg-card p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="puntos" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {career.seasons.length > 1 && (
        <section>
          <H>Por temporada</H>
          <div className="space-y-1">
            {career.seasons.map((s) => (
              <div key={s.season} className="flex justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <span className="font-semibold">{s.season}</span>
                <span className="tabular-nums text-muted-foreground">{s.matches} partidos · {s.points} pts · {s.avgPoints.toFixed(1)} prom.</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(career.records.points || career.records.block || career.records.ace) && (
        <section>
          <H><Trophy className="size-3 inline" /> Récords personales</H>
          <div className="space-y-1.5">
            {career.records.points && <Rec label="Puntos en un partido" p={career.records.points} v={career.records.points.points} />}
            {career.records.block && <Rec label="Bloqueos en un partido" p={career.records.block} v={career.records.block.block} />}
            {career.records.ace && <Rec label="Aces en un partido" p={career.records.ace} v={career.records.ace.ace} />}
          </div>
        </section>
      )}

      <section>
        <H>Últimos partidos</H>
        <div className="space-y-1">
          {perfs.slice(0, compact ? 5 : 10).map((m) => (
            <div key={m.matchId + m.teamId} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">vs {m.opponentName}{m.wasMvp && <Sparkles className="size-3 text-primary" />}</div>
                <div className="text-[11px] text-muted-foreground">{fmt(m.date)} · {m.teamName}</div>
              </div>
              <div className="text-right tabular-nums">
                <div className="font-bold">{m.points} pts</div>
                <div className="text-[10px] text-muted-foreground">{m.attack}A · {m.block}B · {m.ace}S</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {career.teams.length > 0 && (
        <section>
          <H>Historial deportivo</H>
          <ol className="relative border-l border-border ml-2 space-y-3">
            {career.teams.map((tm) => (
              <li key={tm.teamId} className="ml-4">
                <span className="absolute -left-1.5 size-3 rounded-full bg-primary" />
                <p className="font-semibold text-sm">{tm.club ?? tm.teamName}</p>
                <p className="text-xs text-muted-foreground">
                  {tm.teamName} · {tm.matches} partidos{tm.firstMatch ? ` · ${new Date(tm.firstMatch).getFullYear()}${tm.lastMatch && new Date(tm.lastMatch).getFullYear() !== new Date(tm.firstMatch).getFullYear() ? `–${new Date(tm.lastMatch).getFullYear()}` : ""}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{children}</h3>;
}
function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-2 text-center">
      <div className={`tabular-nums font-black text-xl ${accent ? "text-primary" : ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
function Rec({ label, p, v }: { label: string; p: CareerPerformance; v: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <Trophy className="size-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0"><div className="text-xs">{label}</div><div className="text-[11px] text-muted-foreground truncate">vs {p.opponentName} · {fmt(p.date)}</div></div>
      <div className="font-black text-lg tabular-nums">{v}</div>
    </div>
  );
}
