import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import {
  computeMatchStats, computeSetStats, setsWon, useVolley, getSetDuration, formatDurationMs, formatLocalTime,
  type PlayerStat, type Team,
} from "@/lib/volley-store";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Crown, Download, Shield, Target, Trophy, Zap, Sparkles } from "lucide-react";
import { downloadMatchPdf } from "@/lib/match-pdf";
import { toast } from "sonner";

type EnrichedPlayer = PlayerStat & { teamId: string; teamName: string; teamColor: string };

const MVP_WEIGHTS = { attack: 1, block: 1.2, ace: 1.5, unforcedError: -0.5 };
const mvpScore = (p: PlayerStat) =>
  p.attack * MVP_WEIGHTS.attack +
  p.block * MVP_WEIGHTS.block +
  p.ace * MVP_WEIGHTS.ace +
  p.unforcedError * MVP_WEIGHTS.unforcedError;

export const Route = createFileRoute("/_authenticated/matches/$id/stats")({
  head: () => ({ meta: [{ title: "Estadísticas · RALLY" }] }),
  component: StatsPage,
});

function StatsPage() {
  const { id } = Route.useParams();
  const match = useVolley((s) => s.matches.find((m) => m.id === id));
  const teams = useVolley((s) => s.teams);

  const teamA = useMemo(() => teams.find((t) => t.id === match?.teamAId), [teams, match]);
  const teamB = useMemo(() => teams.find((t) => t.id === match?.teamBId), [teams, match]);
  const stats = useMemo(() => match ? computeMatchStats(match) : null, [match]);

  if (!match || !teamA || !teamB || !stats) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Partido no encontrado.</p>
          <Button asChild className="mt-4"><Link to="/matches">Volver</Link></Button>
        </div>
      </AppShell>
    );
  }

  // attach player meta
  const enrichPlayers = (teamId: string): PlayerStat[] => {
    const team = teamId === teamA.id ? teamA : teamB;
    return [...stats.players.values()]
      .filter((p) => team.players.some((tp) => tp.id === p.playerId))
      .map((p) => {
        const tp = team.players.find((x) => x.id === p.playerId)!;
        return { ...p, name: tp.name, number: tp.number };
      })
      .sort((a, b) => b.total - a.total);
  };
  const playersA = enrichPlayers(teamA.id);
  const playersB = enrichPlayers(teamB.id);
  const teamStatA = stats.teams.get(teamA.id) ?? null;
  const teamStatB = stats.teams.get(teamB.id) ?? null;
  const w = setsWon(match);

  const allPlayers: EnrichedPlayer[] = [
    ...playersA.map((p) => ({ ...p, teamId: teamA.id, teamName: teamA.name, teamColor: teamA.color })),
    ...playersB.map((p) => ({ ...p, teamId: teamB.id, teamName: teamB.name, teamColor: teamB.color })),
  ];
  const mvpRanking = [...allPlayers].sort((a, b) => mvpScore(b) - mvpScore(a));
  const mvp = mvpRanking[0];
  const topScorers = [...allPlayers].filter((p) => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const topBlockers = [...allPlayers].filter((p) => p.block > 0).sort((a, b) => b.block - a.block).slice(0, 5);
  const topServers = [...allPlayers].filter((p) => p.ace > 0).sort((a, b) => b.ace - a.ace).slice(0, 5);

  const handleDownloadPdf = async () => {
    try {
      await downloadMatchPdf(match, teamA, teamB);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el PDF");
    }
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/matches/$id" params={{ id: match.id }}><ArrowLeft className="size-4" /> Volver al partido</Link>
        </Button>
        <Button size="sm" onClick={handleDownloadPdf}>
          <Download className="size-4" /> Descargar PDF
        </Button>
      </div>

      {/* Final */}
      <section className="rounded-3xl bg-gradient-surface border border-border/60 p-6 sm:p-8 shadow-elevated mb-6">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center mb-3">
          {match.status === "finished" ? "Resultado final" : "En progreso"}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 sm:gap-8 items-center">
          <div className="flex items-center gap-4">
            <TeamBadge team={teamA} size="lg" />
            <div>
              <div className="font-bold">{teamA.name}</div>
              <div className="scoreboard-digit text-6xl font-black mt-1 leading-none">
                <span className={w.a > w.b ? "text-primary" : "text-muted-foreground"}>{w.a}</span>
              </div>
            </div>
          </div>
          <div className="text-2xl text-muted-foreground font-bold">–</div>
          <div className="flex items-center gap-4 flex-row-reverse text-right">
            <TeamBadge team={teamB} size="lg" />
            <div>
              <div className="font-bold">{teamB.name}</div>
              <div className="scoreboard-digit text-6xl font-black mt-1 leading-none">
                <span className={w.b > w.a ? "text-primary" : "text-muted-foreground"}>{w.b}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {match.sets.map((s) => {
            const dur = getSetDuration(match, s.number);
            return (
              <span key={s.number} className="px-3 py-1.5 rounded-md bg-background/40 border border-border/60 text-xs scoreboard-digit font-bold tabular-nums">
                Set {s.number}: {s.scoreA}–{s.scoreB}
                {dur !== null && <span className="ml-1.5 text-muted-foreground">· {formatDurationMs(dur)}</span>}
              </span>
            );
          })}
        </div>
        {(() => {
          const start = match.setStartTimes?.[1];
          if (!start) return null;
          const totalMs = match.sets.reduce((acc, s) => acc + (getSetDuration(match, s.number) ?? 0), 0);
          return (
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
              <span>Inicio: <span className="text-foreground scoreboard-digit tabular-nums">{formatLocalTime(start)}</span></span>
              {totalMs > 0 && (
                <span>Duración total: <span className="text-foreground scoreboard-digit tabular-nums">{formatDurationMs(totalMs)}</span></span>
              )}
            </div>
          );
        })()}

      </section>

      {/* MVP */}
      {mvp && (
        <section className="rounded-2xl bg-gradient-primary p-[1px] mb-6 shadow-glow">
          <div className="rounded-[calc(theme(borderRadius.2xl)-1px)] bg-card p-5 flex items-center gap-4">
            <div className="size-14 rounded-full bg-gradient-primary flex items-center justify-center">
              <Crown className="size-7 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1">
                <Sparkles className="size-3" /> MVP del partido
              </div>
              <div className="text-xl font-extrabold mt-0.5 truncate">#{mvp.number} {mvp.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {mvp.teamName} · {mvp.attack} ATK · {mvp.block} BLK · {mvp.ace} ACE · {mvp.unforcedError} errores
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Fórmula: ATK×1 + BLK×1.2 + ACE×1.5 − Errores×0.5
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Índice MVP</div>
              <div className="scoreboard-digit text-5xl font-black text-primary tabular-nums">{mvpScore(mvp).toFixed(1)}</div>
              <div className="text-[10px] text-muted-foreground">{mvp.total} pts totales</div>
            </div>
          </div>
        </section>
      )}

      {/* Rankings */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <RankingCard title="Máximos anotadores" icon={Zap} rows={topScorers} valueKey="total" />
        <RankingCard title="Mejores bloqueadores" icon={Shield} rows={topBlockers} valueKey="block" />
        <RankingCard title="Mejores sacadores" icon={Target} rows={topServers} valueKey="ace" />
      </div>

      {/* Team totals */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <TeamSummary team={teamA} stat={teamStatA} />
        <TeamSummary team={teamB} stat={teamStatB} />
      </div>

      {/* Player tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        <PlayerStatsTable team={teamA} rows={playersA} />
        <PlayerStatsTable team={teamB} rows={playersB} />
      </div>

      {/* Set breakdown */}
      <section className="mt-8">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-3">Desglose por set</h2>
        <Tabs defaultValue={`set-${match.sets[0]?.number ?? 1}`}>
          <TabsList className="mb-4 flex-wrap h-auto">
            {match.sets.map((s) => {
              const dur = getSetDuration(match, s.number);
              return (
                <TabsTrigger key={s.number} value={`set-${s.number}`}>
                  Set {s.number}
                  <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">({s.scoreA}-{s.scoreB}{dur !== null ? ` · ${formatDurationMs(dur)}` : ""})</span>
                </TabsTrigger>
              );
            })}

          </TabsList>
          {match.sets.map((s) => {
            const setStats = computeSetStats(match, s.number);
            const setPlayersA = enrichTeamPlayers(teamA, setStats.players);
            const setPlayersB = enrichTeamPlayers(teamB, setStats.players);
            const setTeamA = setStats.teams.get(teamA.id) ?? null;
            const setTeamB = setStats.teams.get(teamB.id) ?? null;
            return (
              <TabsContent key={s.number} value={`set-${s.number}`}>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <TeamSummary team={teamA} stat={setTeamA} />
                  <TeamSummary team={teamB} stat={setTeamB} />
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                  <PlayerStatsTable team={teamA} rows={setPlayersA} />
                  <PlayerStatsTable team={teamB} rows={setPlayersB} />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </section>
    </AppShell>
  );
}

function enrichTeamPlayers(team: Team, playerMap: Map<string, PlayerStat>): PlayerStat[] {
  return [...playerMap.values()]
    .filter((p) => team.players.some((tp) => tp.id === p.playerId))
    .map((p) => {
      const tp = team.players.find((x) => x.id === p.playerId)!;
      return { ...p, name: tp.name, number: tp.number };
    })
    .sort((a, b) => b.total - a.total);
}

function RankingCard({
  title, icon: Icon, rows, valueKey,
}: {
  title: string;
  icon: typeof Trophy;
  rows: EnrichedPlayer[];
  valueKey: "total" | "block" | "ace";
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-4 py-3 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <Icon className="size-4 text-primary" />
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
      </header>
      <ol className="divide-y divide-border/40">
        {rows.map((p, i) => (
          <li key={p.playerId} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`scoreboard-digit font-black text-sm w-5 text-center ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="size-2 rounded-full shrink-0" style={{ background: p.teamColor }} />
            <span className="size-6 rounded scoreboard-digit font-bold bg-background border border-border/60 flex items-center justify-center text-[11px] shrink-0">{p.number}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{p.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{p.teamName}</div>
            </div>
            <span className="scoreboard-digit font-black text-xl text-primary tabular-nums">{p[valueKey]}</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">Sin registros.</li>
        )}
      </ol>
    </section>
  );
}

function TeamSummary({
  team, stat,
}: {
  team: ReturnType<typeof useVolley.getState>["teams"][number];
  stat: ReturnType<typeof computeMatchStats>["teams"] extends Map<string, infer V> ? V | null : never;
}) {
  const items = [
    { icon: Zap, label: "Puntos", value: stat?.total ?? 0, accent: true },
    { icon: Target, label: "Ataque", value: stat?.attack ?? 0 },
    { icon: Shield, label: "Bloqueo", value: stat?.block ?? 0 },
    { icon: Trophy, label: "Ace", value: stat?.ace ?? 0 },
  ];
  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-5 py-3 flex items-center gap-3 border-b border-border/60" style={{ background: `linear-gradient(90deg, ${team.color}1a, transparent)` }}>
        <TeamBadge team={team} size="sm" />
        <h2 className="font-bold truncate">{team.name}</h2>
      </header>
      <div className="grid grid-cols-4 divide-x divide-border/40">
        {items.map((it) => (
          <div key={it.label} className="p-4 text-center">
            <it.icon className={`size-4 mx-auto mb-1 ${it.accent ? "text-primary" : "text-muted-foreground"}`} />
            <div className={`scoreboard-digit font-black text-2xl ${it.accent ? "text-primary" : ""}`}>{it.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{it.label}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-border/40 flex justify-between text-xs text-muted-foreground">
        <span>Errores rival a favor: <span className="text-foreground font-bold">{stat?.opponentErrors ?? 0}</span></span>
        <span>Errores no forzados: <span className="text-destructive font-bold">{stat?.unforcedErrors ?? 0}</span></span>
      </div>
    </section>
  );
}

function PlayerStatsTable({
  team, rows,
}: {
  team: ReturnType<typeof useVolley.getState>["teams"][number];
  rows: PlayerStat[];
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-5 py-3 flex items-center gap-3 border-b border-border/60">
        <TeamBadge team={team} size="sm" />
        <h2 className="font-bold truncate">{team.name} · jugadores</h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
            <tr>
              <th className="text-left py-2 px-4">Jugador</th>
              <th className="text-center py-2 px-2">ATK</th>
              <th className="text-center py-2 px-2">BLK</th>
              <th className="text-center py-2 px-2">ACE</th>
              <th className="text-center py-2 px-4 text-primary">TOT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.playerId} className="border-t border-border/40">
                <td className="py-2 px-4">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded scoreboard-digit font-bold bg-background border border-border/60 flex items-center justify-center text-xs">{p.number}</span>
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                </td>
                <td className="text-center tabular-nums">{p.attack}</td>
                <td className="text-center tabular-nums">{p.block}</td>
                <td className="text-center tabular-nums">{p.ace}</td>
                <td className="text-center tabular-nums font-bold text-primary px-4">{p.total}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Sin puntos registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
