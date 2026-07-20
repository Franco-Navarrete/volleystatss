import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Check, Circle, CircleDot } from "lucide-react";
import { toast } from "sonner";
import {
  type Team,
  type Match,
  type Player,
  type SettingQuality,
  type SettingAttackZone,
  type AttackDirection,
  type AttackZone,
  type ReceptionRating,
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
  /** Cuando se define, el panel inicia en el paso "reception" con este jugador. */
  receptionStep?: {
    playerId: string;
    onRegister: (rating: ReceptionRating) => {
      proceed: boolean;
      quality?: SettingQuality;
    };
  };
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
type Step = "reception" | "zone" | "direction" | "action" | "rating";

const STEPS: { key: Step; label: string }[] = [
  { key: "reception", label: "Recepción" },
  { key: "zone", label: "Armado" },
  { key: "direction", label: "Zona" },
  { key: "action", label: "Ataque" },
  { key: "rating", label: "Resultado" },
];

const ACTION_KIND_LABEL: Record<ActionKind, string> = {
  attack: "Ataque de rotación",
  counter: "Contraataque",
  block: "Bloqueo rival",
  attack_error: "Error de ataque",
  unforced: "Error no forzado",
};

const CURRENT_ACTION_TEXT: Record<Step, string> = {
  reception: "Esperando valoración de la recepción",
  zone: "Esperando zona del armado",
  direction: "Esperando zona destino",
  action: "Esperando tipo de acción",
  rating: "Esperando resultado",
};

interface ReceptionOption {
  key: ReceptionRating;
  label: string;
  hotkey: string;
  className: string;
  quality?: SettingQuality; // undefined = no continua
  desc: string;
}
const RECEPTION_OPTIONS: ReceptionOption[] = [
  { key: "double_positive", label: "#", hotkey: "1", className: "bg-success text-success-foreground", quality: "++", desc: "Doble +" },
  { key: "positive", label: "+", hotkey: "2", className: "bg-success/80 text-success-foreground", quality: "+", desc: "Positiva" },
  { key: "neutral", label: "0", hotkey: "3", className: "bg-yellow-400 text-black", quality: "!", desc: "Neutra" },
  { key: "negative", label: "−", hotkey: "4", className: "bg-yellow-500 text-black", desc: "Negativa" },
  { key: "double_negative", label: "=", hotkey: "5", className: "bg-destructive text-destructive-foreground", desc: "Doble −" },
  { key: "overpass", label: "≠", hotkey: "6", className: "bg-destructive/80 text-destructive-foreground", desc: "Punto saque" },
];

const ATTACK_KIND_OPTIONS: { key: ActionKind; label: string; hotkey: string }[] = [
  { key: "attack", label: "Alta", hotkey: "1" },
  { key: "counter", label: "Contra", hotkey: "2" },
  { key: "block", label: "Bloqueo rival", hotkey: "3" },
  { key: "attack_error", label: "Error de ataque", hotkey: "4" },
  { key: "unforced", label: "Error no forzado", hotkey: "5" },
];

const ZONE_ORDER: SettingAttackZone[] = ["z4", "z3", "z2", "back5", "pipe", "back1"];

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
  if (kind === "attack") return rating === "neutral" ? "attack_neutral" : "rotation_attack";
  return rating === "neutral" ? "counter_neutral" : "counter_attack";
}

/**
 * Panel único del rally. Recorre Recepción → Armado → Zona → Ataque → Resultado
 * sin cerrar el diálogo entre pasos: cambia el contenido con fade y ofrece
 * barra de progreso, resumen en vivo, teclas rápidas y "paso anterior".
 */
