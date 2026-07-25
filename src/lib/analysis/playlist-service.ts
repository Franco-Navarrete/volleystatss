/**
 * PlaylistService — colecciones nombradas de referencias a clips.
 * Persistido en localStorage. NO copia datos de los clips.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Playlist {
  id: string;
  matchId: string;
  name: string;
  clipIds: string[];
  createdAt: number;
  updatedAt: number;
  color?: string;
  description?: string;
}

interface PlaylistState {
  playlistsByMatch: Record<string, Playlist[]>;
  create: (matchId: string, name: string, clipIds?: string[]) => Playlist;
  rename: (matchId: string, id: string, name: string) => void;
  remove: (matchId: string, id: string) => void;
  addClip: (matchId: string, id: string, clipId: string) => void;
  removeClip: (matchId: string, id: string, clipId: string) => void;
  setClips: (matchId: string, id: string, clipIds: string[]) => void;
  setDescription: (matchId: string, id: string, description: string) => void;
}

let seq = 0;
const nid = () => `pl_${Date.now().toString(36)}_${(seq++).toString(36)}`;

function mut(
  s: PlaylistState,
  matchId: string,
  fn: (arr: Playlist[]) => Playlist[],
): Partial<PlaylistState> {
  const arr = s.playlistsByMatch[matchId] ?? [];
  return {
    playlistsByMatch: { ...s.playlistsByMatch, [matchId]: fn(arr) },
  };
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set, get) => ({
      playlistsByMatch: {},
      create: (matchId, name, clipIds = []) => {
        const pl: Playlist = {
          id: nid(),
          matchId,
          name,
          clipIds: [...clipIds],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => mut(s, matchId, (arr) => [...arr, pl]));
        return pl;
      },
      rename: (matchId, id, name) =>
        set((s) =>
          mut(s, matchId, (arr) =>
            arr.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)),
          ),
        ),
      remove: (matchId, id) =>
        set((s) => mut(s, matchId, (arr) => arr.filter((p) => p.id !== id))),
      addClip: (matchId, id, clipId) =>
        set((s) =>
          mut(s, matchId, (arr) =>
            arr.map((p) =>
              p.id === id && !p.clipIds.includes(clipId)
                ? { ...p, clipIds: [...p.clipIds, clipId], updatedAt: Date.now() }
                : p,
            ),
          ),
        ),
      removeClip: (matchId, id, clipId) =>
        set((s) =>
          mut(s, matchId, (arr) =>
            arr.map((p) =>
              p.id === id
                ? { ...p, clipIds: p.clipIds.filter((c) => c !== clipId), updatedAt: Date.now() }
                : p,
            ),
          ),
        ),
      setClips: (matchId, id, clipIds) =>
        set((s) =>
          mut(s, matchId, (arr) =>
            arr.map((p) =>
              p.id === id ? { ...p, clipIds: [...clipIds], updatedAt: Date.now() } : p,
            ),
          ),
        ),
      setDescription: (matchId, id, description) =>
        set((s) =>
          mut(s, matchId, (arr) =>
            arr.map((p) =>
              p.id === id ? { ...p, description, updatedAt: Date.now() } : p,
            ),
          ),
        ),
    }),
    {
      name: "rally-playlists",
      partialize: (s) => ({ playlistsByMatch: s.playlistsByMatch }),
    },
  ),
);

export const PlaylistService = {
  suggestNames: [
    "Recepciones negativas",
    "Ataques por zona 4",
    "Errores no forzados",
    "Bloqueos efectivos",
    "Contraataques",
    "Aces",
    "Puntos de rotación",
  ],
};
