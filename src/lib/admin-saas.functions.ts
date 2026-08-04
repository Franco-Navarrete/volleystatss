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

    // Obtenemos datos base
    const [
      { data: clubs }, 
      { data: leagues }, 
      { data: teams },
      { data: profiles },
      { data: leagueAccess }
    ] = await Promise.all([
      supabaseAdmin.from("clubs").select("*"),
      supabaseAdmin.from("leagues").select("*"),
      supabaseAdmin.from("teams").select("id, club_id, owner_id"),
      supabaseAdmin.from("profiles").select("id, email"),
      supabaseAdmin.from("user_league_access").select("user_id, league_id")
    ]);

    // Mapeo de perfiles para búsqueda rápida
    const profileMap = new Map(profiles?.map(p => [p.id, p.email]));

    // Relación usuarios por club
    // 1. Dueño del club (owner_id en clubs)
    // 2. Dueños de equipos del club (owner_id en teams)
    const usersByClub = new Map<string, Set<string>>();
    
    clubs?.forEach(c => {
      const set = new Set<string>();
      const ownerEmail = profileMap.get(c.owner_id);
      if (ownerEmail) set.add(ownerEmail);
      usersByClub.set(c.id, set);
    });

    teams?.forEach(t => {
      if (t.club_id && t.owner_id) {
        const ownerEmail = profileMap.get(t.owner_id);
        if (ownerEmail) {
          const set = usersByClub.get(t.club_id) || new Set<string>();
          set.add(ownerEmail);
          usersByClub.set(t.club_id, set);
        }
      }
    });

    // Mapeo de usuarios por liga (basado en acceso directo)
    const usersByLeague = new Map<string, Set<string>>();
    leagueAccess?.forEach(la => {
      const email = profileMap.get(la.user_id);
      if (email) {
        const set = usersByLeague.get(la.league_id) ?? new Set<string>();
        set.add(email);
        usersByLeague.set(la.league_id, set);
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
          userCount: profiles?.length || 0,
          users: profiles?.map(p => p.email),
          children: (leagues ?? []).map(l => ({
            id: l.id,
            name: l.name,
            type: "liga",
            status: "active",
            userCount: usersByLeague.get(l.id)?.size || 0,
            users: Array.from(usersByLeague.get(l.id) || []),
            children: (clubs ?? []).map(c => ({
              id: c.id,
              name: c.name,
              type: "club",
              status: "active",
              userCount: usersByClub.get(c.id)?.size || 0,
              users: Array.from(usersByClub.get(c.id) || [])
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
