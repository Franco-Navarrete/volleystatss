import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const uuidSchema = z.string().uuid();
type AuthCtx = { supabase: SupabaseClient<Database>; userId: string };

async function assertAdmin(ctx: AuthCtx) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acceso denegado: Se requieren permisos de administración global.");
}

/**
 * Obtiene la jerarquía completa de organizaciones.
 * En la implementación final, esto consultará la tabla 'workspaces' con parent_id.
 */
export const adminListWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Por ahora, simulamos la respuesta basada en clubes y ligas existentes
    // hasta que la migración de la tabla 'workspaces' esté ejecutada.
    const [{ data: clubs }, { data: leagues }, { data: users }, { data: userRoles }] = await Promise.all([
      supabaseAdmin.from("clubs").select("*"),
      supabaseAdmin.from("leagues").select("*"),
      supabaseAdmin.from("profiles").select("id, email"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    // Relación usuarios por club (owner)
    const usersByClub = new Map<string, string[]>();
    clubs?.forEach(c => {
      if (c.owner_id) {
        const email = users?.find(u => u.id === c.owner_id)?.email || "Usuario Desconocido";
        usersByClub.set(c.id, [email]);
      }
    });

    // Simulamos jerarquía con conteos reales
    return {
      workspaces: [
        {
          id: "root-feva",
          name: "Federación del Voleibol Argentino",
          type: "federacion",
          status: "active",
          userCount: users?.length || 0,
          users: users?.map(u => u.email),
          children: (leagues ?? []).map(l => ({
            id: l.id,
            name: l.name,
            type: "liga",
            status: "active",
            userCount: 0, // En el futuro se calcularía por membresía
            users: [],
            children: (clubs ?? []).map(c => ({
              id: c.id,
              name: c.name,
              type: "club",
              status: "active",
              userCount: usersByClub.get(c.id)?.length || 0,
              users: usersByClub.get(c.id) || []
            }))
          }))
        }
      ]
    };
  });

/**
 * Gestión de Módulos por Workspace/Plan
 */
export const adminUpdateWorkspaceModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    workspaceId: uuidSchema,
    modules: z.array(z.string()),
    plan: z.string()
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Lógica para actualizar suscripción y módulos habilitados
    return { success: true };
  });

/**
 * Catálogo centralizado de permisos
 */
export const adminListPermissionsCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return [
      { id: 'view_stats', name: 'Ver Estadísticas', category: 'Analítica' },
      { id: 'create_match', name: 'Crear Partidos', category: 'Operaciones' },
      { id: 'manage_video', name: 'Gestionar Video', category: 'Video' },
      { id: 'ai_reports', name: 'Generar Informes IA', category: 'Intelligence' },
      { id: 'admin_users', name: 'Administrar Usuarios', category: 'Administración' },
    ];
  });
