import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Team } from "@/lib/volley-store";
import {
  type AttackType,
  getAttackTypeOptions,
} from "@/lib/formations/attack-types";

interface Props {
  open: boolean;
  team: Team | null;
  playerId: string | null;
  isBackRow: boolean;
  onSelect: (type: AttackType | null) => void;
  onClose: () => void;
}

/**
 * Selector de tipo de ataque (modo Entrenador).
 *
 * Botones grandes 1-toque optimizados para tablet. El catálogo se filtra según
 * el rol de la jugadora y si está en cancha delantera o zaguera (atque pipe /
 * zaguero).
 */
export function AttackTypeDialog({ open, team, playerId, isBackRow, onSelect, onClose }: Props) {
  const player = team?.players.find((p) => p.id === playerId) ?? null;
  const options = getAttackTypeOptions({ position: player?.position, isBackRow });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100dvw-24px)] max-w-[380px] rounded-xl border-border/60 p-3 gap-2">
        {team && player && (
          <>
            <DialogHeader className="pr-8 space-y-0 text-left">
              <DialogTitle className="flex items-center gap-3 min-w-0">
                <span
                  className="size-9 shrink-0 rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-sm"
                  style={{ background: team.color }}
                >
                  {player.number}
                </span>
                <span className="min-w-0 truncate">
                  <span className="block text-sm font-bold">{player.name}</span>
                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Tipo de ataque {isBackRow ? "· zaguero" : "· delantero"}
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2 mt-3">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelect(opt.id)}
                  className="min-h-[72px] rounded-lg bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center px-2"
                >
                  <span className="text-base leading-tight">{opt.shortLabel}</span>
                  <span className="text-[10px] opacity-80 mt-1 text-center leading-tight">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onSelect(null)}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline self-center"
            >
              Sin clasificar
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
