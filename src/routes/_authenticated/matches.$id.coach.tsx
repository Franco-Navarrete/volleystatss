import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Eye, Radio, Settings2, Volleyball } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { liveSessionOptions, useLiveCoachConnection } from "@/hooks/use-live-coach-session";
import { LiveNotes } from "@/components/coach/LiveNotes";
import { RotationStatsPanel } from "@/components/RotationStatsPanel";
import { aggregateAttacks } from "@/lib/attack-heatmap";
import { computeMatchStats, setsWon, type Match } from "@/lib/volley-store";
import { computeSetterDistribution, getSettingEvents } from "@/lib/setting-stats";
import { defaultRules, evidenceAlerts, filteredAttacks, filteredEvents, receptionSummary, type AlertRules, type CoachFilters } from "@/lib/coach/live-analytics";

export const Route = createFileRoute("/_authenticated/matches/$id/coach")({
  validateSearch: (s: Record<string, unknown>): CoachFilters => ({ set: typeof s.set === "string" ? s.set : "all", side: s.side === "B" ? "B" : "A", player: typeof s.player === "string" ? s.player : "all", skill: typeof s.skill === "string" ? s.skill : "all", rotation: typeof s.rotation === "string" ? s.rotation : "all", zone: typeof s.zone === "string" ? s.zone : "all", phase: s.phase === "K1" || s.phase === "K2" ? s.phase : "all", view: s.view === "full" ? "full" : "summary" }),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(liveSessionOptions(params.id)),
  head: () => ({ meta: [{ title: "Vista de entrenador en vivo · RALLY" }, { name: "description", content: "Consulta táctica privada del partido autorizado, marcador confirmado y observaciones en vivo." }, { property: "og:title", content: "RALLY · Entrenador en vivo" }, { property: "og:description", content: "Marcador, estadísticas y observaciones del partido autorizado." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  errorComponent: ({ error }) => <AppShell><p role="alert">{error.message}</p></AppShell>,
  notFoundComponent: () => <AppShell><p>Partido no disponible.</p></AppShell>,
  component: LiveCoachRoute,
});

function Filter({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return <div className="min-w-0"><span className="text-xs text-muted-foreground">{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>;
}

function LiveCoachRoute() {
  const { id } = Route.useParams(); const filters = Route.useSearch(); const navigate = Route.useNavigate();
  const query = useSuspenseQuery(liveSessionOptions(id)); const connection = useLiveCoachConnection(id);
  const [rules, setRules] = useState<AlertRules>(defaultRules); const [showRules, setShowRules] = useState(false);
  const change = (key: keyof CoachFilters, value: string) => { void navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true }); };
  const session = query.data.session;
  if (!session) return <AppShell><div className="py-12 space-y-4"><Eye className="size-8 text-muted-foreground" /><h1 className="text-xl font-bold">Consulta en vivo no disponible</h1><p className="text-muted-foreground">El partido todavía no fue habilitado para consulta compartida, o no tenés un equipo autorizado.</p><Button asChild variant="outline"><Link to="/matches"><ArrowLeft /> Partidos</Link></Button></div></AppShell>;
  const { match, teamA, teamB } = session.snapshot;
  const team = filters.side === "A" ? teamA : teamB;
  const events = filteredEvents(match, filters);
  const attacks = filteredAttacks(match, teamA, teamB, filters);
  const agg = aggregateAttacks(attacks, filters.side); const reception = receptionSummary(events, filters.side);
  const alerts = evidenceAlerts(match, events, attacks, filters, rules);
  const stats = computeMatchStats({ ...match, events });
  const own = stats.teams.get(team.id);
  const sets = setsWon(match); const current = match.sets.find((s) => s.number === match.currentSet);
  const stateText = query.isRefetchError ? "Datos desactualizados" : connection === "connected" ? "Conectado" : connection === "offline" ? "Sin conexión" : "Reconectando";
  const all: [string, string][] = [["all", "Todos"]];
  const distribution = computeSetterDistribution(getSettingEvents({ ...match, events }, filters.side));
  return <AppShell><div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3"><div className="flex items-center gap-2"><Volleyball className="text-primary size-5" /><h1 className="text-lg font-bold">RALLY · Entrenador en vivo</h1></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => change("view", filters.view === "full" ? "summary" : "full")}><Eye />{filters.view === "full" ? "Resumen táctico" : "Dashboard completo"}</Button><Button size="sm" variant="ghost" asChild><Link to="/matches"><ArrowLeft /> Partidos</Link></Button></div></div>
    <section className="border-y border-border py-5 space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center"><div className="min-w-0"><h2 className="font-bold text-lg break-words">{teamA.name}</h2><p className="text-xs text-muted-foreground">{sets.a} sets{match.servingSide === "A" ? " · Al saque" : ""}</p></div><div className="text-center"><div className="text-4xl font-bold tabular-nums text-primary">{current?.scoreA ?? 0} <span className="text-muted-foreground">:</span> {current?.scoreB ?? 0}</div><p className="text-xs text-muted-foreground mt-1">Set {match.currentSet} · {match.status === "live" ? "En vivo" : match.status === "finished" ? "Finalizado" : "Programado"}</p></div><div className="min-w-0 text-right"><h2 className="font-bold text-lg break-words">{teamB.name}</h2><p className="text-xs text-muted-foreground">{sets.b} sets{match.servingSide === "B" ? " · Al saque" : ""}</p></div></div>
      <div className="flex flex-wrap gap-3 justify-between text-xs text-muted-foreground"><span role="status" className={stateText === "Conectado" ? "text-success" : "text-warning"}><Radio className="inline size-3 mr-1" />{stateText}</span><span>Confirmado {new Date(session.updated_at).toLocaleTimeString("es-AR")} · versión {session.version}</span></div>
    </section>
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      <Filter label="Set" value={filters.set} options={[...all, ...match.sets.map((s): [string, string] => [String(s.number), `Set ${s.number}`])]} onChange={(v) => change("set", v)} />
      <Filter label="Equipo" value={filters.side} options={[["A", teamA.name], ["B", teamB.name]]} onChange={(v) => { void navigate({ search: (p) => ({ ...p, side: v === "B" ? "B" : "A", player: "all" }), replace: true }); }} />
      <Filter label="Jugadora" value={filters.player} options={[...all, ...team.players.map((p): [string, string] => [p.id, `#${p.number} ${p.name}`])]} onChange={(v) => change("player", v)} />
      <Filter label="Fundamento" value={filters.skill} options={[...all, ["attack", "Ataque"], ["reception", "Recepción"], ["setting", "Armado"], ["defense", "Defensa"], ["block", "Bloqueo"], ["serve", "Saque"]]} onChange={(v) => change("skill", v)} />
      <Filter label="Rotación" value={filters.rotation} options={[...all, ...[1, 2, 3, 4, 5, 6].map((r): [string, string] => [String(r), `R${r}`])]} onChange={(v) => change("rotation", v)} />
      <Filter label="Zona de ataque" value={filters.zone} options={[...all, ...[4, 3, 2, 1, 6, 5].map((r): [string, string] => [String(r), `Zona ${r}`])]} onChange={(v) => change("zone", v)} />
      <Filter label="Fase registrada" value={filters.phase} options={[...all, ["K1", "K1 · Recepción"], ["K2", "K2 · Defensa"]]} onChange={(v) => change("phase", v)} />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-border py-5">
      {[ ["Ataque · balance", agg.total ? `${Math.round((agg.positives - agg.negatives) / agg.total * 100)}%` : "—", `${agg.total} ataques · ${agg.positives} positivos / ${agg.negatives} negativos`], ["Recepción positiva", reception.positivity !== null ? `${reception.positivity.toFixed(0)}%` : "—", `${reception.positive}/${reception.total} recepciones`], ["Bloqueos punto", String(own?.block ?? 0), "Resultados registrados"], ["Defensas", String(events.filter((e) => "kind" in e && e.kind === "defense" && e.rating !== "neutral").length), "Omitidas excluidas"] ].map(([label, value, detail]) => <div key={label} className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="text-3xl font-bold mt-1 text-accent">{value}</p><p className="text-xs text-muted-foreground mt-1 break-words">{detail}</p></div>)}
    </div>
    <section className="space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Alertas con evidencia</h2><Button size="icon" variant="ghost" aria-label="Configurar reglas de alerta" title="Configurar reglas de alerta" onClick={() => setShowRules(!showRules)}><Settings2 /></Button></div>
      {showRules && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{([["minimum", "Muestra mínima", 3, 100], ["concentration", "Concentración (%)", 1, 100], ["receptionDrop", "Caída recepción (pp)", 1, 100], ["rotationDeficit", "Déficit de puntos", 1, 25]] as const).map(([key, label, min, max]) => <label key={key} className="text-xs text-muted-foreground">{label}<Input type="number" min={min} max={max} value={rules[key]} onChange={(e) => setRules((r) => ({ ...r, [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) }))} /></label>)}</div>}
      {!alerts.length ? <p className="text-sm text-muted-foreground">Sin alertas con muestra suficiente para los filtros actuales.</p> : <div className="grid md:grid-cols-2 gap-3">{alerts.map((alert) => <article key={alert.id} className="rounded-md border border-warning/40 bg-warning/5 p-3 space-y-1"><h3 className="text-sm font-bold">{alert.title}</h3><p className="text-sm">{alert.evidence}</p><p className="text-xs text-muted-foreground">{alert.period} · n={alert.sample} · {team.name}</p><p className="text-xs text-muted-foreground">Regla: {alert.rule}</p></article>)}</div>}
    </section>
    <section className="grid lg:grid-cols-2 gap-6 border-t border-border pt-5"><div><h2 className="font-bold mb-3">Distribución ofensiva · {team.name}</h2><div className="grid grid-cols-3 gap-2">{[4, 3, 2, 5, 6, 1].map((z) => { const bucket = agg.origin[z as 1 | 2 | 3 | 4 | 5 | 6]; return <div key={z} className="rounded-md border border-border bg-muted/30 p-3 text-center"><span className="text-xs text-muted-foreground">Zona {z}</span><p className="text-xl font-bold">{bucket.count}</p><p className="text-xs text-muted-foreground">{agg.total ? Math.round(bucket.count / agg.total * 100) : 0}%</p></div>; })}</div></div><div><h2 className="font-bold mb-3">K1 / K2</h2><div className="divide-y divide-border">{["K1", "K2"].map((phase) => { const rows = attacks.filter((a) => a.phase === phase); return <div key={phase} className="py-3 flex justify-between"><span>{phase}</span><span className="text-muted-foreground text-sm">{rows.length} ataques · {rows.filter((a) => a.result === "positive").length} positivos</span></div>; })}<p className="text-xs text-muted-foreground py-2">{attacks.filter((a) => a.phase === null).length} ataques sin fase registrada</p></div></div></section>
    <RotationStatsPanel match={match} teamA={teamA} teamB={teamB} setNumber={filters.set === "all" ? match.currentSet : Number(filters.set)} compact />
    {filters.view === "full" && <>
      <section className="space-y-3 border-t border-border pt-5"><h2 className="font-bold">Estadísticas individuales · {team.name}</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-muted-foreground"><tr>{["Jugadora", "Ataques positivos", "Ataques neutros", "Errores ataque", "Bloqueo", "Saque", "Recepción +"].map((h) => <th key={h} className="text-left py-3 pr-4 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{team.players.filter((p) => filters.player === "all" || filters.player === p.id).map((p) => { const ps = stats.players.get(p.id); const ats = attacks.filter((a) => a.playerId === p.id); const rec = receptionSummary(events.filter((e) => "playerId" in e && e.playerId === p.id), filters.side); return <tr key={p.id} className="border-t border-border"><td className="py-3 pr-4 min-w-40">#{p.number} {p.name}</td><td>{ats.filter((a) => a.result === "positive").length}</td><td>{ats.filter((a) => a.result === "neutral").length}</td><td>{ps?.attackError ?? 0}</td><td>{ps?.block ?? 0}</td><td>{ps?.ace ?? 0}</td><td>{rec.positivity === null ? "—" : `${rec.positivity.toFixed(0)}% (n=${rec.total})`}</td></tr>; })}</tbody></table></div></section>
      <section className="border-t border-border pt-5 space-y-3"><h2 className="font-bold">Distribución del armado</h2>{!distribution.size && <p className="text-sm text-muted-foreground">Sin armados registrados en esta selección.</p>}{[...distribution.values()].map((d) => <div key={d.setterId} className="text-sm"><p className="font-bold">{team.players.find((p) => p.id === d.setterId)?.name ?? "Armadora"} · {d.total} armados</p><p className="text-muted-foreground">{Object.entries(d.byZone).filter(([, n]) => n > 0).map(([z, n]) => `${z}: ${n}`).join(" · ")}</p></div>)}</section>
      <section className="border-t border-border pt-5"><h2 className="font-bold mb-3">Últimas acciones de la selección</h2><div className="divide-y divide-border">{events.slice(-12).reverse().map((e) => <div key={e.id} className="flex gap-3 justify-between py-2 text-sm"><span>{"kind" in e ? e.kind === "reception" ? "Recepción" : e.kind === "defense" ? "Defensa" : e.kind === "setting" ? "Armado" : "Acción" : e.type === "counter_attack" ? "Contraataque" : "Punto"} · Set {e.setNumber}</span><time className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString("es-AR")}</time></div>)}</div></section>
    </>}
    <LiveNotes matchId={id} notes={query.data.notes} snapshot={session.snapshot} />
  </div></AppShell>;
}