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
  SETTING_ATTACK_ZONES,
  SETTING_ATTACK_ZONE_LABEL,
} from "@/lib/volley-store";
import { AttackDirectionGrid } from "@/components/court/AttackDirectionGrid";

interface Props {
  open: boolean;
  onClose: () => void;
  match: Match;
  team: Team;
  side: "A" | "B";
  onCourt: string[];
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
  | "counter_neutral"
  | "attack_error"
  | "block"
  | "unforced_error";

type ActionKind = "attack" | "counter" | "block" | "attack_error" | "unforced";
type Rating = "point" | "neutral";

const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  attack: "Ataque de rotación",
  counter: "Contraataque",
  block: "Bloqueo rival",
  attack_error: "Error de ataque",
  unforced: "Error no forzado",
};

type Step = "zone" | "direction" | "action" | "rating";

/**
 * Distribución de jugadores por rol (no por rotación) para el selector
 * de "Zona del armado". Delanteros = onCourt[1..3], Zagueros = onCourt[0,4,5].
 *
 * Reglas:
 *  - Punta delantero → Z4, Central delantero → Z3
 *  - Opuesto delantero → Z2; en ese caso Armador → Z1 (back1)
 *  - Si no hay opuesto delantero: Armador delantero → Z2; Opuesto zaguero → Z1
 *  - Punta zaguero → pipe (Z6), Central zaguero / Líbero → back5 (Z5)
 */
function computeZoneAssignments(
  onCourt: string[],
  players: Player[],
): Record<SettingAttackZone, string | undefined> {
  const byId = (id: string | undefined) => players.find((p) => p.id === id);
  const front = [onCourt[1], onCourt[2], onCourt[3]].map(byId).filter((p): p is Player => !!p);
  const back = [onCourt[0], onCourt[4], onCourt[5]].map(byId).filter((p): p is Player => !!p);

  const findOne = (arr: Player[], pos: Player["position"]) => arr.find((p) => p.position === pos);
  const puntaFront = findOne(front, "punta");
  const centralFront = findOne(front, "central");
  const opFront = findOne(front, "opuesto");
  const setterFront = findOne(front, "armador");
  const puntaBack = findOne(back, "punta");
  const centralBack = findOne(back, "central") ?? findOne(back, "libero");
  const opBack = findOne(back, "opuesto");
  const setterBack = findOne(back, "armador");

  const z4 = puntaFront?.id ?? onCourt[3];
  const z3 = centralFront?.id ?? onCourt[2];
  const pipe = puntaBack?.id ?? onCourt[5];
  const back5 = centralBack?.id ?? onCourt[4];

  let z2: string | undefined;
  let back1: string | undefined;
  if (opFront) {
    z2 = opFront.id;
    back1 = setterFront?.id ?? setterBack?.id ?? opBack?.id ?? onCourt[0];
  } else {
    z2 = setterFront?.id ?? onCourt[1];
    back1 = opBack?.id ?? setterBack?.id ?? onCourt[0];
  }

  return { back1, z2, z3, z4, back5, pipe, back: back1 };
}


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
  if (kind === "attack_error") return "attack_error";
  if (kind === "attack") {
    return rating === "neutral" ? "attack_neutral" : "rotation_attack";
  }
  return rating === "neutral" ? "counter_neutral" : "counter_attack";
}

/**
 * Diálogo integrado del rally (modo entrenador). Flujo:
 *   1. Zona de armado (auto-selecciona al jugador de esa posición en cancha)
 *   2. Dirección (grilla 3×3 en cancha rival)
 *   3. Acción — Ataque · Contra · Bloqueo rival · Error no forzado
 *   4. Valoración — Punto · Neutra · Error (solo Ataque / Contra)
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

  const [step, setStep] = useState<Step>("zone");
  const [zone, setZone] = useState<SettingAttackZone | null>(null);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [direction, setDirection] = useState<AttackDirection | null>(null);
  const [actionKind, setActionKind] = useState<ActionKind | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("zone");
      setZone(null);
      setAttackerId(null);
      setDirection(null);
      setActionKind(null);
    }
  }, [open]);

  const zoneAssignments = useMemo(
    () => computeZoneAssignments(onCourt, team.players),
    [onCourt, team.players],
  );

  const pickZone = (z: SettingAttackZone) => {
    const pid = zoneAssignments[z] ?? onCourt[0];
    setZone(z);
    setAttackerId(pid);
    setStep("direction");
  };


  const pickDirection = (d: AttackDirection) => {
    setDirection(d);
    setStep("action");
  };

  const pickActionKind = (k: ActionKind) => {
    setActionKind(k);
    if (k === "attack" || k === "counter") {
      setStep("rating");
    } else {
      finalize(resolveAction(k, null));
    }
  };

  const pickRating = (r: Rating) => {
    if (!actionKind) return;
    finalize(resolveAction(actionKind, r));
  };

  const finalize = (a: RallyAction) => {
    if (!attackerId || !setter || !zone) return;
    onSubmit({
      setterId: setter.id,
      setterQuality: "!",
      attackZone: zone,
      attackerId,
      action: a,
      attackDirection: direction ?? undefined,
      receptionQuality,
    });
    onClose();
  };

  const goBack = () => {
    if (step === "rating") setStep("action");
    else if (step === "action") setStep("direction");
    else if (step === "direction") setStep("zone");
  };

  const title = (() => {
    switch (step) {
      case "zone": return "Zona del armado";
      case "direction": return "Zona de destino";
      case "action": return "Acción";
      case "rating": return "Valoración";
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
                {team.shortName} · Armó #{setter?.number ?? "?"}
                {zone && ` · ${SETTING_ATTACK_ZONE_LABEL[zone]}`}
                {attackerName && ` · #${attackerName.number}`}
                {actionKind && ` · ${ACTION_KIND_LABEL[actionKind]}`}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {step === "zone" && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-3 gap-2">
              {SETTING_ATTACK_ZONES.map((z) => {
                const idx = ZONE_TO_COURT_INDEX[z] ?? 3;
                const p = playersOnCourt[idx];
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => pickZone(z)}
                    className="min-h-[72px] rounded-lg border-2 border-border bg-card px-1 py-2 flex flex-col items-center justify-center transition active:scale-95 hover:border-primary hover:bg-primary/10"
                  >
                    <span className="text-xs font-bold">{SETTING_ATTACK_ZONE_LABEL[z]}</span>
                    {p && (
                      <span className="scoreboard-digit text-lg font-black leading-none mt-1">
                        #{p.number}
                      </span>
                    )}
                    {p && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-full">
                        {p.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Se auto-selecciona la jugadora en esa posición.
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
            <div className="grid grid-cols-2 gap-2">
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
            </div>
            <p className="text-[11px] text-center text-muted-foreground">
              Neutra suma al total de ataques pero no cambia el marcador ni la eficiencia.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
