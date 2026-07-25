/**
 * FilterService — filtros combinables sobre la biblioteca de clips.
 * El estado NO se persiste; vive por sesión de análisis.
 */
import { create } from "zustand";
import type { Clip } from "@/lib/analysis/clip-service";
import type { VideoMarkKind } from "@/lib/video-marks";

export interface AnalysisFilters {
  team: "A" | "B" | null;
  playerId: string | null;
  fundamentos: VideoMarkKind[]; // vacío = todos
  results: string[]; // substring match sobre result
  sets: number[]; // vacío = todos
  rallyIds: number[];
  rotations: number[];
  zoneOrigin: number | null;
  zoneDest: number | null;
  serveType: string | null;
  attackType: string | null;
  favoritesOnly: boolean;
  markersOnly: boolean;
  tags: string[];
  playlistId: string | null;
  search: string;
}

export const EMPTY_FILTERS: AnalysisFilters = {
  team: null,
  playerId: null,
  fundamentos: [],
  results: [],
  sets: [],
  rallyIds: [],
  rotations: [],
  zoneOrigin: null,
  zoneDest: null,
  serveType: null,
  attackType: null,
  favoritesOnly: false,
  markersOnly: false,
  tags: [],
  playlistId: null,
  search: "",
};

interface FilterState {
  filters: AnalysisFilters;
  patch: (p: Partial<AnalysisFilters>) => void;
  toggleFundamento: (k: VideoMarkKind) => void;
  toggleSet: (n: number) => void;
  toggleTag: (t: string) => void;
  reset: () => void;
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export const useFilterStore = create<FilterState>((set) => ({
  filters: { ...EMPTY_FILTERS },
  patch: (p) => set((s) => ({ filters: { ...s.filters, ...p } })),
  toggleFundamento: (k) =>
    set((s) => ({ filters: { ...s.filters, fundamentos: toggle(s.filters.fundamentos, k) } })),
  toggleSet: (n) =>
    set((s) => ({ filters: { ...s.filters, sets: toggle(s.filters.sets, n) } })),
  toggleTag: (t) =>
    set((s) => ({ filters: { ...s.filters, tags: toggle(s.filters.tags, t) } })),
  reset: () => set({ filters: { ...EMPTY_FILTERS } }),
}));

export const FilterService = {
  apply(
    clips: Clip[],
    filters: AnalysisFilters,
    opts: { playlistClipIds?: Set<string>; markerTimestamps?: Set<number> } = {},
  ): Clip[] {
    const f = filters;
    const q = f.search.trim().toLowerCase();
    return clips.filter((c) => {
      if (f.team && c.side !== f.team) return false;
      if (f.playerId && c.playerId !== f.playerId) return false;
      if (f.fundamentos.length && !f.fundamentos.includes(c.kind)) return false;
      if (f.results.length) {
        const r = (c.result ?? "").toLowerCase();
        if (!f.results.some((x) => r.includes(x.toLowerCase()))) return false;
      }
      if (f.sets.length && !f.sets.includes(c.setNumber)) return false;
      if (f.rallyIds.length && !f.rallyIds.includes(c.rallyId)) return false;
      if (f.rotations.length && (c.rotation == null || !f.rotations.includes(c.rotation)))
        return false;
      if (f.zoneOrigin != null && c.zone !== f.zoneOrigin) return false;
      if (f.zoneDest != null) {
        const ev = c.event as { attackZone?: number };
        if (ev.attackZone !== f.zoneDest) return false;
      }
      if (f.serveType) {
        const ev = c.event as { serveType?: string };
        if (ev.serveType !== f.serveType) return false;
      }
      if (f.attackType) {
        const ev = c.event as { attackType?: string };
        if (ev.attackType !== f.attackType) return false;
      }
      if (f.favoritesOnly && !c.meta.favorite) return false;
      if (f.tags.length && !f.tags.every((t) => (c.meta.tags ?? []).includes(t))) return false;
      if (f.playlistId && opts.playlistClipIds && !opts.playlistClipIds.has(c.id)) return false;
      if (f.markersOnly && opts.markerTimestamps) {
        const near = [...opts.markerTimestamps].some((t) => Math.abs(t - c.tMs) < 1500);
        if (!near) return false;
      }
      if (q) {
        const hay = [
          c.title,
          c.fundamento,
          c.result ?? "",
          c.playerName ?? "",
          c.team ?? "",
          ...(c.meta.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  },
  isEmpty(f: AnalysisFilters): boolean {
    return (
      !f.team &&
      !f.playerId &&
      f.fundamentos.length === 0 &&
      f.results.length === 0 &&
      f.sets.length === 0 &&
      f.rallyIds.length === 0 &&
      f.rotations.length === 0 &&
      f.zoneOrigin == null &&
      f.zoneDest == null &&
      !f.serveType &&
      !f.attackType &&
      !f.favoritesOnly &&
      !f.markersOnly &&
      f.tags.length === 0 &&
      !f.playlistId &&
      !f.search
    );
  },
};
