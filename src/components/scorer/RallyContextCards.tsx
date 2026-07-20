import type { RallyContext } from "@/lib/rally-phase";
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
 * Chips flotantes con “Acción actual”, “Última acción” y “Posesión”.
 * Se posicionan absolutamente sobre la cancha — no ocupan altura del layout.
 */
export function RallyContextCards({ ctx, teamA, teamB }: Props) {
  const possessionTeam =
    ctx.possession === "A" ? teamA : ctx.possession === "B" ? teamB : null;
  const defenseTeam =
    ctx.possession === "A" ? teamB : ctx.possession === "B" ? teamA : null;
  const curTeam =
    ctx.currentActionSide === "A" ? teamA : ctx.currentActionSide === "B" ? teamB : null;
  const lastTeam =
    ctx.lastActionSide === "A" ? teamA : ctx.lastActionSide === "B" ? teamB : null;

  return (
    <>
      {/* Posesión — cinta superior centrada */}
      {possessionTeam && defenseTeam && !ctx.finished && (
        <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border border-border/60 rounded-full px-2 py-0.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full animate-pulse" style={{ background: possessionTeam.color }} />
            <span style={{ color: possessionTeam.color }}>{possessionTeam.shortName}</span>
            <span className="text-primary">atacando</span>
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="flex items-center gap-1 opacity-70">
            <span style={{ color: defenseTeam.color }}>{defenseTeam.shortName}</span>
            <span className="text-muted-foreground">defendiendo</span>
          </span>
        </div>
      )}

      {/* Acción actual — esquina superior derecha */}
      <div className="pointer-events-none absolute top-1 right-1 z-30 max-w-[46%] rounded-md bg-background/85 backdrop-blur-sm border border-primary/40 px-2 py-1 shadow-lg">
        <div className="text-[8px] uppercase tracking-widest font-black text-primary/80">Acción actual</div>
        <div className="text-[10px] md:text-[11px] font-bold leading-tight truncate">
          {ctx.currentActionText}
        </div>
        {curTeam && ctx.currentActionPlayerId && (
          <div className="text-[9px] text-muted-foreground truncate">
            {playerLabel(curTeam, ctx.currentActionPlayerId)}
          </div>
        )}
      </div>

      {/* Última acción — esquina inferior izquierda */}
      {ctx.lastActionLabel && (
        <div className="pointer-events-none absolute bottom-1 left-1 z-30 max-w-[46%] rounded-md bg-background/85 backdrop-blur-sm border border-border/60 px-2 py-1 shadow-lg">
          <div className="text-[8px] uppercase tracking-widest font-black text-muted-foreground">Última</div>
          <div className="text-[10px] md:text-[11px] font-bold leading-tight truncate">
            {ctx.lastActionLabel}
            {ctx.lastActionDetail && <span className="text-muted-foreground"> · {ctx.lastActionDetail}</span>}
          </div>
          {lastTeam && ctx.lastActionPlayerId && (
            <div
              className="text-[9px] font-semibold truncate"
              style={{ color: lastTeam.color }}
            >
              {playerLabel(lastTeam, ctx.lastActionPlayerId)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
