import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import { computeStandings, useVolley, STATS_MODE_LABEL, STATS_MODE_DESCRIPTION, type StatsMode } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leagues")({
  head: () => ({ meta: [{ title: "Ligas · RALLY" }] }),
  component: LeaguesPage,
});

function LeaguesPage() {
  const leagues = useVolley((s) => s.leagues);
  const teams = useVolley((s) => s.teams);
  const matches = useVolley((s) => s.matches);
  const addLeague = useVolley((s) => s.addLeague);
  const removeLeague = useVolley((s) => s.removeLeague);
  const updateTeam = useVolley((s) => s.updateTeam);
  const updateLeague = useVolley((s) => s.updateLeague);

  const [name, setName] = useState("");
  const [season, setSeason] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const active = leagues.find((l) => l.id === selected) ?? leagues[0];
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const standings = useMemo(
    () => (active ? computeStandings(teams, matches, active.id) : []),
    [teams, matches, active]
  );
  const teamsInLeague = teams.filter((t) => t.leagueId === active?.id);
  const teamsAvailable = teams.filter((t) => !t.leagueId || t.leagueId !== active?.id);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold">Ligas</h1>
          <p className="text-muted-foreground text-sm">Creá ligas, asigná equipos y mirá la tabla en vivo.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <section className="rounded-2xl bg-card border border-border/60 p-5">
          <h2 className="font-bold flex items-center gap-2 mb-4"><Trophy className="size-4 text-primary" /> Ligas</h2>
          <ul className="space-y-1.5 mb-5">
            {leagues.map((l) => {
              const isActive = active?.id === l.id;
              const count = teams.filter((t) => t.leagueId === l.id).length;
              return (
                <li key={l.id}>
                  <button
                    onClick={() => setSelected(l.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? "bg-secondary" : "hover:bg-secondary/50"}`}
                  >
                    <div className="size-9 rounded-md bg-gradient-primary flex items-center justify-center">
                      <Trophy className="size-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{l.season ? `${l.season} · ` : ""}{count} equipos</div>
                    </div>
                  </button>
                </li>
              );
            })}
            {leagues.length === 0 && (
              <li className="text-sm text-muted-foreground py-6 text-center">Aún no hay ligas.</li>
            )}
          </ul>
          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nueva liga</p>
            <Input placeholder="Nombre (ej: Liga Apertura)" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} />
            <Input placeholder="Temporada (opcional)" value={season} onChange={(e) => setSeason(e.target.value.slice(0, 20))} />
            <Button
              className="w-full"
              disabled={!name.trim()}
              onClick={() => {
                const id = addLeague({ name: name.trim(), season: season.trim() || undefined });
                setName(""); setSeason(""); setSelected(id);
              }}
            >
              <Plus className="size-4" /> Crear liga
            </Button>
          </div>
        </section>

        <section className="lg:col-span-2 rounded-2xl bg-card border border-border/60 p-5">
          {active ? (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div className="size-12 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
                  <Trophy className="size-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-xl">{active.name}</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {active.season ?? "Sin temporada"} · {teamsInLeague.length} equipos
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm(`¿Eliminar ${active.name}? Los equipos quedarán sin liga.`)) {
                      removeLeague(active.id);
                      setSelected(null);
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              <div className="mb-5 rounded-xl border border-border/60 bg-secondary/30 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                  Modo de estadísticas
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["liga", "entrenador"] as StatsMode[]).map((m) => {
                    const current = active.statsMode ?? "liga";
                    const isActive = current === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateLeague(active.id, { statsMode: m })}
                        className={`text-left rounded-lg border p-2.5 transition-colors ${
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-border/60 bg-card hover:bg-secondary/50"
                        }`}
                      >
                        <div className="text-sm font-bold">{STATS_MODE_LABEL[m]}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {STATS_MODE_DESCRIPTION[m]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Equipos en la liga</h3>
                  <ul className="space-y-1.5">
                    {teamsInLeague.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2">
                        <TeamBadge team={t} size="sm" />
                        <span className="flex-1 truncate font-medium text-sm">{t.name}</span>
                        <button
                          onClick={() => updateTeam(t.id, { leagueId: undefined })}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                    {teamsInLeague.length === 0 && (
                      <li className="text-sm text-muted-foreground py-4 text-center">Sin equipos asignados.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Agregar equipos</h3>
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                    {teamsAvailable.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 bg-secondary/20 rounded-lg px-3 py-2">
                        <TeamBadge team={t} size="sm" />
                        <span className="flex-1 truncate font-medium text-sm">{t.name}</span>
                        <Button size="sm" variant="secondary" onClick={() => updateTeam(t.id, { leagueId: active.id })}>
                          Agregar
                        </Button>
                      </li>
                    ))}
                    {teamsAvailable.length === 0 && (
                      <li className="text-sm text-muted-foreground py-4 text-center">No hay equipos disponibles.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Tabla de posiciones</h3>
                <div className="overflow-x-auto rounded-lg border border-border/40">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
                      <tr>
                        <th className="text-left py-2 px-3 w-8">#</th>
                        <th className="text-left py-2 px-3">Equipo</th>
                        <th className="text-center py-2 px-2">PJ</th>
                        <th className="text-center py-2 px-2">G</th>
                        <th className="text-center py-2 px-2">P</th>
                        <th className="text-center py-2 px-2">Sets</th>
                        <th className="text-center py-2 px-2 text-primary">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, i) => {
                        const team = teamById.get(row.teamId);
                        return (
                          <tr key={row.teamId} className="border-t border-border/40">
                            <td className="py-2 px-3 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="py-2 px-3"><div className="flex items-center gap-2"><TeamBadge team={team} size="sm" /><span className="font-medium">{team?.name ?? "—"}</span></div></td>
                            <td className="text-center tabular-nums">{row.played}</td>
                            <td className="text-center tabular-nums text-success">{row.won}</td>
                            <td className="text-center tabular-nums text-muted-foreground">{row.lost}</td>
                            <td className="text-center tabular-nums text-muted-foreground">{row.setsFor}-{row.setsAgainst}</td>
                            <td className="text-center tabular-nums font-bold text-primary">{row.leaguePoints}</td>
                          </tr>
                        );
                      })}
                      {standings.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-sm">Sin partidos finalizados todavía.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-muted-foreground">Creá una liga para empezar.</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
