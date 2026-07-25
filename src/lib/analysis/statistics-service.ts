/**
 * StatisticsService — cálculos agregados sobre la biblioteca filtrada.
 * Funciones puras, sin dependencias externas, aptas para memoización.
 */
import type { Clip } from "@/lib/analysis/clip-service";
import type { VideoMarkKind } from "@/lib/video-marks";

export interface Bucket<K extends string | number> {
  key: K;
  label: string;
  count: number;
  positives: number;
  errors: number;
  ratio: number; // positives / count
}

function isPositive(c: Clip): boolean {
  const r = (c.result ?? "").toLowerCase();
  return (
    r.includes("punto") ||
    r.includes("ace") ||
    r.includes("positiva") ||
    r === "positive" ||
    r === "excellent"
  );
}

function isError(c: Clip): boolean {
  const r = (c.result ?? "").toLowerCase();
  return c.kind === "error" || r.includes("error") || r.includes("negativ");
}

function bucketize<K extends string | number>(
  clips: Clip[],
  keyFn: (c: Clip) => K | null,
  labelFn: (k: K) => string,
): Bucket<K>[] {
  const map = new Map<K, Bucket<K>>();
  for (const c of clips) {
    const k = keyFn(c);
    if (k == null) continue;
    let b = map.get(k);
    if (!b) {
      b = { key: k, label: labelFn(k), count: 0, positives: 0, errors: 0, ratio: 0 };
      map.set(k, b);
    }
    b.count += 1;
    if (isPositive(c)) b.positives += 1;
    if (isError(c)) b.errors += 1;
  }
  for (const b of map.values()) b.ratio = b.count ? b.positives / b.count : 0;
  return [...map.values()];
}

export const StatisticsService = {
  isPositive,
  isError,
  byFundamento(clips: Clip[]): Bucket<VideoMarkKind>[] {
    return bucketize(clips, (c) => c.kind, (k) => k).sort((a, b) => b.count - a.count);
  },
  byResult(clips: Clip[]): Bucket<string>[] {
    return bucketize(clips, (c) => c.result ?? null, (k) => k).sort((a, b) => b.count - a.count);
  },
  bySet(clips: Clip[]): Bucket<number>[] {
    return bucketize(clips, (c) => c.setNumber, (k) => `Set ${k}`).sort(
      (a, b) => Number(a.key) - Number(b.key),
    );
  },
  byRotation(clips: Clip[]): Bucket<number>[] {
    return bucketize(clips, (c) => c.rotation, (k) => `R${k}`).sort(
      (a, b) => Number(a.key) - Number(b.key),
    );
  },
  byPlayer(clips: Clip[]): Bucket<string>[] {
    return bucketize(
      clips,
      (c) => c.playerId,
      (k) => {
        const c = clips.find((x) => x.playerId === k);
        return c?.playerName ? `#${c.playerNumber ?? "?"} ${c.playerName}` : String(k);
      },
    ).sort((a, b) => b.count - a.count);
  },
  byZone(clips: Clip[]): Bucket<number>[] {
    return bucketize(clips, (c) => c.zone, (k) => `Zona ${k}`).sort(
      (a, b) => Number(a.key) - Number(b.key),
    );
  },
  summary(clips: Clip[]) {
    let positives = 0;
    let errors = 0;
    let points = 0;
    let aces = 0;
    for (const c of clips) {
      if (isPositive(c)) positives += 1;
      if (isError(c)) errors += 1;
      const r = (c.result ?? "").toLowerCase();
      if (r.includes("punto")) points += 1;
      if (r === "ace") aces += 1;
    }
    return {
      total: clips.length,
      positives,
      errors,
      points,
      aces,
      efficiency: clips.length ? (positives - errors) / clips.length : 0,
    };
  },
};
