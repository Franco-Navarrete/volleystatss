/**
 * ClipService — capa post-partido.
 *
 * Un "clip" es SIEMPRE una referencia a una VideoMark existente
 * (id, tMs, ventana virtual). No se duplican datos.
 *
 * Los metadatos editables por el usuario (nombre, favorito, tags, grupo)
 * viven en un store persistido por partido, indexado por markId.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VideoMark } from "@/lib/video-marks";

export interface ClipMeta {
  name?: string;
  favorite?: boolean;
  tags?: string[];
  group?: string | null;
}

export interface Clip extends VideoMark {
  meta: ClipMeta;
  /** Duración del clip virtual en ms. */
  durationMs: number;
  /** Título derivado (nombre custom o generado). */
  title: string;
}

interface ClipMetaState {
  metaByMatch: Record<string, Record<string, ClipMeta>>;
  setName: (matchId: string, clipId: string, name: string) => void;
  toggleFavorite: (matchId: string, clipId: string) => void;
  setTags: (matchId: string, clipId: string, tags: string[]) => void;
  addTag: (matchId: string, clipId: string, tag: string) => void;
  removeTag: (matchId: string, clipId: string, tag: string) => void;
  setGroup: (matchId: string, clipId: string, group: string | null) => void;
  clearMatch: (matchId: string) => void;
}

function patch(
  s: ClipMetaState,
  matchId: string,
  clipId: string,
  fn: (prev: ClipMeta) => ClipMeta,
): Partial<ClipMetaState> {
  const perMatch = s.metaByMatch[matchId] ?? {};
  const prev = perMatch[clipId] ?? {};
  const next = fn(prev);
  return {
    metaByMatch: {
      ...s.metaByMatch,
      [matchId]: { ...perMatch, [clipId]: next },
    },
  };
}

export const useClipMetaStore = create<ClipMetaState>()(
  persist(
    (set) => ({
      metaByMatch: {},
      setName: (m, id, name) => set((s) => patch(s, m, id, (p) => ({ ...p, name }))),
      toggleFavorite: (m, id) =>
        set((s) => patch(s, m, id, (p) => ({ ...p, favorite: !p.favorite }))),
      setTags: (m, id, tags) => set((s) => patch(s, m, id, (p) => ({ ...p, tags }))),
      addTag: (m, id, tag) =>
        set((s) =>
          patch(s, m, id, (p) => ({
            ...p,
            tags: Array.from(new Set([...(p.tags ?? []), tag])),
          })),
        ),
      removeTag: (m, id, tag) =>
        set((s) =>
          patch(s, m, id, (p) => ({
            ...p,
            tags: (p.tags ?? []).filter((t) => t !== tag),
          })),
        ),
      setGroup: (m, id, group) => set((s) => patch(s, m, id, (p) => ({ ...p, group }))),
      clearMatch: (m) =>
        set((s) => {
          const { [m]: _, ...rest } = s.metaByMatch;
          return { metaByMatch: rest };
        }),
    }),
    {
      name: "rally-clip-meta",
      partialize: (s) => ({ metaByMatch: s.metaByMatch }),
    },
  ),
);

function defaultTitle(m: VideoMark): string {
  const who = m.playerNumber ? `#${m.playerNumber}` : m.team ?? m.side ?? "";
  return `${m.fundamento}${who ? ` · ${who}` : ""}${m.result ? ` · ${m.result}` : ""}`;
}

export const ClipService = {
  /** Enriquecer una VideoMark → Clip aplicando metadata + ventana actual. */
  enrich(
    matchId: string,
    marks: VideoMark[],
    prerollMs: number,
    postrollMs: number,
    metaByClip: Record<string, ClipMeta>,
  ): Clip[] {
    return marks.map((m) => {
      const meta = metaByClip[m.id] ?? {};
      const inicio = Math.max(0, m.tMs - prerollMs);
      const fin = m.tMs + postrollMs;
      return {
        ...m,
        inicioClipMs: inicio,
        finClipMs: fin,
        meta,
        durationMs: fin - inicio,
        title: meta.name ?? defaultTitle(m),
      };
    });
  },

  /** Todos los tags únicos presentes en la biblioteca. */
  collectTags(clips: Clip[]): string[] {
    const set = new Set<string>();
    for (const c of clips) for (const t of c.meta.tags ?? []) set.add(t);
    return [...set].sort();
  },
};
