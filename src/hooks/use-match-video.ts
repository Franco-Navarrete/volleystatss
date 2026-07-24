import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MatchVideoRow {
  id: string;
  match_id: string;
  source: "upload" | "url";
  storage_path: string | null;
  external_url: string | null;
  duration_sec: number | null;
  sync_offset_ms: number;
  fps: number | null;
  favorite: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export function useMatchVideo(matchId: string | null | undefined) {
  const [video, setVideo] = useState<MatchVideoRow | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("match_videos")
      .select("*")
      .eq("match_id", matchId)
      .maybeSingle();
    if (error) console.warn("[useMatchVideo] load", error.message);
    setVideo((data as MatchVideoRow | null) ?? null);
    setLoading(false);
  }, [matchId]);

  useEffect(() => { void reload(); }, [reload]);

  return { video, loading, reload, setVideo };
}

export async function upsertMatchVideoUrl(matchId: string, url: string) {
  const { data, error } = await supabase
    .from("match_videos")
    .upsert(
      { match_id: matchId, source: "url", external_url: url, storage_path: null },
      { onConflict: "match_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as MatchVideoRow;
}

export async function upsertMatchVideoUpload(matchId: string, storagePath: string) {
  const { data, error } = await supabase
    .from("match_videos")
    .upsert(
      { match_id: matchId, source: "upload", storage_path: storagePath, external_url: null },
      { onConflict: "match_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as MatchVideoRow;
}

export async function updateSyncOffset(matchId: string, offsetMs: number) {
  const { data, error } = await supabase
    .from("match_videos")
    .update({ sync_offset_ms: Math.round(offsetMs) })
    .eq("match_id", matchId)
    .select("*")
    .single();
  if (error) throw error;
  return data as MatchVideoRow;
}

export async function updateVideoMeta(matchId: string, patch: Partial<Pick<MatchVideoRow, "duration_sec" | "favorite" | "tags" | "fps">>) {
  const { data, error } = await supabase
    .from("match_videos")
    .update(patch)
    .eq("match_id", matchId)
    .select("*")
    .single();
  if (error) throw error;
  return data as MatchVideoRow;
}

export async function deleteMatchVideo(matchId: string, storagePath: string | null) {
  if (storagePath) {
    await supabase.storage.from("match-videos").remove([storagePath]).catch(() => undefined);
  }
  const { error } = await supabase.from("match_videos").delete().eq("match_id", matchId);
  if (error) throw error;
}

export async function listMatchVideos(): Promise<MatchVideoRow[]> {
  const { data, error } = await supabase.from("match_videos").select("*");
  if (error) {
    console.warn("[listMatchVideos]", error.message);
    return [];
  }
  return (data as MatchVideoRow[]) ?? [];
}

export async function getSignedVideoUrl(storagePath: string, ttlSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from("match-videos").createSignedUrl(storagePath, ttlSec);
  if (error) {
    console.warn("[getSignedVideoUrl]", error.message);
    return null;
  }
  return data.signedUrl;
}

export async function uploadMatchVideo(matchId: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${matchId}/${Date.now()}_${safeName}`;
  // Supabase JS v2 upload doesn't support progress natively without XHR; fake a two-step signal.
  onProgress?.(1);
  const { error } = await supabase.storage.from("match-videos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "video/mp4",
  });
  if (error) throw error;
  onProgress?.(100);
  return path;
}
