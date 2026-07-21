import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  useVolley,
  ATTACK_FINISH_LABEL,
  type AttackDirection,
  type AttackFinishType,
  type AttackZone,
  type Match,
  type Team,
} from "@/lib/volley-store";
import { useCoachMode } from "@/lib/coach-mode-store";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
  /** Lado atacante = lado que NO saca actualmente (posesión rally). */
  attackingSide?: "A" | "B";
}

type Step = "origin" | "destination" | "result" | "finish";

/** Índices en `onCourt`: 0=Z1, 1=Z2, 2=Z3, 3=Z4, 4=Z5, 5=Z6. */
const ZONE_TO_INDEX: Record<AttackZone, number> = {
  1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
};

/** 1..5 (teclas) → zona de origen del ataque. */
const ORIGIN_KEYS: Record<string, { zone: AttackZone; label: string }> = {
  Digit1: { zone: 4, label: "Zona 4" },
  Digit2: { zone: 3, label: "Zona 3" },
  Digit3: { zone: 2, label: "Zona 2" },
  Digit4: { zone: 6, label: "Pipe (Z6)" },
  Digit5: { zone: 1, label: "Zaguero (Z1)" },
};

/** QWE/ASD → dirección 1..9 (cancha rival, 1..3 pegado a la red). */
const DEST_KEYS: Record<string, { dir: AttackDirection; label: string }> = {
  KeyQ: { dir: 7, label: "Z5" },
  KeyW: { dir: 8, label: "Z6" },
  KeyE: { dir: 9, label: "Z1" },
  KeyA: { dir: 1, label: "Z4" },
  KeyS: { dir: 2, label: "Z3" },
  KeyD: { dir: 3, label: "Z2" },
};

const FINISH_KEYS: Record<string, AttackFinishType> = {
  KeyK: "kill",
  KeyB: "block_out",
  KeyT: "tool",
  KeyF: "tip",
  KeyL: "line",
  KeyC: "cross",
};

/** Ventana en ms para que el entrenador registre el tipo de finalización. */
const FINISH_WINDOW_MS = 1500;

interface FlowState {
  step: Step;
  side: "A" | "B";
  origin?: { zone: AttackZone; playerId: string | null };
  destination?: AttackDirection;
  result?: "point" | "attempt" | "defended" | "error";
}

/**
 * Panel flotante Coach Mode para registrar un ataque completo
 * usando sólo el teclado. Se activa al presionar `A` cuando
 * Coach Mode está encendido.
 */
