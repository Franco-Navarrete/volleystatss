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

type Pending = { operationId: string; expectedVersion: number; match: Match };

/** Opt-in transport. The existing writer remains untouched until an administrator activates the session. */
export function LiveScoutingBridge({ matchId }: { matchId: string }) {
  const { user } = useAuthUser();
  const remote = useOptionalLiveSession(matchId);
  const client = useQueryClient();
  const commit = useServerFn(commitLiveSession); const read = useServerFn(readLiveSession); const activate = useServerFn(activateLiveSession);
  const [status, setStatus] = useState("confirmed"); const [error, setError] = useState(""); const [showNotes, setShowNotes] = useState(false);
  const [source, setSource] = useState(""); const [scorer, setScorer] = useState(""); const [showActivate, setShowActivate] = useState(false);
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
    <Button size="sm" variant="ghost" asChild><Link to="/matches/$id/coach" params={{ id: matchId }} search={{ set: "all", side: "A", player: "all", skill: "all", rotation: "all", zone: "all", phase: "all", view: "summary" }}><Eye /> Vista del entrenador</Link></Button>
    {!session && remote.data?.canActivate && <Button size="sm" variant="outline" onClick={() => setShowActivate(true)}><CloudUpload /> Habilitar consulta en vivo</Button>}
    {session && remote.data?.canWrite && <>
      <span role="status" className={status === "confirmed" ? "text-success" : "text-warning"}>{status === "confirmed" ? <Check className="inline size-3 mr-1" /> : <WifiOff className="inline size-3 mr-1" />}{({ confirmed: "Confirmado", pending: "Guardado pendiente", failed: "Guardado fallido", offline: "Sin conexión · pendiente", conflict: "Conflicto de versiones" } as Record<string, string>)[status]}</span>
      {status === "failed" && <Button size="sm" variant="ghost" onClick={() => retryRef.current()}>Reintentar</Button>}
      {status === "conflict" && <Button size="sm" variant="outline" disabled={recover.isPending} onClick={() => { if (window.confirm("Se recuperará la versión confirmada; los cambios locales pendientes se descartarán. ¿Continuar?")) recover.mutate({ data: { matchId } }); }}><RotateCcw /> Recuperar confirmado</Button>}
      <Button size="sm" variant="ghost" onClick={() => setShowNotes(true)}><MessageSquare /> Observación</Button>
    </>}
    {error && <span role="alert" className="text-destructive break-words">{error}</span>}
    <Dialog open={showActivate} onOpenChange={setShowActivate}><DialogContent><DialogHeader><DialogTitle>Habilitar consulta compartida</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Se usará el partido guardado. La carga queda asignada explícitamente a un estadista; el entrenador consulta sin modificarlo.</p>
      <label className="text-sm space-y-1">Usuario de la copia guardada (opcional)<Input aria-label="Usuario de origen" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Mi cuenta" /></label>
      <label className="text-sm space-y-1">Usuario del estadista (opcional)<Input aria-label="Usuario del estadista" value={scorer} onChange={(e) => setScorer(e.target.value)} placeholder="Mi cuenta" /></label>
      <Button disabled={activation.isPending} onClick={() => activation.mutate({ data: { matchId, ...(source.trim() ? { sourceUserId: source.trim() } : {}), ...(scorer.trim() ? { scorerId: scorer.trim() } : {}) } })}>Habilitar</Button>
      {activation.error && <p role="alert" className="text-destructive text-sm">{activation.error.message}</p>}
    </DialogContent></Dialog>
    {session && <Dialog open={showNotes} onOpenChange={setShowNotes}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Observaciones del partido</DialogTitle></DialogHeader><LiveNotes matchId={matchId} snapshot={session.snapshot} notes={remote.data?.notes ?? []} canWrite={remote.data?.canWrite} /></DialogContent></Dialog>}
  </div>;
}