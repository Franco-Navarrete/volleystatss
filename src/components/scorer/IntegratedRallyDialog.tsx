import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  type Team,
  type Match,
  type Player,
  type SettingQuality,
  type SettingAttackZone,
  type SettingAttackResult,
  type PointType,
  type AttackDirection,
  type AttackZone,
  SETTING_ATTACK_ZONES,
  SETTING_ATTACK_ZONE_LABEL,
} from "@/lib/volley-store";
import { useFormation } from "@/hooks/use-formation";
import { pickAttackerByZone } from "@/lib/formations/pick-attacker";
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
  | "counter_attack"
  | "block" // rival tapó
  | "attack_error"
  | "unforced_error";

const ACTION_LABEL: Record<RallyAction, string> = {
  rotation_attack: "Ataque de rotación",
  counter_attack: "Contraataque",
  block: "Bloqueo rival",
  attack_error: "Error de ataque",
  unforced_error: "Error no forzado",
};

const ACTION_SHORT: Record<RallyAction, string> = {
  rotation_attack: "Ataque",
  counter_attack: "Contra",
  block: "Bloqueo",
  attack_error: "Err. ataque",
  unforced_error: "Err. no forz.",
};

type Step = "zone" | "attacker" | "action" | "direction";

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
 * Diálogo integrado del flujo Armado → Ataque → Dirección. Se abre después
 * de la recepción. Todo el flujo con la menor cantidad de toques posible:
 *   1. Zona armado
 *   2. Atacante (auto-preselecc. por rotación, editable)
 *   3. Calidad armado (+ / neutro / -)
 *   4. Acción del atacante
 *   5. Dirección 3×3 (sólo si ataque / contra)
 */
export function IntegratedRallyDialog({
  open,
  onClose,
  match,
  team,
  side,
  onCourt,
  receptionQuality,
  onSubmit,
}: Props) {
  const formation = useFormation(match, team, side, "5-1", "attack");

  const playersOnCourt: Player[] = useMemo(
    () => onCourt.map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p),
    [onCourt, team.players],
  );
  const setter = useMemo(
    () => playersOnCourt.find((p) => p.position === "armador") ?? playersOnCourt[0],
    [playersOnCourt],
  );

  const [step, setStep] = useState<Step>("zone");
  const [zone, setZone] = useState<SettingAttackZone | null>(null);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [action, setAction] = useState<RallyAction | null>(null);
  const [direction, setDirection] = useState<AttackDirection | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("zone");
      setZone(null);
      setAttackerId(null);
      setAction(null);
      setDirection(null);
    }
  }, [open]);

  const pickZone = (z: SettingAttackZone) => {
    setZone(z);
    const suggested = pickAttackerByZone(formation, onCourt, z);
    setAttackerId(suggested);
    setStep("attacker");
  };

  const pickAttacker = (id: string) => {
    setAttackerId(id);
    setStep("action");
  };

  const pickAction = (a: RallyAction) => {
    setAction(a);
    if (a === "rotation_attack" || a === "counter_attack") {
      setStep("direction");
    } else {
      // Sin dirección → submit directo
      finalize(a, undefined);
    }
  };

  const pickDirection = (d: AttackDirection) => {
    setDirection(d);
    if (action) finalize(action, d);
  };

  const finalize = (a: RallyAction, dir: AttackDirection | undefined) => {
    if (!zone || !attackerId || !setter) return;
    onSubmit({
      setterId: setter.id,
      // Calidad del armado desactivada en el flujo — se envía neutro por defecto.
      setterQuality: "!",
      attackZone: zone,
      attackerId,
      action: a,
      attackDirection: dir,
      receptionQuality,
    });
    onClose();
  };

  const goBack = () => {
    const order: Step[] = ["zone", "attacker", "action", "direction"];
    const i = order.indexOf(step);
    if (i > 0) setStep(order[i - 1]);
  };

  const title = (() => {
    switch (step) {
      case "zone": return "Zona del armado";
      case "attacker": return "Atacante";
      case "action": return "Acción del ataque";
      case "direction": return "Dirección del ataque";
    }
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100dvw-24px)] max-w-[440px] rounded-xl border-border/60 p-3 gap-2 max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="pr-8 space-y-0 text-left">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            {step !== "zone" && (
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
                Armó #{setter?.number ?? "?"} · {team.shortName}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {step === "zone" && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              {SETTING_ATTACK_ZONES.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => pickZone(z)}
                  className="min-h-[64px] rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-primary/10 font-bold text-sm active:scale-95 transition"
                >
                  {SETTING_ATTACK_ZONE_LABEL[z]}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "attacker" && (
          <div className="space-y-2 mt-2">
            <p className="text-[11px] text-muted-foreground">
              Sugerido según rotación. Tocá otra jugadora para cambiar.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {playersOnCourt.map((p) => {
                const highlighted = p.id === attackerId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickAttacker(p.id)}
                    className={`min-h-[68px] rounded-lg border-2 px-1 py-2 flex flex-col items-center justify-center transition active:scale-95 ${
                      highlighted
                        ? "border-primary bg-primary/15 ring-2 ring-primary/40"
                        : "border-border bg-card hover:border-primary/60"
                    }`}
                  >
                    <span className="scoreboard-digit text-xl font-black leading-none">#{p.number}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-full mt-0.5">
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {attackerId && (
              <Button
                className="w-full mt-2"
                onClick={() => setStep("action")}
              >
                Confirmar #{playersOnCourt.find((p) => p.id === attackerId)?.number}
              </Button>
            )}
          </div>
        )}


        {step === "action" && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Object.keys(ACTION_LABEL) as RallyAction[]).map((a) => {
              const tone =
                a === "rotation_attack" || a === "counter_attack"
                  ? "bg-primary text-primary-foreground"
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
            <AttackDirectionGrid onPick={pickDirection} value={direction} />
            <button
              type="button"
              onClick={() => action && finalize(action, undefined)}
              className="mt-2 w-full text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              Sin dirección
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
