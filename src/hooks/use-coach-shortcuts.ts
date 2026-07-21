import { useEffect } from "react";
import {
  useCoachMode,
  bindingMatches,
  type CoachAction,
  type Macro,
} from "@/lib/coach-mode-store";

export interface CoachSeqDetail {
  action?: CoachAction;
  playerNumber?: number;
  zone?: number;
  rating?: string;
  note?: string;
  hint?: string;
}

/**
 * Emite un evento `coach:action` con la acción disparada
 * y actualiza el HUD con la secuencia en progreso vía `coach:seq`.
 */
export function useCoachShortcuts(options?: { active?: boolean }) {
  const enabled = useCoachMode((s) => s.enabled);
  const active = options?.active !== false && enabled;

  useEffect(() => {
    if (!active) return;

    let seq: CoachSeqDetail = {};
    let seqTimer: ReturnType<typeof setTimeout> | null = null;
    let digitBuffer = "";
    let digitTimer: ReturnType<typeof setTimeout> | null = null;

    const resetSeq = () => {
      seq = {};
      digitBuffer = "";
      if (seqTimer) clearTimeout(seqTimer);
      seqTimer = null;
      if (digitTimer) clearTimeout(digitTimer);
      digitTimer = null;
      window.dispatchEvent(new CustomEvent("coach:seq", { detail: {} }));
    };
    const scheduleReset = () => {
      if (seqTimer) clearTimeout(seqTimer);
      seqTimer = setTimeout(resetSeq, 3500);
    };
    const emitSeq = () => {
      window.dispatchEvent(new CustomEvent("coach:seq", { detail: { ...seq } }));
      scheduleReset();
    };

    const isTypingTarget = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      if (document.body.dataset.coachInput === "lock") return true;
      return false;
    };

    const dispatchAction = (detail: {
      action?: CoachAction;
      macro?: Macro;
      seq?: CoachSeqDetail;
    }) => {
      window.dispatchEvent(new CustomEvent("coach:action", { detail }));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const { bindings, macros } = useCoachMode.getState();

      // No robar teclas cuando el usuario escribe.
      if (isTypingTarget()) return;

      // 1) Ayuda / navegación (siempre disponibles)
      const nav: CoachAction[] = ["help", "confirm", "cancel", "back", "undo", "redo"];
      for (const a of nav) {
        if (bindingMatches(bindings[a], e)) {
          e.preventDefault();
          if (a === "cancel") {
            resetSeq();
          }
          dispatchAction({ action: a, seq: { ...seq } });
          if (a === "confirm") resetSeq();
          return;
        }
      }

      // 2) Macros (Ctrl+número, etc.)
      for (const m of macros) {
        if (bindingMatches(m.binding, e)) {
          e.preventDefault();
          dispatchAction({ macro: m });
          seq = { action: m.steps[0]?.kind === "action" ? m.steps[0].action : undefined, hint: `Macro: ${m.label}` };
          emitSeq();
          return;
        }
      }

      // 3) Acciones de fundamento
      const fundamentals: CoachAction[] = [
        "saque", "recepcion", "armado", "ataque",
        "bloqueo", "defensa", "contraataque",
        "timeout", "cambio", "libero", "sancion",
      ];
      for (const a of fundamentals) {
        if (bindingMatches(bindings[a], e)) {
          e.preventDefault();
          seq = { action: a, hint: "Selecciona jugador (número)" };
          dispatchAction({ action: a });
          emitSeq();
          return;
        }
      }

      // 4) Dígitos → jugador (o zona si ya hay jugador)
      if (/^Digit[0-9]$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!seq.action) return; // solo tiene sentido con acción activa
        e.preventDefault();
        const d = e.code.slice(5);
        if (seq.playerNumber == null) {
          digitBuffer += d;
          if (digitTimer) clearTimeout(digitTimer);
          digitTimer = setTimeout(() => {
            seq.playerNumber = Number(digitBuffer);
            digitBuffer = "";
            seq.hint = "Zona (1-6) o valoración";
            window.dispatchEvent(
              new CustomEvent("coach:action", {
                detail: { action: seq.action, playerNumber: seq.playerNumber },
              }),
            );
            emitSeq();
          }, 350);
        } else if (seq.zone == null) {
          const z = Number(d);
          if (z >= 1 && z <= 6) {
            seq.zone = z;
            seq.hint = "Valoración (+ 0 - # = ≠) y Enter";
            emitSeq();
          }
        }
        return;
      }

      // 5) Valoración
      const ratingMap: Record<string, string> = {
        "+": "+", "-": "-", "0": "0", "=": "=", "#": "#", "≠": "≠",
      };
      const k = e.key;
      if (seq.action && ratingMap[k] != null) {
        e.preventDefault();
        seq.rating = ratingMap[k];
        seq.hint = "Enter para confirmar";
        emitSeq();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (seqTimer) clearTimeout(seqTimer);
      if (digitTimer) clearTimeout(digitTimer);
    };
  }, [active]);
}
