import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";
import {
  type Team,
  type Match,
  type Player,
  type SettingQuality,
  type SettingAttackZone,
  type AttackDirection,
  type AttackZone,
} from "@/lib/volley-store";
import { AttackDirectionGrid } from "@/components/court/AttackDirectionGrid";

interface Props {
  open: boolean;
  onClose: () => void;
  match: Match;
  team: Team;
  side: "A" | "B";
  onCourt: string[];
  /** Calidad de recepción ya cargada afuera del diálogo. */
  receptionQuality?: SettingQuality;
  onSubmit: (payload: {
    setterId: string;
    setterQuality: SettingQuality;
    attackZone: SettingAttackZone;
    attackerId: string;
    action: RallyAction;
    attackDirection?: AttackDirection;
    receptionQuality?: SettingQuality;
  }) => void;
}

export type RallyAction =
  | "rotation_attack"
  | "attack_neutral"
  | "counter_attack"
  | "block" // rival tapó
  | "attack_error"
  | "unforced_error";

const ACTION_LABEL: Record<RallyAction, string> = {
  rotation_attack: "Ataque · Punto",
  attack_neutral: "Ataque · Neutra",
  counter_attack: "Contraataque",
  block: "Bloqueo rival",
  attack_error: "Error de ataque",
  unforced_error: "Error no forzado",
};

const ACTION_SHORT: Record<RallyAction, string> = {
  rotation_attack: "Ataque +",
  attack_neutral: "Ataque =",
  counter_attack: "Contra",
  block: "Bloqueo",
  attack_error: "Err. ataque",
  unforced_error: "Err. no forz.",
};

type Step = "attacker" | "action" | "direction";

/** Zona SettingAttackZone inferida a partir del índice on-court del atacante. */
function inferSettingZone(onCourt: string[], playerId: string): SettingAttackZone {
  const idx = onCourt.indexOf(playerId);
  switch (idx) {
    case 0: return "back1";
    case 1: return "z2";
    case 2: return "z3";
    case 3: return "z4";
    case 4: return "back5";
    case 5: return "pipe";
    default: return "z4";
  }
}

/** Mapeo zona-armado → PointEvent.attackZone. */
export function settingZoneToAttackZone(z: SettingAttackZone): AttackZone | undefined {
  switch (z) {
    case "z2": return 2;
    case "z3": return 3;
    case "z4": return 4;
    case "back1": return 1;
    case "back5": return 5;
    case "pipe": return 6;
    default: return undefined;
  }
}

/**
 * Diálogo integrado ultra-rápido para el modo entrenador. Se abre después de
 * la recepción positiva/neutral. Flujo:
 *   1. Elegir atacante (una jugadora en cancha)
 *   2. Elegir acción (Ataque+, Ataque neutro, Contra, Bloqueo rival, Err ataque, Err no forzado)
 *   3. Si acción = Contra → paso obligatorio de dirección 3×3 en cancha rival.
 *
 * El resto de las acciones cierra el diálogo automáticamente al elegirse.
 */
export function IntegratedRallyDialog({
  open,
  onClose,
  match: _match,
  team,
  side: _side,
  onCourt,
  receptionQuality,
  onSubmit,
}: Props) {
  const playersOnCourt: Player[] = useMemo(
    () => onCourt.map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p),
    [onCourt, team.players],
  );
  const setter = useMemo(
    () => playersOnCourt.find((p) => p.position === "armador") ?? playersOnCourt[0],
    [playersOnCourt],
  );

  const [step, setStep] = useState<Step>("attacker");
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [action, setAction] = useState<RallyAction | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("attacker");
      setAttackerId(null);
      setAction(null);
    }
  }, [open]);

  const pickAttacker = (id: string) => {
    setAttackerId(id);
    setStep("action");
  };

  const pickAction = (a: RallyAction) => {
    setAction(a);
    if (a === "counter_attack") {
      // Contraataque exige zona de destino (dirección) obligatoria.
      setStep("direction");
    } else {
      finalize(a, undefined);
    }
  };

  const pickDirection = (d: AttackDirection) => {
    if (action) finalize(action, d);
  };

  const finalize = (a: RallyAction, dir: AttackDirection | undefined) => {
    if (!attackerId || !setter) return;
    const attackZone = inferSettingZone(onCourt, attackerId);
    onSubmit({
      setterId: setter.id,
      setterQuality: "!",
      attackZone,
      attackerId,
      action: a,
      attackDirection: dir,
      receptionQuality,
    });
    onClose();
  };

  const goBack = () => {
    if (step === "direction") setStep("action");
    else if (step === "action") setStep("attacker");
  };

  const title = (() => {
    switch (step) {
      case "attacker": return "¿Quién atacó?";
      case "action": return "Acción del ataque";
      case "direction": return "Zona de destino (obligatoria)";
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100dvw-24px)] max-w-[440px] rounded-xl border-border/60 p-3 gap-2 max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="pr-8 space-y-0 text-left">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            {step !== "attacker" && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Atrás"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <span
              className="size-7 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black text-white"
              style={{ background: team.color }}
            >
              {team.shortName?.slice(0, 2)}
            </span>
            <span className="min-w-0 truncate">
              <span className="block text-sm font-bold">{title}</span>
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                {team.shortName} · Armó #{setter?.number ?? "?"}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {step === "attacker" && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              {playersOnCourt.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickAttacker(p.id)}
                  className="min-h-[72px] rounded-lg border-2 border-border bg-card px-1 py-2 flex flex-col items-center justify-center transition active:scale-95 hover:border-primary hover:bg-primary/10"
                >
                  <span className="scoreboard-digit text-xl font-black leading-none">#{p.number}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-full mt-0.5">
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "action" && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Object.keys(ACTION_LABEL) as RallyAction[]).map((a) => {
              const tone =
                a === "rotation_attack" || a === "counter_attack"
                  ? "bg-primary text-primary-foreground"
                  : a === "attack_neutral"
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-destructive/90 text-destructive-foreground";
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => pickAction(a)}
                  className={`min-h-[64px] rounded-lg font-bold text-sm active:scale-95 transition ${tone}`}
                >
                  <span className="block text-base leading-tight">{ACTION_SHORT[a]}</span>
                  <span className="block text-[10px] font-normal opacity-90 mt-0.5">{ACTION_LABEL[a]}</span>
                </button>
              );
            })}
          </div>
        )}

        {step === "direction" && (
          <div className="mt-2">
            <AttackDirectionGrid onPick={pickDirection} value={null} />
            <p className="mt-2 text-[11px] text-center text-muted-foreground">
              Elegí una zona para cerrar el contraataque.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
