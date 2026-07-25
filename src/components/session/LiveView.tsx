/**
 * Vista Live de MatchSession — reutiliza el layout mobile ya existente
 * (MobileMatchShell) para desktop/tablet también, dejando el registro
 * rápido y el marcador visibles. NO reemplaza scouting/video pipeline.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useVolley } from "@/lib/volley-store";
import { MatchSessionService } from "@/lib/match-session/services/match-session-service";
import { ProcessingService } from "@/lib/match-session/services/processing-service";
import { Radio, Square, Video } from "lucide-react";

interface Props {
  sessionId: string;
}

export function LiveView({ sessionId }: Props) {
  const match = useVolley((s) => s.matches.find((m) => m.id === sessionId));
  const teamA = useVolley((s) => s.teams.find((t) => t.id === match?.teamAId));
  const teamB = useVolley((s) => s.teams.find((t) => t.id === match?.teamBId));

  if (!match) return null;

  const handleFinish = () => {
    void ProcessingService.run(sessionId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-destructive animate-pulse" />
          <span className="text-sm font-bold">Sesión en vivo</span>
          <span className="text-xs text-muted-foreground">
            {teamA?.name} vs {teamB?.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/video/$matchId/live" params={{ matchId: sessionId }}>
              <Video className="size-3.5" /> Cámara
            </Link>
          </Button>
          <Button size="sm" variant="destructive" onClick={handleFinish} className="gap-1.5">
            <Square className="size-3.5" /> Terminar partido
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <p className="text-sm text-muted-foreground mb-3">
          Registro y marcador se ejecutan en la vista clásica de partido.
          Todos los eventos, clips virtuales y grabación quedan asociados a
          esta sesión.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/matches/$id" params={{ id: sessionId }}>Abrir marcador</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/video/$matchId/scout" params={{ matchId: sessionId }}>Abrir scouting</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/matches/$id/stats" params={{ id: sessionId }}>Estadísticas</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
