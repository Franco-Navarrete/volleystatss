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
