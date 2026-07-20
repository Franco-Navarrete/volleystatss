import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const nameSchema = z.string().trim().min(1).max(80);
const optionalStr = (max: number) => z.string().trim().max(max).optional().nullable();
const optionalUrl = z.string().max(1_000_000).optional().nullable();
const colorSchema = z.string().trim().max(20).optional().nullable();
const uuidSchema = z.string().uuid();

export type ClubDTO = {
  id: string;
  ownerId: string;
  name: string;
  logoUrl?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

function rowToDTO(r: Record<string, unknown>): ClubDTO {
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    name: r.name as string,
    logoUrl: (r.logo_url as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    province: (r.province as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    primaryColor: (r.primary_color as string | null) ?? null,
    secondaryColor: (r.secondary_color as string | null) ?? null,
  };
}

export const getMyClub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clubs")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToDTO(data as Record<string, unknown>) : null;
  });

export const listClubs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clubs")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToDTO(r as Record<string, unknown>));
  });

export const createClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name: string;
    logoUrl?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  }) =>
    z
      .object({
        name: nameSchema,
        logoUrl: optionalUrl,
        city: optionalStr(80),
        province: optionalStr(80),
        country: optionalStr(80),
        primaryColor: colorSchema,
        secondaryColor: colorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clubs")
      .insert({
        owner_id: context.userId,
        name: data.name,
        logo_url: data.logoUrl ?? null,
        city: data.city ?? null,
        province: data.province ?? null,
        country: data.country ?? null,
        primary_color: data.primaryColor ?? null,
        secondary_color: data.secondaryColor ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return rowToDTO(row as Record<string, unknown>);
  });

export const updateClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    name?: string;
    logoUrl?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
  }) =>
    z
      .object({
        id: uuidSchema,
        name: nameSchema.optional(),
        logoUrl: optionalUrl,
        city: optionalStr(80),
        province: optionalStr(80),
        country: optionalStr(80),
        primaryColor: colorSchema,
        secondaryColor: colorSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      name?: string;
      logo_url?: string | null;
      city?: string | null;
      province?: string | null;
      country?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
    if (data.city !== undefined) patch.city = data.city;
    if (data.province !== undefined) patch.province = data.province;
    if (data.country !== undefined) patch.country = data.country;
    if (data.primaryColor !== undefined) patch.primary_color = data.primaryColor;
    if (data.secondaryColor !== undefined) patch.secondary_color = data.secondaryColor;
    const { data: row, error } = await context.supabase
      .from("clubs")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return rowToDTO(row as Record<string, unknown>);
  });
