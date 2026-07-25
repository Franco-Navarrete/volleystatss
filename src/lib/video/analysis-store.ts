/**
 * Estado compartido del entorno de análisis de video.
 *
 * Responsabilidades:
 *   - Selección única de acción (mark) sincronizada entre tabla, timeline y video.
 *   - Ventana de clip virtual (preroll / postroll) configurable.
 *   - Zoom + panning sobre la línea de tiempo.
 *   - Marcadores manuales del entrenador (independientes del scouting).
 *   - Pestaña activa del panel de análisis.
 *   - Atajos configurables (contrato listo para editor futuro).
 *
 * NO reemplaza el store de scouting (`video-scout-store`) ni el core (`useVolley`).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_CLIP_PREROLL_MS,
  DEFAULT_CLIP_POSTROLL_MS,
} from "@/lib/video-marks";

export type AnalysisTab = "acciones" | "rally" | "marcadores";

export type CustomMarkerKind = "star" | "fire" | "warn" | "note";

export const CUSTOM_MARKER_META: Record<
  CustomMarkerKind,
  { label: string; emoji: string; color: string }
> = {
  star: { label: "Jugada importante", emoji: "⭐", color: "#fbbf24" },
  fire: { label: "Rally destacado", emoji: "🔥", color: "#f97316" },
  warn: { label: "Error arbitral", emoji: "⚠", color: "#ef4444" },
  note: { label: "Nota del entrenador", emoji: "📝", color: "#38bdf8" },
};

export interface CustomMarker {
  id: string;
  matchId: string;
  tMs: number;
  kind: CustomMarkerKind;
  text: string;
  createdAt: number;
}

export type ShortcutAction =
  | "seekBack5"
  | "seekFwd5"
  | "prevEvent"
  | "nextEvent"
  | "playPause"
  | "frameBack"
  | "frameFwd";

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  seekBack5: "ArrowLeft",
  seekFwd5: "ArrowRight",
  prevEvent: "j",
  nextEvent: "l",
  playPause: "k",
  frameBack: ",",
  frameFwd: ".",
};

interface AnalysisState {
  // Selección compartida
  selectedMarkId: string | null;
  selectMark: (id: string | null) => void;

  // Ventana de clip
  prerollMs: number;
  postrollMs: number;
  setPreroll: (ms: number) => void;
  setPostroll: (ms: number) => void;
  /** Pausar automáticamente al llegar a finClipMs cuando el usuario elige una acción. */
  autoPauseAtEnd: boolean;
  setAutoPauseAtEnd: (v: boolean) => void;

  // Zoom / pan de la timeline
  zoom: number; // 1 = todo el partido; >1 acerca; <1 no permitido
  centerMs: number; // ms centrado en el viewport
  setZoom: (z: number) => void;
  setCenterMs: (ms: number) => void;
  resetView: () => void;

  // Pestaña activa
  activeTab: AnalysisTab;
  setActiveTab: (t: AnalysisTab) => void;

  // Marcadores manuales (por partido)
  markersByMatch: Record<string, CustomMarker[]>;
  addMarker: (m: Omit<CustomMarker, "id" | "createdAt">) => void;
  removeMarker: (matchId: string, id: string) => void;
  updateMarkerText: (matchId: string, id: string, text: string) => void;

  // Atajos configurables (contrato)
  shortcuts: Record<ShortcutAction, string>;
  setShortcut: (action: ShortcutAction, key: string) => void;
  resetShortcuts: () => void;
}

let seq = 0;
const nid = () =>
  `mk_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      selectedMarkId: null,
      selectMark: (id) => set({ selectedMarkId: id }),

      prerollMs: DEFAULT_CLIP_PREROLL_MS,
      postrollMs: DEFAULT_CLIP_POSTROLL_MS,
      setPreroll: (ms) => set({ prerollMs: Math.max(500, Math.min(30_000, ms)) }),
      setPostroll: (ms) => set({ postrollMs: Math.max(500, Math.min(30_000, ms)) }),
      autoPauseAtEnd: true,
      setAutoPauseAtEnd: (v) => set({ autoPauseAtEnd: v }),

      zoom: 1,
      centerMs: 0,
      setZoom: (z) => set({ zoom: Math.max(1, Math.min(200, z)) }),
      setCenterMs: (ms) => set({ centerMs: Math.max(0, ms) }),
      resetView: () => set({ zoom: 1, centerMs: 0 }),

      activeTab: "acciones",
      setActiveTab: (t) => set({ activeTab: t }),

      markersByMatch: {},
      addMarker: (m) =>
        set((s) => {
          const next = { ...s.markersByMatch };
          const arr = next[m.matchId] ? [...next[m.matchId]!] : [];
          arr.push({ ...m, id: nid(), createdAt: Date.now() });
          arr.sort((a, b) => a.tMs - b.tMs);
          next[m.matchId] = arr;
          return { markersByMatch: next };
        }),
      removeMarker: (matchId, id) =>
        set((s) => {
          const arr = s.markersByMatch[matchId];
          if (!arr) return {};
          return {
            markersByMatch: {
              ...s.markersByMatch,
              [matchId]: arr.filter((x) => x.id !== id),
            },
          };
        }),
      updateMarkerText: (matchId, id, text) =>
        set((s) => {
          const arr = s.markersByMatch[matchId];
          if (!arr) return {};
          return {
            markersByMatch: {
              ...s.markersByMatch,
              [matchId]: arr.map((x) => (x.id === id ? { ...x, text } : x)),
            },
          };
        }),

      shortcuts: { ...DEFAULT_SHORTCUTS },
      setShortcut: (action, key) =>
        set((s) => ({ shortcuts: { ...s.shortcuts, [action]: key } })),
      resetShortcuts: () => set({ shortcuts: { ...DEFAULT_SHORTCUTS } }),
    }),
    {
      name: "rally-video-analysis",
      partialize: (s) => ({
        prerollMs: s.prerollMs,
        postrollMs: s.postrollMs,
        autoPauseAtEnd: s.autoPauseAtEnd,
        markersByMatch: s.markersByMatch,
        shortcuts: s.shortcuts,
      }),
    },
  ),
);
