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

    const allowed = role === "admin" || role === "planillero";

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

    // Limpiar la copia pública del partido si existía (owner-scoped).
    await supabase
      .from("public_matches")
      .delete()
      .eq("owner_id", userId)
      .eq("match_id", data.matchId);

    return { ok: true };
  });
