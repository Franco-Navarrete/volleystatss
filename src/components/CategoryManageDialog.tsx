import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MoreVertical, User, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { teamsKey } from "@/hooks/use-cloud-teams";

const POS: Record<string, string> = { punta: "Punta", central: "Central", opuesto: "Opuesto", armador: "Armador", libero: "Líbero", universal: "Universal" };

type Row = {
  id: string; user_id: string; status: string; number: number | null; position: string | null;
  profile?: { first_name: string; last_name: string; photo_url: string | null };
};

export function useCategoryMembers(teamId: string, enabled = true) {
  return useQuery({
    queryKey: ["category-members", teamId],
    enabled,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, user_id, status, number, position")
        .eq("team_id", teamId)
        .in("status", ["pending", "active"]);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids)
        : { data: [] as { user_id: string; first_name: string; last_name: string; photo_url: string | null }[] };
      const byId = new Map((profs ?? []).map((p) => [p.user_id, p]));
      return (data ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) }));
    },
  });
}

export function CategoryManageDialog({ teamId, teamName, players, open, onOpenChange }: {
  teamId: string; teamName: string; open: boolean; onOpenChange: (o: boolean) => void;
  players: { id: string; name: string; number: number; position?: string; photoUrl?: string }[];
}) {
  const qc = useQueryClient();
  const members = useCategoryMembers(teamId, open);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["category-members", teamId] });
    qc.invalidateQueries({ queryKey: teamsKey });
  };
  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_team_membership", { _member_id: id, _approve: approve });
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.approve ? "Jugadora aceptada" : "Solicitud rechazada"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("remove_team_membership", { _member_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Quitada de la categoría"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const removePlayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Quitada de la categoría"); refresh(); },
    onError: () => toast.error("No se pudo quitar (puede tener partidos registrados)."),
  });

  const pending = (members.data ?? []).filter((m) => m.status === "pending");
  const memberByPlayerUser = new Map((members.data ?? []).filter((m) => m.status === "active").map((m) => [m.user_id, m.id]));
  // players no tiene user_id en el store: buscamos membresía por nombre+número como vínculo visual
  const activeMembers = (members.data ?? []).filter((m) => m.status === "active");
  const memberFor = (p: { name: string; number: number }) =>
    activeMembers.find((m) => m.number === p.number && m.profile && `${m.profile.first_name} ${m.profile.last_name}`.trim() === p.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{teamName}</DialogTitle></DialogHeader>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">Solicitudes pendientes <Badge variant="secondary">{pending.length}</Badge></h3>
          {members.isLoading && <Loader2 className="size-4 animate-spin" />}
          {!members.isLoading && pending.length === 0 && <p className="text-sm text-muted-foreground">No hay solicitudes.</p>}
          {pending.map((m) => (
            <div key={m.id} className="rounded-lg border border-border p-3 space-y-2">
              <Person photo={m.profile?.photo_url} name={`${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`}
                sub={[m.number != null ? `#${m.number}` : null, m.position ? POS[m.position] : null].filter(Boolean).join(" · ")} />
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: m.id, approve: true })}><Check className="size-4" /> Aceptar</Button>
                <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: m.id, approve: false })}><X className="size-4" /> Rechazar</Button>
              </div>
            </div>
          ))}
        </section>
        <section className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold">Jugadoras ({players.length})</h3>
          {players.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay jugadoras.</p>}
          {players.map((p) => {
            const mem = memberFor(p);
            return (
              <div key={p.id} className="rounded-lg border border-border p-3 flex items-center justify-between">
                <Person photo={p.photoUrl} name={p.name} sub={[`#${p.number}`, p.position ? POS[p.position] : null].filter(Boolean).join(" · ")} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Opciones"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive" onClick={() => {
                      if (!confirm(`¿Quitar a ${p.name} de ${teamName}? Su cuenta no se elimina.`)) return;
                      if (mem) removeMember.mutate(mem.id); else removePlayer.mutate(p.id);
                    }}>Quitar de la categoría</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          {memberByPlayerUser.size > 0 && null}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Person({ photo, name, sub }: { photo?: string | null; name: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      {photo ? <img src={photo} alt="" className="size-10 rounded-full object-cover" />
        : <div className="size-10 rounded-full bg-secondary flex items-center justify-center"><User className="size-5 text-muted-foreground" /></div>}
      <div className="min-w-0">
        <p className="font-medium truncate">{name.trim() || "Sin nombre"}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
