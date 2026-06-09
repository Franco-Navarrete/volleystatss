import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Volleyball } from "lucide-react";
import {
  useVolley,
  setsWon,
  currentServer,
  timeoutsUsedInSet,
  computeMatchStats,
  type PointType,
  type SanctionType,
  type Team,
  type Match,
} from "@/lib/volley-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeftRight,
  ChartBarBig,
  Flag,
  Hourglass,
  Play,
  StopCircle,
  Undo2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/matches/$id/")({
  head: () => ({ meta: [{ title: "Partido en vivo · RALLY" }] }),
  component: LiveMatch,
});

function useForceLandscape(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const mq = window.matchMedia("(orientation: portrait) and (max-width: 900px)");
    const apply = () => {
      document.documentElement.classList.toggle("force-landscape", mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    // Best-effort native orientation lock (works in fullscreen on some Android browsers).
    const so: any = (screen as any).orientation;
    so?.lock?.("landscape").catch(() => {});
    return () => {
      mq.removeEventListener("change", apply);
      document.documentElement.classList.remove("force-landscape");
      so?.unlock?.();
    };
  }, [active]);
}

function LiveMatch() {
  const { id } = Route.useParams();
  const match = useVolley((s) => s.matches.find((m) => m.id === id));
  const teams = useVolley((s) => s.teams);
  const startMatch = useVolley((s) => s.startMatch);
  const recordPoint = useVolley((s) => s.recordPoint);
  const recordSub = useVolley((s) => s.recordSubstitution);
  const recordTimeout = useVolley((s) => s.recordTimeout);
  const recordSanction = useVolley((s) => s.recordSanction);
  const undo = useVolley((s) => s.undoLastEvent);
  const finishMatch = useVolley((s) => s.finishMatch);

  const teamA = useMemo(() => teams.find((t) => t.id === match?.teamAId), [teams, match]);
  const teamB = useMemo(() => teams.find((t) => t.id === match?.teamBId), [teams, match]);

  const [pendingPlayer, setPendingPlayer] = useState<{ side: "A" | "B"; playerId: string } | null>(null);
  const [subState, setSubState] = useState<{ side: "A" | "B"; playerOutId: string } | null>(null);
  const [timeoutSide, setTimeoutSide] = useState<"A" | "B" | null>(null);
  const [sanctionSide, setSanctionSide] = useState<"A" | "B" | null>(null);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const navigate = useNavigate();
  const autoNavigatedRef = useRef(false);
  useEffect(() => {
    if (match?.status === "finished" && !autoNavigatedRef.current) {
      autoNavigatedRef.current = true;
      navigate({ to: "/matches/$id/stats", params: { id: match.id } });
    }
  }, [match?.status, match?.id, navigate]);

  // Auto-rotate to landscape on portrait phones during live scoring.
  useForceLandscape(match?.status === "live");

  if (!match || !teamA || !teamB) {
    return (
      <CompactShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Partido no encontrado.</p>
          <Button asChild className="mt-4"><Link to="/matches">Volver</Link></Button>
        </div>
      </CompactShell>
    );
  }

  const w = setsWon(match);
  const currentSet = match.sets.find((s) => s.number === match.currentSet)!;
  const server = currentServer(match);
  const isLive = match.status === "live";
  const toUsedA = timeoutsUsedInSet(match, "A", match.currentSet);
  const toUsedB = timeoutsUsedInSet(match, "B", match.currentSet);

  const onPlayerClick = (side: "A" | "B", playerId: string) => {
    if (!isLive) return;
    setPendingPlayer({ side, playerId });
  };

  const submitAction = (type: PointType) => {
    if (!pendingPlayer) return;
    recordPoint(match.id, pendingPlayer.side, type, pendingPlayer.playerId);
    setPendingPlayer(null);
  };

  const handleTimeout = (side: "A" | "B") => {
    const ok = recordTimeout(match.id, side);
    if (ok) setTimeoutSide(side);
    else alert(`${side === "A" ? teamA.name : teamB.name} ya usó los 2 tiempos del set.`);
  };

  return (
    <CompactShell>
      <div className="flex flex-col gap-1.5 md:gap-3 h-full min-h-0 px-2 md:px-6 py-2 md:py-4 mx-auto w-full max-w-[1400px]">
        {/* Scoreboard header */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-6 rounded-lg md:rounded-xl bg-card border border-border/60 px-2 sm:px-4 md:px-8 py-1.5 md:py-4 shrink-0">
          <ScoreColumn team={teamA} score={currentSet.scoreA} sets={w.a} align="right" serving={server.side === "A"} />
          <div className="text-center px-1.5 md:px-4">
            <div className="text-[9px] md:text-xs uppercase tracking-widest text-muted-foreground font-bold">Set {match.currentSet}</div>
            {match.status === "live" ? (
              <span className="mt-0.5 md:mt-1 inline-flex items-center gap-1 text-[9px] md:text-xs font-bold uppercase tracking-widest text-destructive">
                <span className="size-1.5 md:size-2 rounded-full bg-destructive animate-pulse" /> Live
              </span>
            ) : match.status === "finished" ? (
              <span className="mt-0.5 md:mt-1 inline-block text-[9px] md:text-xs font-bold uppercase tracking-widest text-success">Final</span>
            ) : (
              <span className="mt-0.5 md:mt-1 inline-block text-[9px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">Prog.</span>
            )}
          </div>
          <ScoreColumn team={teamB} score={currentSet.scoreB} sets={w.b} align="left" serving={server.side === "B"} />
        </header>

        {match.status === "scheduled" && (
          <div className="rounded-xl border border-dashed border-border/60 p-4 md:p-8 text-center">
            <p className="text-muted-foreground mb-3 md:mb-5 text-sm md:text-base">Iniciá el partido para registrar puntos sobre la cancha.</p>
            <Button onClick={() => startMatch(match.id)} size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Play className="size-4 md:size-5" /> Iniciar partido
            </Button>
          </div>
        )}

        {/* Court + side controls */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-2 sm:gap-3 md:gap-5 items-stretch flex-1 min-h-0 md:min-h-[420px]">
          <SideActions
            side="left"
            disabled={!isLive}
            timeoutsUsed={toUsedA}
            onCambio={() => setSubState({ side: "A", playerOutId: "" })}
            onTiempo={() => handleTimeout("A")}
            onSancion={() => setSanctionSide("A")}
          />

          <CourtView
            match={match}
            teamA={teamA}
            teamB={teamB}
            serverPlayerId={server.playerId}
            serverSide={server.side}
            onPlayerClick={onPlayerClick}
          />

          <SideActions
            side="right"
            disabled={!isLive}
            timeoutsUsed={toUsedB}
            onCambio={() => setSubState({ side: "B", playerOutId: "" })}
            onTiempo={() => handleTimeout("B")}
            onSancion={() => setSanctionSide("B")}
          />
        </div>

        {/* Bottom action row */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 md:gap-3 shrink-0">
          <Button size="sm" variant="secondary" className="h-8 md:h-11 text-xs md:text-sm" disabled={!isLive || match.events.length === 0} onClick={() => undo(match.id)}>
            <Undo2 className="size-3.5 md:size-4" /> Deshacer
          </Button>
          <Button size="sm" variant="secondary" className="h-8 md:h-11 text-xs md:text-sm" onClick={() => setShowLiveStats(true)}>
            <ChartBarBig className="size-3.5 md:size-4" /> Stats vivo
          </Button>
          <Button asChild size="sm" variant="secondary" className="h-8 md:h-11 text-xs md:text-sm">
            <Link to="/matches/$id/stats" params={{ id: match.id }}>
              <ChartBarBig className="size-3.5 md:size-4" /> Stats final
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 md:h-11 text-xs md:text-sm" disabled={!isLive} onClick={() => alert("El set se cierra automáticamente al alcanzar la meta de puntos.")}>
            <StopCircle className="size-3.5 md:size-4" /> Fin Set
          </Button>
          <Button size="sm" variant="destructive" className="h-8 md:h-11 text-xs md:text-sm" disabled={match.status === "finished"}
            onClick={() => { if (confirm("¿Finalizar el partido manualmente?")) finishMatch(match.id); }}>
            <Flag className="size-3.5 md:size-4" /> Fin Partido
          </Button>
        </div>

        {match.sets.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1 md:gap-2 shrink-0">
            {match.sets.map((s) => (
              <div key={s.number} className={`px-2 md:px-3 py-0.5 md:py-1 rounded text-[10px] md:text-xs scoreboard-digit font-bold tabular-nums border ${
                s.number === match.currentSet ? "border-primary text-primary bg-primary/5" : "border-border/60 text-muted-foreground"
              }`}>
                Set {s.number}: <span className="text-foreground">{s.scoreA}–{s.scoreB}</span>
                {s.finished && (
                  <span className="ml-1 text-success">{s.scoreA > s.scoreB ? `▲${teamA.shortName}` : `▲${teamB.shortName}`}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Action menu when a player is tapped */}
      <Dialog open={!!pendingPlayer} onOpenChange={(o) => !o && setPendingPlayer(null)}>
        <DialogContent className="max-w-sm">
          {pendingPlayer && (() => {
            const t = pendingPlayer.side === "A" ? teamA : teamB;
            const other = pendingPlayer.side === "A" ? teamB : teamA;
            const player = t.players.find((p) => p.id === pendingPlayer.playerId);
            const isServer = server.side === pendingPlayer.side && server.playerId === pendingPlayer.playerId;
            const actions: { type: PointType; label: string; tone: "primary" | "neutral" | "danger" }[] = [
              { type: "attack", label: "Ataque", tone: "primary" },
              { type: "block", label: "Bloqueo", tone: "primary" },
              ...(isServer ? ([{ type: "ace", label: "Saque (Ace)", tone: "primary" }] as const) : []),
              { type: "opponent_error", label: `Error del rival (${other.shortName})`, tone: "neutral" },
              { type: "unforced_error", label: "Error no forzado", tone: "danger" },
              ...(isServer ? ([{ type: "serve_error", label: "Error de saque", tone: "danger" }] as const) : []),
            ];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span className="size-10 rounded-full flex items-center justify-center scoreboard-digit font-black text-white" style={{ background: t.color }}>
                      {player?.number}
                    </span>
                    <span className="truncate">
                      <span className="block text-sm font-bold">{player?.name}</span>
                      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        {t.name} {isServer && "· saca"}
                      </span>
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 mt-2">
                  {actions.map((a) => (
                    <button key={a.type} onClick={() => submitAction(a.type)}
                      className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] ${
                        a.tone === "primary" ? "bg-primary text-primary-foreground hover:opacity-90"
                          : a.tone === "danger" ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                          : "bg-secondary hover:bg-secondary/70"
                      }`}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Substitution dialog */}
      <Dialog open={!!subState} onOpenChange={(o) => !o && setSubState(null)}>
        <DialogContent>
          {subState && (() => {
            const t = subState.side === "A" ? teamA : teamB;
            const onCourt = subState.side === "A" ? match.onCourtA : match.onCourtB;
            const onCourtSet = new Set(onCourt);
            return (
              <>
                <DialogHeader><DialogTitle>Cambio · {t.name}</DialogTitle></DialogHeader>
                {!subState.playerOutId ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">Jugador que SALE</p>
                    <div className="grid grid-cols-2 gap-2">
                      {onCourt.map((pid) => {
                        const p = t.players.find((x) => x.id === pid);
                        if (!p) return null;
                        return (
                          <button key={p.id} onClick={() => setSubState({ ...subState, playerOutId: p.id })}
                            className="flex items-center gap-2 p-3 rounded-lg bg-secondary hover:bg-destructive/20">
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
                      {t.players.filter((p) => !onCourtSet.has(p.id)).map((p) => (
                        <button key={p.id} onClick={() => { recordSub(match.id, subState.side, p.id, subState.playerOutId); setSubState(null); }}
                          className="flex items-center gap-2 p-3 rounded-lg bg-secondary hover:bg-success/20">
                          <span className="size-8 rounded scoreboard-digit font-bold bg-background flex items-center justify-center text-xs">{p.number}</span>
                          <span className="text-sm truncate">{p.name}</span>
                        </button>
                      ))}
                      {t.players.filter((p) => !onCourtSet.has(p.id)).length === 0 && (
                        <p className="col-span-2 text-center text-sm text-muted-foreground py-4">No hay suplentes disponibles.</p>
                      )}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Timeout countdown */}
      <Dialog open={!!timeoutSide} onOpenChange={(o) => !o && setTimeoutSide(null)}>
        <DialogContent className="max-w-xs">
          {timeoutSide && (
            <TimeoutCountdown
              team={timeoutSide === "A" ? teamA : teamB}
              used={timeoutSide === "A" ? toUsedA : toUsedB}
              onClose={() => setTimeoutSide(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Sanction dialog */}
      <Dialog open={!!sanctionSide} onOpenChange={(o) => !o && setSanctionSide(null)}>
        <DialogContent className="max-w-md">
          {sanctionSide && (
            <SanctionDialog
              team={sanctionSide === "A" ? teamA : teamB}
              onCourt={sanctionSide === "A" ? match.onCourtA : match.onCourtB}
              onSubmit={(playerId, sanction) => {
                recordSanction(match.id, sanctionSide, playerId, sanction);
                setSanctionSide(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Live stats */}
      <Dialog open={showLiveStats} onOpenChange={setShowLiveStats}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Estadísticas en vivo</DialogTitle></DialogHeader>
          <LiveStatsPanel match={match} teamA={teamA} teamB={teamB} />
        </DialogContent>
      </Dialog>
    </CompactShell>
  );
}

function CompactShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-xl px-3 md:px-8 h-10 md:h-14 flex items-center justify-between shrink-0">
        <Link to="/matches" className="flex items-center gap-2 md:gap-3">
          <div className="size-6 md:size-9 rounded-md md:rounded-lg bg-gradient-primary flex items-center justify-center">
            <Volleyball className="size-3.5 md:size-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xs md:text-base tracking-tight">RALLY</span>
        </Link>
        <Link to="/matches" className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground font-bold">
          ← Partidos
        </Link>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden md:overflow-auto">{children}</main>
    </div>
  );
}

function ScoreColumn({ team, score, sets, align, serving }: {
  team: Team; score: number; sets: number; align: "left" | "right"; serving: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 md:gap-4 ${align === "right" ? "justify-end text-right flex-row-reverse" : "text-left"}`}>
      <div className="size-9 md:size-14 rounded-md md:rounded-lg flex items-center justify-center font-black text-white text-xs md:text-base shrink-0" style={{ background: team.color }}>
        {team.shortName}
      </div>
      <div className="min-w-0">
        <div className="text-xs md:text-lg font-bold truncate flex items-center gap-1.5">
          {team.name}
          {serving && <span className="text-[9px] md:text-[11px] uppercase tracking-widest text-primary">● Saque</span>}
        </div>
        <div className="text-[9px] md:text-[11px] uppercase tracking-widest text-muted-foreground">
          Sets <span className="text-foreground font-bold">{sets}</span>
        </div>
        <div className="scoreboard-digit text-4xl sm:text-5xl md:text-7xl font-black leading-none mt-0.5 md:mt-1 text-primary">{score}</div>
      </div>
    </div>
  );
}

function SideActions({ side, disabled, timeoutsUsed, onCambio, onTiempo, onSancion }: {
  side: "left" | "right"; disabled: boolean; timeoutsUsed: number;
  onCambio: () => void; onTiempo: () => void; onSancion: () => void;
}) {
  const reverse = side === "right";
  return (
    <div className="flex flex-col gap-1.5 md:gap-2.5 w-[68px] sm:w-[92px] md:w-[140px] shrink-0">
      <SideButton icon={<ArrowLeftRight className="size-3.5 md:size-5" />} label="Cambio" onClick={onCambio} disabled={disabled} reverse={reverse} />
      <SideButton
        icon={<Hourglass className="size-3.5 md:size-5" />}
        label="Tiempo"
        badge={`${timeoutsUsed}/2`}
        onClick={onTiempo}
        disabled={disabled || timeoutsUsed >= 2}
        reverse={reverse}
      />
      <SideButton icon={<X className="size-3.5 md:size-5" />} label="Sanción" onClick={onSancion} disabled={disabled} reverse={reverse} />
    </div>
  );
}

function SideButton({ icon, label, onClick, disabled, reverse, badge }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled: boolean; reverse: boolean; badge?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center ${reverse ? "flex-row-reverse" : ""} justify-between gap-1.5 md:gap-3 px-2 md:px-4 py-1.5 md:py-3 rounded-md md:rounded-lg bg-card border border-border/60 hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs md:text-sm font-semibold flex-1 min-h-0`}>
      <span className="truncate flex flex-col items-start leading-tight">
        <span className="text-[11px] md:text-sm">{label}</span>
        {badge && <span className="text-[9px] md:text-[11px] font-bold text-muted-foreground tabular-nums">{badge}</span>}
      </span>
      <span className="text-muted-foreground shrink-0">{icon}</span>
    </button>
  );
}


function CourtView({ match, teamA, teamB, serverPlayerId, serverSide, onPlayerClick }: {
  match: Match; teamA: Team; teamB: Team;
  serverPlayerId: string | null; serverSide: "A" | "B";
  onPlayerClick: (side: "A" | "B", playerId: string) => void;
}) {
  const a = match.onCourtA;
  const b = match.onCourtB;
  // 4 columns left→right: A back, A front, B front, B back
  const columns: Array<{ side: "A" | "B"; team: Team; idxs: number[] }> = [
    { side: "A", team: teamA, idxs: [4, 5, 0] },
    { side: "A", team: teamA, idxs: [3, 2, 1] },
    { side: "B", team: teamB, idxs: [1, 2, 3] },
    { side: "B", team: teamB, idxs: [0, 5, 4] },
  ];
  return (
    <div className="relative rounded-lg overflow-hidden h-full min-h-[180px] bg-[#1e5fa8] p-3 sm:p-5">
      {/* court inner (orange) with white perimeter line */}
      <div className="absolute inset-3 sm:inset-5 bg-[#f4a36a] border-2 border-white rounded-sm" />
      {/* attack zones (darker orange) — the two front-row columns */}
      <div className="absolute inset-y-3 sm:inset-y-5 left-1/2 -translate-x-1/2 flex pointer-events-none">
        <div className="h-full w-[calc(50vw)] max-w-none" />
      </div>
      {/* dashed center net line */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-white pointer-events-none z-10" />
      {/* antenna dots top/bottom of net */}
      <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white z-10" />
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white z-10" />
      {/* attack-line dashes (3m lines) */}
      <div className="absolute top-0 bottom-0 left-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />

      <div className="relative grid grid-cols-4 h-full z-20">
        {columns.map((col, ci) => {
          const onCourt = col.side === "A" ? a : b;
          const serverPid = serverSide === col.side ? serverPlayerId : null;
          const isFront = ci === 1 || ci === 2;
          return (
            <div
              key={ci}
              className={`grid grid-rows-3 gap-1.5 sm:gap-3 h-full px-1 sm:px-2 ${isFront ? "bg-[#ec7a3c]/70" : ""}`}
            >
              {col.idxs.map((idx) => {
                const pid = onCourt[idx];
                const p = col.team.players.find((x) => x.id === pid);
                const isServer = pid && pid === serverPid;
                return (
                  <button
                    key={`${ci}-${idx}`}
                    onClick={() => p && onPlayerClick(col.side, p.id)}
                    disabled={!p}
                    className={`relative rounded-full flex items-center justify-center text-white font-black scoreboard-digit text-lg sm:text-2xl shadow-md transition-all active:scale-95 hover:ring-4 hover:ring-white/30 aspect-square mx-auto h-full ${isServer ? "ring-4 ring-primary border-2 border-white" : ""}`}
                    style={{ background: col.team.color }}
                    title={p ? `#${p.number} ${p.name}` : ""}
                  >
                    {p?.number ?? "?"}
                    {isServer && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[8px] font-bold uppercase tracking-widest">Saque</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeoutCountdown({ team, used, onClose }: { team: Team; used: number; onClose: () => void }) {
  const [seconds, setSeconds] = useState(15);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timer.current = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);
  useEffect(() => {
    if (seconds === 0 && timer.current) clearInterval(timer.current);
  }, [seconds]);
  return (
    <div className="text-center py-2">
      <DialogHeader><DialogTitle className="text-center">Tiempo · {team.name}</DialogTitle></DialogHeader>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-3">
        Tiempos usados <span className="text-foreground">{used}/2</span>
      </div>
      <div className={`scoreboard-digit font-black text-7xl my-4 tabular-nums ${seconds <= 5 ? "text-destructive animate-pulse" : "text-primary"}`}>
        {String(seconds).padStart(2, "0")}
      </div>
      <p className="text-xs text-muted-foreground mb-4">{seconds === 0 ? "¡Tiempo finalizado!" : "Segundos restantes"}</p>
      <Button onClick={onClose} className="w-full">Cerrar</Button>
    </div>
  );
}

function SanctionDialog({ team, onCourt, onSubmit }: {
  team: Team; onCourt: string[];
  onSubmit: (playerId: string | null, sanction: SanctionType) => void;
}) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const sideAColumns: number[][] = [[4, 5, 0], [3, 2, 1]];
  const cards: { type: SanctionType; label: string; render: React.ReactNode }[] = [
    { type: "yellow", label: "Amarilla", render: <div className="w-10 h-14 rounded-sm bg-yellow-400 shadow" /> },
    { type: "red", label: "Roja", render: <div className="w-10 h-14 rounded-sm bg-red-600 shadow" /> },
    { type: "yellow_red", label: "Amar+Roja (expulsión)", render: (
      <div className="relative w-10 h-14">
        <div className="absolute inset-0 rounded-sm bg-yellow-400 shadow translate-x-[-3px] translate-y-[-3px]" />
        <div className="absolute inset-0 rounded-sm bg-red-600 shadow translate-x-[3px] translate-y-[3px]" />
      </div>
    )},
    { type: "red_expulsion", label: "Roja (descalif.)", render: (
      <div className="flex">
        <div className="w-5 h-14 rounded-l-sm bg-yellow-400" />
        <div className="w-5 h-14 rounded-r-sm bg-red-600" />
      </div>
    )},
  ];
  return (
    <>
      <DialogHeader><DialogTitle>Sanción solicitada · {team.name}</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">1. Elegí al jugador sancionado</p>
      <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-secondary/30">
        {sideAColumns.map((col, ci) => (
          <div key={ci} className="grid grid-rows-3 gap-2">
            {col.map((idx) => {
              const pid = onCourt[idx];
              const p = team.players.find((x) => x.id === pid);
              const active = pid === playerId;
              return (
                <button key={`${ci}-${idx}`} onClick={() => p && setPlayerId(p.id)} disabled={!p}
                  className={`aspect-square rounded-full flex items-center justify-center text-white font-black scoreboard-digit text-lg mx-auto h-14 transition-all ${active ? "ring-4 ring-primary" : ""}`}
                  style={{ background: team.color }}>
                  {p?.number ?? "?"}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">2. Elegí el tipo de tarjeta</p>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => (
          <button key={c.type} onClick={() => onSubmit(playerId, c.type)}
            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary hover:bg-secondary/70 active:scale-95 transition">
            {c.render}
            <span className="text-[10px] font-semibold text-center leading-tight">{c.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Roja y Amarilla+Roja otorgan un punto al rival.
      </p>
    </>
  );
}

function LiveStatsPanel({ match, teamA, teamB }: { match: Match; teamA: Team; teamB: Team }) {
  const stats = useMemo(() => computeMatchStats(match), [match]);
  const renderTeam = (team: Team) => {
    const tStat = stats.teams.get(team.id);
    const players = [...stats.players.values()]
      .filter((p) => team.players.some((tp) => tp.id === p.playerId))
      .map((p) => {
        const tp = team.players.find((x) => x.id === p.playerId)!;
        return { ...p, name: tp.name, number: tp.number };
      })
      .sort((a, b) => b.total - a.total);
    return (
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border/60" style={{ background: `${team.color}22` }}>
          <span className="size-6 rounded text-white text-[10px] font-black flex items-center justify-center" style={{ background: team.color }}>{team.shortName}</span>
          <h3 className="font-bold text-sm truncate flex-1">{team.name}</h3>
          <span className="scoreboard-digit text-lg font-black text-primary">{tStat?.total ?? 0}</span>
        </div>
        <div className="grid grid-cols-5 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/40 py-1.5">
          <div>ATK</div><div>BLK</div><div>ACE</div><div>Err Rival</div><div>Err NF</div>
        </div>
        <div className="grid grid-cols-5 text-center scoreboard-digit font-black text-lg py-2 border-b border-border/40">
          <div>{tStat?.attack ?? 0}</div>
          <div>{tStat?.block ?? 0}</div>
          <div>{tStat?.ace ?? 0}</div>
          <div>{tStat?.opponentErrors ?? 0}</div>
          <div className="text-destructive">{tStat?.unforcedErrors ?? 0}</div>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[9px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
            <tr>
              <th className="text-left py-1.5 px-3">Jugador</th>
              <th className="text-center">ATK</th><th className="text-center">BLK</th>
              <th className="text-center">ACE</th><th className="text-center px-3 text-primary">TOT</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.playerId} className="border-t border-border/40">
                <td className="py-1 px-3"><span className="scoreboard-digit font-bold mr-2">#{p.number}</span>{p.name}</td>
                <td className="text-center tabular-nums">{p.attack}</td>
                <td className="text-center tabular-nums">{p.block}</td>
                <td className="text-center tabular-nums">{p.ace}</td>
                <td className="text-center tabular-nums font-bold text-primary px-3">{p.total}</td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr><td colSpan={5} className="text-center py-3 text-muted-foreground">Sin puntos aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };
  return <div className="grid md:grid-cols-2 gap-3 mt-2">{renderTeam(teamA)}{renderTeam(teamB)}</div>;
}
