import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type TeamUpdate = Database["public"]["Tables"]["teams"]["Update"];
type PlayerUpdate = Database["public"]["Tables"]["players"]["Update"];

const uuidSchema = z.string().uuid();
const nameSchema = z.string().trim().min(1).max(80);
const shortSchema = z.string().trim().min(1).max(8);
const colorSchema = z.string().trim().max(20);
const optionalUrl = z.string().max(1_000_000).optional().nullable();
const positionSchema = z
  .enum(["punta", "central", "opuesto", "armador", "libero"])
  .optional()
  .nullable();
const genderSchema = z.enum(["M", "F"]).optional().nullable();

// ---------------- READ ----------------

export const listTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [teamsRes, playersRes] = await Promise.all([
      supabase
        .from("teams")
        .select("id, league_id, name, short_name, color, logo_url, gender, created_at")
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
    return (teamsRes.data ?? []).map((t) => ({
      id: t.id,
      leagueId: t.league_id,
      name: t.name,
      shortName: t.short_name,
      color: t.color,
      logoUrl: t.logo_url ?? undefined,
      gender: (t.gender === "M" || t.gender === "F" ? t.gender : undefined) as "M" | "F" | undefined,
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
  }) =>
    z
      .object({
        leagueId: uuidSchema.nullable().optional(),
        name: nameSchema,
        shortName: shortSchema,
        color: colorSchema,
        logoUrl: optionalUrl,
        gender: genderSchema,
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
        created_by: context.userId,
      })
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
  }) =>
    z
      .object({
        id: uuidSchema,
        name: nameSchema.optional(),
        shortName: shortSchema.optional(),
        color: colorSchema.optional(),
        logoUrl: optionalUrl,
        leagueId: uuidSchema.nullable().optional(),
        gender: genderSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: TeamUpdate = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.shortName !== undefined) patch.short_name = data.shortName;
    if (data.color !== undefined) patch.color = data.color;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
    if (data.leagueId !== undefined) patch.league_id = data.leagueId;
    if (data.gender !== undefined) patch.gender = data.gender;
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
      .select("id, name, season, color")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      season: l.season ?? undefined,
      color: l.color ?? undefined,
    }));
  });