export function IntegratedRallyDialog({
  open,
  onClose,
  match: _match,
  team,
  side: _side,
  onCourt,
  receptionQuality,
  receptionStep,
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
  const receptionPlayer = useMemo(
    () => (receptionStep ? team.players.find((p) => p.id === receptionStep.playerId) : null),
    [receptionStep, team.players],
  );

  const initialStep: Step = receptionStep ? "reception" : "zone";
  const [step, setStep] = useState<Step>(initialStep);
  const [zone, setZone] = useState<SettingAttackZone | null>(null);
  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [direction, setDirection] = useState<AttackDirection | null>(null);
  const [actionKind, setActionKind] = useState<ActionKind | null>(null);
  const [receptionValue, setReceptionValue] = useState<ReceptionRating | null>(null);
  const [effectiveQuality, setEffectiveQuality] = useState<SettingQuality | undefined>(receptionQuality);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => { setFadeKey((k) => k + 1); }, [step]);

  useEffect(() => {
    if (!open) {
      setStep(initialStep);
      setZone(null);
      setAttackerId(null);
      setDirection(null);
      setActionKind(null);
      setReceptionValue(null);
      setEffectiveQuality(receptionQuality);
    }
  }, [open, initialStep, receptionQuality]);

  const zoneAssignments = useMemo(
    () => computeZoneAssignments(onCourt, team.players),
    [onCourt, team.players],
  );

  const pickReception = useCallback((rating: ReceptionRating) => {
    if (!receptionStep) return;
    setReceptionValue(rating);
    const result = receptionStep.onRegister(rating);
    toast.success(`✓ Recepción ${RECEPTION_OPTIONS.find((r) => r.key === rating)?.label ?? ""}`, { duration: 900 });
    if (result.proceed) {
      setEffectiveQuality(result.quality);
      setStep("zone");
    } else {
      onClose();
    }
  }, [receptionStep, onClose]);

  const pickZone = useCallback((z: SettingAttackZone) => {
    const pid = zoneAssignments[z] ?? onCourt[0];
    setZone(z);
    setAttackerId(pid);
    setStep("direction");
    toast.success(`✓ Armado a ${SETTING_ATTACK_ZONE_LABEL[z]}`, { duration: 800 });
  }, [zoneAssignments, onCourt]);

  const pickDirection = useCallback((d: AttackDirection) => {
    setDirection(d);
    setStep("action");
    toast.success(`✓ Zona destino ${d}`, { duration: 800 });
  }, []);

  const pickActionKind = useCallback((k: ActionKind) => {
    setActionKind(k);
    if (k === "attack" || k === "counter") {
      setStep("rating");
    } else {
      finalize(resolveAction(k, null));
    }
  }, []);

  const pickRating = useCallback((r: Rating) => {
    if (!actionKind) return;
    finalize(resolveAction(actionKind, r));
  }, [actionKind]);

  const finalize = (a: RallyAction) => {
    if (!attackerId || !setter || !zone) return;
    onSubmit({
      setterId: setter.id,
      setterQuality: "!",
      attackZone: zone,
      attackerId,
      action: a,
      attackDirection: direction ?? undefined,
      receptionQuality: effectiveQuality,
    });
    toast.success("✓ Rally registrado", { duration: 900 });
    onClose();
  };

  const goBack = useCallback(() => {
    if (step === "rating") setStep("action");
    else if (step === "action") setStep("direction");
    else if (step === "direction") setStep("zone");
    else if (step === "zone" && receptionStep) setStep("reception");
  }, [step, receptionStep]);

  // Teclas rápidas
  useEffect(() => {
    if (!open) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Backspace") {
        ev.preventDefault();
        goBack();
        return;
      }
      if (step === "reception") {
        const opt = RECEPTION_OPTIONS.find((o) => o.hotkey === ev.key);
        if (opt) { ev.preventDefault(); pickReception(opt.key); }
      } else if (step === "zone") {
        const idx = Number(ev.key) - 1;
        if (idx >= 0 && idx < ZONE_ORDER.length) { ev.preventDefault(); pickZone(ZONE_ORDER[idx]); }
      } else if (step === "direction") {
        const n = Number(ev.key);
        if (n >= 1 && n <= 9) { ev.preventDefault(); pickDirection(n as AttackDirection); }
      } else if (step === "action") {
        const opt = ATTACK_KIND_OPTIONS.find((o) => o.hotkey === ev.key);
        if (opt) { ev.preventDefault(); pickActionKind(opt.key); }
      } else if (step === "rating") {
        if (ev.key === "Enter") { ev.preventDefault(); pickRating("point"); }
        if (ev.key === " ") { ev.preventDefault(); pickRating("neutral"); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, step, pickReception, pickZone, pickDirection, pickActionKind, pickRating, goBack]);

  const activeSteps: { key: Step; label: string }[] = useMemo(
    () => receptionStep ? STEPS : STEPS.filter((s) => s.key !== "reception"),
    [receptionStep],
  );
  const stepIdx = activeSteps.findIndex((s) => s.key === step);

  const attackerName = attackerId ? playersOnCourt.find((p) => p.id === attackerId) : null;
  const summary = [
    receptionValue && { label: "Recepción", value: RECEPTION_OPTIONS.find((r) => r.key === receptionValue)?.label ?? "" },
    setter && { label: "Armó", value: `#${setter.number}` },
    zone && { label: "Zona armado", value: SETTING_ATTACK_ZONE_LABEL[zone] },
    attackerName && { label: "Atacante", value: `#${attackerName.number} ${attackerName.name}` },
    direction && { label: "Zona destino", value: String(direction) },
    actionKind && { label: "Acción", value: ACTION_KIND_LABEL[actionKind] },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100dvw-24px)] max-w-[760px] rounded-xl border-border/60 p-3 gap-2 max-h-[94dvh] overflow-y-auto">
        <DialogHeader className="pr-8 space-y-0 text-left">
          <DialogTitle className="flex items-center gap-2 min-w-0">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-md p-1 hover:bg-muted transition"
                aria-label="Paso anterior"
                title="Paso anterior · Backspace"
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
              <span className="block text-sm font-bold">
                {activeSteps[stepIdx]?.label ?? "Rally"}
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                {CURRENT_ACTION_TEXT[step]}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Barra de progreso */}
        <ol className="mt-1 flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-2">
          {activeSteps.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li key={s.key} className="flex-1 flex items-center gap-1 min-w-0">
                <span
                  className={`shrink-0 grid place-items-center size-5 rounded-full text-[10px] font-bold transition-colors ${
                    done ? "bg-success text-success-foreground" :
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3" /> : active ? <CircleDot className="size-3" /> : <Circle className="size-3" />}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wide truncate ${
                  active ? "text-primary" : done ? "text-success" : "text-muted-foreground"
                }`}>
                  {s.label}
                </span>
                {i < activeSteps.length - 1 && (
                  <span className={`hidden sm:block h-px flex-1 ${done ? "bg-success/50" : "bg-border"}`} />
                )}
              </li>
            );
          })}
        </ol>

        {/* Cuerpo + resumen (md+) */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] mt-1">
          <div key={fadeKey} className="animate-fade-in min-w-0">
            {step === "reception" && receptionPlayer && (
              <div className="space-y-2">
                <div className="text-center">
                  <div className="scoreboard-digit text-2xl font-black">#{receptionPlayer.number}</div>
                  <div className="text-xs text-muted-foreground truncate">{receptionPlayer.name}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {RECEPTION_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => pickReception(o.key)}
                      className={`relative min-h-16 rounded-lg font-black text-3xl active:scale-95 transition ${o.className}`}
                      title={`${o.desc} · ${o.hotkey}`}
                    >
                      {o.label}
                      <span className="absolute top-1 right-1.5 text-[9px] font-bold opacity-70">{o.hotkey}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  1# · 2+ · 30 · 4− · 5= · 6≠ — Backspace: paso anterior
                </p>
              </div>
            )}

            {step === "zone" && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {ZONE_ORDER.map((z, i) => {
                    const pid = zoneAssignments[z];
                    const p = pid ? team.players.find((pl) => pl.id === pid) : undefined;
                    return (
                      <button
                        key={z}
                        type="button"
                        onClick={() => pickZone(z)}
                        className="relative min-h-[72px] rounded-lg border-2 border-border bg-card px-1 py-2 flex flex-col items-center justify-center transition active:scale-95 hover:border-primary hover:bg-primary/10"
                      >
                        <span className="absolute top-1 right-1.5 text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                        <span className="text-xs font-bold">{SETTING_ATTACK_ZONE_LABEL[z]}</span>
                        {p && <span className="scoreboard-digit text-lg font-black leading-none mt-1">#{p.number}</span>}
                        {p && <span className="text-[9px] text-muted-foreground truncate max-w-full">{p.name}</span>}
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
              <div>
                <AttackDirectionGrid onPick={pickDirection} value={null} />
                <p className="mt-2 text-[11px] text-center text-muted-foreground">
                  Tocá la zona donde cayó · teclas 1–9
                </p>
              </div>
            )}

            {step === "action" && (
              <div className="flex flex-wrap gap-2">
                {ATTACK_KIND_OPTIONS.map((o) => {
                  const tone = o.key === "attack" || o.key === "counter"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-destructive/90 text-destructive-foreground hover:bg-destructive";
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => pickActionKind(o.key)}
                      className={`relative flex-1 min-w-[120px] min-h-[56px] rounded-lg font-bold text-sm active:scale-95 transition ${tone}`}
                    >
                      {o.label}
                      <span className="absolute top-1 right-1.5 text-[9px] font-bold opacity-70">{o.hotkey}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === "rating" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => pickRating("point")}
                    className="relative min-h-[80px] rounded-lg bg-success text-success-foreground font-black text-lg active:scale-95 transition"
                  >
                    🟢 Punto
                    <span className="block text-[10px] font-normal opacity-90 mt-1">Cerró el rally</span>
                    <span className="absolute top-1 right-2 text-[9px] font-bold opacity-70">Enter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => pickRating("neutral")}
                    className="relative min-h-[80px] rounded-lg bg-secondary text-secondary-foreground font-black text-lg active:scale-95 transition"
                  >
                    ⚪ Continúa
                    <span className="block text-[10px] font-normal opacity-90 mt-1">Rally continuó</span>
                    <span className="absolute top-1 right-2 text-[9px] font-bold opacity-70">Espacio</span>
                  </button>
                </div>
                <p className="text-[11px] text-center text-muted-foreground">
                  Continúa suma al total de ataques pero no cambia el marcador.
                </p>
              </div>
            )}
          </div>

          {/* Resumen lateral */}
          <aside className="hidden md:flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-2 self-start">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1">
              Resumen del rally
            </p>
            {summary.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-1 py-2">Todavía no hay datos.</p>
            )}
            {summary.map((s) => (
              <div key={s.label} className="flex items-baseline justify-between gap-2 px-1 py-0.5 text-[11px] border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-bold text-right truncate">{s.value}</span>
              </div>
            ))}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
