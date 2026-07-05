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

/**
 * Acción del atacante. La valoración (+ / = / −) se elige en el paso siguiente
 * para Ataque y Contra; el resto de las acciones no tienen valoración.
 */
export type RallyAction =
  | "rotation_attack"   // Ataque de rotación · Punto
  | "attack_neutral"    // Ataque · Neutra (continuidad, no puntúa)
  | "counter_attack"    // Contraataque · Punto
  | "counter_neutral"   // Contra · Neutra
  | "attack_error"      // Error de ataque
  | "block"             // Bloqueo rival (nos tapó)
  | "unforced_error";   // Error no forzado

type ActionKind = "attack" | "counter" | "block" | "unforced";
type Rating = "point" | "neutral" | "error";

const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  attack: "Ataque",
  counter: "Contraataque",
  block: "Bloqueo rival",
  unforced: "Error no forzado",
};

type Step = "quality" | "attacker" | "action" | "rating" | "direction";

const SETTING_STEPS: { q: SettingQuality; label: string; tone: string }[] = [
  { q: "+", label: "Bueno (+)", tone: "bg-primary text-primary-foreground" },
  { q: "!", label: "Neutro (=)", tone: "bg-secondary text-secondary-foreground" },
  { q: "-", label: "Malo (−)", tone: "bg-destructive/80 text-destructive-foreground" },
];

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

function resolveAction(kind: ActionKind, rating: Rating | null): RallyAction {
  if (kind === "block") return "block";
  if (kind === "unforced") return "unforced_error";
  if (kind === "attack") {
    if (rating === "point") return "rotation_attack";
    if (rating === "neutral") return "attack_neutral";
    return "attack_error";
  }
  // counter
  if (rating === "point") return "counter_attack";
  if (rating === "neutral") return "counter_neutral";
  return "attack_error";
}

/**
 * Diálogo integrado del rally (modo entrenador). Flujo:
 *   1. Armado — calidad del pase del armador (+ / = / −)
 *   2. Atacante — jugadora en cancha
 *   3. Acción — Ataque · Contra · Bloqueo rival · Error no forzado
 *   4. Valoración — Punto · Neutra · Error (sólo para Ataque / Contra)
 *   5. Zona — dirección 3×3 en cancha rival (obligatoria para Ataque/Contra si
 *      la valoración fue Punto o Neutra)
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

  const [step, setStep] = useState<Step>("quality");
  const [setterQuality, setSetterQuality] = useState<SettingQuality>("!");
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [actionKind, setActionKind] = useState<ActionKind | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("quality");
      setSetterQuality("!");
      setAttackerId(null);
      setActionKind(null);
      setRating(null);
    }
  }, [open]);

  const pickQuality = (q: SettingQuality) => {
    setSetterQuality(q);
    setStep("attacker");
  };

  const pickAttacker = (id: string) => {
    setAttackerId(id);
    setStep("action");
  };

  const pickActionKind = (k: ActionKind) => {
    setActionKind(k);
    if (k === "attack" || k === "counter") {
      setStep("rating");
    } else {
      // Bloqueo / Error no forzado → cierre directo, sin dirección.
      finalize(resolveAction(k, null), undefined);
    }
  };

  const pickRating = (r: Rating) => {
    setRating(r);
    if (!actionKind) return;
    if (r === "error") {
      // Errores cierran sin pedir zona.
      finalize(resolveAction(actionKind, "error"), undefined);
    } else {
      setStep("direction");
    }
  };

  const pickDirection = (d: AttackDirection) => {
    if (actionKind && rating) finalize(resolveAction(actionKind, rating), d);
  };

  const finalize = (a: RallyAction, dir: AttackDirection | undefined) => {
    if (!attackerId || !setter) return;
    const attackZone = inferSettingZone(onCourt, attackerId);
    onSubmit({
      setterId: setter.id,
      setterQuality,
      attackZone,
      attackerId,
      action: a,
      attackDirection: dir,
      receptionQuality,
    });
    onClose();
  };

  const goBack = () => {
    if (step === "direction") setStep("rating");
    else if (step === "rating") setStep("action");
    else if (step === "action") setStep("attacker");
    else if (step === "attacker") setStep("quality");
  };

  const title = (() => {
    switch (step) {
      case "quality": return "Calidad del armado";
      case "attacker": return "¿Quién atacó?";
      case "action": return "Acción";
      case "rating": return "Valoración del ataque";
      case "direction": return "Zona de destino";
    }
  })();

  const attackerName = attackerId
    ? playersOnCourt.find((p) => p.id === attackerId)
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100dvw-24px)] max-w-[440px] rounded-xl border-border/60 p-3 gap-2 max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="pr-8 space-y-0 text-left">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            {step !== "quality" && (
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
                {attackerName && ` · Atacó #${attackerName.number}`}
                {actionKind && ` · ${ACTION_KIND_LABEL[actionKind]}`}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {step === "quality" && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              {SETTING_STEPS.map((s) => (
                <button
                  key={s.q}
                  type="button"
                  onClick={() => pickQuality(s.q)}
                  className={`min-h-[72px] rounded-lg font-bold text-sm active:scale-95 transition ${s.tone}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Cómo salió el pase del armador para el ataque.
            </p>
          </div>
        )}

        {step === "attacker" && (
          <div className="grid grid-cols-3 gap-2 mt-2">
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
        )}

        {step === "action" && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(Object.keys(ACTION_KIND_LABEL) as ActionKind[]).map((k) => {
              const tone =
                k === "attack" || k === "counter"
                  ? "bg-primary text-primary-foreground"
                  : "bg-destructive/90 text-destructive-foreground";
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickActionKind(k)}
                  className={`min-h-[64px] rounded-lg font-bold text-sm active:scale-95 transition ${tone}`}
                >
                  {ACTION_KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        )}

        {step === "rating" && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => pickRating("point")}
                className="min-h-[80px] rounded-lg bg-success text-success-foreground font-black text-lg active:scale-95 transition"
              >
                Punto
                <span className="block text-[10px] font-normal opacity-90 mt-1">Cerró el rally</span>
              </button>
              <button
                type="button"
                onClick={() => pickRating("neutral")}
                className="min-h-[80px] rounded-lg bg-secondary text-secondary-foreground font-black text-lg active:scale-95 transition"
              >
                Neutra
                <span className="block text-[10px] font-normal opacity-90 mt-1">Rally continuó</span>
              </button>
              <button
                type="button"
                onClick={() => pickRating("error")}
                className="min-h-[80px] rounded-lg bg-destructive text-destructive-foreground font-black text-lg active:scale-95 transition"
              >
                Error
                <span className="block text-[10px] font-normal opacity-90 mt-1">Punto rival</span>
              </button>
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Neutra suma al total de ataques pero no cambia el marcador ni la eficiencia.
            </p>
          </div>
        )}

        {step === "direction" && (
          <div className="mt-2">
            <AttackDirectionGrid onPick={pickDirection} value={null} />
            <p className="mt-2 text-[11px] text-center text-muted-foreground">
              Elegí la zona donde cayó la pelota.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
