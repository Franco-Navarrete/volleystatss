import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import {
  POINT_TYPE_LABEL,
  useVolley,
  setsWon,
  type PointType,
  type Team,
} from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeftRight, ChartBarBig, Flag, Pause, Play, Repeat2, Undo2, Zap,
} from "lucide-react";

export const Route = createFileRoute("/matches/$id")({
  head: () => ({ meta: [{ title: "Partido en vivo · RALLY" }] }),
  component: LiveMatch,
});

const POINT_TYPES: { type: PointType; label: string; icon: string }[] = [
  { type: "attack", label: "Ataque", icon: "⚡" },
  { type: "block", label: "Bloqueo", icon: "🧱" },
  { type: "ace", label: "Ace", icon: "🎯" },
  { type: "opponent_error", label: "Error rival", icon: "⚠" },
];

function LiveMatch() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const match = useVolley((s) => s.matches.find((m) => m.id === id));
  const teams = useVolley((s) => s.teams);
  const startMatch = useVolley((s) => s.startMatch);
  const recordPoint = useVolley((s) => s.recordPoint);
  const recordSub = useVolley((s) => s.recordSubstitution);
  const recordTimeout = useVolley((s) => s.recordTimeout);
  const undo = useVolley((s) => s.undoLastEvent);
  const finishMatch = useVolley((s) => s.finishMatch);

  const teamA = useMemo(() => teams.find((t) => t.id === match?.teamAId), [teams, match]);
  const teamB = useMemo(() => teams.find((t) => t.id === match?.teamBId), [teams, match]);

  const [pending, setPending] = useState<{ side: "A" | "B"; type: PointType } | null>(null);

  if (!match || !teamA || !teamB) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Partido no encontrado.</p>
          <Button asChild className="mt-4"><Link to="/matches">Volver</Link></Button>
        </div>
      </AppShell>
    );
  }

  const w = setsWon(match);
  const currentSet = match.sets.find((s) => s.number === match.currentSet)!;

  const handlePointClick = (side: "A" | "B", type: PointType) => {
    if (type === "opponent_error") {
      // attribute to the team that scored (side); no player needed
      recordPoint(match.id, side, type, null);
      return;
    }
    setPending({ side, type });
  };

  return (
    <AppShell>
      {/* Scoreboard */}
      <section className="rounded-3xl bg-gradient-surface border border-border/60 p-5 sm:p-8 shadow-elevated mb-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05] bg-gradient-primary pointer-events-none" />
        <div className="relative flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2 text-xs">
            {match.status === "live" ? (
              <span className="px-2 py-1 rounded-md bg-destructive/15 text-destructive font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-destructive animate-pulse" /> En vivo
              </span>
            ) : match.status === "finished" ? (
              <span className="px-2 py-1 rounded-md bg-success/15 text-success font-bold uppercase tracking-widest">Final</span>
            ) : (
              <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground font-bold uppercase tracking-widest">Programado</span>
            )}
            <span className="text-muted-foreground uppercase tracking-widest font-semibold">Set {match.currentSet}</span>
          </div>
          <div className="flex gap-2">
            {match.status === "scheduled" && (
              <Button size="sm" onClick={() => startMatch(match.id)} className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Play className="size-4" /> Iniciar
              </Button>
            )}
            {match.status !== "finished" && (
              <Button size="sm" variant="ghost" onClick={() => undo(match.id)}>
                <Undo2 className="size-4" /> Deshacer
              </Button>
            )}
            <Button asChild size="sm" variant="secondary">
              <Link to="/matches/$id/stats" params={{ id: match.id }}><ChartBarBig className="size-4" /> Stats</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 sm:gap-8 items-center">
          <TeamScore team={teamA} setScore={currentSet.scoreA} setsWon={w.a} align="left" />
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Set</div>
            <div className="text-2xl scoreboard-digit font-extrabold text-muted-foreground">VS</div>
          </div>
          <TeamScore team={teamB} setScore={currentSet.scoreB} setsWon={w.b} align="right" />
        </div>

        {/* Set history */}
        {match.sets.length > 1 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {match.sets.map((s) => (
              <div
                key={s.number}
                className={`px-3 py-1.5 rounded-md text-xs scoreboard-digit font-bold tabular-nums border ${s.number === match.currentSet ? "border-primary text-primary bg-primary/5" : "border-border/60 text-muted-foreground"}`}
              >
                Set {s.number}: <span className="text-foreground">{s.scoreA}–{s.scoreB}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {match.status === "scheduled" && (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center">
          <p className="text-muted-foreground mb-3">Iniciá el partido para empezar a registrar puntos.</p>
        </div>
      )}

      {match.status === "live" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <TeamPanel
            match={match} side="A" team={teamA} otherTeam={teamB}
            onPoint={(type) => handlePointClick("A", type)}
            onSub={(inId, outId) => recordSub(match.id, "A", inId, outId)}
            onTimeout={() => recordTimeout(match.id, "A")}
          />
          <TeamPanel
            match={match} side="B" team={teamB} otherTeam={teamA}
            onPoint={(type) => handlePointClick("B", type)}
            onSub={(inId, outId) => recordSub(match.id, "B", inId, outId)}
            onTimeout={() => recordTimeout(match.id, "B")}
          />
        </div>
      )}

      {match.status !== "scheduled" && (
        <div className="mt-8 flex justify-center">
          {match.status === "live" ? (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("¿Finalizar el partido manualmente?")) finishMatch(match.id);
              }}
            >
              <Flag className="size-4" /> Finalizar partido
            </Button>
          ) : (
            <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Link to="/matches/$id/stats" params={{ id: match.id }}>
                <ChartBarBig className="size-4" /> Ver estadísticas finales
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Player picker dialog */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pending && `¿Quién hizo el ${POINT_TYPE_LABEL[pending.type].toLowerCase()}?`}
            </DialogTitle>
          </DialogHeader>
          {pending && (() => {
            const t = pending.side === "A" ? teamA : teamB;
            const onCourt = pending.side === "A" ? match.onCourtA : match.onCourtB;
            const players = onCourt
              .map((pid) => t.players.find((p) => p.id === pid))
              .filter((p): p is NonNullable<typeof p> => !!p);
            return (
              <div className="grid grid-cols-2 gap-2">
                {players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      recordPoint(match.id, pending.side, pending.type, p.id);
                      setPending(null);
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors text-left"
                  >
                    <div className="size-10 rounded-md bg-background border border-border/60 flex items-center justify-center scoreboard-digit font-bold text-primary">
                      {p.number}
                    </div>
                    <span className="font-medium text-sm truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function TeamScore({
  team, setScore, setsWon, align,
}: { team: Team; setScore: number; setsWon: number; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-4 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <TeamBadge team={team} size="lg" />
      <div>
        <div className="font-bold text-sm sm:text-base truncate">{team.name}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Sets ganados: <span className="text-foreground font-bold">{setsWon}</span></div>
        <div className="scoreboard-digit text-6xl sm:text-8xl font-black leading-none mt-1 text-primary text-stroke">
          {String(setScore).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

function TeamPanel({
  match, side, team, otherTeam, onPoint, onSub, onTimeout,
}: {
  match: ReturnType<typeof useVolley.getState>["matches"][number];
  side: "A" | "B";
  team: Team;
  otherTeam: Team;
  onPoint: (type: PointType) => void;
  onSub: (inId: string, outId: string) => void;
  onTimeout: () => void;
}) {
  const onCourt = side === "A" ? match.onCourtA : match.onCourtB;
  const onCourtIds = new Set(onCourt);
  const [subOut, setSubOut] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);

  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-5 py-4 flex items-center gap-3 border-b border-border/60" style={{ background: `linear-gradient(90deg, ${team.color}1a, transparent)` }}>
        <TeamBadge team={team} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{team.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Registrar punto a favor</div>
        </div>
      </header>

      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {POINT_TYPES.map((pt) => (
            <button
              key={pt.type}
              onClick={() => onPoint(pt.type)}
              className="group relative p-4 rounded-xl bg-secondary hover:bg-primary hover:text-primary-foreground transition-all text-left active:scale-[0.98]"
            >
              <div className="text-2xl mb-1">{pt.icon}</div>
              <div className="font-bold text-sm">+1 {pt.label}</div>
              <div className="text-[10px] uppercase tracking-widest opacity-60 mt-0.5">
                {pt.type === "opponent_error" ? `Error de ${otherTeam.shortName}` : "Elegir jugador"}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Dialog open={subOpen} onOpenChange={setSubOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="flex-1"><ArrowLeftRight className="size-4" /> Cambio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cambio · {team.name}</DialogTitle></DialogHeader>
              {!subOut ? (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Jugador que SALE</p>
                  <div className="grid grid-cols-2 gap-2">
                    {onCourt.map((pid) => {
                      const p = team.players.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <button key={p.id} onClick={() => setSubOut(p.id)} className="flex items-center gap-2 p-3 rounded-lg bg-secondary hover:bg-destructive/20">
                          <span className="size-8 rounded scoreboard-digit font-bold bg-background flex items-center justify-center text-xs">{p.number}</span>
                          <span className="text-sm truncate">{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">Jugador que ENTRA</p>
                  <div className="grid grid-cols-2 gap-2">
                    {team.players.filter((p) => !onCourtIds.has(p.id)).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { onSub(p.id, subOut); setSubOut(null); setSubOpen(false); }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-secondary hover:bg-success/20"
                      >
                        <span className="size-8 rounded scoreboard-digit font-bold bg-background flex items-center justify-center text-xs">{p.number}</span>
                        <span className="text-sm truncate">{p.name}</span>
                      </button>
                    ))}
                    {team.players.filter((p) => !onCourtIds.has(p.id)).length === 0 && (
                      <p className="col-span-2 text-center text-sm text-muted-foreground py-4">No hay suplentes disponibles.</p>
                    )}
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
          <Button variant="secondary" className="flex-1" onClick={onTimeout}>
            <Pause className="size-4" /> Tiempo
          </Button>
        </div>

        <div className="pt-3 border-t border-border/40">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-1.5">
            <Repeat2 className="size-3" /> En cancha
          </div>
          <div className="flex flex-wrap gap-1.5">
            {onCourt.map((pid) => {
              const p = team.players.find((x) => x.id === pid);
              if (!p) return null;
              return (
                <span key={p.id} className="px-2 py-1 rounded bg-secondary/60 text-xs flex items-center gap-1.5">
                  <span className="scoreboard-digit font-bold text-primary">{p.number}</span>
                  <span className="truncate max-w-[100px]">{p.name}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Recent events */}
        <RecentEvents match={match} side={side} team={team} />
      </div>
    </section>
  );
}

function RecentEvents({ match, side, team }: { match: ReturnType<typeof useVolley.getState>["matches"][number]; side: "A" | "B"; team: Team }) {
  const teamId = side === "A" ? match.teamAId : match.teamBId;
  const events = match.events.filter((e) => e.teamId === teamId).slice(-4).reverse();
  if (events.length === 0) return null;
  return (
    <div className="pt-3 border-t border-border/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2 flex items-center gap-1.5">
        <Zap className="size-3" /> Últimas acciones
      </div>
      <ul className="space-y-1 text-xs">
        {events.map((e) => {
          if ("type" in e) {
            const player = e.playerId ? team.players.find((p) => p.id === e.playerId) : null;
            return (
              <li key={e.id} className="flex justify-between gap-2 px-2 py-1 rounded bg-secondary/30">
                <span className="text-muted-foreground">{POINT_TYPE_LABEL[e.type]}</span>
                <span className="font-medium truncate">{player ? `#${player.number} ${player.name}` : "—"}</span>
              </li>
            );
          }
          if (e.kind === "timeout") {
            return <li key={e.id} className="px-2 py-1 text-muted-foreground italic">⏸ Tiempo muerto</li>;
          }
          return <li key={e.id} className="px-2 py-1 text-muted-foreground italic">↔ Cambio</li>;
        })}
      </ul>
    </div>
  );
}
