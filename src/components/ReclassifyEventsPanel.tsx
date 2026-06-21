import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useVolley, POINT_TYPE_LABEL, type Match, type Team, type PointEvent, type PointType } from "@/lib/volley-store";

const RECLASS_TYPES: PointType[] = ["attack", "rotation_attack", "counter_attack", "block", "ace", "opponent_error"];

export function ReclassifyEventsPanel({ match, teamA, teamB }: { match: Match; teamA: Team; teamB: Team }) {
  const reclassify = useVolley((s) => s.reclassifyPointEvent);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"opponent_error" | "all">("opponent_error");

  const pointEvents = useMemo(
    () =>
      match.events
        .filter((e): e is PointEvent => "type" in e)
        .filter((e) => (filter === "all" ? true : e.type === filter))
        .sort((a, b) => a.timestamp - b.timestamp),
    [match.events, filter]
  );

  const teamFor = (side: "A" | "B") => (side === "A" ? teamA : teamB);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Wand2 className="size-4" /> Reclasificar eventos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reclasificar eventos</DialogTitle>
          <DialogDescription>
            Convertí "errores del rival" en ataques, bloqueos o aces asignándolos al jugador que cerró el punto. El equipo que ganó el punto se mantiene.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 items-center text-xs">
          <span className="text-muted-foreground">Mostrar:</span>
          <Select value={filter} onValueChange={(v) => setFilter(v as "opponent_error" | "all")}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="opponent_error">Solo errores del rival</SelectItem>
              <SelectItem value="all">Todos los puntos</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-muted-foreground">{pointEvents.length} eventos</span>
        </div>

        <div className="space-y-2">
          {pointEvents.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No hay eventos para mostrar.</p>
          )}
          {pointEvents.map((ev) => {
            const scoringTeam = teamFor(ev.scoringSide);
            return (
              <div key={ev.id} className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-bold">SET {ev.setNumber}</span>
                    <span className="font-semibold" style={{ color: scoringTeam.color }}>{scoringTeam.shortName}</span>
                    <span className="text-muted-foreground">{POINT_TYPE_LABEL[ev.type]}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(ev.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <ReclassifyRow
                  event={ev}
                  scoringTeam={scoringTeam}
                  onApply={(newType, playerId) => {
                    // El equipo que gana el punto se mantiene → playerSide = scoringSide
                    reclassify(match.id, ev.id, newType, ev.scoringSide, playerId);
                    toast.success("Evento reclasificado");
                  }}
                />
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReclassifyRow({
  event,
  scoringTeam,
  onApply,
}: {
  event: PointEvent;
  scoringTeam: Team;
  onApply: (newType: PointType, playerId: string | null) => void;
}) {
  const [type, setType] = useState<PointType>(event.type);
  const [playerId, setPlayerId] = useState<string>(event.playerId ?? "");

  const needsPlayer = type !== "opponent_error";
  const canApply =
    (type !== event.type || playerId !== (event.playerId ?? "")) &&
    (!needsPlayer || !!playerId);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select value={type} onValueChange={(v) => setType(v as PointType)}>
        <SelectTrigger className="h-8 flex-1 min-w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {RECLASS_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{POINT_TYPE_LABEL[t]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsPlayer && (
        <Select value={playerId} onValueChange={setPlayerId}>
          <SelectTrigger className="h-8 flex-1 min-w-[160px]"><SelectValue placeholder="Jugador..." /></SelectTrigger>
          <SelectContent>
            {scoringTeam.players.map((p) => (
              <SelectItem key={p.id} value={p.id}>#{p.number} {p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button size="sm" className="h-8" disabled={!canApply} onClick={() => onApply(type, needsPlayer ? playerId : null)}>
        Aplicar
      </Button>
    </div>
  );
}
