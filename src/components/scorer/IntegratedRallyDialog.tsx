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
  type DefenseRating,
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
  /** Cuando se define, el panel inicia en el paso "defense" con este jugador. */
  defenseStep?: {
    playerId: string;
    onRegister: (rating: DefenseRating) => {
      proceed: boolean;
      quality?: SettingQuality;
    };
  };
  /** Jugadora preseleccionada como atacante (modo planillero rápido). */
  initialAttackerId?: string;
  /** Salta directamente al paso de acción final. */
  startAtAction?: boolean;
  /** Jugadora que actualmente saca; se usa para filtrar opciones de saque. */
  serverPlayerId?: string | null;
  onSubmit: (payload: {
    setterId: string;
    setterQuality: SettingQuality;
    attackZone?: SettingAttackZone;
    attackerId: string;
    action: RallyAction;
    attackDirection?: AttackDirection;
    receptionQuality?: SettingQuality;
    /** true si el flujo fue disparado tras una defensa (contraataque). */
    isCounter?: boolean;
  }) => boolean | void;
}

export type RallyAction =
  | "serve"
  | "serve_error"
  | "rotation_attack"
  | "attack_neutral"
  | "counter_attack"
  | "counter_neutral"
  | "attack_error"
  | "block"
  | "unforced_error";

type AttackResult = "serve" | "serve_error" | "point" | "continue" | "block" | "attack_error" | "unforced";
type Step = "reception" | "defense" | "zone" | "direction" | "action";

const STEPS: { key: Step; label: string }[] = [
  { key: "reception", label: "Recepción" },
  { key: "defense", label: "Defensa" },
  { key: "zone", label: "Armado" },
  { key: "direction", label: "Zona" },
  { key: "action", label: "Ataque" },
];

const ACTION_KIND_LABEL: Record<AttackResult, string> = {
  serve: "Saque",
  serve_error: "Error de saque",
  point: "Ataque",
  continue: "Continúa el punto",
  block: "Bloqueo",
  attack_error: "Error de ataque",
  unforced: "Error no forzado",
};

const CURRENT_ACTION_TEXT: Record<Step, string> = {
  reception: "Esperando valoración de la recepción",
  defense: "Esperando valoración de la defensa",
  zone: "Esperando zona del armado",
  direction: "Esperando zona destino",
  action: "Esperando resultado del ataque",
};

interface DefenseOption {
  key: DefenseRating;
  label: string;
  hotkey: string;
  className: string;
  quality?: SettingQuality; // undefined = corta la jugada (error)
  desc: string;
}
const DEFENSE_OPTIONS: DefenseOption[] = [
  { key: "excellent", label: "Doble positivo", hotkey: "1", className: "bg-success text-success-foreground", quality: "++", desc: "Doble positivo" },
  { key: "controlled", label: "Neutro", hotkey: "2", className: "bg-yellow-400 text-black", quality: "!", desc: "Neutro" },
  { key: "neutral", label: "Omitir", hotkey: "0", className: "bg-secondary text-secondary-foreground border border-border/50", quality: "!", desc: "Saltar scouting de defensa" },
  { key: "error", label: "Doble negativo", hotkey: "3", className: "bg-destructive text-destructive-foreground", desc: "Doble negativo" },
];

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

const ATTACK_RESULT_OPTIONS: { key: AttackResult; label: string; hotkey: string }[] = [
  { key: "serve", label: "Saque", hotkey: "1" },
  { key: "serve_error", label: "Error de saque", hotkey: "2" },
  { key: "point", label: "Ataque", hotkey: "3" },
  { key: "attack_error", label: "Error de ataque", hotkey: "4" },
  { key: "block", label: "Bloqueo", hotkey: "5" },
  { key: "unforced", label: "Error no forzado", hotkey: "6" },
];

const ZONE_ORDER: SettingAttackZone[] = ["z4", "z3", "z2", "back5", "pipe", "back1"];

function getZoneForPlayer(onCourt: string[], playerId: string): SettingAttackZone | null {
  const idx = onCourt.indexOf(playerId);
  if (idx === -1) return null;
  // onCourt: [P1, P2, P3, P4, P5, P6]
  const map: Record<number, SettingAttackZone> = {
    0: "back1",
    1: "z2",
    2: "z3",
    3: "z4",
    4: "back5",
    5: "pipe",
  };
  return map[idx] ?? null;
}

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

