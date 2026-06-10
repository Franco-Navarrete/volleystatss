import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-auth";
import type { League, Match, Team } from "@/lib/volley-store";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administración · vstats" }] }),
  component: AdminPage,
});

type CloudData = { teams?: Team[]; matches?: Match[]; leagues?: League[] };

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  data: CloudData;
  isAdmin: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programado",
  live: "En vivo",
  finished: "Finalizado",
};

function AdminPage() {
  const { isAdmin, checking } = useIsAdmin();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const [profilesRes, stateRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, email, created_at"),
        supabase.from("app_state").select("user_id, data"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (cancelled) return;
      const states = new Map(
        (stateRes.data ?? []).map((s) => [s.user_id, (s.data ?? {}) as CloudData]),
      );
      const admins = new Set(
        (rolesRes.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
      );
      setRows(
        (profilesRes.data ?? []).map((p) => ({
          id: p.id,
          email: p.email,
          created_at: p.created_at,
          data: states.get(p.id) ?? {},
          isAdmin: admins.has(p.id),
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  if (checking) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Verificando permisos…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-16">
          <h1 className="text-lg font-semibold">Sin acceso</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Esta sección es solo para administradores.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="size-5 text-primary" />
        <h1 className="text-xl font-bold tracking-tight">Administración</h1>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            {rows.length} usuario{rows.length === 1 ? "" : "s"} registrado
            {rows.length === 1 ? "" : "s"}
          </div>
          {rows.map((row) => {
            const matches = row.data.matches ?? [];
            const teams = row.data.teams ?? [];
            const teamName = (id: string) =>
              teams.find((t) => t.id === id)?.name ?? "Equipo";
            const expanded = open === row.id;
            return (
              <div key={row.id} className="rounded-xl border border-border/60 bg-card/40">
                <button
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                  onClick={() => setOpen(expanded ? null : row.id)}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate flex items-center gap-2">
                      {row.email}
                      {row.isAdmin && (
                        <Badge variant="secondary" className="text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {matches.length} partido{matches.length === 1 ? "" : "s"} ·{" "}
                      {teams.length} equipo{teams.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {expanded ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {expanded && (
                  <div className="border-t border-border/60 px-4 py-3 space-y-2">
                    {matches.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin partidos guardados.</p>
                    ) : (
                      matches.map((m) => {
                        const setsA = m.sets.filter(
                          (s) => s.finished && s.scoreA > s.scoreB,
                        ).length;
                        const setsB = m.sets.filter(
                          (s) => s.finished && s.scoreB > s.scoreA,
                        ).length;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 text-sm rounded-lg bg-secondary/40 px-3 py-2"
                          >
                            <span className="truncate">
                              {teamName(m.teamAId)} vs {teamName(m.teamBId)}
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="font-semibold tabular-nums">
                                {setsA}-{setsB}
                              </span>
                              <Badge
                                variant={m.status === "live" ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {STATUS_LABEL[m.status] ?? m.status}
                              </Badge>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
