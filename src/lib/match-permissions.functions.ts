// Autorización + auditoría para eliminar partidos.
// Solo administradores y planilleros pueden eliminar; el resto obtiene 403.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ matchId: z.string().min(1).max(200) });

export const authorizeAndDeleteMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    // Rol efectivo: admin > planillero > entrenador > otro.
    const email = (claims as { email?: string } | undefined)?.email ?? null;
    const isSuperAdmin = email === "franco.e.navarrete@gmail.com";

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roleSet = new Set((roles ?? []).map((r) => r.role as string));
    const role = isSuperAdmin || roleSet.has("admin")
      ? "admin"
      : roleSet.has("planillero")
      ? "planillero"
      : roleSet.has("entrenador")
      ? "entrenador"
      : "user";

    // El super admin y los administradores pueden eliminar cualquier partido.
    // Los planilleros pueden eliminar partidos.
    // Los entrenadores pueden eliminar SUS partidos (donde son dueños).
    let allowed = role === "admin" || role === "planillero";

    if (!allowed && role === "entrenador") {
      const { data: row } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      
      const matches = (row?.data as any)?.matches ?? [];
      const hasMatchLocally = matches.some((m: any) => m.id === data.matchId);
      if (hasMatchLocally) {
        allowed = true;
      }
    }

    await supabase.from("match_deletion_audit").insert({
      user_id: userId,
      user_email: email,
      role,
      match_id: data.matchId,
      result: allowed ? "authorized" : "denied",
      reason: allowed ? null : "role_not_allowed",
    });

    if (!allowed) {
      throw new Error("No tienes permisos para eliminar partidos en vivo.");
    }

    // 1. Limpiar la copia pública del partido si existía.
    await supabase
      .from("public_matches")
      .delete()
      .eq("match_id", data.matchId);

    // 2. Eliminar de la nube (app_state) de TODOS los usuarios que puedan tenerlo.
    // Esto es necesario porque varios usuarios pueden "ver" el mismo partido si comparten liga.
    const { data: allStates } = await supabase
      .from("app_state")
      .select("user_id, data");

    if (allStates) {
      for (const row of allStates) {
        const d = row.data as any;
        if (d?.matches?.some((m: any) => m.id === data.matchId)) {
          const newMatches = d.matches.filter((m: any) => m.id !== data.matchId);
          await supabase
            .from("app_state")
            .update({ data: { ...d, matches: newMatches } })
            .eq("user_id", row.user_id);
        }
      }
    }

    return { ok: true };
  });