function resolveAction(kind: AttackResult, isCounter: boolean): RallyAction {
  if (kind === "serve") return "serve";
  if (kind === "serve_error") return "serve_error";
  if (kind === "block") return "block";
  if (kind === "unforced") return "unforced_error";
  if (kind === "attack_error") return "attack_error";
  if (kind === "continue") return isCounter ? "counter_neutral" : "attack_neutral";
  return isCounter ? "counter_attack" : "rotation_attack";
}

/**
 * Panel único del rally. Recorre Recepción/Defensa → Armado → Zona destino → Resultado del ataque.
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
  defenseStep,
  initialAttackerId,
  startAtAction,
  serverPlayerId,
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
  const defensePlayer = useMemo(
    () => (defenseStep ? team.players.find((p) => p.id === defenseStep.playerId) : null),
    [defenseStep, team.players],
  );

  const initialStep: Step = startAtAction
    ? "action"
    : defenseStep
    ? "defense"
    : receptionStep
    ? "reception"
    : "zone";
  const isCounterFlow = !!defenseStep;
  const initialZone = useMemo(
    () => (initialAttackerId ? getZoneForPlayer(onCourt, initialAttackerId) : null),
    [initialAttackerId, onCourt],
  );
  const [step, setStep] = useState<Step>(initialStep);
  const [zone, setZone] = useState<SettingAttackZone | null>(initialZone);
  const [attackerId, setAttackerId] = useState<string | null>(initialAttackerId ?? null);
  const [direction, setDirection] = useState<AttackDirection | null>(null);
  const [actionKind, setActionKind] = useState<AttackResult | null>(null);
  const [receptionValue, setReceptionValue] = useState<ReceptionRating | null>(null);
  const [defenseValue, setDefenseValue] = useState<DefenseRating | null>(null);
  const [effectiveQuality, setEffectiveQuality] = useState<SettingQuality | undefined>(receptionQuality);
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => { setFadeKey((k) => k + 1); }, [step]);

  useEffect(() => {
    setStep(initialStep);
    setZone(initialZone);
    setAttackerId(initialAttackerId ?? null);
    setDirection(null);
    setActionKind(null);
    setReceptionValue(null);
    setDefenseValue(null);
    setEffectiveQuality(receptionQuality);
  }, [open, initialStep, initialZone, initialAttackerId, receptionQuality, receptionStep?.playerId, defenseStep?.playerId]);

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

  const pickDefense = useCallback((rating: DefenseRating) => {
    if (!defenseStep) return;
    setDefenseValue(rating);
    const result = defenseStep.onRegister(rating);
    toast.success(`✓ Defensa ${DEFENSE_OPTIONS.find((r) => r.key === rating)?.label ?? ""}`, { duration: 900 });
    if (result.proceed) {
      setEffectiveQuality(result.quality);
      setStep("zone");
    } else {
      onClose();
    }
  }, [defenseStep, onClose]);

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

  const finalize = useCallback((a: RallyAction) => {
    if (!attackerId || !setter) return;
    const needsZone =
      a === "rotation_attack" ||
      a === "counter_attack" ||
      a === "attack_neutral" ||
      a === "counter_neutral" ||
      a === "attack_error";
    if (needsZone && !zone) return;
    const keepOpen = onSubmit({
      setterId: setter.id,
      setterQuality: "!",
      attackZone: zone ?? undefined,
      attackerId,
      action: a,
      attackDirection: direction ?? undefined,
      receptionQuality: effectiveQuality,
      isCounter: isCounterFlow,
    });
    toast.success("✓ Rally registrado", { duration: 900 });
    if (!keepOpen) onClose();
  }, [attackerId, setter, zone, direction, effectiveQuality, onSubmit, onClose, isCounterFlow]);

  const pickActionKind = useCallback((k: AttackResult) => {
    setActionKind(k);
    finalize(resolveAction(k, isCounterFlow));
  }, [finalize, isCounterFlow]);

  const goBack = useCallback(() => {
    if (step === "action") setStep("direction");
    else if (step === "direction") setStep("zone");
    else if (step === "zone" && defenseStep) setStep("defense");
    else if (step === "zone" && receptionStep) setStep("reception");
  }, [step, receptionStep, defenseStep]);

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
      } else if (step === "defense") {
        const opt = DEFENSE_OPTIONS.find((o) => o.hotkey === ev.key);
        if (opt) { ev.preventDefault(); pickDefense(opt.key); }
      } else if (step === "zone") {
        const idx = Number(ev.key) - 1;
        if (idx >= 0 && idx < ZONE_ORDER.length) { ev.preventDefault(); pickZone(ZONE_ORDER[idx]); }
      } else if (step === "direction") {
        const n = Number(ev.key);
        if (n >= 1 && n <= 9) { ev.preventDefault(); pickDirection(n as AttackDirection); }
      } else if (step === "action") {
        const opt = ATTACK_RESULT_OPTIONS.find((o) => o.hotkey === ev.key);
        if (opt) { ev.preventDefault(); pickActionKind(opt.key); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, step, pickReception, pickDefense, pickZone, pickDirection, pickActionKind, goBack]);

  const activeSteps: { key: Step; label: string }[] = useMemo(
    () => STEPS.filter((s) => {
      if (s.key === "reception") return !!receptionStep;
      if (s.key === "defense") return !!defenseStep;
      return true;
    }),
    [receptionStep, defenseStep],
  );
  const stepIdx = activeSteps.findIndex((s) => s.key === step);

  const attackerName = attackerId ? playersOnCourt.find((p) => p.id === attackerId) : null;
  const summary = [
    receptionValue && { label: "Recepción", value: RECEPTION_OPTIONS.find((r) => r.key === receptionValue)?.label ?? "" },
    defenseValue && { label: "Defensa", value: DEFENSE_OPTIONS.find((r) => r.key === defenseValue)?.label ?? "" },
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
                {startAtAction ? "Acción rápida" : (activeSteps[stepIdx]?.label ?? "Rally")}
              </span>
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                {startAtAction ? "Seleccioná el resultado" : CURRENT_ACTION_TEXT[step]}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Barra de progreso (oculta en modo planillero rápido) */}
        {!startAtAction && (
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
        )}

        {/* Cuerpo + resumen (md+) */}
        <div className={`grid gap-3 mt-1 ${startAtAction ? "" : "md:grid-cols-[minmax(0,1fr)_180px]"}`}>
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

            {step === "defense" && defensePlayer && (
              <div className="space-y-2">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest font-black text-orange-500">Defensa</div>
                  <div className="scoreboard-digit text-2xl font-black">#{defensePlayer.number}</div>
                  <div className="text-xs text-muted-foreground truncate">{defensePlayer.name}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEFENSE_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => pickDefense(o.key)}
                      className={`relative min-h-16 rounded-lg px-2 font-black text-sm active:scale-95 transition flex flex-col items-center justify-center gap-0.5 ${o.className}`}
                      title={`${o.desc} · ${o.hotkey}`}
                    >
                      <span className="text-[10px] opacity-60 font-bold uppercase tracking-tighter">
                        {o.key === "neutral" ? "Omitir" : o.desc}
                      </span>
                      <span className="text-lg">{o.label}</span>
                      <span className="absolute top-1 right-1.5 text-[9px] font-bold opacity-70">{o.hotkey}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-center text-muted-foreground">
                  1: Doble (+) · 2: Neutro · 3: Doble (-) · 0: Omitir
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
                {ATTACK_RESULT_OPTIONS.filter((o) => {
                  const isServeOption = o.key === "serve" || o.key === "serve_error";
                  // En modo planillero rápido siempre mostramos las 6 opciones;
                  // el wrapper se encarga de asignar el punto al sacador real.
                  if (startAtAction) return true;
                  if (!isServeOption) return true;
                  return !!serverPlayerId && attackerId === serverPlayerId;
                }).map((o) => {
                  const tone =
                    o.key === "serve" || o.key === "point" || o.key === "block"
                      ? "bg-success text-success-foreground hover:bg-success/90"
                      : o.key === "continue"
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
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

          </div>

          {/* Resumen lateral (oculto en modo planillero rápido) */}
          {!startAtAction && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
