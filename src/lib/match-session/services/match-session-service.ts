/**
 * MatchSessionService — punto de entrada único para crear / avanzar / cerrar
 * sesiones. Envuelve el `MatchSessionStore` y el `useVolley` para mantener
 * las dos entidades sincronizadas por `id`.
 */
import { useMatchSessionStore } from "../store";
import type { MatchSession, SessionStatus, SessionVideoHint } from "../types";
import { useVolley } from "@/lib/volley-store";

export const MatchSessionService = {
  /** Crea la sesión enlazándola a un `matchId` ya existente en volley-store. */
  create(init: {
    matchId: string;
    teamAId: string;
    teamBId: string;
    competition?: string;
    category?: string;
    videoSourceHint?: SessionVideoHint;
    recordingFileName?: string;
  }): MatchSession {
    return useMatchSessionStore.getState().createSession({
      id: init.matchId,
      teamAId: init.teamAId,
      teamBId: init.teamBId,
      competition: init.competition,
      category: init.category,
      videoSourceHint: init.videoSourceHint,
      recordingFileName: init.recordingFileName,
    });
  },

  get(id: string) {
    return useMatchSessionStore.getState().getSession(id);
  },

  setStatus(id: string, status: SessionStatus) {
    useMatchSessionStore.getState().setStatus(id, status);
    // Reflejo mínimo en el volley-store para mantener coherencia visual:
    if (status === "live") useVolley.getState().startMatch(id);
  },

  /** Avanza al siguiente estado en el flujo canónico. */
  advance(id: string) {
    const s = MatchSessionService.get(id);
    if (!s) return;
    const order: SessionStatus[] = ["preparation", "live", "processing", "analysis", "finished"];
    const next = order[order.indexOf(s.status) + 1];
    if (next) MatchSessionService.setStatus(id, next);
  },

  finish(id: string) {
    MatchSessionService.setStatus(id, "finished");
  },

  setVideoHint(id: string, hint: SessionVideoHint | undefined) {
    useMatchSessionStore.getState().setVideoHint(id, hint);
  },
};
