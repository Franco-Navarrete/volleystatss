/**
 * Vista de análisis: reutiliza AnalysisPanel + VideoPlayer existentes.
 * No se crea otro reproductor — el mismo componente cambia su comportamiento
 * según el estado de la sesión.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { MatchSessionService } from "@/lib/match-session/services/match-session-service";

interface Props {
  sessionId: string;
  finished?: boolean;
}

export function AnalysisView({ sessionId, finished }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="text-sm">
          <div className="font-bold">Modo Análisis</div>
          <p className="text-xs text-muted-foreground">
            Timeline, playlists, biblioteca de clips, comparación y dashboard
            operan sobre el mismo reproductor.
          </p>
        </div>
        {!finished && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => MatchSessionService.finish(sessionId)}
          >
            <CheckCircle2 className="size-3.5" /> Finalizar sesión
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnalysisLink
          href={`/video/${sessionId}/analysis`}
          title="Análisis post-partido"
          desc="Filtros, playlists, comparación y dashboard."
        />
        <AnalysisLink
          href={`/video/${sessionId}/scout`}
          title="Scouting profesional"
          desc="Tabla + Rally + timeline con zoom, atajos J/K/L."
        />
        <AnalysisLink
          href={`/matches/${sessionId}/stats`}
          title="Estadísticas completas"
          desc="Rotaciones, distribución, mapa de calor, ranking."
        />
      </div>

    </div>
  );
}

function AnalysisLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-2xl border border-border/60 bg-card/40 p-4 hover:border-primary/60 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">{title}</span>
        <ExternalLink className="size-3.5 text-muted-foreground group-hover:text-primary" />
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </a>
  );
}

