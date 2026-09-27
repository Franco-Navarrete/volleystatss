import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Clock, Image as ImageIcon, Loader2, LogOut, ShieldAlert, Volleyball } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { compressPhoto } from "@/lib/image-compress";
import { clearAppRoleCache } from "@/lib/app-role";

export const Route = createFileRoute("/_authenticated/jugadora")({
  validateSearch: (s: Record<string, unknown>): { denied?: 1 } => (s.denied ? { denied: 1 } : {}),
  head: () => ({
    meta: [
      { title: "Mi panel · RALLY" },
      { name: "description", content: "Tu perfil, tus equipos y el estado de tus solicitudes en RALLY." },
      { property: "og:title", content: "Mi panel de jugadora · RALLY" },
      { property: "og:description", content: "Tu perfil y tus equipos en RALLY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlayerPanel,
});

const POS: Record<string, string> = { punta: "Punta", central: "Central", opuesto: "Opuesto", armador: "Armador", libero: "Líbero", universal: "Universal" };
const GENDER: Record<string, string> = { F: "Femenino", M: "Masculino", X: "Mixto" };
export const categoryLabel = (cat?: string | null, g?: string | null) =>
  [cat ? (/^\d+$/.test(cat) ? `Sub ${cat}` : cat[0].toUpperCase() + cat.slice(1)) : null, g ? GENDER[g] ?? g : null].filter(Boolean).join(" ");

function PlayerPanel() {
  const { user } = Route.useRouteContext();
  const { denied } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (denied) toast.error("Acceso no autorizado"); }, [denied]);

  const profile = useQuery({
    queryKey: ["my-player-profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("player_profiles").select("first_name, last_name, photo_url").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });
  const teams = useQuery({
    queryKey: ["my-memberships", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_memberships");
      if (error) throw error;
      return data ?? [];
    },
  });

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear(); clearAppRoleCache();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const p = profile.data;
  const main = teams.data?.find((t) => t.status === "active") ?? teams.data?.[0];
  const name = p ? `${p.first_name} ${p.last_name}` : user.email ?? "";
  const initials = p ? `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase() : "?";
  const fields = [p?.first_name, p?.last_name, p?.photo_url, main?.number != null ? 1 : null, main?.position];
  const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 sticky top-0 z-40 backdrop-blur-xl">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-primary flex items-center justify-center"><Volleyball className="size-4 text-primary-foreground" /></div>
            <span className="font-bold text-sm">RALLY</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="size-4" /> Salir</Button>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6 space-y-5">
        {profile.isLoading || teams.isLoading ? <Loader2 className="size-6 animate-spin mx-auto" /> : <>
          <div>
            <h1 className="text-2xl font-black">Hola, {p?.first_name ?? "jugadora"} 👋</h1>
            {main && <p className="text-muted-foreground text-sm">{main.club_name ?? main.team_name} · {categoryLabel(main.team_category, main.team_gender)}</p>}
          </div>

          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mi perfil</h2>
            <div className="flex items-center gap-4">
              {p?.photo_url ? <img src={p.photo_url} alt="" className="size-16 rounded-full object-cover" />
                : <div className="size-16 rounded-full bg-secondary flex items-center justify-center text-lg font-bold">{initials}</div>}
              <div className="min-w-0">
                <p className="font-bold truncate">{name}</p>
                <p className="text-sm text-muted-foreground">{[main?.number != null ? `#${main.number}` : null, main?.position ? POS[main.position] : null].filter(Boolean).join(" · ") || "Sin número ni posición"}</p>
              </div>
            </div>
            {pct < 100 && (
              <div className="rounded-lg bg-secondary/60 p-3 space-y-2">
                <p className="text-sm font-medium">Tu perfil está casi completo · {pct}%</p>
                <div className="h-1.5 rounded-full bg-background overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                {!p?.photo_url && <p className="text-xs text-muted-foreground">Agregá una foto de perfil (opcional).</p>}
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>Editar perfil</Button>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{(teams.data?.length ?? 0) > 1 ? "Mis equipos" : "Mi equipo"}</h2>
            {teams.data?.length === 0 && <p className="text-sm text-muted-foreground">Todavía no pertenecés a ningún equipo. Pedile a tu entrenador/a un enlace de invitación.</p>}
            {teams.data?.map((t) => (
              <div key={t.member_id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                {t.team_logo_url ? <img src={t.team_logo_url} alt="" className="size-10 rounded-full object-cover" /> : <div className="size-10 rounded-full bg-secondary flex items-center justify-center">🏐</div>}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{t.club_name ?? t.team_name}</p>
                  <p className="text-sm text-muted-foreground">{categoryLabel(t.team_category, t.team_gender) || t.team_name}</p>
                  {t.status === "pending" && <p className="text-xs text-muted-foreground mt-1">Tu solicitud está pendiente de aprobación.</p>}
                </div>
                {t.status === "active"
                  ? <span className="text-xs font-semibold text-success">● Activa</span>
                  : <span className="text-xs font-semibold text-warning flex items-center gap-1"><Clock className="size-3" /> Pendiente</span>}
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground flex gap-2">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" /> Pronto vas a ver acá tus partidos y estadísticas.
          </section>
        </>}
      </main>
      <EditProfileDialog open={editing} onOpenChange={setEditing} userId={user.id} initial={p ?? null}
        onSaved={() => qc.invalidateQueries({ queryKey: ["my-player-profile", user.id] })} />
    </div>
  );
}

function EditProfileDialog({ open, onOpenChange, userId, initial, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; userId: string; onSaved: () => void;
  initial: { first_name: string; last_name: string; photo_url: string | null } | null;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setFirst(initial?.first_name ?? ""); setLast(initial?.last_name ?? ""); setPhoto(initial?.photo_url ?? null); } }, [open]);
  const onPhoto = async (f?: File) => { if (f) try { setPhoto(await compressPhoto(f)); } catch (e) { toast.error((e as Error).message); } };
  const save = async () => {
    if (!first.trim() || !last.trim()) return toast.error("Completá nombre y apellido.");
    setBusy(true);
    const { error } = await supabase.from("player_profiles").upsert({ user_id: userId, first_name: first.trim().slice(0, 60), last_name: last.trim().slice(0, 60), photo_url: photo });
    setBusy(false);
    if (error) return toast.error("No se pudo guardar.");
    toast.success("Perfil actualizado"); onSaved(); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-2">
            {photo ? <img src={photo} alt="" className="size-20 rounded-full object-cover" /> : <div className="size-20 rounded-full bg-secondary" />}
            <div className="flex flex-wrap justify-center gap-2">
              <label className="md:hidden inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm cursor-pointer"><Camera className="size-4" /> Tomar foto
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} /></label>
              <label className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm cursor-pointer"><ImageIcon className="size-4" /><span className="md:hidden">Elegir de galería</span><span className="hidden md:inline">Subir foto</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} /></label>
              {photo && <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>Quitar</Button>}
            </div>
          </div>
          <div className="space-y-1"><Label>Nombre</Label><Input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={60} /></div>
          <div className="space-y-1"><Label>Apellido</Label><Input value={last} onChange={(e) => setLast(e.target.value)} maxLength={60} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
