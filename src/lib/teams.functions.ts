import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type TeamUpdate = Database["public"]["Tables"]["teams"]["Update"];
type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];
type LeagueUpdate = Database["public"]["Tables"]["leagues"]["Update"];

const uuidSchema = z.string().uuid();
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Coerce non-UUID / empty leagueId (e.g. legacy local IDs) to null instead of throwing.
const leagueIdSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (typeof v === "string" && UUID_RE.test(v) ? v : null))
  .nullable()
  .optional();
const nameSchema = z.string().trim().min(1).max(80);
const shortSchema = z.string().trim().min(1).max(8);
const colorSchema = z.string().trim().max(20);
const optionalUrl = z.string().max(1_000_000).optional().nullable();
const positionSchema = z
  .enum(["punta", "central", "opuesto", "armador", "libero"])
  .optional()
  .nullable();
const genderSchema = z.enum(["M", "F", "X"]).optional().nullable();
const categorySchema = z.enum(["12", "14", "16", "18", "21", "primera", "libre"]).optional().nullable();
const clubSchema = z.string().trim().max(80).optional().nullable();
const secondaryColorSchema = z.string().trim().max(20).optional().nullable();


// ---------------- READ ----------------

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [teamsRes, playersRes] = await Promise.all([
      supabase
        .from("teams")
        .select("id, league_id, name, short_name, color, logo_url, gender, category, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("players")
        .select("id, team_id, name, number, position, photo_url, created_at")
        .order("number", { ascending: true }),
    ]);
    if (teamsRes.error) throw teamsRes.error;
    if (playersRes.error) throw playersRes.error;

    const playersByTeam = new Map<string, typeof playersRes.data>();
    for (const p of playersRes.data ?? []) {
      const arr = playersByTeam.get(p.team_id) ?? [];
      arr.push(p);
      playersByTeam.set(p.team_id, arr);
    }
    const VALID_CATEGORIES = ["12", "14", "16", "18", "21", "primera"] as const;
    type Cat = (typeof VALID_CATEGORIES)[number];
    return (teamsRes.data ?? []).map((t) => ({
      id: t.id,
      leagueId: t.league_id,
      name: t.name,
      shortName: t.short_name,
      color: t.color,
      logoUrl: t.logo_url ?? undefined,
      gender: (t.gender === "M" || t.gender === "F" ? t.gender : undefined) as "M" | "F" | undefined,
      category: (VALID_CATEGORIES.includes((t as { category?: string }).category as Cat)
        ? ((t as { category?: string }).category as Cat)
        : undefined),
      players: (playersByTeam.get(t.id) ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position ?? undefined,
        photoUrl: p.photo_url ?? undefined,
      })),
    }));
  });


// ---------------- TEAM WRITES ----------------

export const createTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    leagueId?: string | null;
    name: string;
    shortName: string;
    color: string;
    logoUrl?: string | null;
    gender?: "M" | "F" | null;
    category?: "12" | "14" | "16" | "18" | "21" | "primera" | null;
  }) =>
    z
      .object({
        leagueId: leagueIdSchema,
        name: nameSchema,
        shortName: shortSchema,
        color: colorSchema,
        logoUrl: optionalUrl,
        gender: genderSchema,
        category: categorySchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("teams")
      .insert({
        league_id: data.leagueId ?? null,
        name: data.name,
        short_name: data.shortName,
        color: data.color,
        logo_url: data.logoUrl ?? null,
        gender: data.gender ?? null,
        category: data.category ?? null,
        created_by: context.userId,
      } as TeamUpdate & { name: string; short_name: string; color: string; created_by: string })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });


export const updateTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    name?: string;
    shortName?: string;
    color?: string;
    logoUrl?: string | null;
    leagueId?: string | null;
    gender?: "M" | "F" | null;
    category?: "12" | "14" | "16" | "18" | "21" | "primera" | null;
  }) =>
    z
      .object({
        id: uuidSchema,
        name: nameSchema.optional(),
        shortName: shortSchema.optional(),
        color: colorSchema.optional(),
        logoUrl: optionalUrl,
        leagueId: leagueIdSchema,
        gender: genderSchema,
        category: categorySchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: TeamUpdate & { category?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.shortName !== undefined) patch.short_name = data.shortName;
    if (data.color !== undefined) patch.color = data.color;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
    if (data.leagueId !== undefined) patch.league_id = data.leagueId;
    if (data.gender !== undefined) patch.gender = data.gender;
    if (data.category !== undefined) patch.category = data.category;
    const { error } = await context.supabase.from("teams").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });


export const deleteTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("teams").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- PLAYER WRITES ----------------

export const createPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    teamId: string;
    name: string;
    number: number;
    position?: string | null;
    photoUrl?: string | null;
  }) =>
    z
      .object({
        teamId: uuidSchema,
        name: nameSchema,
        number: z.number().int().min(0).max(99),
        position: positionSchema,
        photoUrl: optionalUrl,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("players")
      .insert({
        team_id: data.teamId,
        name: data.name,
        number: data.number,
        position: data.position ?? null,
        photo_url: data.photoUrl ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const updatePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    name?: string;
    number?: number;
    position?: string | null;
    photoUrl?: string | null;
  }) =>
    z
      .object({
        id: uuidSchema,
        name: nameSchema.optional(),
        number: z.number().int().min(0).max(99).optional(),
        position: positionSchema,
        photoUrl: optionalUrl,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: PlayerUpdate = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.number !== undefined) patch.number = data.number;
    if (data.position !== undefined) patch.position = data.position;
    if (data.photoUrl !== undefined) patch.photo_url = data.photoUrl;
    const { error } = await context.supabase.from("players").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deletePlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("players").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- LEAGUES (shared, read) ----------------

export const listLeagues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leagues")
      .select("id, name, season, color, gender")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      season: l.season ?? undefined,
      color: l.color ?? undefined,
      gender: (l as { gender?: string | null }).gender === "M" || (l as { gender?: string | null }).gender === "F"
        ? ((l as { gender: "M" | "F" }).gender)
        : undefined,
    }));
  });

export const createLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; season?: string | null; color?: string | null; gender?: "M" | "F" | null }) =>
    z
      .object({
        name: nameSchema,
        season: z.string().trim().max(40).optional().nullable(),
        color: colorSchema.optional().nullable(),
        gender: genderSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("leagues")
      .insert({
        name: data.name,
        season: data.season ?? null,
        color: data.color ?? null,
        gender: data.gender ?? null,
        created_by: context.userId,
      } as LeagueUpdate & { name: string; created_by: string })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const updateLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name?: string; season?: string | null; color?: string | null; gender?: "M" | "F" | null }) =>
    z
      .object({
        id: uuidSchema,
        name: nameSchema.optional(),
        season: z.string().trim().max(40).optional().nullable(),
        color: colorSchema.optional().nullable(),
        gender: genderSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: LeagueUpdate = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.season !== undefined) patch.season = data.season;
    if (data.color !== undefined) patch.color = data.color;
    if (data.gender !== undefined) (patch as LeagueUpdate & { gender?: string | null }).gender = data.gender;
    const { error } = await context.supabase.from("leagues").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: uuidSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const clearTeams = await context.supabase.from("teams").update({ league_id: null }).eq("league_id", data.id);
    if (clearTeams.error) throw clearTeams.error;
    const { error } = await context.supabase.from("leagues").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
