import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { PublicMatchSnapshot } from "./public-match-snapshot";

const slugSchema = z.string().trim().min(4).max(32).regex(/^[A-Za-z0-9_-]+$/);
const matchIdSchema = z.string().trim().min(1).max(64);

const SLUG_ALPHABET =
  "abcdefghijkmnpqrstuvwxyz23456789"; // base32, no ambiguous chars
function newSlug(len = 8): string {
  const bytes = new Uint8Array(len);
  // Edge runtime + browsers both expose crypto.getRandomValues.
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
  return out;
}

/** Public, unauthenticated read using the anon publishable key. */
export const getPublicMatch = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: slugSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: row, error } = await sb
      .from("public_matches")
      .select("id, data, is_public, updated_at")
      .eq("id", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!row || !row.is_public) throw notFound();
    return {
      slug: row.id,
      updatedAt: row.updated_at,
      snapshot: row.data as unknown as PublicMatchSnapshot,
    };
  });

/**
 * Public: lista todos los partidos EN VIVO compartidos (is_public = true).
 * Usada para que todos los roles (incluso sin acceso al partido) puedan
 * ver los partidos que se están jugando ahora mismo.
 */
export const listLivePublicMatches = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    // Sólo consideramos "en vivo" a los snapshots que se actualizaron
    // recientemente. Si el dueño cerró la pestaña y el partido nunca terminó,
    // la snapshot queda con status="live" para siempre; el filtro por
    // updated_at evita mostrar partidos fantasma.
    const FRESH_MINUTES = 15;
    const sinceIso = new Date(Date.now() - FRESH_MINUTES * 60_000).toISOString();
    const { data, error } = await sb
      .from("public_matches")
      .select("id, data, updated_at")
      .eq("is_public", true)
      .contains("data", { match: { status: "live" } })
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((row) => {
      const snap = row.data as unknown as PublicMatchSnapshot | null;
      return {
        slug: row.id,
        updatedAt: row.updated_at,
        matchId: snap?.match?.id ?? null,
        teamA: { id: snap?.match?.teamAId ?? null, name: snap?.teamA?.name ?? "—", shortName: snap?.teamA?.shortName ?? "", color: snap?.teamA?.color ?? null, logoUrl: snap?.teamA?.logoUrl ?? null },
        teamB: { id: snap?.match?.teamBId ?? null, name: snap?.teamB?.name ?? "—", shortName: snap?.teamB?.shortName ?? "", color: snap?.teamB?.color ?? null, logoUrl: snap?.teamB?.logoUrl ?? null },
        leagueName: snap?.league?.name ?? null,
        sets: snap?.match?.sets ?? [],
      };
    });
  });

/** Upsert a snapshot for a match owned by the current user. */
export const upsertPublicMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; snapshot: PublicMatchSnapshot; isPublic?: boolean }) =>
    z
      .object({
        matchId: matchIdSchema,
        snapshot: z.unknown() as unknown as z.ZodType<PublicMatchSnapshot>,
        isPublic: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("public_matches")
      .select("id, is_public")
      .eq("owner_id", userId)
      .eq("match_id", data.matchId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("public_matches")
        .update({
          data: data.snapshot as unknown as Json,
          is_public: data.isPublic ?? existing.is_public,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return { slug: existing.id, isPublic: data.isPublic ?? existing.is_public };
    }

    // Generate a unique slug (retry on collision, very unlikely with 8 base32 chars).
    let slug = newSlug();
    for (let i = 0; i < 5; i++) {
      const { data: hit } = await supabase
        .from("public_matches")
        .select("id")
        .eq("id", slug)
        .maybeSingle();
      if (!hit) break;
      slug = newSlug();
    }

    const { error } = await supabase.from("public_matches").insert({
      id: slug,
      match_id: data.matchId,
      owner_id: userId,
      data: data.snapshot as unknown as Json,
      is_public: data.isPublic ?? true,
    });
    if (error) throw error;
    return { slug, isPublic: data.isPublic ?? true };
  });

export const setPublicMatchVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string; isPublic: boolean }) =>
    z.object({ matchId: matchIdSchema, isPublic: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("public_matches")
      .update({ is_public: data.isPublic })
      .eq("owner_id", userId)
      .eq("match_id", data.matchId)
      .select("id, is_public")
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const deletePublicMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string }) =>
    z.object({ matchId: matchIdSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("public_matches")
      .delete()
      .eq("owner_id", userId)
      .eq("match_id", data.matchId);
    if (error) throw error;
    return { ok: true };
  });

/** Look up the current public state for a given match (owner-only). */
export const getOwnPublicMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { matchId: string }) =>
    z.object({ matchId: matchIdSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("public_matches")
      .select("id, is_public, updated_at")
      .eq("owner_id", userId)
      .eq("match_id", data.matchId)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

/**
 * Admin-only: read any shared match by slug, ignoring `is_public`.
 * RLS policy `Admins can read all shared matches` gates access.
 */
export const adminGetPublicMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: slugSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: row, error } = await supabase
      .from("public_matches")
      .select("id, data, is_public, updated_at")
      .eq("id", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    return {
      slug: row.id,
      updatedAt: row.updated_at,
      isPublic: row.is_public,
      snapshot: row.data as unknown as PublicMatchSnapshot,
    };
  });

/** Admin-only: list every shared match, newest first. */
export const adminListPublicMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await supabase
      .from("public_matches")
      .select("id, match_id, owner_id, is_public, updated_at, data")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const snap = row.data as unknown as PublicMatchSnapshot | null;
      const match = snap?.match;
      return {
        slug: row.id,
        matchId: row.match_id,
        ownerId: row.owner_id,
        isPublic: row.is_public,
        updatedAt: row.updated_at,
        status: match?.status ?? null,
        teamAName: snap?.teamA?.name ?? null,
        teamBName: snap?.teamB?.name ?? null,
        leagueName: snap?.league?.name ?? null,
      };
    });
  });
