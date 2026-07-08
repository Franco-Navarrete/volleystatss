import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Team, AttackDirection } from "@/lib/volley-store";
import { AttackDirectionGrid } from "@/components/court/AttackDirectionGrid";

interface Props {
  open: boolean;
  team: Team | null;
  playerId: string | null;
  onSelect: (dir: AttackDirection | null) => void;
  onClose: () => void;
}

/**
 * Selector de zona de destino del ataque (grilla 3×3 en cancha rival).
 * Zona opcional: botón "Sin zona / saltar" cierra igual guardando el ataque.
 */
export function AttackDirectionDialog({ open, team, playerId, onSelect, onClose }: Props) {
  const player = team?.players.find((p) => p.id === playerId) ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100dvw-24px)] max-w-[400px] rounded-xl border-border/60 p-3 gap-2 max-h-[92dvh] overflow-y-auto">
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
                    Zona de destino del ataque
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2">
              <AttackDirectionGrid onPick={(d) => onSelect(d)} value={null} />
            </div>

            <button
              type="button"
              onClick={() => onSelect(null)}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline self-center"
            >
              Sin zona / saltar
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
