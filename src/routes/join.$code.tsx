import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle2, Image as ImageIcon, Loader2, User, Volleyball, XCircle } from "lucide-react";
import { compressPhoto } from "@/lib/image-compress";
import { clearAppRoleCache } from "@/lib/app-role";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/join/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Invitación a equipo · RALLY" },
      { name: "description", content: "Sumate a tu equipo de vóley en RALLY." },
      { property: "og:title", content: "Te invitaron a un equipo · RALLY" },
      { property: "og:description", content: "Creá tu cuenta o iniciá sesión para unirte a tu equipo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const invite = useQuery({
    queryKey: ["join-invite", code, session?.user.id ?? "anon"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_invitation_v2", { _token: code });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const inv = invite.data;
  const linkedPlayer = useQuery({
    queryKey: ["join-invite-player", code],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_invitation_player", { _token: code });
      return data?.[0] ?? null;
    },
  });
  const [state, setState] = useState<"idle" | "busy" | "sent" | "already" | "linked">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    if (inv?.has_profile) { setFirst(inv.first_name ?? ""); setLast(inv.last_name ?? ""); setPhoto(inv.photo_url ?? null); }
  }, [inv?.has_profile]);
  useEffect(() => {
    const lp = linkedPlayer.data;
    if (!lp || inv?.has_profile) return;
    const [f, ...rest] = (lp.player_name ?? "").trim().split(/\s+/);
    setFirst((v) => v || f || ""); setLast((v) => v || rest.join(" "));
    if (lp.player_number != null) setNumber(String(lp.player_number));
    if (lp.player_position) setPosition(lp.player_position);
  }, [linkedPlayer.data, inv?.has_profile]);

  const onPhoto = async (f?: File) => {
    if (!f) return;
    try { setPhoto(await compressPhoto(f)); setErr(null); } catch (e) { setErr((e as Error).message); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy"); setErr(null);
    const { data, error } = await supabase.rpc("request_team_membership", {
      _token: code, _first: first, _last: last,
      _number: number === "" ? (null as unknown as number) : Number(number),
      _position: (position || null) as unknown as string,
      _photo: (photo?.startsWith("data:") ? photo : null) as unknown as string,
    });
    if (error) { setErr(error.message); setState("idle"); return; }
    clearAppRoleCache();
    setState(data === "linked" ? "linked" : data === "already_member" ? "already" : "sent");
  };

  const sub = inv ? [inv.team_gender === "F" ? "Femenino" : inv.team_gender === "M" ? "Masculino" : inv.team_gender === "X" ? "Mixto" : null,
    inv.team_category ? (/^\d+$/.test(inv.team_category) ? `Sub ${inv.team_category}` : inv.team_category) : null].filter(Boolean).join(" · ") : "";

  let body: React.ReactNode;
  if (!ready || invite.isLoading) body = <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />;
  else if (!inv || inv.invite_state === "revoked") body = <Msg title="Esta invitación ya no es válida." />;
  else if (state === "linked") body = <Msg ok title={`¡Listo${first ? `, ${first}` : ""}! 🏐`} text="Tu cuenta quedó vinculada a tu ficha de jugadora. Tus partidos y estadísticas anteriores ya están en tu panel." action />;
  else if (state === "already" || inv.member_status === "active") body = <Msg ok title="Ya pertenecés a este equipo." action />;
  else if (state === "sent" || inv.member_status === "pending") body = <Msg ok title={`¡Bienvenida${first ? `, ${first}` : ""}! 👋`} text={`Tu solicitud para unirte a ${inv.club_name ? inv.club_name + " · " : ""}${sub || inv.team_name} fue enviada a tu entrenador/a y está pendiente de aprobación.`} action />;
  else if (inv.invite_state === "expired") body = <Msg title="Esta invitación ha expirado." />;
  else if (!session) body = <><TeamCard inv={inv} sub={sub} /><AuthForm /></>;
  else body = (
    <form onSubmit={submit} className="space-y-4">
      <TeamCard inv={inv} sub={sub} />
      <p className="text-xs text-center text-muted-foreground">Sesión iniciada como {session.user.email}</p>
      <div className="flex flex-col items-center gap-2">
        {photo ? <img src={photo} alt="Tu foto" className="size-24 rounded-full object-cover border border-border" />
          : <div className="size-24 rounded-full bg-secondary flex items-center justify-center"><User className="size-10 text-muted-foreground" /></div>}
        <div className="flex flex-wrap justify-center gap-2">
          <label className="md:hidden inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm cursor-pointer">
            <Camera className="size-4" /> Tomar foto
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm cursor-pointer">
            <ImageIcon className="size-4" /> <span className="md:hidden">Elegir de galería</span><span className="hidden md:inline">Subir foto</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">Foto de perfil (opcional) · podés continuar sin foto</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Nombre *</Label><Input required maxLength={60} value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" /></div>
        <div className="space-y-1"><Label>Apellido *</Label><Input required maxLength={60} value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>N° camiseta</Label><Input type="number" inputMode="numeric" min={0} max={99} value={number} onChange={(e) => setNumber(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Posición</Label>
          <select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">—</option>
            {[["punta","Punta"],["central","Central"],["opuesto","Opuesto"],["armador","Armador"],["libero","Líbero"],["universal","Universal"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {err && <p className="text-sm text-destructive text-center">{err}</p>}
      <Button type="submit" className="w-full" disabled={state === "busy"}>
        {state === "busy" && <Loader2 className="size-4 animate-spin" />} {photo ? "Unirme" : "Continuar sin foto y unirme"}
      </Button>
      <button type="button" className="text-xs text-muted-foreground underline w-full" onClick={() => supabase.auth.signOut()}>Usar otra cuenta</button>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center">
          <div className="size-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-2">
            <Volleyball className="size-6 text-primary-foreground" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">RALLY</h1>
        </div>
        {body}
      </div>
    </div>
  );
}

function TeamCard({ inv, sub }: { inv: { team_name: string; team_logo_url: string | null; club_name: string | null }; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-center space-y-2">
      <p className="text-sm text-muted-foreground">Te invitaron a unirte</p>
      {inv.club_name && <p className="text-xs uppercase tracking-wider text-muted-foreground">{inv.club_name}</p>}
      {inv.team_logo_url && <img src={inv.team_logo_url} alt="" className="size-14 rounded-full object-cover mx-auto" />}
      <p className="text-xl font-bold">{inv.team_name}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Msg({ title, text, ok, action }: { title: string; text?: string; ok?: boolean; action?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
      {ok ? <CheckCircle2 className="size-10 mx-auto text-success" /> : <XCircle className="size-10 mx-auto text-destructive" />}
      <p className="font-semibold">{title}</p>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
      {action && <Button asChild className="w-full"><Link to="/player/dashboard">Continuar</Link></Button>}
    </div>
  );
}

function AuthForm() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: window.location.href },
      });
      if (error) setErr(error.message.includes("registered") ? "Ese email ya tiene cuenta. Iniciá sesión." : error.message);
      else if (!data.session) setMsg("Te enviamos un email para confirmar tu cuenta. Abrilo y volverás a esta invitación.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setErr("Email o contraseña incorrectos.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 text-sm">
        {(["signup", "signin"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`rounded-md py-1.5 ${mode === m ? "bg-background font-semibold" : "text-muted-foreground"}`}>
            {m === "signup" ? "Crear cuenta" : "Ya tengo cuenta"}
          </button>
        ))}
      </div>
      <div className="space-y-1.5"><Label htmlFor="je">Email</Label><Input id="je" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="jp">Contraseña</Label><Input id="jp" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm text-success">{msg}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} {mode === "signup" ? "Crear cuenta y continuar" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
