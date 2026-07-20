import type { RallyContext } from "@/lib/rally-phase";
import { RALLY_PHASE_LABEL } from "@/lib/rally-phase";
import type { Team } from "@/lib/volley-store";

interface Props {
  ctx: RallyContext;
  teamA: Team;
  teamB: Team;
}

function playerLabel(team: Team, id: string | null): string {
  if (!id) return "—";
  const p = team.players.find((x) => x.id === id);
  return p ? `#${p.number} ${p.name}` : "—";
}

/**
 * Chips flotantes con contexto del rally: acción actual, última acción, y
 * mini-línea temporal (Saque → Recepción → Armado → Ataque → Defensa → …).
 */
export function RallyContextCards({ ctx, teamA, teamB }: Props) {
  const short = (s: "A" | "B") => (s === "A" ? teamA.shortName ?? teamA.name : teamB.shortName ?? teamB.name);
  const color = (s: "A" | "B") => (s === "A" ? teamA.color : teamB.color);
  const teamOf = (s: "A" | "B") => (s === "A" ? teamA : teamB);
  const curSide = ctx.currentPhaseSide;
  const oppSide: "A" | "B" | null = curSide ? (curSide === "A" ? "B" : "A") : null;

  const doneSteps = ctx.steps.filter((s) => s.done);
  const timeline = doneSteps.slice(-6); // últimos 6 para no saturar

  return (
    <>
      {/* Cinta superior: quién ejecuta la fase actual. */}
      {curSide && oppSide && !ctx.finished && (
        <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/60 rounded-full px-2 py-0.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full animate-pulse" style={{ background: color(curSide) }} />
            <span style={{ color: color(curSide) }}>{short(curSide)}</span>
            <span className="text-primary">{RALLY_PHASE_LABEL[ctx.currentPhase]}</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1 opacity-70">
            <span style={{ color: color(oppSide) }}>{short(oppSide)}</span>
            <span className="text-muted-foreground">espera</span>
          </span>
        </div>
      )}

      {/* Acción actual — esquina superior derecha */}
      <div className="pointer-events-none absolute top-1 right-1 z-30 max-w-[46%] rounded-md bg-background/85 backdrop-blur-sm border border-primary/40 px-2 py-1 shadow-lg">
        <div className="text-[8px] uppercase tracking-widest font-black text-primary/80">Acción actual</div>
        <div className="text-[10px] md:text-[11px] font-bold leading-tight truncate">
          {ctx.currentActionText}
        </div>
        {ctx.currentActionSide && ctx.currentActionPlayerId && (
          <div className="text-[9px] text-muted-foreground truncate">
            {playerLabel(teamOf(ctx.currentActionSide), ctx.currentActionPlayerId)}
          </div>
        )}
      </div>

      {/* Historial mini del rally — esquina inferior izquierda */}
      {timeline.length > 0 && (
        <div className="pointer-events-none absolute bottom-1 left-1 z-30 max-w-[70%] rounded-md bg-background/85 backdrop-blur-sm border border-border/60 px-2 py-1 shadow-lg">
          <div className="text-[8px] uppercase tracking-widest font-black text-muted-foreground">Rally</div>
          <div className="flex items-center gap-1 flex-wrap text-[10px] font-bold">
            {timeline.map((s, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/50">→</span>}
                <span
                  className="px-1 rounded"
                  style={{ color: s.side ? color(s.side) : undefined }}
                >
                  {RALLY_PHASE_LABEL[s.phase].slice(0, 3)}
                  {s.detail ? ` ${s.detail}` : ""}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
