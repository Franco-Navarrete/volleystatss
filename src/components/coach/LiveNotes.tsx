import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { addLiveNote, markLiveNote } from "@/lib/coach/live.functions";
import type { LiveNote, LiveSnapshot } from "@/lib/coach/live-contract";

export function LiveNotes({ matchId, notes, snapshot, canWrite = false }: { matchId: string; notes: LiveNote[]; snapshot: LiveSnapshot; canWrite?: boolean }) {
  const client = useQueryClient();
  const add = useServerFn(addLiveNote); const mark = useServerFn(markLiveNote);
  const [body, setBody] = useState(""); const [player, setPlayer] = useState("all"); const [rotation, setRotation] = useState(""); const [video, setVideo] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const refresh = () => { void client.invalidateQueries({ queryKey: ["live-coach-session", matchId] }); };
  const save = useMutation({ mutationFn: add, onSuccess: () => { setBody(""); setNoteId(null); refresh(); } });
  const update = useMutation({ mutationFn: mark, onSuccess: refresh });
  const players = [...snapshot.teamA.players, ...snapshot.teamB.players];
  return <section className="space-y-3 border-t border-border py-5">
    <h2 className="flex items-center gap-2 text-base font-bold"><MessageSquare className="size-4 text-accent" /> Observaciones <span className="text-muted-foreground text-xs">{notes.length}</span></h2>
    {canWrite && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const id = noteId ?? crypto.randomUUID(); setNoteId(id); save.mutate({ data: { matchId, id, body, context: { set: snapshot.match.currentSet, ...(rotation ? { rotation: Number(rotation) } : {}), ...(player !== "all" ? { playerId: player } : {}), ...(snapshot.match.events.at(-1) ? { rallyId: snapshot.match.events.at(-1)?.id } : {}), ...(video ? { videoSec: Number(video) } : {}) } } }); }}>
      <Textarea aria-label="Observación del estadista" value={body} maxLength={2000} onChange={(e) => { setBody(e.target.value); setNoteId(null); }} placeholder="Observación" />
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-48"><Label>Jugadora</Label><Select value={player} onValueChange={setPlayer}><SelectTrigger aria-label="Jugadora de la observación"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Equipo</SelectItem>{players.map((p) => <SelectItem key={p.id} value={p.id}>#{p.number} {p.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-20"><Label htmlFor="note-rotation">Rotación</Label><Input id="note-rotation" type="number" min={1} max={6} value={rotation} onChange={(e) => setRotation(e.target.value)} /></div>
        <div className="w-24"><Label htmlFor="note-video">Video (s)</Label><Input id="note-video" type="number" min={0} value={video} onChange={(e) => setVideo(e.target.value)} /></div>
        <Button type="submit" disabled={!body.trim() || save.isPending}><Send className="size-4" /> {save.isPending ? "Guardando…" : "Guardar observación"}</Button>
      </div>
      {save.error && <p role="alert" className="text-destructive text-sm">{save.error.message}</p>}
    </form>}
    {!notes.length && <p className="text-sm text-muted-foreground">Sin observaciones registradas.</p>}
    <div className="divide-y divide-border">{notes.map((n) => <article key={n.id} className="py-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Set {n.context.set ?? "—"}{n.context.rotation ? ` · R${n.context.rotation}` : ""}{n.context.playerId ? ` · ${players.find((p) => p.id === n.context.playerId)?.name ?? "Jugadora"}` : ""}{n.context.videoSec !== undefined ? ` · Video ${n.context.videoSec}s` : ""}</span><time>{new Date(n.created_at).toLocaleTimeString("es-AR")}</time></div>
      <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
      <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{n.status === "new" ? "Nueva" : n.status === "read" ? "Leída" : "Resuelta"}</span>
        <Button size="sm" variant="ghost" disabled={update.isPending || n.status === "read"} onClick={() => update.mutate({ data: { id: n.id, status: "read" } })}><Eye /> Leída</Button>
        <Button size="sm" variant="ghost" disabled={update.isPending || n.status === "resolved"} onClick={() => update.mutate({ data: { id: n.id, status: "resolved" } })}><Check /> Resuelta</Button></div>
    </article>)}</div>
    {update.error && <p role="alert" className="text-sm text-destructive">{update.error.message}</p>}
  </section>;
}