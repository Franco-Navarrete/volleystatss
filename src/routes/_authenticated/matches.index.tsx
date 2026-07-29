import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { LiveMatchesFeed } from "@/components/LiveMatchesFeed";
import { TeamBadge } from "@/components/TeamBadge";
import { useVolley, setsWon } from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import { Plus, Radio, Trash2 } from "lucide-react";
import { useCanCreateMatches, useCanDeleteMatches } from "@/hooks/use-permissions";
import { useIsAdmin } from "@/hooks/use-auth";
import { useCoachAccess } from "@/hooks/use-coach-access";
import { useAllUsersAppState } from "@/hooks/use-all-app-state";
import { authorizeAndDeleteMatch } from "@/lib/match-permissions.functions";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/matches/")({
  head: () => ({ meta: [{ title: "Partidos · RALLY" }] }),
  component: MatchesIndex,
});

function MatchesIndex() {
  const localMatches = useVolley((s) => s.matches);
  const localTeams = useVolley((s) => s.teams);
  const deleteMatch = useVolley((s) => s.deleteMatch);
  
  const { user } = useIsAdmin();
  const { isAdmin } = useIsAdmin();
  const { hasAccess: isCoach } = useCoachAccess();
  const adminAll = useAllUsersAppState();

  const matches = useMemo(() => {
    // Si es admin, ve todo el sistema (Merged App State)
    if (isAdmin) {
      if (!adminAll.data) return localMatches;
      const byId = new Map(localMatches.map((m) => [m.id, m]));
      for (const m of adminAll.data.matches) if (!byId.has(m.id)) byId.set(m.id, m);
      return [...byId.values()];
    }
    
    // Si es Coach (como franco@gmail.com), solo ve lo que él creó 
    // o lo que está en su estado local (localMatches ya está filtrado por RLS en app_state)
    return localMatches;
  }, [isAdmin, adminAll.data, localMatches]);

  const teams = useMemo(() => {
    if (isAdmin) {
      if (!adminAll.data) return localTeams;
      const byId = new Map(localTeams.map((t) => [t.id, t]));
      for (const t of adminAll.data.teams) if (!byId.has(t.id)) byId.set(t.id, t);
      return [...byId.values()];
    }
    return localTeams;
  }, [isAdmin, adminAll.data, localTeams]);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const { allowed: canCreate } = useCanCreateMatches();
  const { allowed: canDelete } = useCanDeleteMatches();
  const deleteFn = useServerFn(authorizeAndDeleteMatch);
  const [, setDeletingId] = useState<string | null>(null);

  async function handleDelete(matchId: string) {
    setDeletingId(matchId);
    try {
      await deleteFn({ data: { matchId } });
      deleteMatch(matchId);
      toast.success("Partido eliminado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No tienes permisos para eliminar partidos en vivo.");
    } finally {
      setDeletingId(null);
    }
  }

  const groups = [
    { label: "En vivo", items: matches.filter((m) => m.status === "live"), addTo: "live" as const },
    { label: "Programados", items: matches.filter((m) => m.status === "scheduled"), addTo: "scheduled" as const },
    { label: "Finalizados", items: matches.filter((m) => m.status === "finished").sort((a, b) => b.createdAt - a.createdAt), addTo: null },
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold">Partidos</h1>
          <p className="text-muted-foreground text-sm">Fixture, partidos en vivo y resultados.</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/session/new"><Plus className="size-4" /> Nueva sesión</Link>
            </Button>
            <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
              <Link to="/matches/new"><Plus className="size-4" /> Nuevo partido</Link>
            </Button>
          </div>
        )}

      </div>

      <LiveMatchesFeed />

      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.label}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{g.label} · {g.items.length}</h2>
              {canCreate && g.addTo && (
                <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                  <Link to="/matches/new">
                    <Plus className="size-3.5" /> Nuevo
                  </Link>
                </Button>
              )}
            </div>
            {g.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 px-5 py-8 text-center text-sm text-muted-foreground">
                Sin partidos.
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.items.map((m) => {
                  const a = teamById.get(m.teamAId);
                  const b = teamById.get(m.teamBId);
                  const w = setsWon(m);
                  const isLive = m.status === "live";
                  return (
                    <li key={m.id} className="relative">
                      <Link
                        to="/matches/$id"
                        params={{ id: m.id }}
                        className="block rounded-2xl bg-card border border-border/60 p-4 hover:border-primary/60 hover:-translate-y-0.5 transition-all shadow-elevated"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                            {new Date(m.scheduledAt).toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>

                          {isLive && (
                            <span className="text-[10px] uppercase tracking-widest font-bold text-destructive flex items-center gap-1.5">
                              <Radio className="size-3 animate-pulse" /> En vivo
                            </span>
                          )}
                          {m.status === "finished" && (
                            <span className="text-[10px] uppercase tracking-widest font-bold text-success">Final</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <TeamBadge team={a} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{a?.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{b?.name}</div>
                          </div>
                          <TeamBadge team={b} size="md" />
                        </div>
                        {m.status !== "scheduled" && (
                          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-center gap-3 scoreboard-digit text-2xl font-extrabold">
                            <span className={w.a >= w.b ? "text-primary" : "text-muted-foreground"}>{w.a}</span>
                            <span className="text-muted-foreground text-sm">SETS</span>
                            <span className={w.b >= w.a ? "text-primary" : "text-muted-foreground"}>{w.b}</span>
                          </div>
                        )}
                      </Link>
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              type="button"
                              aria-label="Eliminar partido"
                              className="absolute top-2 right-2 size-8 rounded-full bg-background/80 border border-border/60 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/60 transition-colors"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar este partido?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se borrarán todos los puntos, rotaciones y estadísticas asociadas. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(m.id)}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </AppShell>
  );
}
