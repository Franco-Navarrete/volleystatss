import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, RefreshCw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { publicAppOrigin } from "@/lib/app-url";

type Invitation = { id: string; token: string; status: string; expires_at: string; used_at: string | null };

export function TeamRegistrationLinkDialog({
  teamId,
  teamName,
  open,
  onOpenChange,
}: {
  teamId: string;
  teamName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);
  const queryKey = ["team-invitations", teamId];
  const query = useQuery({
    queryKey,
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invitations")
        .select("id, token, status, expires_at, used_at")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Invitation[];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const { error } = await supabase.from("team_invitations").insert({ team_id: teamId, created_by: auth.user.id });
      if (error) throw new Error("No se pudo generar la invitación.");
    },
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_invitations").update({ status: "revoked" }).eq("id", id);
      if (error) throw new Error("No se pudo revocar la invitación.");
    },
    onSuccess: refresh,
  });
  const regenerate = useMutation({
    mutationFn: async (id: string) => {
      await revoke.mutateAsync(id);
      await create.mutateAsync();
    },
  });

  const linkFor = (token: string) => `${publicAppOrigin()}/join/${token}`;
  const copy = async (token: string) => {
    await navigator.clipboard.writeText(linkFor(token));
    setCopied(token);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const now = Date.now();
  const rows = (query.data ?? []).map((i) => ({
    ...i,
    label: i.status === "used" ? "Usada" : i.status === "revoked" ? "Revocada" : new Date(i.expires_at).getTime() <= now ? "Vencida" : "Activa",
  }));
  const active = rows.filter((r) => r.label === "Activa");
  const past = rows.filter((r) => r.label !== "Activa").slice(0, 6);
  const err = query.error ?? create.error ?? revoke.error ?? regenerate.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="size-5 text-primary" /> Invitar jugadores</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="font-semibold">{teamName}</p>
            <p className="text-sm text-muted-foreground">Cada invitación es para una persona: la abre, crea su cuenta o inicia sesión y acepta. Vence a los 7 días.</p>
          </div>
          {query.isLoading ? (
            <div className="h-20 flex items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {active.map((inv) => (
                <div key={inv.id} className="rounded-md border border-border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Input value={linkFor(inv.token)} readOnly className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={() => copy(inv.token)} aria-label="Copiar enlace">
                      {copied === inv.token ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Vence {new Date(inv.expires_at).toLocaleDateString("es-AR")}</span>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => regenerate.mutate(inv.id)} disabled={regenerate.isPending}><RefreshCw className="size-3.5" /> Regenerar</Button>
                      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => revoke.mutate(inv.id)} disabled={revoke.isPending}><Ban className="size-3.5" /> Revocar</Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Generar invitación
              </Button>
              {past.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Anteriores</p>
                  {past.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs text-muted-foreground py-0.5">
                      <span className="font-mono">{p.token}</span><span>{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {err ? <p className="text-sm text-destructive">{err.message}</p> : null}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
