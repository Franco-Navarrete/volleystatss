import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Team } from "@/lib/volley-store";

export type AttackResult = "point" | "continue" | "error";

interface Props {
  open: boolean;
  team: Team | null;
  playerId: string | null;
  onSelect: (result: AttackResult) => void;
  onClose: () => void;
}

/**
 * Selector de resultado del ataque.
 *   Punto     → cierra rally, suma punto (mantiene rotation_attack / counter_attack).
 *   Continúa  → rally sigue (attack_neutral / counter_neutral). No pide zona? Sí, pide.
 *   Error     → attack_error, salta paso de zona destino.
 */
export function AttackResultDialog({ open, team, playerId, onSelect, onClose }: Props) {
  const player = team?.players.find((p) => p.id === playerId) ?? null;

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
                    Resultado del ataque
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-2 mt-3">
              <button
                type="button"
                onClick={() => onSelect("point")}
                className="min-h-[72px] rounded-lg bg-success text-success-foreground font-black text-lg active:scale-[0.98] transition"
              >
                Punto
                <span className="block text-[10px] font-normal opacity-90 mt-1">
                  Cerró el rally
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelect("continue")}
                className="min-h-[72px] rounded-lg bg-secondary text-secondary-foreground font-black text-lg active:scale-[0.98] transition"
              >
                Continúa el rally
                <span className="block text-[10px] font-normal opacity-90 mt-1">
                  Suma al total, no afecta eficiencia
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelect("error")}
                className="min-h-[64px] rounded-lg bg-destructive text-destructive-foreground font-black text-base active:scale-[0.98] transition"
              >
                Error de ataque
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
