import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BarChart3, Plus, Trophy, Users, CalendarDays, ArrowRight } from "lucide-react";
import { TeamBadge } from "@/components/TeamBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setsWon, TEAM_CATEGORY_LABEL, TEAM_GENDER_LABEL, type Match, type Team } from "@/lib/volley-store";
import { computeHistoricalStats } from "@/lib/historical-stats";

type Period = "all" | "30" | "90" | "365";

interface Props {
  /** Solo equipos autorizados para el entrenador (ya filtrados). */
  teams: Team[];
  /** Todos los equipos (para mostrar el nombre del rival). */
  allTeams: Team[];
  matches: Match[];
  canCreate: boolean;
}

export function CoachPerformancePanel({ teams, allTeams, matches, canCreate }: Props) {
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [period, setPeriod] = useState<Period>("all");
  const team = teams.find((t) => t.id === teamId) ?? teams[0];
  const teamById = useMemo(() => new Map(allTeams.map((t) => [t.id, t])), [allTeams]);

  const teamMatches = useMemo(() => {
    if (!team) return [];
    const since = period === "all" ? 0 : Date.now() - Number(period) * 86400000;
    return matches
      .filter((m) => m.status === "finished" && (m.teamAId === team.id || m.teamBId === team.id))
      .filter((m) => (m.scheduledAt || m.createdAt) >= since)
      .sort((a, b) => (b.scheduledAt || b.createdAt) - (a.scheduledAt || a.createdAt));
  }, [matches, team, period]);

  const summary = useMemo(() => {
    let w = 0, l = 0, sf = 0, sa = 0;
    for (const m of teamMatches) {
      const s = setsWon(m);
      const mine = m.teamAId === team?.id ? s.a : s.b;
      const theirs = m.teamAId === team?.id ? s.b : s.a;
      sf += mine; sa += theirs;
      if (mine > theirs) w++; else if (theirs > mine) l++;
    }
    const pj = teamMatches.length;
    return { pj, w, l, sf, sa, pct: pj ? Math.round((w / pj) * 100) : 0 };
  }, [teamMatches, team?.id]);

  const players = useMemo(() => {
    if (!team) return [];
    return computeHistoricalStats(teamMatches, [team])
      .filter((p) => p.matchesPlayed > 0)
      .sort((a, b) => b.totals.points - a.totals.points)
      .slice(0, 8);
  }, [teamMatches, team]);

  const evolution = useMemo(() => {
    return [...teamMatches].reverse().map((m, i) => {
      const s = setsWon(m);
      const isA = m.teamAId === team?.id;
      let pf = 0, pa = 0;
      for (const set of m.sets) { pf += isA ? set.scoreA : set.scoreB; pa += isA ? set.scoreB : set.scoreA; }
      return { n: `P${i + 1}`, sets: (isA ? s.a : s.b) - (isA ? s.b : s.a), dif: pf - pa };
    });
  }, [teamMatches, team?.id]);

  if (teams.length === 0) {
    return (
      <section className="rounded-2xl bg-card border border-border/60 p-8 text-center">
        <Users className="size-8 mx-auto text-muted-foreground mb-3" />
        <p className="font-semibold">Todavía no tenés equipos asignados.</p>
        <p className="text-sm text-muted-foreground mt-1">Cuando te asignen un equipo vas a ver su rendimiento acá.</p>
      </section>
    );
  }

  const label = (t: Team) =>
    [t.name, t.category ? TEAM_CATEGORY_LABEL[t.category] : null, t.gender ? TEAM_GENDER_LABEL[t.gender] : null]
      .filter(Boolean).join(" · ");

  return (
    <section className="space-y-6">
      <header className="rounded-2xl bg-card border border-border/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <h2 className="font-bold flex items-center gap-2"><BarChart3 className="size-4 text-primary" /> Rendimiento de mi equipo</h2>
        <div className="flex flex-wrap gap-2">
          <Select value={team?.id} onValueChange={setTeamId}>
            <SelectTrigger className="h-9 w-auto min-w-[200px]"><SelectValue placeholder="Equipo" /></SelectTrigger>
            <SelectContent>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{label(t)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="365">Último año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Partidos jugados" value={summary.pj} />
        <Stat label="Victorias / Derrotas" value={`${summary.w} / ${summary.l}`} />
        <Stat label="Sets ganados / perdidos" value={`${summary.sf} / ${summary.sa}`} />
        <Stat label="% de victorias" value={`${summary.pct}%`} accent />
      </div>

      {teamMatches.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border/60 p-8 text-center">
          <p className="font-semibold">Todavía no hay partidos finalizados para {team?.name}.</p>
          {canCreate && (
            <Button asChild className="mt-4 bg-gradient-primary text-primary-foreground">
              <Link to="/matches/new"><Plus className="size-4" /> Crear partido</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <h3 className="px-5 py-4 border-b border-border/60 font-bold flex items-center gap-2"><Trophy className="size-4 text-primary" /> Estadísticas individuales</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="text-left py-2 px-3">Jugador</th>
                    <th className="px-2">Pts</th><th className="px-2">Atq</th><th className="px-2">Saq</th><th className="px-2">Blq</th>
                    <th className="px-2">Ef.%</th><th className="px-2">Err</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => {
                    const tot = p.totals.attack + p.totals.attackError;
                    const errs = p.totals.attackError + p.totals.serveError + p.totals.blockError + p.totals.unforcedError;
                    return (
                      <tr key={p.player.id} className="border-t border-border/40 text-center tabular-nums">
                        <td className="text-left py-2 px-3">
                          <Link to="/players/$playerId" params={{ playerId: p.player.id }} className="font-medium hover:text-primary">
                            #{p.player.number} {p.player.name}
                          </Link>
                        </td>
                        <td className="font-bold text-primary">{p.totals.points}</td>
                        <td>{p.totals.attack}</td><td>{p.totals.ace}</td><td>{p.totals.block}</td>
                        <td className="text-muted-foreground">{tot >= 5 ? `${Math.round((p.totals.attack / tot) * 100)}` : "—"}</td>
                        <td className="text-muted-foreground">{errs}</td>
                      </tr>
                    );
                  })}
                  {players.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Sin datos individuales.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <h3 className="px-5 py-4 border-b border-border/60 font-bold flex items-center gap-2"><CalendarDays className="size-4 text-accent" /> Últimos partidos</h3>
            <ul className="divide-y divide-border/40">
              {teamMatches.slice(0, 6).map((m) => {
                const isA = m.teamAId === team?.id;
                const rival = teamById.get(isA ? m.teamBId : m.teamAId);
                const s = setsWon(m);
                const mine = isA ? s.a : s.b, theirs = isA ? s.b : s.a;
                return (
                  <li key={m.id}>
                    <Link to="/matches/$id/stats" params={{ id: m.id }} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30">
                      <TeamBadge team={rival} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">vs {rival?.name ?? "Rival"}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.sets.map((st) => (isA ? `${st.scoreA}-${st.scoreB}` : `${st.scoreB}-${st.scoreA}`)).join(" · ")}
                        </div>
                      </div>
                      <span className={`font-bold tabular-nums ${mine > theirs ? "text-success" : "text-destructive"}`}>{mine}-{theirs}</span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {canCreate && (
              <div className="p-4 border-t border-border/60">
                <Button asChild variant="secondary" className="w-full"><Link to="/matches/new"><Plus className="size-4" /> Nuevo partido</Link></Button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl bg-card border border-border/60 p-5">
            <h3 className="font-bold mb-1">Evolución del rendimiento</h3>
            <p className="text-xs text-muted-foreground mb-4">Diferencia de sets y de puntos por partido (más antiguo → más reciente).</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="n" stroke="currentColor" className="text-muted-foreground" fontSize={11} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="dif" name="Dif. puntos" stroke="var(--primary)" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="sets" name="Dif. sets" stroke="var(--accent)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-extrabold tabular-nums mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
