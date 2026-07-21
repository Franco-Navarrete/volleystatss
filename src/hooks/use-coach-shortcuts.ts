import { useEffect } from "react";
import {
  useCoachMode,
  bindingMatches,
  type CoachAction,
} from "@/lib/coach-mode-store";
import { useCoachRally, type Rating } from "@/lib/coach/rally-machine";
import { useVolley } from "@/lib/volley-store";

export interface CoachSeqDetail {
  action?: CoachAction;
  playerNumber?: number;
  zone?: number;
  rating?: string;
  note?: string;
  hint?: string;
}

const FUNDAMENTAL_TO_STATE: Partial<Record<CoachAction, "saque" | "recepcion" | "armado" | "ataque" | "bloqueo" | "defensa" | "contraataque">> = {
  saque: "saque",
  recepcion: "recepcion",
  armado: "armado",
  ataque: "ataque",
  bloqueo: "bloqueo",
  defensa: "defensa",
  contraataque: "contraataque",
};

const ZONE_KEYS_QWE: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9> = {
  KeyQ: 5, KeyW: 6, KeyE: 1,
  KeyA: 4, KeyS: 3, KeyD: 2,
};

const ORIGIN_DIGIT: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  Digit1: 4, Digit2: 3, Digit3: 2, Digit4: 6, Digit5: 1,
};

const RATING_KEYS: Record<string, Rating> = {
  "#": "#", "+": "+", "0": "0", "-": "-", "=": "=", "≠": "≠",
};

/**
 * Hook global de teclado para Coach Mode v2.
 * Ya no emite eventos sueltos: dispatch directo a la máquina de estados.
 * El route sigue escuchando `coach:action` sólo para atajos ajenos al
 * rally (timeout/cambio/libero/sanción).
 */
export function useCoachShortcuts(options?: { active?: boolean; matchId?: string | null }) {
  const enabled = useCoachMode((s) => s.enabled);
  const active = options?.active !== false && enabled;
  const matchId = options?.matchId ?? null;

  useEffect(() => {
    if (!active) return;

    const isTypingTarget = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      if (document.body.dataset.coachInput === "lock") return true;
      return false;
    };

    const dispatchAction = (action: CoachAction) => {
      window.dispatchEvent(new CustomEvent("coach:action", { detail: { action } }));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const { bindings } = useCoachMode.getState();
      if (isTypingTarget()) return;

      const rally = useCoachRally.getState();

      // 1) Navegación / undo / help
      if (bindingMatches(bindings.help, e)) { e.preventDefault(); dispatchAction("help"); return; }
      if (bindingMatches(bindings.cancel, e)) { e.preventDefault(); if (rally.state !== "idle") rally.cancel(); else dispatchAction("cancel"); return; }
      if (bindingMatches(bindings.back, e)) { e.preventDefault(); if (rally.state !== "idle") rally.back(); return; }
      if (bindingMatches(bindings.undo, e)) {
        e.preventDefault();
        const match = matchId ? useVolley.getState().matches.find((m) => m.id === matchId) : null;
        if (match && match.events.length > 0) useVolley.getState().undoLastEvent(match.id);
        rally.cancel();
        return;
      }
      if (bindingMatches(bindings.redo, e)) { e.preventDefault(); return; }

      // 2) Atajos externos al rally: timeout, cambio, libero, sancion
      const external: CoachAction[] = ["timeout", "cambio", "libero", "sancion"];
      for (const a of external) {
        if (bindingMatches(bindings[a], e)) { e.preventDefault(); dispatchAction(a); return; }
      }

      // 3) Iniciar fundamento (sólo si la máquina está idle)
      if (rally.state === "idle" && matchId) {
        for (const [action, state] of Object.entries(FUNDAMENTAL_TO_STATE)) {
          if (bindingMatches(bindings[action as CoachAction], e)) {
            e.preventDefault();
            const match = useVolley.getState().matches.find((m) => m.id === matchId);
            if (!match) return;
            // Lado por defecto: quien saca para SAQUE; para el resto usamos posesión inferida.
            const side: "A" | "B" = state === "saque" ? match.servingSide : (match.servingSide === "A" ? "B" : "A");
            rally.start(matchId, state as never, side);
            return;
          }
        }
      }

      // 4) Dentro del rally: dispatch al sub-paso actual
      const cur = rally.current;
      if (!cur) return;

      if (cur.sub === "origin" && ORIGIN_DIGIT[e.code] != null) {
        e.preventDefault();
        rally.setOrigin(ORIGIN_DIGIT[e.code]);
        return;
      }

      if (cur.sub === "player" && /^Digit[0-9]$/.test(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const num = Number(e.code.slice(5));
        const match = useVolley.getState().matches.find((m) => m.id === matchId);
        if (!match) return;
        const team = cur.side === "A"
          ? useVolley.getState().teams.find((t) => t.id === match.teamAId)
          : useVolley.getState().teams.find((t) => t.id === match.teamBId);
        if (!team) return;
        const onCourt = cur.side === "A" ? match.onCourtA : match.onCourtB;
        const found = onCourt
          .map((id) => team.players.find((p) => p.id === id))
          .find((p) => p && p.number === num);
        if (found) rally.setPlayer(found.id);
        return;
      }

      if (cur.sub === "target" && ZONE_KEYS_QWE[e.code] != null) {
        e.preventDefault();
        rally.setTarget(ZONE_KEYS_QWE[e.code]);
        return;
      }

      if (cur.sub === "rating" && RATING_KEYS[e.key] != null) {
        e.preventDefault();
        rally.setRating(RATING_KEYS[e.key]);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, matchId]);
}