export function CoachAttackPanel({ match, teamA, teamB, attackingSide }: Props) {
  const enabled = useCoachMode((s) => s.enabled);
  const recordPoint = useVolley((s) => s.recordPoint);
  const recordAttackAttempt = useVolley((s) => s.recordAttackAttempt);
  const undoLastEvent = useVolley((s) => s.undoLastEvent);
  const [flow, setFlow] = useState<FlowState | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lado atacante por defecto = quien tiene la posesión.
  // Si no viene por prop, usamos el lado que recibió el saque.
  const defaultSide: "A" | "B" =
    attackingSide ?? (match.servingSide === "A" ? "B" : "A");

  const teams = useMemo(() => ({ A: teamA, B: teamB }), [teamA, teamB]);

  const detectPlayer = (side: "A" | "B", zone: AttackZone): string | null => {
    const onCourt = side === "A" ? match.onCourtA : match.onCourtB;
    const idx = ZONE_TO_INDEX[zone];
    const pid = onCourt[idx];
    return pid ?? null;
  };

  const playerLabel = (side: "A" | "B", pid: string | null): string => {
    if (!pid) return "—";
    const team = teams[side];
    const p = team.players.find((x) => x.id === pid);
    if (!p) return "?";
    return `#${p.number} ${p.name}`;
  };

  const clearFinishTimer = () => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  };

  const commit = (
    state: FlowState,
    finishType?: AttackFinishType,
  ) => {
    if (!state.origin || state.destination == null || !state.result) return;
    const { side, origin, destination, result } = state;
    if (result === "point") {
      // Ataque ganador. Usamos "attack" genérico; el motor de rotación decide.
      recordPoint(
        match.id,
        side,
        "attack",
        origin.playerId,
        origin.zone,
        undefined,
        destination,
        finishType,
      );
    } else if (result === "error") {
      recordPoint(
        match.id,
        side,
        "attack_error",
        origin.playerId,
        origin.zone,
        undefined,
        destination,
      );
    } else {
      // Continúa rally o defendido → intento neutro
      recordAttackAttempt(match.id, side, origin.playerId, {
        attackZone: origin.zone,
        attackDirection: destination,
        isCounter: false,
      });
    }
    setFlow(null);
    clearFinishTimer();
  };

  useEffect(() => {
    if (!enabled || match.status !== "live") return;

    const isTyping = (): boolean => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const t = el.tagName;
      return t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || el.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      // Undo / redo globales — funcionan siempre que Coach Mode esté ON.
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        undoLastEvent(match.id);
        setFlow(null);
        clearFinishTimer();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey))) {
        e.preventDefault();
        // Rehacer no implementado en el store — deshacer es la única operación.
        return;
      }

      if (isTyping()) return;

      // Cancelar en cualquier paso
      if (e.code === "Escape") {
        if (flow) {
          e.preventDefault();
          setFlow(null);
          clearFinishTimer();
        }
        return;
      }

      // Abrir el flujo con "A" (sólo cuando no está abierto)
      if (!flow) {
        if (e.code === "KeyA" && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setFlow({ step: "origin", side: defaultSide });
        }
        return;
      }

      // === Flujo activo ===
      if (flow.step === "origin") {
        const opt = ORIGIN_KEYS[e.code];
        if (opt) {
          e.preventDefault();
          const playerId = detectPlayer(flow.side, opt.zone);
          setFlow({
            ...flow,
            step: "destination",
            origin: { zone: opt.zone, playerId },
          });
        }
        return;
      }

      if (flow.step === "destination") {
        const opt = DEST_KEYS[e.code];
        if (opt) {
          e.preventDefault();
          setFlow({ ...flow, step: "result", destination: opt.dir });
        }
        return;
      }

      if (flow.step === "result") {
        let result: FlowState["result"] | null = null;
        if (e.key === "+") result = "point";
        else if (e.key === "0") result = "attempt";
        else if (e.key === "-") result = "defended";
        else if (e.key.toLowerCase() === "x") result = "error";
        if (result) {
          e.preventDefault();
          const nextState: FlowState = { ...flow, result };
          if (result === "point") {
            // Abrir ventana opcional de tipo de finalización
            setFlow({ ...nextState, step: "finish" });
            clearFinishTimer();
            finishTimerRef.current = setTimeout(() => {
              commit(nextState); // sin finishType
            }, FINISH_WINDOW_MS);
          } else {
            commit(nextState);
          }
        }
        return;
      }

      if (flow.step === "finish") {
        const ft = FINISH_KEYS[e.code];
        if (ft) {
          e.preventDefault();
          clearFinishTimer();
          commit(flow, ft);
        }
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled, match.status, match.id, match.onCourtA, match.onCourtB, flow, defaultSide]);

  // Limpieza en desmontaje
  useEffect(() => () => clearFinishTimer(), []);

  if (!enabled || !flow) return null;

  const attackingTeam = teams[flow.side];
  const sideLabel = `${attackingTeam.name} (${flow.side})`;

  return (
    <div
      role="dialog"
      aria-label="Coach Mode — Registrar ataque"
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
    >
      <div
        className="pointer-events-auto w-[min(92vw,520px)] rounded-2xl border border-primary/40 bg-background/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-primary">
            ⌨️ Coach Mode · Ataque
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{sideLabel}</span>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => {
                setFlow(null);
                clearFinishTimer();
              }}
              className="p-1 rounded-md hover:bg-secondary/50"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <StepBreadcrumbs flow={flow} playerLabel={(pid) => playerLabel(flow.side, pid)} />

          {flow.step === "origin" && (
            <Section title="¿Desde dónde se realizó el ataque?">
              {(Object.entries(ORIGIN_KEYS) as [string, { zone: AttackZone; label: string }][]).map(
                ([code, opt], i) => (
                  <KeyRow key={code} keyLabel={String(i + 1)} value={opt.label} />
                ),
              )}
              <Hint>Esc para cancelar</Hint>
            </Section>
          )}

          {flow.step === "destination" && (
            <Section title="¿Hacia qué zona fue el ataque?">
              <div className="grid grid-cols-3 gap-2">
                {(["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD"] as const).map((c) => {
                  const { dir, label } = DEST_KEYS[c];
                  const key = c.slice(3);
                  return (
                    <div
                      key={c}
                      className="rounded-lg border border-border/60 bg-secondary/40 py-2 text-center"
                    >
                      <div className="font-mono text-sm font-bold text-primary">{key}</div>
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="text-[10px] text-muted-foreground/70">dir {dir}</div>
                    </div>
                  );
                })}
              </div>
              <Hint>Esc para cancelar</Hint>
            </Section>
          )}

          {flow.step === "result" && (
            <Section title="Resultado">
              <KeyRow keyLabel="+" value="Punto" />
              <KeyRow keyLabel="0" value="Continúa el rally" />
              <KeyRow keyLabel="-" value="Defendido" />
              <KeyRow keyLabel="X" value="Error" />
              <Hint>Esc para cancelar</Hint>
            </Section>
          )}

          {flow.step === "finish" && (
            <Section title={`Tipo de punto (opcional — ${Math.round(FINISH_WINDOW_MS / 100) / 10}s)`}>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.entries(FINISH_KEYS) as [string, AttackFinishType][]).map(([code, ft]) => (
                  <KeyRow
                    key={code}
                    keyLabel={code.slice(3)}
                    value={ATTACK_FINISH_LABEL[ft]}
                    dense
                  />
                ))}
              </div>
              <Hint>Presioná una tecla o esperá para omitir</Hint>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KeyRow({
  keyLabel,
  value,
  dense,
}: {
  keyLabel: string;
  value: string;
  dense?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-md border border-border/40 bg-secondary/30 ${
        dense ? "px-2 py-1" : "px-3 py-1.5"
      }`}
    >
      <kbd className="min-w-[28px] text-center font-mono text-xs font-bold rounded bg-background border border-border/60 px-1.5 py-0.5">
        {keyLabel}
      </kbd>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-muted-foreground pt-1">{children}</div>;
}

function StepBreadcrumbs({
  flow,
  playerLabel,
}: {
  flow: FlowState;
  playerLabel: (pid: string | null) => string;
}) {
  const chips: { k: string; v: string; on: boolean }[] = [
    { k: "Origen", v: flow.origin ? `Z${flow.origin.zone}` : "—", on: !!flow.origin },
    {
      k: "Jugador",
      v: flow.origin ? playerLabel(flow.origin.playerId) : "—",
      on: !!flow.origin,
    },
    {
      k: "Destino",
      v: flow.destination != null ? `dir ${flow.destination}` : "—",
      on: flow.destination != null,
    },
    {
      k: "Resultado",
      v:
        flow.result === "point"
          ? "Punto"
          : flow.result === "error"
            ? "Error"
            : flow.result === "defended"
              ? "Defendido"
              : flow.result === "attempt"
                ? "Rally"
                : "—",
      on: !!flow.result,
    },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c.k}
          className={`text-[11px] px-2 py-1 rounded-md border ${
            c.on
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border/40 bg-secondary/30 text-muted-foreground"
          }`}
        >
          <span className="uppercase tracking-wider text-[9px] mr-1 opacity-70">
            {c.k}
          </span>
          <span className="font-semibold">{c.v}</span>
        </span>
      ))}
    </div>
  );
}
