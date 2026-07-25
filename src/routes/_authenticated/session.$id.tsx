import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useMatchSessionStore } from "@/lib/match-session/store";
import { useVolley } from "@/lib/volley-store";
import { SessionStatusBadge } from "@/components/session/SessionStatusBadge";
import { LiveView } from "@/components/session/LiveView";
import { ProcessingView } from "@/components/session/ProcessingView";
import { AnalysisView } from "@/components/session/AnalysisView";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/session/$id")({
  head: () => ({ meta: [{ title: "Sesión de partido · RALLY" }] }),
  component: SessionRoute,
});

function SessionRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const session = useMatchSessionStore((s) => s.sessions[id]);
  const teamA = useVolley((s) => s.teams.find((t) => t.id === session?.teamAId));
  const teamB = useVolley((s) => s.teams.find((t) => t.id === session?.teamBId));

  // Si no existe la sesión pero sí el partido, adoptamos con estado análisis
  const matchExists = useVolley((s) => s.matches.some((m) => m.id === id));
  const createSession = useMatchSessionStore((s) => s.createSession);
  useEffect(() => {
    if (!session && matchExists) {
      const m = useVolley.getState().matches.find((x) => x.id === id)!;
      createSession({
        id,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
      });
      useMatchSessionStore.getState().setStatus(id, m.status === "finished" ? "finished" : "analysis");
    }
  }, [session, matchExists, id, createSession]);

  if (!session) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-16 text-center">
          <h1 className="text-xl font-bold mb-2">Sesión no encontrada</h1>
          <p className="text-sm text-muted-foreground mb-6">
            No pudimos encontrar esta Match Session.
          </p>
          <Button onClick={() => navigate({ to: "/matches" })}>Volver</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild size="sm" variant="ghost" className="gap-1.5">
            <Link to="/matches"><ArrowLeft className="size-3.5" /> Partidos</Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold truncate">
              {teamA?.name ?? "Local"} <span className="text-muted-foreground">vs</span> {teamB?.name ?? "Visitante"}
            </h1>
            {(session.competition || session.category) && (
              <p className="text-xs text-muted-foreground truncate">
                {[session.competition, session.category].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <SessionStatusBadge status={session.status} />
      </div>

      {session.status === "preparation" && (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Esta sesión está en preparación.{" "}
          <Link to="/session/new" className="text-primary underline">Configurar</Link>.
        </div>
      )}
      {session.status === "live" && <LiveView sessionId={id} />}
      {session.status === "processing" && <ProcessingView sessionId={id} />}
      {(session.status === "analysis" || session.status === "finished") && (
        <AnalysisView sessionId={id} finished={session.status === "finished"} />
      )}
    </AppShell>
  );
}
