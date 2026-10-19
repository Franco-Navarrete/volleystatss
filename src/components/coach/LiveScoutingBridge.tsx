import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CloudUpload, Eye, MessageSquare, RotateCcw, WifiOff } from "lucide-react";
import { useVolley, type Match } from "@/lib/volley-store";
import { activateLiveSession, commitLiveSession, readLiveSession } from "@/lib/coach/live.functions";
import { useOptionalLiveSession } from "@/hooks/use-live-coach-session";
import { useAuthUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LiveNotes } from "./LiveNotes";
import { CoachLiveDashboard } from "@/components/live/CoachLiveDashboard";
import { useCloudTeams } from "@/hooks/use-cloud-teams";
import { useCoachAccess } from "@/hooks/use-coach-access";
import type { LiveSnapshot } from "@/lib/coach/live-contract";

type Pending = { operationId: string; expectedVersion: number; match: Match };

/** Opt-in transport. The existing writer remains untouched until an administrator activates the session. */
export function LiveScoutingBridge({ matchId, snapshot, canViewLocal = false }: { matchId: string; snapshot: LiveSnapshot; canViewLocal?: boolean }) {
  const { user } = useAuthUser();
  const { hasAccess } = useCoachAccess();
  const teams = useCloudTeams();
  const [showCoach, setShowCoach] = useState(false);
  const assignedTeam = teams.data?.find((t) => t.directlyManaged && (t.id === snapshot.teamA.id || t.id === snapshot.teamB.id));
  const localAvailable = canViewLocal || (hasAccess && !!assignedTeam);
  const remote = useOptionalLiveSession(matchId);
  const client = useQueryClient();
  const commit = useServerFn(commitLiveSession); const read = useServerFn(readLiveSession); const activate = useServerFn(activateLiveSession);
  const [status, setStatus] = useState("confirmed"); const [error, setError] = useState(""); const [showNotes, setShowNotes] = useState(false);
  const [source, setSource] = useState(""); const [scorer, setScorer] = useState(""); const [showActivate, setShowActivate] = useState(false);
  const [mode, setMode] = useState<"individual" | "shared">("shared");
  const [recovery, setRecovery] = useState(0);
  const retryRef = useRef<() => void>(() => {});
  const refresh = () => { void client.invalidateQueries({ queryKey: ["live-coach-session", matchId] }); };
  const activation = useMutation({ mutationFn: activate, onSuccess: () => { setShowActivate(false); refresh(); } });
  const session = remote.data?.session;
  const recover = useMutation({ mutationFn: read, onSuccess: (result) => {
    if (!result.session) return;
    const key = `rally-live-pending:${user?.id}:${matchId}`;
    localStorage.removeItem(key);
    useVolley.setState((s) => ({ matches: s.matches.map((m) => m.id === matchId ? result.session?.snapshot.match ?? m : m) }));
    setError(""); setStatus("confirmed"); setRecovery((n) => n + 1); refresh();
  } });

  useEffect(() => {
    if (!session || !remote.data?.canWrite || !user) return;
    const key = `rally-live-pending:${user.id}:${matchId}`;
    let stopped = false; let busy = false; let conflict = false; let timer: ReturnType<typeof setTimeout> | undefined;
    let version = session.version;
    let confirmed = JSON.stringify(session.snapshot.match);
    let pending: Pending | null = null;
    try { const stored = localStorage.getItem(key); if (stored) pending = JSON.parse(stored) as Pending; } catch { setError("No se pudo recuperar la carga pendiente."); }
    let desired: Match | null = pending?.match ?? null;
    // On a clean entry, adopt the server version instead of uploading a stale local copy.
    if (!pending) useVolley.setState((s) => ({ matches: s.matches.some((m) => m.id === matchId) ? s.matches.map((m) => m.id === matchId ? session.snapshot.match : m) : [...s.matches, session.snapshot.match] }));
    else useVolley.setState((s) => ({ matches: s.matches.map((m) => m.id === matchId ? pending?.match ?? m : m) }));
    const flush = async () => {
      if (stopped || busy || conflict || !desired) return;
      if (!pending && JSON.stringify(desired) === confirmed) return;
      pending ??= { operationId: crypto.randomUUID(), expectedVersion: version, match: desired };
      localStorage.setItem(key, JSON.stringify(pending));
      if (!navigator.onLine) { setStatus("offline"); return; }
      busy = true; setStatus("pending");
      try {
        const result = await commit({ data: { matchId, ...pending } });
        if (stopped) return;
        version = result.version; confirmed = JSON.stringify(pending.match); pending = null; localStorage.removeItem(key); setError(""); setStatus("confirmed");
        refresh();
      } catch (e) {
        if (stopped) return;
        const message = e instanceof Error ? e.message : "No se pudo confirmar el guardado.";
        conflict = message.includes("CONFLICT:"); setError(message); setStatus(conflict ? "conflict" : "failed");
        if (!conflict) timer = setTimeout(() => { void flush(); }, 4000);
      } finally { busy = false; }
      if (!stopped && !conflict && !pending && desired && JSON.stringify(desired) !== confirmed) timer = setTimeout(() => { void flush(); }, 120);
    };
    const unsubscribe = useVolley.subscribe((s) => {
      const m = s.matches.find((m) => m.id === matchId); if (!m) return;
      desired = m;
      if (!busy) { if (timer) clearTimeout(timer); timer = setTimeout(() => { void flush(); }, 150); }
    });
    retryRef.current = () => { void flush(); };
    const offline = () => setStatus("offline"); const online = () => { void flush(); };
    window.addEventListener("online", online); window.addEventListener("offline", offline);
    if (pending) void flush();
    return () => { stopped = true; unsubscribe(); if (timer) clearTimeout(timer); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
    // Keep the in-flight operation alive across query updates; recovery deliberately remounts the writer below.
  }, [session?.match_id, remote.data?.canWrite, user?.id, recovery]);

  return <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-1 text-xs shrink-0">
    {(localAvailable || session) && <div role="group" aria-label="Vista del partido" className="flex flex-wrap items-center gap-1">
      <Button size="sm" variant={showCoach ? "ghost" : "secondary"} aria-pressed={!showCoach} onClick={() => setShowCoach(false)}>Scouting</Button>
      {localAvailable ? <Button size="sm" variant={showCoach ? "secondary" : "ghost"} aria-pressed={showCoach} onClick={() => setShowCoach(true)}><Eye /> Vista de entrenador</Button> : <Button size="sm" variant="ghost" asChild><Link to="/matches/$id/coach" params={{ id: matchId }} search={{ set: "all", side: "A", player: "all", skill: "all", rotation: "all", zone: "all", phase: "all", view: "summary" }}><Eye /> Vista de entrenador</Link></Button>}
    </div>}
    {session && localAvailable && <Button size="sm" variant="ghost" asChild><Link to="/matches/$id/coach" params={{ id: matchId }} search={{ set: "all", side: "A", player: "all", skill: "all", rotation: "all", zone: "all", phase: "all", view: "summary" }}>Abrir vista independiente</Link></Button>}
    {session && <span className="text-muted-foreground">{session.scouting_mode === "individual" ? "Modo individual" : "Modo compartido"}</span>}
    {!session && remote.data?.canActivate && <Button size="sm" variant="outline" onClick={() => setShowActivate(true)}><CloudUpload /> Habilitar consulta en vivo</Button>}
    {session && remote.data?.canWrite && <>
      <span role="status" className={status === "confirmed" ? "text-success" : "text-warning"}>{status === "confirmed" ? <Check className="inline size-3 mr-1" /> : <WifiOff className="inline size-3 mr-1" />}{({ confirmed: "Confirmado", pending: "Guardado pendiente", failed: "Guardado fallido", offline: "Sin conexión · pendiente", conflict: "Conflicto de versiones" } as Record<string, string>)[status]}</span>
      {status === "failed" && <Button size="sm" variant="ghost" onClick={() => retryRef.current()}>Reintentar</Button>}
      {status === "conflict" && <Button size="sm" variant="outline" disabled={recover.isPending} onClick={() => { if (window.confirm("Se recuperará la versión confirmada; los cambios locales pendientes se descartarán. ¿Continuar?")) recover.mutate({ data: { matchId } }); }}><RotateCcw /> Recuperar confirmado</Button>}
      {remote.data?.permissions.can_create_observations && <Button size="sm" variant="ghost" onClick={() => setShowNotes(true)}><MessageSquare /> Observación</Button>}
    </>}
    {error && <span role="alert" className="text-destructive break-words">{error}</span>}
    {localAvailable && <Dialog open={showCoach} onOpenChange={setShowCoach}><DialogContent className="max-w-7xl max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Vista de entrenador</DialogTitle></DialogHeader><div><Button size="sm" variant="outline" onClick={() => setShowCoach(false)}><RotateCcw /> Volver al scouting</Button></div><CoachLiveDashboard match={snapshot.match} teamA={snapshot.teamA} teamB={snapshot.teamB} coachSide={assignedTeam?.id === snapshot.teamB.id ? "B" : "A"} /></DialogContent></Dialog>}
    <Dialog open={showActivate} onOpenChange={setShowActivate}><DialogContent><DialogHeader><DialogTitle>Habilitar consulta compartida</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Se usará el partido guardado. La carga queda asignada explícitamente a un estadista; el entrenador consulta sin modificarlo.</p>
      <div className="space-y-1"><span className="text-sm">Modalidad de scouting</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode("individual")} className={`rounded-lg border px-3 py-2 text-sm text-left ${mode === "individual" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><strong className="block">Individual</strong>Una misma persona carga y analiza.</button>
          <button type="button" onClick={() => setMode("shared")} className={`rounded-lg border px-3 py-2 text-sm text-left ${mode === "shared" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}><strong className="block">Compartido</strong>Estadista carga; entrenadores consultan.</button>
        </div>
      </div>
      <label className="text-sm space-y-1">Usuario de la copia guardada (opcional)<Input aria-label="Usuario de origen" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Mi cuenta" /></label>
      <label className="text-sm space-y-1">Usuario del estadista (opcional)<Input aria-label="Usuario del estadista" value={scorer} onChange={(e) => setScorer(e.target.value)} placeholder="Mi cuenta" /></label>
      <Button disabled={activation.isPending} onClick={() => activation.mutate({ data: { matchId, mode, ...(source.trim() ? { sourceUserId: source.trim() } : {}), ...(scorer.trim() ? { scorerId: scorer.trim() } : {}) } })}>Habilitar</Button>
      {activation.error && <p role="alert" className="text-destructive text-sm">{activation.error.message}</p>}
    </DialogContent></Dialog>
    {session && <Dialog open={showNotes} onOpenChange={setShowNotes}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Observaciones del partido</DialogTitle></DialogHeader><LiveNotes matchId={matchId} snapshot={session.snapshot} notes={remote.data?.notes ?? []} canWrite={remote.data?.canWrite} /></DialogContent></Dialog>}
  </div>;
}