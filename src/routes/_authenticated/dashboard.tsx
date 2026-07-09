import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveMatchesFeed } from "@/components/LiveMatchesFeed";
import { TeamBadge } from "@/components/TeamBadge";
import {
  computeStandings,
  setsWon,
  useVolley,
} from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays, Plus, Trophy } from "lucide-react";
import { useCanCreateMatches } from "@/hooks/use-permissions";
import { GenderFilter, type GenderFilterValue } from "@/components/GenderFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "RALLY · Liga de Vóley en Vivo" },
      { name: "description", content: "Liga de vóley con resultados, fixture, tabla de posiciones y estadísticas en tiempo real." },
    ],
  }),
  component: LeaguePage,
});

function LeaguePage() {
  const teams = useVolley((s) => s.teams);
  const matches = useVolley((s) => s.matches);
  const seed = useVolley((s) => s.seedDemo);
  const seedMatch = useVolley((s) => s.seedDemoMatch);
  const { allowed: canCreate } = useCanCreateMatches();

  useEffect(() => {
    if (teams.length === 0) seed();
  }, [teams.length, seed]);

  useEffect(() => {
    if (teams.length >= 2 && matches.length === 0) seedMatch();
  }, [teams.length, matches.length, seedMatch]);

  const standings = useMemo(() => computeStandings(teams, matches), [teams, matches]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const finished = matches.filter((m) => m.status === "finished").sort((a, b) => b.createdAt - a.createdAt);
  const upcoming = matches.filter((m) => m.status !== "finished").sort((a, b) => a.scheduledAt - b.scheduledAt);

  return (
    <AppShell>
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-surface border border-border/60 p-6 sm:p-10 shadow-elevated relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-[0.07] pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-3">
              <Trophy className="size-3.5" /> Temporada en curso
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-[1.05] max-w-2xl">
              Estadísticas de vóley <span className="text-primary">en tiempo real</span>.
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl text-sm sm:text-base">
              Cargá partidos, registrá cada punto y generá estadísticas automáticas de jugadores, equipos y torneos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate && (
              <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
                <Link to="/matches/new"><Plus className="size-4" /> Nuevo partido</Link>
              </Button>
            )}
            <Button asChild size="lg" variant="secondary">
              <Link to="/teams">Gestionar equipos</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mt-8">
        <LiveMatchesFeed />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        {/* Standings */}
        <section className="lg:col-span-2 rounded-2xl bg-card border border-border/60 overflow-hidden">
          <header className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2"><Trophy className="size-4 text-primary" /> Tabla de posiciones</h2>
            <span className="text-xs text-muted-foreground">3 pts = victoria 3-0/3-1 · 2 pts = 3-2 · 1 pt = 2-3</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
                <tr>
                  <th className="text-left py-3 px-4 w-8">#</th>
                  <th className="text-left py-3 px-4">Equipo</th>
                  <th className="text-center py-3 px-2">PJ</th>
                  <th className="text-center py-3 px-2">G</th>
                  <th className="text-center py-3 px-2">P</th>
                  <th className="text-center py-3 px-2">Sets</th>
                  <th className="text-center py-3 px-2">Pts</th>
                  <th className="text-center py-3 px-4 text-primary">Liga</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const team = teamById.get(row.teamId);
                  return (
                    <tr key={row.teamId} className="border-t border-border/40 hover:bg-secondary/30">
                      <td className="py-3 px-4 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <TeamBadge team={team} size="sm" />
                          <span className="font-medium">{team?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="text-center tabular-nums">{row.played}</td>
                      <td className="text-center tabular-nums text-success">{row.won}</td>
                      <td className="text-center tabular-nums text-muted-foreground">{row.lost}</td>
                      <td className="text-center tabular-nums text-muted-foreground">{row.setsFor}-{row.setsAgainst}</td>
                      <td className="text-center tabular-nums text-muted-foreground">{row.pointsFor}-{row.pointsAgainst}</td>
                      <td className="text-center tabular-nums font-bold text-primary px-4">{row.leaguePoints}</td>
                    </tr>
                  );
                })}
                {standings.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">Sin equipos cargados todavía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Fixture / results */}
        <aside className="space-y-6">
          <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <header className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2"><CalendarDays className="size-4 text-accent" /> Próximos / En vivo</h2>
            </header>
            <ul className="divide-y divide-border/40">
              {upcoming.slice(0, 5).map((m) => {
                const a = teamById.get(m.teamAId);
                const b = teamById.get(m.teamBId);
                return (
                  <li key={m.id}>
                    <Link to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30">
                      <TeamBadge team={a} size="sm" />
                      <span className="text-xs text-muted-foreground">vs</span>
                      <TeamBadge team={b} size="sm" />
                      <span className="ml-auto text-xs uppercase font-semibold">
                        {m.status === "live" ? (
                          <span className="text-destructive flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-destructive animate-pulse" /> EN VIVO
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Programado</span>
                        )}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
              {upcoming.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-muted-foreground">No hay partidos programados.</li>
              )}
            </ul>
          </section>

          <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <header className="px-5 py-4 border-b border-border/60">
              <h2 className="font-bold">Últimos resultados</h2>
            </header>
            <ul className="divide-y divide-border/40">
              {finished.slice(0, 6).map((m) => {
                const a = teamById.get(m.teamAId);
                const b = teamById.get(m.teamBId);
                const w = setsWon(m);
                const aWon = w.a > w.b;
                return (
                  <li key={m.id}>
                    <Link to="/matches/$id" params={{ id: m.id }} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30">
                      <TeamBadge team={a} size="sm" />
                      <span className={aWon ? "font-bold" : "text-muted-foreground"}>{a?.shortName}</span>
                      <span className="ml-auto scoreboard-digit font-bold tabular-nums">
                        <span className={aWon ? "text-primary" : ""}>{w.a}</span>
                        <span className="text-muted-foreground mx-1">–</span>
                        <span className={!aWon ? "text-primary" : ""}>{w.b}</span>
                      </span>
                      <span className={!aWon ? "font-bold" : "text-muted-foreground"}>{b?.shortName}</span>
                      <TeamBadge team={b} size="sm" />
                    </Link>
                  </li>
                );
              })}
              {finished.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-muted-foreground">Aún no hay resultados.</li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
