import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

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
  const [copied, setCopied] = useState(false);
  const queryKey = ["team-registration-link", teamId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_registration_links")
        .select("token, short_code, active, updated_at")
        .eq("team_id", teamId)
        .maybeSingle();
      if (error) throw error;
      return data ? { token: data.token, shortCode: data.short_code, active: data.active, updatedAt: data.updated_at } : null;
    },
    enabled: open,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const renew = useMutation({
    mutationFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
      const shortCode = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
      const { error } = await supabase.from("player_registration_links").upsert({
        team_id: teamId,
        token: crypto.randomUUID(),
        short_code: shortCode,
        active: true,
        created_by: authData.user.id,
      }, { onConflict: "team_id" });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: async (active: boolean) => {
      const { error } = await supabase
        .from("player_registration_links")
        .update({ active })
        .eq("team_id", teamId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const url = useMemo(() => {
    if (!query.data?.shortCode || typeof window === "undefined") return "";
    return `${window.location.origin}/sumate/${query.data.shortCode}`;
  }, [query.data?.shortCode]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="size-5 text-primary" /> Inscripción de jugadores</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><p className="font-semibold">{teamName}</p><p className="text-sm text-muted-foreground">Compartí este enlace para que los jugadores se sumen directamente al plantel, sin registrarse ni iniciar sesión.</p></div>
          {query.isLoading ? (
            <div className="h-24 flex items-center justify-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : query.data ? (
            <>
              <div className="flex gap-2"><Input value={url} readOnly className="font-mono text-xs" /><Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copiar enlace" title="Copiar enlace">{copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}</Button></div>
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-3">
                <div><p className="text-sm font-medium">{query.data.active ? "Enlace activo" : "Enlace desactivado"}</p><p className="text-xs text-muted-foreground">{query.data.active ? "Acepta nuevas inscripciones." : "Nadie puede usarlo actualmente."}</p></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => toggle.mutate(!query.data?.active)} disabled={toggle.isPending} aria-label={query.data.active ? "Desactivar enlace" : "Activar enlace"}>{query.data.active ? <ToggleRight className="size-7 text-success" /> : <ToggleLeft className="size-7 text-muted-foreground" />}</Button>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => renew.mutate()} disabled={renew.isPending}>{renew.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Renovar enlace</Button>
              <p className="text-xs text-muted-foreground">Al renovarlo, el enlace anterior deja de funcionar inmediatamente.</p>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border p-5 text-center"><p className="text-sm text-muted-foreground mb-3">Todavía no hay un enlace para este equipo.</p><Button type="button" onClick={() => renew.mutate()} disabled={renew.isPending}>{renew.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Generar enlace</Button></div>
          )}
          {(query.error || renew.error || toggle.error) ? <p className="text-sm text-destructive">{(query.error ?? renew.error ?? toggle.error)?.message}</p> : null}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}