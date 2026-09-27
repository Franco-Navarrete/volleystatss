import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Copy, Link2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CareerView } from "@/components/player/CareerView";
import { getPlayerProfileForStaff } from "@/lib/player-career.functions";
import { supabase } from "@/integrations/supabase/client";
import { publicAppOrigin } from "@/lib/app-url";

export const Route = createFileRoute("/_authenticated/players/$playerId")({
  head: () => ({
    meta: [
      { title: "Perfil de jugadora — RALLY" },
      { name: "description", content: "Perfil deportivo, estadísticas e historial de la jugadora." },
      { property: "og:title", content: "Perfil de jugadora — RALLY" },
      { property: "og:description", content: "Perfil deportivo, estadísticas e historial de la jugadora." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlayerStaffProfile,
});

const POS: Record<string, string> = { punta: "Punta", central: "Central", opuesto: "Opuesto", armador: "Armadora", libero: "Líbero", universal: "Universal" };
const STATUS = { linked: "🟢 Cuenta vinculada", invited: "🔵 Invitación enviada", none: "🟡 Sin cuenta" } as const;
const PAGE = 10;
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

function PlayerStaffProfile() {
  const { playerId } = Route.useParams();
  const router = useRouter();
  const fetchProfile = useServerFn(getPlayerProfileForStaff);
  const qc = useQueryClient();
  const [shown, setShown] = useState(PAGE);
  const { data: p, isLoading, error } = useQuery({ queryKey: ["staff-player", playerId], queryFn: () => fetchProfile({ data: { playerId } }) });

  const copy = async (token: string) => {
    const url = `${publicAppOrigin()}/join/${token}`;
    try { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); } catch { prompt("Copiá el enlace:", url); }
  };
  const invite = useMutation({
    mutationFn: async (renew: boolean) => {
      if (!p) return;
      if (renew && p.inviteToken) await supabase.from("team_invitations").update({ status: "revoked" }).eq("token", p.inviteToken);
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("team_invitations")
        .insert({ team_id: p.teamId, created_by: auth.user!.id, player_id: p.id, multi_use: false }).select("token").single();
      if (error) throw error;
      await copy(data.token);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-player", playerId] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const revoke = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_invitations").update({ status: "revoked" }).eq("token", p!.inviteToken!);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invitación revocada"); qc.invalidateQueries({ queryKey: ["staff-player", playerId] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) return <div className="p-10 flex justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (error || !p) return <div className="p-6 text-sm text-destructive">{(error as Error)?.message ?? "No se pudo cargar la jugadora."}</div>;

  const c = p.career;
  const t = c.totals;
  const perfs = c.performances;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.history.back()}><ArrowLeft className="size-4" /> Volver</Button>

      <header className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row gap-5 sm:items-center">
        {p.photoUrl
          ? <img src={p.photoUrl} alt="" className="size-24 rounded-2xl object-cover" />
          : <div className="size-24 rounded-2xl bg-secondary flex items-center justify-center text-3xl font-black">{p.name[0]?.toUpperCase()}</div>}
        <div className="flex-1 min-w-0 space-y-1">
          <h1 className="text-3xl font-black tracking-tight truncate">{p.name}</h1>
          <p className="text-sm text-muted-foreground">#{p.number}{p.position ? ` · ${POS[p.position] ?? p.position}` : ""}</p>
          <p className="text-sm">{[p.club, p.teamName, [p.category, p.gender].filter(Boolean).join(" · "), p.season && `Temporada ${p.season}`].filter(Boolean).join(" — ")}</p>
          <Badge variant="secondary" className="mt-1">{STATUS[p.status]}</Badge>
        </div>
        <div className="flex flex-col gap-2 sm:w-52">
          {p.status === "none" && <Button onClick={() => invite.mutate(false)} disabled={invite.isPending}><Link2 className="size-4" /> Invitar jugadora</Button>}
          {p.status === "invited" && p.inviteToken && <>
            <Button variant="secondary" onClick={() => copy(p.inviteToken!)}><Copy className="size-4" /> Copiar enlace</Button>
            <Button variant="outline" onClick={() => invite.mutate(true)} disabled={invite.isPending}><RefreshCw className="size-4" /> Reenviar (nuevo enlace)</Button>
            <Button variant="ghost" onClick={() => revoke.mutate()} disabled={revoke.isPending}><XCircle className="size-4" /> Revocar</Button>
          </>}
          {p.publicAlias && <Button variant="outline" asChild><Link to="/player/$alias" params={{ alias: p.publicAlias }}>Ver perfil público</Link></Button>}
        </div>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ["Partidos", c.matchesPlayed], ["Puntos", t.points], ["Ataques (punto)", t.attack], ["Aces", t.ace],
          ["Bloqueos", t.block], ["Recepciones", t.receptionTotal], ["Recepción positiva", pct(t.receptionPositive, t.receptionTotal)],
          ["Eficacia ataque", pct(t.attack, t.attack + t.attackError)],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-black tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      {c.seasons.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Evolución por temporada</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="text-left py-1">Temporada</th><th className="text-right">Partidos</th><th className="text-right">Puntos</th><th className="text-right">Puntos / partido</th></tr></thead>
              <tbody>{c.seasons.map((s) => <tr key={s.season} className="border-t border-border"><td className="py-1.5">{s.season}</td><td className="text-right tabular-nums">{s.matches}</td><td className="text-right tabular-nums">{s.points}</td><td className="text-right tabular-nums">{s.avgPoints.toFixed(1)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      <CareerView career={c} />

      <section className="space-y-2">
        <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Historial de partidos · {perfs.length}</h2>
        {perfs.length === 0 && <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Todavía no tiene partidos finalizados registrados.</p>}
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {perfs.slice(0, shown).map((m) => (
            <div key={m.matchId + m.teamId} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{m.teamName} vs {m.opponentName}</p>
                <p className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString("es-AR")} · {m.points} pts · {m.attack} ataques · {m.ace} aces · {m.block} bloqueos</p>
              </div>
              <Button size="sm" variant="outline" asChild><Link to="/matches/$id" params={{ id: m.matchId }}>Ver partido</Link></Button>
            </div>
          ))}
        </div>
        {shown < perfs.length && <div className="flex justify-center"><Button variant="ghost" onClick={() => setShown((s) => s + PAGE)}>Ver más</Button></div>}
      </section>
    </div>
  );
}
