import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Volleyball, XCircle } from "lucide-react";
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
      const { data, error } = await supabase.rpc("get_team_invitation", { _token: code });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const [state, setState] = useState<"idle" | "busy" | "joined" | "already">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [position, setPosition] = useState("");
  const [birth, setBirth] = useState("");
  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy"); setErr(null);
    const { data, error } = await supabase.rpc("join_team_as_player", {
      _token: code, _name: name, _number: Number(number), _position: position, _birth_date: birth,
    });
    if (error) { setErr(error.message); setState("idle"); return; }
    setState(data === "already_member" ? "already" : "joined");
  };

  const inv = invite.data;
  const sub = inv ? [inv.team_gender, inv.team_category].filter(Boolean).join(" · ") : "";

  let body: React.ReactNode;
  if (!ready || invite.isLoading) body = <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />;
  else if (state === "joined") body = <Msg ok title="¡Listo! Ya sos parte del equipo." action />;
  else if (state === "already" || (inv && inv.has_player)) body = <Msg ok title="Ya pertenecés a este equipo." action />;
  else if (!inv || !inv.valid) body = <Msg title="Esta invitación ya no es válida." />;
  else if (!session) body = <><TeamCard inv={inv} sub={sub} /><AuthForm /></>;
  else body = (
    <form onSubmit={accept} className="space-y-4">
      <TeamCard inv={inv} sub={sub} />
      <p className="text-xs text-center text-muted-foreground">Sesión iniciada como {session.user.email}</p>
      <div className="space-y-1"><Label>Nombre y apellido</Label><Input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>N° camiseta</Label><Input required type="number" min={0} max={99} value={number} onChange={(e) => setNumber(e.target.value)} /></div>
        <div className="space-y-1"><Label>Nacimiento</Label><Input required type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></div>
      </div>
      <div className="space-y-1">
        <Label>Posición</Label>
        <select required value={position} onChange={(e) => setPosition(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="" disabled>Elegí tu posición</option>
          {[["punta","Punta"],["central","Central"],["opuesto","Opuesto"],["armador","Armador"],["libero","Líbero"],["universal","Universal"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {err && <p className="text-sm text-destructive text-center">{err}</p>}
      <Button type="submit" className="w-full" disabled={state === "busy"}>
        {state === "busy" && <Loader2 className="size-4 animate-spin" />} Aceptar invitación
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

function TeamCard({ inv, sub }: { inv: { team_name: string; team_logo_url: string | null }; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 text-center space-y-2">
      <p className="text-sm text-muted-foreground">Te invitaron a unirte a:</p>
      {inv.team_logo_url && <img src={inv.team_logo_url} alt="" className="size-14 rounded-full object-cover mx-auto" />}
      <p className="text-xl font-bold">{inv.team_name}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Msg({ title, ok, action }: { title: string; ok?: boolean; action?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
      {ok ? <CheckCircle2 className="size-10 mx-auto text-success" /> : <XCircle className="size-10 mx-auto text-destructive" />}
      <p className="font-semibold">{title}</p>
      {action && <Button asChild className="w-full"><Link to="/dashboard">Ir a la app</Link></Button>}
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
