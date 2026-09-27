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
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getMyCareer } from "@/lib/player-career.functions";
import { CareerView } from "@/components/player/CareerView";
import { publicAppOrigin } from "@/lib/app-url";
import { clearAppRoleCache } from "@/lib/app-role";

export const Route = createFileRoute("/_authenticated/player/dashboard")({
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
      const { data } = await supabase.from("player_profiles").select("first_name, last_name, photo_url, alias, visibility, bio, height_cm, dominant_hand, birth_date, show_stats, show_club").eq("user_id", user.id).maybeSingle();
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

  const careerFn = useServerFn(getMyCareer);
  const career = useQuery({ queryKey: ["my-career", user.id], queryFn: () => careerFn(), staleTime: 60_000 });
  const [sharing, setSharing] = useState(false);

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

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mi carrera</h2>
              <Button size="sm" variant="outline" onClick={() => setSharing(true)}>Compartir perfil</Button>
            </div>
            {career.isLoading ? <Loader2 className="size-5 animate-spin" />
              : career.isError ? <p className="text-sm text-muted-foreground flex gap-2"><ShieldAlert className="size-4" /> No se pudieron cargar tus estadísticas.</p>
              : career.data && <CareerView career={career.data} />}
          </section>
        </>}
      </main>
      <EditProfileDialog open={editing} onOpenChange={setEditing} userId={user.id} initial={p ?? null}
        onSaved={() => qc.invalidateQueries({ queryKey: ["my-player-profile", user.id] })} />
      <ShareDialog open={sharing} onOpenChange={setSharing} profile={p ?? null} onEdit={() => { setSharing(false); setEditing(true); }} />
    </div>
  );
}

function EditProfileDialog({ open, onOpenChange, userId, initial, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; userId: string; onSaved: () => void;
  initial: Profile | null;
}) {
  const [alias, setAlias] = useState("");
  const [bio, setBio] = useState("");
  const [height, setHeight] = useState("");
  const [hand, setHand] = useState("");
  const [birth, setBirth] = useState("");
  const [pub, setPub] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showClub, setShowClub] = useState(true);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setFirst(initial?.first_name ?? ""); setLast(initial?.last_name ?? ""); setPhoto(initial?.photo_url ?? null);
    setAlias(initial?.alias ?? ""); setBio(initial?.bio ?? ""); setHeight(initial?.height_cm ? String(initial.height_cm) : ""); setHand(initial?.dominant_hand ?? "");
    setBirth(initial?.birth_date ?? ""); setPub(initial?.visibility === "public"); setShowStats(initial?.show_stats ?? true); setShowClub(initial?.show_club ?? true); } }, [open]);
  const onPhoto = async (f?: File) => { if (f) try { setPhoto(await compressPhoto(f)); } catch (e) { toast.error((e as Error).message); } };
  const save = async () => {
    if (!first.trim() || !last.trim()) return toast.error("Completá nombre y apellido.");
    const a = alias.trim().toLowerCase();
    if (a && !/^[a-z0-9-]{3,40}$/.test(a)) return toast.error("El alias usa solo letras minúsculas, números y guiones (3 a 40).");
    if (pub && !a) return toast.error("Elegí un alias para tu perfil público.");
    const h = height ? Number(height) : null;
    if (h != null && (h < 100 || h > 250)) return toast.error("Altura entre 100 y 250 cm.");
    setBusy(true);
    const { error } = await supabase.from("player_profiles").upsert({
      user_id: userId, first_name: first.trim().slice(0, 60), last_name: last.trim().slice(0, 60), photo_url: photo,
      alias: a || null, bio: bio.trim().slice(0, 280) || null, height_cm: h, dominant_hand: hand || null, birth_date: birth || null,
      visibility: pub ? "public" : "private", show_stats: showStats, show_club: showClub,
    });
    setBusy(false);
    if (error) return toast.error(error.code === "23505" ? "Ese alias ya está en uso." : "No se pudo guardar.");
    toast.success("Perfil actualizado"); onSaved(); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Altura (cm)</Label><Input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} /></div>
            <div className="space-y-1"><Label>Mano hábil</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={hand} onChange={(e) => setHand(e.target.value)}>
                <option value="">—</option><option value="derecha">Derecha</option><option value="izquierda">Izquierda</option><option value="ambas">Ambas</option>
              </select></div>
          </div>
          <div className="space-y-1"><Label>Fecha de nacimiento</Label><Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Nunca se muestra en tu perfil público.</p></div>
          <div className="space-y-1"><Label>Sobre mí</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={2} /></div>
          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-semibold">Privacidad</p>
            <label className="flex items-center justify-between gap-2 text-sm">Perfil público<Switch checked={pub} onCheckedChange={setPub} /></label>
            {pub && <>
              <div className="space-y-1"><Label>Alias (tu enlace)</Label><Input value={alias} onChange={(e) => setAlias(e.target.value.toLowerCase())} placeholder="sofia-perez" maxLength={40} /></div>
              <label className="flex items-center justify-between gap-2 text-sm">Mostrar estadísticas<Switch checked={showStats} onCheckedChange={setShowStats} /></label>
              <label className="flex items-center justify-between gap-2 text-sm">Mostrar club<Switch checked={showClub} onCheckedChange={setShowClub} /></label>
            </>}
            {!pub && <p className="text-[11px] text-muted-foreground">Tu perfil es privado: solo lo ves vos y tu club.</p>}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Profile = {
  first_name: string; last_name: string; photo_url: string | null; alias: string | null; visibility: string; bio: string | null;
  height_cm: number | null; dominant_hand: string | null; birth_date: string | null; show_stats: boolean; show_club: boolean;
};

function ShareDialog({ open, onOpenChange, profile, onEdit }: { open: boolean; onOpenChange: (o: boolean) => void; profile: Profile | null; onEdit: () => void }) {
  const isPublic = profile?.visibility === "public" && !!profile.alias;
  const url = isPublic ? `${publicAppOrigin()}/player/${profile!.alias}` : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Compartir mi perfil</DialogTitle></DialogHeader>
        {!isPublic ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Tu perfil es privado. Para compartirlo, activá "Perfil público" y elegí un alias.</p>
            <Button className="w-full" onClick={onEdit}>Configurar privacidad</Button>
          </div>
        ) : (
          <div className="space-y-3 flex flex-col items-center">
            <div className="rounded-xl bg-card border border-border p-4 w-full flex flex-col items-center gap-2">
              {profile!.photo_url && <img src={profile!.photo_url} alt="" className="size-16 rounded-full object-cover" />}
              <p className="font-black">{profile!.first_name} {profile!.last_name}</p>
              <div className="rounded-lg bg-foreground p-2"><QRCodeSVG value={url} size={148} bgColor="transparent" fgColor="currentColor" className="text-background" /></div>
              <p className="text-[11px] text-muted-foreground break-all text-center">{url}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(url); toast.success("Enlace copiado"); }}>Copiar enlace</Button>
              <Button asChild><a href={`https://wa.me/?text=${encodeURIComponent(`Mirá mi perfil deportivo en RALLY: ${url}`)}`} target="_blank" rel="noreferrer">WhatsApp</a></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
