/**
 * MatchSessionStore — estado maestro que enlaza todos los módulos existentes
 * (volley-store, analysis-store, video-scout-store, live-recording, etc.)
 * bajo una sola entidad `MatchSession`.
 *
 * Persistencia local vía zustand/persist. La sincronización a la nube usa
 * el mismo mecanismo genérico de `app_state` sólo cuando el store base
 * decida propagar (fuera de alcance de esta iteración).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  MatchSession,
  SessionStatus,
  SessionVideoHint,
  ProcessingStep,
} from "./types";

interface State {
  sessions: Record<string, MatchSession>;
}

interface Actions {
  createSession: (init: Omit<MatchSession, "createdAt" | "status">) => MatchSession;
  getSession: (id: string) => MatchSession | undefined;
  setStatus: (id: string, status: SessionStatus) => void;
  patch: (id: string, patch: Partial<MatchSession>) => void;
  setVideoHint: (id: string, hint: SessionVideoHint | undefined) => void;
  setProcessing: (id: string, steps: ProcessingStep[]) => void;
  updateStep: (id: string, stepId: ProcessingStep["id"], status: ProcessingStep["status"]) => void;
  remove: (id: string) => void;
}

export const useMatchSessionStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      sessions: {},

      createSession: (init) => {
        const now = Date.now();
        const s: MatchSession = { ...init, status: "preparation", createdAt: now };
        set((st) => ({ sessions: { ...st.sessions, [s.id]: s } }));
        return s;
      },

      getSession: (id) => get().sessions[id],

      setStatus: (id, status) =>
        set((st) => {
          const cur = st.sessions[id];
          if (!cur) return st;
          const patch: Partial<MatchSession> = { status };
          if (status === "live" && !cur.startedAt) patch.startedAt = Date.now();
          if (status === "finished") patch.endedAt = Date.now();
          return { sessions: { ...st.sessions, [id]: { ...cur, ...patch } } };
        }),

      patch: (id, patch) =>
        set((st) =>
          st.sessions[id]
            ? { sessions: { ...st.sessions, [id]: { ...st.sessions[id]!, ...patch } } }
            : st,
        ),

      setVideoHint: (id, hint) =>
        set((st) =>
          st.sessions[id]
            ? { sessions: { ...st.sessions, [id]: { ...st.sessions[id]!, videoSourceHint: hint } } }
            : st,
        ),

      setProcessing: (id, steps) =>
        set((st) =>
          st.sessions[id]
            ? { sessions: { ...st.sessions, [id]: { ...st.sessions[id]!, processing: steps } } }
            : st,
        ),

      updateStep: (id, stepId, status) =>
        set((st) => {
          const cur = st.sessions[id];
          if (!cur?.processing) return st;
          const next = cur.processing.map((s) => (s.id === stepId ? { ...s, status } : s));
          return { sessions: { ...st.sessions, [id]: { ...cur, processing: next } } };
        }),

      remove: (id) =>
        set((st) => {
          const { [id]: _, ...rest } = st.sessions;
          return { sessions: rest };
        }),
    }),
    { name: "vstats:match-sessions" },
  ),
);

export const listSessions = () =>
  Object.values(useMatchSessionStore.getState().sessions).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
