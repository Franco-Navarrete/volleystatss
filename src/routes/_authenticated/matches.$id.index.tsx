import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Volleyball } from "lucide-react";
import {
  useVolley,
  setsWon,
  currentServer,
  timeoutsUsedInSet,
  computeSetStats,
  computeReceptionStats,
  getSetDuration,
  formatDurationMs,
  formatLocalTime,
  needsReceptionForRally,
  getMatchStatsMode,
  type PointType,
  type SanctionType,
  type ReceptionRating,
  type SettingQuality,
  type Team,
  type Match,
  type AttackZone,
  ATTACK_ZONE_LABEL,
} from "@/lib/volley-store";
import { RotationStatsPanel } from "@/components/RotationStatsPanel";
import { AttackZonesPanel } from "@/components/AttackZonesPanel";
import { SettingDialog } from "@/components/scorer/SettingDialog";
import { QuickSettingBar } from "@/components/scorer/QuickSettingBar";
import { useCoachAccess } from "@/hooks/use-coach-access";


import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeftRight,
  ChartBarBig,
  Check,
  Edit3,
  Flag,
  Hourglass,
  Minus,
  Play,
  Plus,
  Shirt,
  Target,
  Undo2,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/matches/$id/")({
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
  const leagues = useVolley((s) => s.leagues);
  const startMatch = useVolley((s) => s.startMatch);
  const setInitialServingSide = useVolley((s) => s.setInitialServingSide);
  const setSetLineup = useVolley((s) => s.setSetLineup);
  const confirmSetLineup = useVolley((s) => s.confirmSetLineup);
  const startSet = useVolley((s) => s.startSet);
  const toggleSidesFlipped = useVolley((s) => s.toggleSidesFlipped);

  const recordPoint = useVolley((s) => s.recordPoint);
  const recordSub = useVolley((s) => s.recordSubstitution);
  const recordLiberoIn = useVolley((s) => s.recordLiberoIn);
  const recordLiberoOut = useVolley((s) => s.recordLiberoOut);
  const recordTimeout = useVolley((s) => s.recordTimeout);
  const recordSanction = useVolley((s) => s.recordSanction);
  const overrideLineup = useVolley((s) => s.overrideLineup);
  const recordReception = useVolley((s) => s.recordReception);
  const recordSetting = useVolley((s) => s.recordSetting);
  const updateMatchFormat = useVolley((s) => s.updateMatchFormat);
  const overrideScore = useVolley((s) => s.overrideScore);
  const undo = useVolley((s) => s.undoLastEvent);
  const finishMatch = useVolley((s) => s.finishMatch);

  const teamA = useMemo(() => teams.find((t) => t.id === match?.teamAId), [teams, match]);
  const teamB = useMemo(() => teams.find((t) => t.id === match?.teamBId), [teams, match]);

  const [pendingPlayer, setPendingPlayer] = useState<{ side: "A" | "B"; playerId: string } | null>(null);
  const [pendingReception, setPendingReception] = useState<{ side: "A" | "B"; playerId: string } | null>(null);
  const [pendingZone, setPendingZone] = useState<{ side: "A" | "B"; playerId: string; type: PointType } | null>(null);
  const [subState, setSubState] = useState<{ side: "A" | "B"; playerOutId: string } | null>(null);
  const [liberoState, setLiberoState] = useState<{ side: "A" | "B"; liberoId: string | null } | null>(null);
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const [timeoutSide, setTimeoutSide] = useState<"A" | "B" | null>(null);
  const [sanctionSide, setSanctionSide] = useState<"A" | "B" | null>(null);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [showSettingDialog, setShowSettingDialog] = useState(false);
  const [quickSetting, setQuickSetting] = useState<{ side: "A" | "B"; receptionQuality?: SettingQuality } | null>(null);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
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

  // Admins y entrenadores acceden al modo entrenador aunque la liga no lo defina.
  const { hasAccess: coachOverride } = useCoachAccess();


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
  const leftSide: "A" | "B" = match.sidesFlipped ? "B" : "A";
  const rightSide: "A" | "B" = match.sidesFlipped ? "A" : "B";
  const leftTeam = leftSide === "A" ? teamA : teamB;
  const rightTeam = rightSide === "A" ? teamA : teamB;
  const setNotStarted = currentSet.scoreA === 0 && currentSet.scoreB === 0;
  const lineupConfirmed = (match.confirmedLineupSets ?? []).includes(match.currentSet);
  // The set can't start until the formation for this set is confirmed.
  const needsLineup = isLive && setNotStarted && !lineupConfirmed;
  const setStartedAt = match.setStartTimes?.[match.currentSet];
  const needsSetStart = isLive && setNotStarted && lineupConfirmed && !setStartedAt;
  const actionsDisabled = !isLive || needsLineup || needsSetStart;
  const statsMode = getMatchStatsMode(match, teams, leagues);
  const isCoach = statsMode === "entrenador" || coachOverride;

  // Reception flow: the receiving side must register reception (+/0/-) before any other action.
  const receivingSide: "A" | "B" = match.servingSide === "A" ? "B" : "A";
  const receivingTeam = receivingSide === "A" ? teamA : teamB;
  const receivingOnCourt = receivingSide === "A" ? match.onCourtA : match.onCourtB;
  const designatedLiberos = (receivingSide === "A"
    ? [match.liberoA1Id, match.liberoA2Id]
    : [match.liberoB1Id, match.liberoB2Id]
  ).filter(Boolean) as string[];
  const receiverIds = new Set<string>(
    receivingOnCourt.filter((pid) => {
      const p = receivingTeam.players.find((x) => x.id === pid);
      if (!p) return false;
      if (p.position === "punta") return true;
      if (p.position === "libero" || designatedLiberos.includes(p.id)) return true;
      return false;
    })
  );
  const needsReception = isCoach && !actionsDisabled && needsReceptionForRally(match, match.currentSet, receivingSide);

  // Timer tick (1s) — activo durante set en vivo o durante el descanso entre sets.
  const [now, setNow] = useState(() => Date.now());
  const prevSetEndedAt = match.currentSet > 1
    ? [...match.events].reverse().find((e) => "setNumber" in e && e.setNumber === match.currentSet - 1)?.timestamp
    : undefined;
  const inBreak = isLive && match.currentSet > 1 && setNotStarted && !!prevSetEndedAt && !setStartedAt;
  useEffect(() => {
    if (match.status === "finished") return;
    if (!setStartedAt && !inBreak) return;
    if (setStartedAt && currentSet.finished) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [setStartedAt, match.status, currentSet.finished, inBreak]);
  const setEndedAt = currentSet.finished
    ? [...match.events].reverse().find((e) => "setNumber" in e && e.setNumber === match.currentSet)?.timestamp
    : undefined;
  const elapsedMs = setStartedAt ? (setEndedAt ?? now) - setStartedAt : 0;
  const setTimerLabel = setStartedAt ? formatDurationMs(elapsedMs) : null;
  const BREAK_MS = 3 * 60 * 1000;
  const breakRemainingMs = inBreak && prevSetEndedAt ? Math.max(0, BREAK_MS - (now - prevSetEndedAt)) : 0;
  const breakMinutes = Math.floor(breakRemainingMs / 60000);
  const breakSeconds = Math.floor((breakRemainingMs % 60000) / 1000);
  const breakLabel = `${breakMinutes}:${String(breakSeconds).padStart(2, "0")}`;



  const onPlayerClick = (side: "A" | "B", playerId: string) => {
    if (!isLive) return;
    if (needsLineup) {
      setShowLineupEditor(true);
      return;
    }
    if (needsSetStart) return;
    if (needsReception && side === receivingSide) {
      setPendingReception({ side, playerId });
      return;
    }
    setPendingPlayer({ side, playerId });
  };

  const submitAction = (type: PointType) => {
    if (!pendingPlayer) return;
    if (isCoach && (type === "rotation_attack" || type === "counter_attack")) {
      setPendingZone({ side: pendingPlayer.side, playerId: pendingPlayer.playerId, type });
      setPendingPlayer(null);
      return;
    }
    recordPoint(match.id, pendingPlayer.side, type, pendingPlayer.playerId);
    setPendingPlayer(null);
  };

  const submitZone = (zone: AttackZone) => {
    if (!pendingZone) return;
    recordPoint(match.id, pendingZone.side, pendingZone.type, pendingZone.playerId, zone);
    setPendingZone(null);
  };

  const submitReception = (rating: ReceptionRating) => {
    if (!pendingReception) return;
    const side = pendingReception.side;
    recordReception(match.id, side, pendingReception.playerId, rating);
    setPendingReception(null);
    if (isCoach) {
      // Mapeo rating de recepción (3 niveles) → calidad de armado (5 niveles)
      const map: Record<ReceptionRating, SettingQuality> = {
        positive: "++",
        neutral: "!",
        negative: "-",
      };
      setQuickSetting({ side, receptionQuality: map[rating] });
    }
  };

  const handleTimeout = (side: "A" | "B") => {
    const ok = recordTimeout(match.id, side);
    if (ok) setTimeoutSide(side);
    else alert(`${side === "A" ? teamA.name : teamB.name} ya usó los 2 tiempos del set.`);
  };

  return (
    <CompactShell>
      <div className="relative flex flex-col gap-1.5 md:gap-3 h-full min-h-0 px-2 md:px-6 py-2 md:py-4 mx-auto w-full max-w-[1400px] select-none">
        {/* Scoreboard header */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 md:gap-6 rounded-lg md:rounded-xl bg-card border border-border/60 px-2 sm:px-4 md:px-8 py-0.5 md:py-4 shrink-0">
          <ScoreColumn team={leftTeam} score={leftSide === "A" ? currentSet.scoreA : currentSet.scoreB} sets={leftSide === "A" ? w.a : w.b} align="right" serving={server.side === leftSide} onScoreClick={() => isLive && setShowScoreDialog(true)} />
          <div className="text-center px-1 md:px-4 flex flex-row md:flex-col items-center justify-center gap-1.5 md:gap-0">
            <div className="flex flex-col items-center">
              <div className="text-[8px] md:text-xs uppercase tracking-widest text-muted-foreground font-bold">Set {match.currentSet}</div>
              {match.status === "live" ? (
                <span className="md:mt-1 inline-flex items-center gap-1 text-[8px] md:text-xs font-bold uppercase tracking-widest text-destructive">
                  <span className="size-1 md:size-2 rounded-full bg-destructive animate-pulse" /> Live
                </span>
              ) : match.status === "finished" ? (
                <span className="md:mt-1 inline-block text-[8px] md:text-xs font-bold uppercase tracking-widest text-success">Final</span>
              ) : (
                <span className="md:mt-1 inline-block text-[8px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground">Prog.</span>
              )}
              {setTimerLabel && (
                <span className="md:mt-0.5 scoreboard-digit tabular-nums text-[10px] md:text-sm font-bold text-foreground">
                  {setTimerLabel}
                </span>
              )}

            </div>
            <div>
              <button
                type="button"
                onClick={() => toggleSidesFlipped(match.id)}
                title="Invertir lados"
                className="md:mt-2 inline-flex items-center justify-center size-6 md:size-9 rounded-md md:rounded-lg border border-border/60 text-muted-foreground hover:text-primary hover:border-primary transition-colors active:scale-95"
              >
                <ArrowLeftRight className="size-3.5 md:size-5" />
              </button>
            </div>
          </div>
          <ScoreColumn team={rightTeam} score={rightSide === "A" ? currentSet.scoreA : currentSet.scoreB} sets={rightSide === "A" ? w.a : w.b} align="left" serving={server.side === rightSide} onScoreClick={() => isLive && setShowScoreDialog(true)} />
        </header>

        {match.status === "scheduled" && (
          <div className="rounded-xl border border-dashed border-border/60 p-4 md:p-8 text-center">
            <p className="text-muted-foreground mb-3 md:mb-4 text-sm md:text-base">Elegí quién saca primero e iniciá el partido.</p>
            <div className="flex items-center justify-center gap-2 mb-4 md:mb-5">
              <span className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground font-bold mr-1">Saque inicial:</span>
              {(["A", "B"] as const).map((side) => {
                const t = side === "A" ? teamA : teamB;
                const active = match.initialServingSide === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setInitialServingSide(match.id, side)}
                    className={`px-3 py-1.5 rounded-md border-2 text-xs md:text-sm font-semibold transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-border text-muted-foreground"}`}
                  >
                    {t.shortName}
                  </button>
                );
              })}
            </div>
            <Button onClick={() => startMatch(match.id)} size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Play className="size-4 md:size-5" /> Iniciar partido
            </Button>
          </div>
        )}

        {/* Lineup confirmation required before the set can start */}
        {needsLineup && (
          <div className="rounded-lg md:rounded-xl border-2 border-primary/60 bg-primary/10 px-3 py-2 md:px-5 md:py-3 flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-4 shrink-0">
            <p className="text-xs md:text-sm font-semibold text-center">
              Confirmá la formación inicial del <span className="text-primary font-bold">Set {match.currentSet}</span> para continuar.
            </p>
            <Button size="sm" className="h-8 md:h-10 bg-gradient-primary text-primary-foreground shadow-glow" onClick={() => setShowLineupEditor(true)}>
              <Users className="size-3.5 md:size-4" /> Confirmar formación
            </Button>
          </div>
        )}

        {/* Descanso entre sets: 3 minutos */}
        {inBreak && (
          <div className={`rounded-lg md:rounded-xl border-2 px-3 py-2 md:px-5 md:py-3 flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-4 shrink-0 ${breakRemainingMs > 0 ? "border-amber-500/60 bg-amber-500/10" : "border-success/60 bg-success/10"}`}>
            <div className="flex items-center gap-2 md:gap-3">
              <Hourglass className={`size-4 md:size-5 ${breakRemainingMs > 0 ? "text-amber-500" : "text-success"}`} />
              <p className="text-xs md:text-sm font-semibold text-center">
                {breakRemainingMs > 0 ? (
                  <>Descanso entre sets · <span className="scoreboard-digit tabular-nums font-bold text-amber-600 dark:text-amber-400">{breakLabel}</span></>
                ) : (
                  <span className="text-success font-bold">Fin del descanso · listos para el Set {match.currentSet}</span>
                )}
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="h-8 md:h-10 text-xs md:text-sm">
              <Link to="/matches/$id/stats" params={{ id: match.id }}>
                <ChartBarBig className="size-3.5 md:size-4" /> Ver estadísticas
              </Link>
            </Button>
          </div>
        )}

        {/* After lineup confirmed, scorer must explicitly start the set (starts the timer) */}
        {needsSetStart && (
          <div className="rounded-lg md:rounded-xl border-2 border-success/60 bg-success/10 px-3 py-2 md:px-5 md:py-3 flex flex-col items-center justify-center gap-2 md:gap-3 shrink-0">
            <p className="text-xs md:text-sm font-semibold text-center">
              Formación confirmada. Tocá <span className="text-success font-bold">Iniciar Set {match.currentSet}</span> cuando arranque el juego.
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground font-bold">Saque:</span>
              {(["A", "B"] as const).map((side) => {
                const t = side === "A" ? teamA : teamB;
                const active = match.initialServingSide === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setInitialServingSide(match.id, side)}
                    className={`px-3 py-1.5 rounded-md border-2 text-xs md:text-sm font-semibold transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:border-border text-muted-foreground"}`}
                  >
                    {t.shortName}
                  </button>
                );
              })}
            </div>
            <Button size="sm" className="h-8 md:h-10 bg-success text-success-foreground hover:bg-success/90" onClick={() => startSet(match.id)}>
              <Play className="size-3.5 md:size-4" /> Iniciar Set {match.currentSet}
            </Button>
          </div>
        )}


        {/* Court + side controls */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-2 [@media(max-width:360px)]:gap-1 sm:gap-3 md:gap-5 items-stretch flex-1 min-h-0 md:min-h-[420px]">
          <SideActions
            side="left"
            disabled={actionsDisabled}
            timeoutsUsed={leftSide === "A" ? toUsedA : toUsedB}
            onCambio={() => setSubState({ side: leftSide, playerOutId: "" })}
            onLibero={() => setLiberoState({ side: leftSide, liberoId: null })}
            onTiempo={() => handleTimeout(leftSide)}
            onSancion={() => setSanctionSide(leftSide)}
          />

          <CourtView
            match={match}
            teamA={teamA}
            teamB={teamB}
            leftSide={leftSide}
            serverPlayerId={server.playerId}
            serverSide={server.side}
            onPlayerClick={onPlayerClick}
            receivingSide={receivingSide}
            needsReception={needsReception}
            receiverIds={receiverIds}
          />

          <SideActions
            side="right"
            disabled={actionsDisabled}
            timeoutsUsed={rightSide === "A" ? toUsedA : toUsedB}
            onCambio={() => setSubState({ side: rightSide, playerOutId: "" })}
            onLibero={() => setLiberoState({ side: rightSide, liberoId: null })}
            onTiempo={() => handleTimeout(rightSide)}
            onSancion={() => setSanctionSide(rightSide)}
          />
        </div>

        {/* Bottom action row */}
        <div className={`grid grid-cols-3 ${isCoach ? "sm:grid-cols-7" : "sm:grid-cols-6"} gap-1 md:gap-3 shrink-0`}>
          <Button size="sm" variant="secondary" className="h-8 sm:h-10 md:h-11 text-xs md:text-sm" disabled={match.status === "scheduled" || match.events.length === 0} onClick={() => undo(match.id)}>
            <Undo2 className="size-3 md:size-4" /> Deshacer
          </Button>
          <Button size="sm" variant="secondary" className="h-8 sm:h-10 md:h-11 text-xs md:text-sm" disabled={!isLive} onClick={() => setShowLineupEditor(true)}>
            <Users className="size-3 md:size-4" /> Formación
          </Button>
          {isCoach && (
            <Button size="sm" variant="secondary" className="h-8 sm:h-10 md:h-11 text-xs md:text-sm bg-primary/10 hover:bg-primary/20 border border-primary/30" disabled={!isLive || actionsDisabled} onClick={() => setShowSettingDialog(true)}>
              <Target className="size-3 md:size-4" /> Armado
            </Button>
          )}
          <Button size="sm" variant="secondary" className="h-8 sm:h-10 md:h-11 text-xs md:text-sm" onClick={() => setShowLiveStats(true)}>
            <ChartBarBig className="size-3 md:size-4" /> Stats vivo
          </Button>
          <Button asChild size="sm" variant="secondary" className="h-8 sm:h-10 md:h-11 text-xs md:text-sm">
            <Link to="/matches/$id/stats" params={{ id: match.id }}>
              <ChartBarBig className="size-3 md:size-4" /> Estadísticas
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 sm:h-10 md:h-11 text-xs md:text-sm" disabled={match.status === "finished"} onClick={() => setShowFormatDialog(true)}>
            <Hourglass className="size-3 md:size-4" /> Formato
          </Button>
          <Button size="sm" variant="destructive" className="h-8 sm:h-10 md:h-11 text-xs md:text-sm" disabled={match.status === "finished"}
            onClick={() => { if (confirm("¿Finalizar el partido manualmente?")) finishMatch(match.id); }}>
            <Flag className="size-3 md:size-4" /> Fin Partido
          </Button>
        </div>

        {(match.sets.length > 0 || match.setStartTimes?.[1]) && (
          <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2 shrink-0">
            {match.setStartTimes?.[1] && (
              <div className="px-2 md:px-3 py-0.5 md:py-1 rounded text-[10px] md:text-xs scoreboard-digit font-bold tabular-nums border border-border/60 text-muted-foreground">
                Inicio: <span className="text-foreground">{formatLocalTime(match.setStartTimes[1])}</span>
              </div>
            )}
            {match.sets.map((s) => {
              const dur = getSetDuration(match, s.number, now);
              return (
                <div key={s.number} className={`px-2 md:px-3 py-0.5 md:py-1 rounded text-[10px] md:text-xs scoreboard-digit font-bold tabular-nums border ${
                  s.number === match.currentSet ? "border-primary text-primary bg-primary/5" : "border-border/60 text-muted-foreground"
                }`}>
                  Set {s.number}: <span className="text-foreground">{s.scoreA}–{s.scoreB}</span>
                  {s.finished && (
                    <span className="ml-1 text-success">{s.scoreA > s.scoreB ? `▲${teamA.shortName}` : `▲${teamB.shortName}`}</span>
                  )}
                  {dur !== null && (
                    <span className="ml-1 text-muted-foreground">· {formatDurationMs(dur)}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>


      {/* Action menu when a player is tapped */}
      <Dialog open={!!pendingPlayer} onOpenChange={(o) => !o && setPendingPlayer(null)}>
        <DialogContent className="live-action-dialog w-[calc(100dvw-24px)] max-w-[374px] max-h-[calc(100dvh-16px)] overflow-visible rounded-xl border-border/60 p-3 gap-2">
          {pendingPlayer && (() => {
            const t = pendingPlayer.side === "A" ? teamA : teamB;
            const other = pendingPlayer.side === "A" ? teamB : teamA;
            const player = t.players.find((p) => p.id === pendingPlayer.playerId);
            const isServer = server.side === pendingPlayer.side && server.playerId === pendingPlayer.playerId;
            const activeLibero = pendingPlayer.side === "A" ? match.liberoActiveA : match.liberoActiveB;
            const isActiveLibero = !!activeLibero && activeLibero.liberoId === pendingPlayer.playerId;
            const replacedPlayer = isActiveLibero ? t.players.find((p) => p.id === activeLibero!.replacedId) : null;
            const actions: { type: PointType; label: string; tone: "primary" | "neutral" | "danger" }[] = [
              { type: "ace", label: "Saque (Ace)", tone: "primary" },
              { type: "serve_error", label: "Error de saque", tone: "danger" },
              { type: "rotation_attack", label: "Ataque de rotación", tone: "primary" },
              { type: "attack_error", label: "Error de ataque", tone: "danger" },
              { type: "counter_attack", label: "Contraataque", tone: "primary" },
              { type: "unforced_error", label: "Error no forzado", tone: "danger" },
              { type: "block", label: "Bloqueo", tone: "primary" },
            ];
            return (
              <>
                <DialogHeader className="pr-8 space-y-0 text-left">
                  <DialogTitle className="flex items-center gap-3 min-w-0">
                    <span className="size-9 shrink-0 rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-sm" style={{ background: t.color }}>
                      {player?.number}
                    </span>
                     <span className="min-w-0 truncate">
                      <span className="block text-sm font-bold">{player?.name}</span>
                      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        {t.name} {isServer && "· saca"}
                      </span>
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2 mt-5">
                  {actions.map((a) => (
                    <button key={a.type} onClick={() => submitAction(a.type)}
                      className={`min-h-11 w-full text-center px-2 py-2 rounded-lg font-semibold text-[13px] leading-tight transition-all active:scale-[0.98] ${
                        a.tone === "primary" ? "bg-primary text-primary-foreground hover:opacity-90"
                          : a.tone === "danger" ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                          : "bg-secondary hover:bg-secondary/70"
                      }`}>
                      {a.label}
                    </button>
                  ))}
                </div>
                {isActiveLibero && replacedPlayer && (
                  <button
                    onClick={() => {
                      recordLiberoOut(match.id, pendingPlayer.side);
                      setPendingPlayer(null);
                    }}
                    className="mt-2 w-full min-h-11 px-3 py-2 rounded-lg font-bold text-[13px] leading-tight bg-destructive text-destructive-foreground hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Shirt className="size-4" />
                    Sacar líbero · vuelve #{replacedPlayer.number} {replacedPlayer.name}
                  </button>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Attack zone picker (after rotation/counter attack) */}
      <Dialog open={!!pendingZone} onOpenChange={(o) => !o && setPendingZone(null)}>
        <DialogContent className="w-[calc(100dvw-24px)] max-w-[340px] rounded-xl border-border/60 p-3 gap-2">
          {pendingZone && (() => {
            const t = pendingZone.side === "A" ? teamA : teamB;
            const player = t.players.find((p) => p.id === pendingZone.playerId);
            const actionLabel = pendingZone.type === "counter_attack" ? "Contraataque" : "Ataque de rotación";
            return (
              <>
                <DialogHeader className="pr-8 space-y-0 text-left">
                  <DialogTitle className="flex items-center gap-3 min-w-0">
                    <span className="size-9 shrink-0 rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-sm" style={{ background: t.color }}>
                      {player?.number}
                    </span>
                    <span className="min-w-0 truncate">
                      <span className="block text-sm font-bold">{player?.name}</span>
                      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        {actionLabel} · ¿desde qué zona?
                      </span>
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <button
                    onClick={() => submitZone(4)}
                    className="min-h-16 rounded-lg bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center"
                  >
                    <span className="text-lg leading-none">4</span>
                    <span className="text-[10px] opacity-80 mt-1">Punta</span>
                  </button>
                  <button
                    onClick={() => submitZone(3)}
                    className="min-h-16 rounded-lg bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center"
                  >
                    <span className="text-lg leading-none">3</span>
                    <span className="text-[10px] opacity-80 mt-1">Central</span>
                  </button>
                  <button
                    onClick={() => submitZone(2)}
                    className="min-h-16 rounded-lg bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center"
                  >
                    <span className="text-lg leading-none">2</span>
                    <span className="text-[10px] opacity-80 mt-1">Opuesto</span>
                  </button>
                  <button
                    onClick={() => submitZone(5)}
                    className="min-h-16 rounded-lg bg-secondary hover:bg-secondary/70 font-bold text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center"
                  >
                    <span className="text-lg leading-none">5</span>
                    <span className="text-[10px] opacity-80 mt-1">Zag. 5</span>
                  </button>
                  <button
                    onClick={() => submitZone(6)}
                    className="min-h-16 rounded-lg bg-secondary hover:bg-secondary/70 font-bold text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center"
                  >
                    <span className="text-lg leading-none">6</span>
                    <span className="text-[10px] opacity-80 mt-1">Zag. 6</span>
                  </button>
                  <button
                    onClick={() => submitZone(1)}
                    className="min-h-16 rounded-lg bg-secondary hover:bg-secondary/70 font-bold text-sm active:scale-[0.98] transition-all flex flex-col items-center justify-center"
                  >
                    <span className="text-lg leading-none">1</span>
                    <span className="text-[10px] opacity-80 mt-1">Zag. 1</span>
                  </button>

                </div>

                <button
                  type="button"
                  onClick={() => setPendingZone(null)}
                  className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline self-center"
                >
                  Sin zona / cancelar
                </button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* Reception rating dialog */}
      <Dialog open={!!pendingReception} onOpenChange={(o) => !o && setPendingReception(null)}>
        <DialogContent className="w-[calc(100dvw-24px)] max-w-[360px] rounded-xl border-border/60 p-3 gap-2">
          {pendingReception && (() => {
            const t = pendingReception.side === "A" ? teamA : teamB;
            const player = t.players.find((p) => p.id === pendingReception.playerId);
            return (
              <>
                <DialogHeader className="pr-8 space-y-0 text-left">
                  <DialogTitle className="flex items-center gap-3 min-w-0">
                    <span className="size-9 shrink-0 rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-sm" style={{ background: t.color }}>
                      {player?.number}
                    </span>
                    <span className="min-w-0 truncate">
                      <span className="block text-sm font-bold">{player?.name}</span>
                      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        Recepción · {t.name}
                      </span>
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button
                    onClick={() => submitReception("positive")}
                    className="min-h-14 rounded-lg bg-success text-success-foreground font-black text-2xl active:scale-95 transition"
                  >
                    +
                  </button>
                  <button
                    onClick={() => submitReception("neutral")}
                    className="min-h-14 rounded-lg bg-muted text-foreground font-black text-2xl active:scale-95 transition"
                  >
                    0
                  </button>
                  <button
                    onClick={() => submitReception("negative")}
                    className="min-h-14 rounded-lg bg-destructive text-destructive-foreground font-black text-2xl active:scale-95 transition"
                  >
                    −
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  + Positiva · 0 Neutra · − Negativa
                </p>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>



      {/* Substitution panel: local to the rotated match screen so it never gets clipped off-screen. */}
      {subState && (() => {
        const t = subState.side === "A" ? teamA : teamB;
        const onCourt = subState.side === "A" ? match.onCourtA : match.onCourtB;
        const onCourtSet = new Set(onCourt);
        const availableSubs = t.players.filter((p) => !onCourtSet.has(p.id));
        const playersToShow = subState.playerOutId
          ? availableSubs
          : onCourt.map((pid) => t.players.find((x) => x.id === pid)).filter(Boolean);

        return (
          <div className="absolute inset-0 z-[80] grid place-items-center bg-background/85 p-3 backdrop-blur-sm">
            <div className="relative w-full max-w-[420px] max-h-[calc(100%-24px)] overflow-y-auto rounded-xl border border-border bg-background p-3 shadow-elevated">
              <button
                type="button"
                onClick={() => setSubState(null)}
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Cerrar cambio"
              >
                <X className="size-4" />
              </button>
              <div className="pr-10">
                <h2 className="truncate text-sm font-bold md:text-lg">Cambio · {t.name}</h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:text-xs">
                  {subState.playerOutId ? "Jugador que ENTRA" : "Jugador que SALE"}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 md:grid-cols-2">
                {playersToShow.map((p) => p && (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (!subState.playerOutId) {
                        setSubState({ ...subState, playerOutId: p.id });
                        return;
                      }
                      recordSub(match.id, subState.side, p.id, subState.playerOutId);
                      setSubState(null);
                    }}
                    className="flex min-w-0 items-center gap-1.5 rounded-lg bg-secondary p-1.5 text-left transition hover:bg-secondary/70 active:scale-95 md:p-3"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded bg-background text-[10px] font-bold scoreboard-digit md:size-8 md:text-xs">
                      {p.number}
                    </span>
                    <span className="min-w-0 truncate text-[11px] md:text-sm">{p.name}</span>
                  </button>
                ))}
                {subState.playerOutId && availableSubs.length === 0 && (
                  <p className="col-span-3 py-3 text-center text-xs text-muted-foreground md:col-span-2">No hay suplentes disponibles.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* Format dialog */}
      <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
        <DialogContent className="max-w-xs">
          <FormatDialog
            match={match}
            onSave={(stw, pps) => { updateMatchFormat(match.id, stw, pps); setShowFormatDialog(false); }}
            onCancel={() => setShowFormatDialog(false)}
          />
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

      {/* Libero entry/exit dialog */}
      <Dialog open={!!liberoState} onOpenChange={(o) => !o && setLiberoState(null)}>
        <DialogContent>
          {liberoState && (() => {
            const t = liberoState.side === "A" ? teamA : teamB;
            const onCourt = liberoState.side === "A" ? match.onCourtA : match.onCourtB;
            const onCourtSet = new Set(onCourt);
            const active = liberoState.side === "A" ? match.liberoActiveA : match.liberoActiveB;
            const designated = (liberoState.side === "A"
              ? [match.liberoA1Id, match.liberoA2Id]
              : [match.liberoB1Id, match.liberoB2Id]
            ).filter(Boolean) as string[];
            const liberoCandidateIds = new Set<string>([
              ...designated,
              ...t.players.filter((p) => p.position === "libero").map((p) => p.id),
            ]);
            const liberos = t.players.filter(
              (p) => liberoCandidateIds.has(p.id) && !onCourtSet.has(p.id),
            );
            const totalLiberos = t.players.filter((p) => liberoCandidateIds.has(p.id)).length;
            const allOnCourt = totalLiberos > 0 && liberos.length === 0;

            // Si ya hay un líbero activo en esta cancha: ofrecer cerrar el cambio.
            if (active) {
              const liberoPlayer = t.players.find((p) => p.id === active.liberoId);
              const replacedPlayer = t.players.find((p) => p.id === active.replacedId);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-sm md:text-lg">Líbero · {t.name}</DialogTitle>
                  </DialogHeader>
                  <div className="mt-2 space-y-3">
                    <div className="rounded-lg border border-border bg-secondary/50 p-3 text-xs md:text-sm">
                      <p className="font-semibold">
                        En cancha: #{liberoPlayer?.number} {liberoPlayer?.name}
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Reemplaza a #{replacedPlayer?.number} {replacedPlayer?.name}
                      </p>
                    </div>
                    <p className="text-[11px] md:text-xs text-muted-foreground">
                      El líbero saldrá automáticamente cuando su jugador rote a posición 4. Podés cerrar el cambio manualmente acá.
                    </p>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        recordLiberoOut(match.id, liberoState.side);
                        setLiberoState(null);
                      }}
                    >
                      Cerrar cambio — sale el líbero
                    </Button>
                  </div>
                </>
              );
            }

            return (
              <>
                <DialogHeader><DialogTitle className="text-sm md:text-lg">Líbero · {t.name}</DialogTitle></DialogHeader>
                {!liberoState.liberoId ? (
                  <>
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Líbero que ENTRA</p>
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5">
                      {liberos.map((p) => (
                        <button key={p.id} onClick={() => setLiberoState({ ...liberoState, liberoId: p.id })}
                          className="flex items-center gap-1.5 p-1.5 md:p-3 rounded-lg bg-secondary hover:bg-success/20 active:scale-95 transition">
                          <span className="size-6 md:size-8 rounded scoreboard-digit font-bold bg-background flex items-center justify-center text-[10px] md:text-xs shrink-0">{p.number}</span>
                          <span className="text-[11px] md:text-sm truncate min-w-0">{p.name}</span>
                        </button>
                      ))}
                      {liberos.length === 0 && (
                        <p className="col-span-3 md:col-span-2 text-center text-xs text-muted-foreground py-3">
                          {allOnCourt
                            ? "Todos los líberos ya están en cancha. Sacalos primero con un cambio normal."
                            : "No hay líberos disponibles. Asigná la posición \"Líbero\" a un jugador del plantel o designá líberos al crear el partido."}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Jugador que SALE (solo zaguero: P1, P5 o P6)</p>
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-1.5">
                      {onCourt.map((pid, idx) => {
                        const p = t.players.find((x) => x.id === pid);
                        if (!p) return null;
                        // Regla oficial: el líbero solo puede reemplazar a un zaguero (P1=idx0, P5=idx4, P6=idx5).
                        const isBackRow = idx === 0 || idx === 4 || idx === 5;
                        return (
                          <button key={p.id}
                            disabled={!isBackRow}
                            onClick={() => { if (!isBackRow) return; recordLiberoIn(match.id, liberoState.side, liberoState.liberoId!, p.id); setLiberoState(null); }}
                            className={`flex items-center gap-1.5 p-1.5 md:p-3 rounded-lg transition ${isBackRow ? "bg-secondary hover:bg-destructive/20 active:scale-95" : "bg-secondary/30 opacity-40 cursor-not-allowed"}`}>
                            <span className="size-6 md:size-8 rounded scoreboard-digit font-bold bg-background flex items-center justify-center text-[10px] md:text-xs shrink-0">{p.number}</span>
                            <span className="text-[11px] md:text-sm truncate min-w-0">{p.name}</span>
                            <span className="ml-auto text-[9px] md:text-[10px] font-bold uppercase text-muted-foreground">P{idx + 1}</span>
                          </button>
                        );
                      })}
                    </div>

                  </>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Set lineup editor */}
      <Dialog open={showLineupEditor} onOpenChange={setShowLineupEditor}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {showLineupEditor && (
            <LineupEditor
              match={match}
              teamA={teamA}
              teamB={teamB}
              onSave={(lineupA, lineupB) => {
                if (setNotStarted) {
                  setSetLineup(match.id, "A", lineupA);
                  setSetLineup(match.id, "B", lineupB);
                  confirmSetLineup(match.id);
                } else {
                  // Mid-set correction: append override events so future rotations follow new positions.
                  overrideLineup(match.id, "A", lineupA);
                  overrideLineup(match.id, "B", lineupB);
                }
                setShowLineupEditor(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Score correction dialog */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="max-w-xs">
          <ScoreCorrectionDialog
            setNumber={match.currentSet}
            teamA={teamA}
            teamB={teamB}
            scoreA={currentSet.scoreA}
            scoreB={currentSet.scoreB}
            onSave={(sa, sb) => { overrideScore(match.id, sa, sb); setShowScoreDialog(false); }}
            onCancel={() => setShowScoreDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Live stats */}
      <Dialog open={showLiveStats} onOpenChange={setShowLiveStats} modal={false}>
        <DialogContent className="live-stats-dialog flex h-[85dvh] max-h-[85dvh] w-[calc(100dvw-24px)] max-w-3xl flex-col overflow-hidden rounded-xl border-border/60 p-0 gap-0">
          <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left">
            <DialogTitle>Estadísticas en vivo</DialogTitle>
          </DialogHeader>
          <div className="live-stats-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
            <LiveStatsPanel key={`${showLiveStats}-${match.currentSet}`} match={match} teamA={teamA} teamB={teamB} isCoach={isCoach} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Armado · Modo Entrenador */}
      {isCoach && (
        <SettingDialog
          open={showSettingDialog}
          onClose={() => setShowSettingDialog(false)}
          teamA={teamA}
          teamB={teamB}
          onCourtA={match.onCourtA}
          onCourtB={match.onCourtB}
          onSubmit={(payload) => {
            const { side, ...rest } = payload;
            recordSetting(match.id, side, rest);
          }}
        />
      )}
    </CompactShell>
  );
}

function CompactShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="live-match-shell min-h-[100dvh] flex flex-col bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-xl px-3 md:px-8 h-8 md:h-14 flex items-center justify-between shrink-0">
        <Link to="/matches" className="flex items-center gap-2 md:gap-3 min-h-10">
          <div className="size-6 md:size-9 rounded-md md:rounded-lg bg-gradient-primary flex items-center justify-center">
            <Volleyball className="size-3.5 md:size-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xs md:text-base tracking-tight">RALLY</span>
        </Link>
        <Link to="/matches" className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground font-bold min-h-10 flex items-center">
          ← Partidos
        </Link>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden md:overflow-auto">{children}</main>
    </div>
  );
}

function ScoreColumn({ team, score, sets, align, serving, onScoreClick }: {
  team: Team; score: number; sets: number; align: "left" | "right"; serving: boolean; onScoreClick?: () => void;
}) {
  const scoreEl = (
    <button
      type="button"
      onClick={onScoreClick}
      disabled={!onScoreClick}
      className={`inline-flex items-center gap-1 ${onScoreClick ? "cursor-pointer hover:opacity-80 active:scale-95 transition-all" : ""}`}
    >
      <span className="scoreboard-digit text-3xl sm:text-4xl md:text-7xl font-black leading-none text-primary">{score}</span>
      {onScoreClick && <Edit3 className="size-3 md:size-4 text-muted-foreground opacity-60" />}
    </button>
  );
  return (
    <div className={`flex items-center gap-1.5 md:gap-4 ${align === "right" ? "justify-end text-right flex-row-reverse" : "text-left"}`}>
      {team.logoUrl ? (
        <div className="size-7 md:size-14 rounded-md md:rounded-lg overflow-hidden bg-background border border-border/60 shrink-0">
          <img src={team.logoUrl} alt={team.shortName} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="size-7 md:size-14 rounded-md md:rounded-lg flex items-center justify-center font-black text-white text-[10px] md:text-base shrink-0" style={{ background: team.color }}>
          {team.shortName}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[11px] md:text-lg font-bold truncate flex items-center gap-1 md:gap-1.5">
          {team.name}
          {serving && <span className="text-[8px] md:text-[11px] uppercase tracking-widest text-primary">● Saque</span>}
        </div>
        <div className="text-[8px] md:text-[11px] uppercase tracking-widest text-muted-foreground">
          Sets <span className="text-foreground font-bold">{sets}</span>
        </div>
        <div className="hidden md:block mt-1">{scoreEl}</div>
      </div>
      <div className="md:hidden shrink-0">{scoreEl}</div>
    </div>
  );
}

function SideActions({ side, disabled, timeoutsUsed, onCambio, onLibero, onTiempo, onSancion }: {
  side: "left" | "right"; disabled: boolean; timeoutsUsed: number;
  onCambio: () => void; onLibero: () => void; onTiempo: () => void; onSancion: () => void;
}) {
  const reverse = side === "right";
  return (
    <div className="flex flex-col gap-1 md:gap-2.5 w-[52px] [@media(max-width:360px)]:w-[44px] sm:w-[92px] md:w-[140px] shrink-0">
      <SideButton icon={<ArrowLeftRight className="size-3 md:size-5" />} label="Cambio" onClick={onCambio} disabled={disabled} reverse={reverse} />
      <SideButton icon={<Shirt className="size-3 md:size-5" />} label="Líbero" onClick={onLibero} disabled={disabled} reverse={reverse} />
      <SideButton
        icon={<Hourglass className="size-3 md:size-5" />}
        label="Tiempo"
        badge={`${timeoutsUsed}/2`}
        onClick={onTiempo}
        disabled={disabled || timeoutsUsed >= 2}
        reverse={reverse}
      />
      <SideButton icon={<X className="size-3 md:size-5" />} label="Sanción" onClick={onSancion} disabled={disabled} reverse={reverse} />
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


function CourtView({ match, teamA, teamB, leftSide, serverPlayerId, serverSide, onPlayerClick, receivingSide, needsReception, receiverIds }: {
  match: Match; teamA: Team; teamB: Team; leftSide: "A" | "B";
  serverPlayerId: string | null; serverSide: "A" | "B";
  onPlayerClick: (side: "A" | "B", playerId: string) => void;
  receivingSide: "A" | "B"; needsReception: boolean; receiverIds: Set<string>;
}) {
  const a = match.onCourtA;
  const b = match.onCourtB;
  const rightSide: "A" | "B" = leftSide === "A" ? "B" : "A";
  const teamFor = (s: "A" | "B") => (s === "A" ? teamA : teamB);
  // 4 columns left→right: left back, left front, right front, right back
  const columns: Array<{ side: "A" | "B"; team: Team; idxs: number[] }> = [
    { side: leftSide, team: teamFor(leftSide), idxs: [4, 5, 0] },
    { side: leftSide, team: teamFor(leftSide), idxs: [3, 2, 1] },
    { side: rightSide, team: teamFor(rightSide), idxs: [1, 2, 3] },
    { side: rightSide, team: teamFor(rightSide), idxs: [0, 5, 4] },
  ];
  return (
    <div className="relative rounded-lg md:rounded-xl overflow-hidden h-full min-h-[140px] [@media(max-width:360px)]:min-h-[100px] sm:min-h-[220px] md:min-h-[420px] bg-[#1e5fa8] p-1.5 [@media(max-width:360px)]:p-1 sm:p-5 md:p-7">
      {/* court inner (orange) with white perimeter line */}
      <div className="absolute inset-2 [@media(max-width:360px)]:inset-1.5 sm:inset-5 md:inset-7 bg-[#f4a36a] border-2 border-white rounded-sm" />
      {/* attack zones (darker orange) — the two front-row columns */}
      <div className="absolute inset-y-2 [@media(max-width:360px)]:inset-y-1.5 sm:inset-y-5 md:inset-y-7 left-1/2 -translate-x-1/2 flex pointer-events-none">

        <div className="h-full w-[calc(50vw)] max-w-none" />
      </div>
      {/* dashed center net line */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-white pointer-events-none z-10" />
      {/* antenna dots top/bottom of net */}
      <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white z-10" />
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white z-10" />
      {/* attack-line dashes (3m lines) */}
      <div className="absolute top-0 bottom-0 left-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />

      <div className="absolute inset-3 [@media(max-width:360px)]:inset-2 sm:inset-8 md:inset-10 grid grid-cols-4 z-20">
        {columns.map((col, ci) => {
          const onCourt = col.side === "A" ? a : b;
          const serverPid = serverSide === col.side ? serverPlayerId : null;
          const isFront = ci === 1 || ci === 2;
          return (
              <div
                key={ci}
                className={`grid grid-rows-3 items-center gap-1 [@media(max-width:360px)]:gap-0.5 sm:gap-3 h-full px-0.5 [@media(max-width:360px)]:px-0 sm:px-2 ${isFront ? "bg-[#ec7a3c]/70" : ""}`}
              >
                {col.idxs.map((idx) => {
                  const pid = onCourt[idx];
                  const p = col.team.players.find((x) => x.id === pid);
                  const isServer = pid && pid === serverPid;
                  const designated = (col.side === "A"
                    ? [match.liberoA1Id, match.liberoA2Id]
                    : [match.liberoB1Id, match.liberoB2Id]
                  ).filter(Boolean) as string[];
                  const isLibero = !!p && (designated.length > 0 ? designated.includes(p.id) : p.position === "libero");
                  const isSetter = !!p && p.position === "armador";
                  const pairColor = p && !isLibero
                    ? (p.position === "armador" || p.position === "opuesto"
                        ? "#22d3ee" // cyan — armador ↔ opuesto
                        : p.position === "punta"
                        ? "#a3e635" // lime — punta ↔ punta
                        : p.position === "central"
                        ? "#f472b6" // pink — central ↔ central
                        : null)
                    : null;
                  const roleLabel = p && !isLibero
                    ? (p.position === "armador" ? "A"
                        : p.position === "opuesto" ? "O"
                        : p.position === "punta" ? "P"
                        : p.position === "central" ? "C"
                        : null)
                    : null;
                  let replacedName: string | null = null;
                  if (isLibero && pid) {
                    const active = col.side === "A" ? match.liberoActiveA : match.liberoActiveB;
                    if (active && active.liberoId === pid) {
                      const rp = col.team.players.find((x) => x.id === active.replacedId);
                      replacedName = rp ? `#${rp.number} ${rp.name}` : null;
                    }
                  }
                  const isReceptionTarget = needsReception && col.side === receivingSide && !!pid;
                  const isReceiverHighlight = isReceptionTarget && receiverIds.has(pid);
                  return (
                    <button
                      key={`${ci}-${idx}`}
                      onClick={() => p && onPlayerClick(col.side, p.id)}
                      disabled={!p}
                      className={`relative rounded-full flex flex-col items-center justify-center text-white font-black shadow-md transition-all active:scale-95 hover:ring-2 sm:hover:ring-4 hover:ring-white/30 aspect-square mx-auto h-[58%] [@media(max-width:360px)]:h-[48%] sm:h-[72%] overflow-hidden ${isServer ? "ring-2 [@media(max-width:360px)]:ring-1 sm:ring-4 ring-primary" : ""} ${pairColor || isLibero ? "border-[2px] [@media(max-width:360px)]:border sm:border-[3px] md:border-4" : ""} ${isReceiverHighlight ? "ring-2 [@media(max-width:360px)]:ring-1 sm:ring-4 ring-yellow-300 animate-pulse" : ""} ${isReceptionTarget && !isReceiverHighlight ? "ring-2 [@media(max-width:360px)]:ring-1 ring-white/50" : ""}`}
                      style={isLibero
                        ? { background: "#ffffff", color: col.team.color, borderColor: col.team.color }
                        : { background: col.team.color, borderColor: pairColor ?? undefined }}
                      title={p ? `#${p.number} ${p.name}` : ""}
                    >
                      <span className="scoreboard-digit leading-none text-sm [@media(max-width:360px)]:text-xs sm:text-xl md:text-3xl" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{p?.number ?? "?"}</span>
                      {p && (
                        <span className="max-w-[90%] truncate text-[9px] [@media(max-width:360px)]:text-[7px] sm:text-[13px] md:text-[16px] font-bold leading-tight" style={{ textShadow: '-0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000' }}>{p.name}</span>
                      )}
                      {isLibero && replacedName && (
                        <span className="max-w-[90%] truncate text-[5px] [@media(max-width:360px)]:text-[4px] sm:text-[8px] md:text-[9px] font-semibold leading-tight opacity-70">↔ {replacedName}</span>
                      )}
                      {isLibero && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 px-1 rounded-b text-[5px] [@media(max-width:360px)]:text-[4px] sm:text-[8px] font-bold uppercase tracking-widest text-white" style={{ background: col.team.color }}>L</span>
                      )}
                      {roleLabel && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 rounded-b text-[7px] [@media(max-width:360px)]:text-[5px] sm:text-[10px] font-black uppercase tracking-widest text-black shadow-md" style={{ background: pairColor ?? undefined }}>{roleLabel}</span>
                      )}
                      {isServer && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 sm:px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[7px] [@media(max-width:360px)]:text-[5px] sm:text-[8px] font-bold uppercase tracking-widest">Saque</span>
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
  const [seconds, setSeconds] = useState(30);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);
  useEffect(() => {
    if (seconds === 0) {
      if (timer.current) clearInterval(timer.current);
      // Cierre automático al terminar el tiempo (1s para mostrar "finalizado")
      closeTimer.current = setTimeout(() => onClose(), 1000);
    }
  }, [seconds, onClose]);
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

function LineupEditor({ match, teamA, teamB, onSave }: {
  match: Match; teamA: Team; teamB: Team;
  onSave: (lineupA: string[], lineupB: string[]) => void;
}) {
  const [lineupA, setLineupA] = useState<string[]>([...match.onCourtA]);
  const [lineupB, setLineupB] = useState<string[]>([...match.onCourtB]);
  const [step, setStep] = useState<1 | 2>(1);
  const validSide = (l: string[]) => l.filter(Boolean).length === 6 && new Set(l.filter(Boolean)).size === 6;
  const validA = validSide(lineupA);
  const validB = validSide(lineupB);

  const team = step === 1 ? teamA : teamB;
  const lineup = step === 1 ? lineupA : lineupB;
  const setLineup = step === 1 ? setLineupA : setLineupB;
  const stepValid = step === 1 ? validA : validB;
  const filled = lineup.filter(Boolean).length;
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  const designatedLiberoIds = new Set<string>(
    (step === 1
      ? [match.liberoA1Id, match.liberoA2Id]
      : [match.liberoB1Id, match.liberoB2Id]
    ).filter(Boolean) as string[],
  );
  const isLiberoPlayer = (playerId: string) => {
    if (designatedLiberoIds.has(playerId)) return true;
    const pl = team.players.find((x) => x.id === playerId);
    return pl?.position === "libero";
  };
  const isFrontRowSlot = (slot: number) => slot === 1 || slot === 2 || slot === 3;

  const grid: { idx: number; label: string; sub?: string }[][] = [
    [{ idx: 3, label: "4" }, { idx: 2, label: "3" }, { idx: 1, label: "2" }],
    [{ idx: 4, label: "5" }, { idx: 5, label: "6" }, { idx: 0, label: "1", sub: "saca" }],
  ];

  const setSlot = (slotIdx: number, playerId: string | null) => {
    const next = [...lineup];
    if (playerId) {
      const prev = next.indexOf(playerId);
      if (prev >= 0 && prev !== slotIdx) {
        // Intercambio: el jugador que estaba en slotIdx pasa al slot previo
        next[prev] = next[slotIdx] ?? "";
      }
    }
    next[slotIdx] = playerId ?? "";
    setLineup(next);
  };

  // Rota la formación en sentido del saque: P1→P6→P5→P4→P3→P2→P1
  const rotateLineup = () => {
    if (lineup.filter(Boolean).length !== 6) return;
    // idx: 0=P1, 1=P2, 2=P3, 3=P4, 4=P5, 5=P6
    // Tras rotar, el de P2 pasa a P1, P3→P2, P4→P3, P5→P4, P6→P5, P1→P6
    const next = [lineup[1], lineup[2], lineup[3], lineup[4], lineup[5], lineup[0]];
    setLineup(next);
  };

  // Reset picker when switching team step
  const goToStep = (s: 1 | 2) => { setPickingSlot(null); setStep(s); };

  const pickingLabel = pickingSlot !== null
    ? (grid.flat().find((g) => g.idx === pickingSlot)?.label ?? "")
    : "";

  return (
    <div className="flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between gap-2">
          <span>Formación · Set {match.currentSet}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Paso {step} / 2</span>
        </DialogTitle>
      </DialogHeader>

      <div className="flex items-center gap-2">
        <StepChip n={1} label={teamA.shortName} active={step === 1} done={validA} onClick={() => goToStep(1)} color={teamA.color} />
        <div className="flex-1 h-0.5 bg-border/60 rounded-full overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: validA ? "100%" : "0%" }} />
        </div>
        <StepChip n={2} label={teamB.shortName} active={step === 2} done={validB} onClick={() => validA && goToStep(2)} color={teamB.color} disabled={!validA} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {team.logoUrl ? (
            <img src={team.logoUrl} alt="" className="size-7 rounded object-cover shrink-0" />
          ) : (
            <span className="size-7 rounded text-white text-[10px] font-black flex items-center justify-center shrink-0" style={{ background: team.color }}>{team.shortName}</span>
          )}
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{team.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              {step === 1 ? "Equipo local" : "Equipo visitante"}
            </div>
          </div>
        </div>
        <span className="text-xs scoreboard-digit font-bold shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={rotateLineup}
            disabled={!stepValid}
            title="Rotar formación"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/60 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeftRight className="size-3" /> Rotar
          </button>
          <span>
            <span className={stepValid ? "text-success" : "text-primary"}>{filled}</span>
            <span className="text-muted-foreground"> / 6</span>
          </span>
        </span>
      </div>


      <div className="relative rounded-xl bg-gradient-to-b from-[#1e293b] to-[#0b1322] p-3 border border-court-line/40">
        <div className="text-center text-[9px] uppercase tracking-widest text-muted-foreground mb-1">— red —</div>
        {(() => {
          // Rol por slot en base a la posición del armador (sentido antihorario).
          // slotIdx 0..5 ↔ pos 1..6; secuencia CCW: 1→6→5→4→3→2.
          const ccwIndexByPos: Record<number, number> = { 1: 0, 6: 1, 5: 2, 4: 3, 3: 4, 2: 5 };
          const roleOrder = ["A", "P1", "C1", "O", "P2", "C2"];
          const armadorSlot = lineup.findIndex((pid) => {
            const pl = team.players.find((x) => x.id === pid);
            return pl?.position === "armador";
          });
          const armadorPos = armadorSlot >= 0 ? armadorSlot + 1 : -1;
          const roleFor = (slotIdx: number): string | null => {
            if (armadorPos < 0) return null;
            const pos = slotIdx + 1;
            const offset = (ccwIndexByPos[pos] - ccwIndexByPos[armadorPos] + 6) % 6;
            return roleOrder[offset];
          };
          return grid.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-2 mb-2 last:mb-0">
              {row.map(({ idx, label, sub }) => {
                const pid = lineup[idx];
                const p = team.players.find((x) => x.id === pid);
                return (
                  <LineupSlotCell
                    key={idx}
                    label={label}
                    sub={sub}
                    role={roleFor(idx)}
                    teamColor={team.color}
                    player={p}
                    onOpen={() => setPickingSlot(idx)}
                    onClear={() => setSlot(idx, null)}
                  />
                );
              })}
            </div>
          ));
        })()}

        {pickingSlot !== null && (
          <div className="absolute inset-0 rounded-xl bg-background/95 backdrop-blur-sm flex flex-col p-2 z-20">
            <div className="flex items-center justify-between px-1 pb-2 border-b border-border/60">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
                Elegir jugador · <span className="text-primary">P{pickingLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setPickingSlot(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto mt-2 grid grid-cols-2 gap-1.5">
              {team.players.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground text-center py-4">Sin jugadores en el equipo.</p>
              )}
              {team.players.map((pl) => {
                const slotOfPl = lineup.indexOf(pl.id);
                const onCourt = slotOfPl >= 0;
                const takenElsewhere = onCourt && slotOfPl !== pickingSlot;
                const isCurrent = lineup[pickingSlot] === pl.id;
                const isLib = isLiberoPlayer(pl.id);
                const liberoInFront = isLib && isFrontRowSlot(pickingSlot);
                // Sólo bloquear si hay OTRO líbero en cancha que NO sea el que vamos a intercambiar
                const currentPidInSlot = lineup[pickingSlot];
                const otherLiberoOnCourt = isLib && lineup.some(
                  (pid, i) => pid && i !== pickingSlot && pid !== pl.id && isLiberoPlayer(pid) && pid !== currentPidInSlot,
                );
                const liberoForbidden = liberoInFront || otherLiberoOnCourt;
                const disabled = liberoForbidden;
                const swapLabel = takenElsewhere
                  ? (grid.flat().find((g) => g.idx === slotOfPl)?.label ?? "")
                  : "";
                const reason = liberoInFront
                  ? "líbero no en frente"
                  : otherLiberoOnCourt
                    ? "ya hay un líbero"
                    : takenElsewhere
                      ? `P${swapLabel} ⇄`
                      : null;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => { setSlot(pickingSlot, pl.id); setPickingSlot(null); }}
                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs transition-colors min-w-0 border ${
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : takenElsewhere
                          ? "bg-primary/15 border-primary/60 text-foreground hover:bg-primary/25"
                          : "bg-secondary border-transparent hover:bg-secondary/70"
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {pl.photoUrl ? (
                      <img src={pl.photoUrl} alt="" className="size-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="size-7 rounded-full scoreboard-digit font-bold flex items-center justify-center text-xs shrink-0" style={{ background: team.color, color: "#fff" }}>
                        {pl.number}
                      </span>
                    )}
                    <span className="truncate flex-1 min-w-0">
                      <span className="scoreboard-digit font-bold mr-1">#{pl.number}</span>
                      {pl.name}
                      {isLib && <span className="ml-1 text-[9px] uppercase opacity-70">líb</span>}
                    </span>
                    {reason && <span className="text-[9px] uppercase opacity-80 shrink-0 font-bold">{reason}</span>}
                    {isCurrent && <Check className="size-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {step === 2 && (
          <Button variant="outline" onClick={() => goToStep(1)} className="flex-1">← Atrás</Button>
        )}
        {step === 1 ? (
          <Button disabled={!validA} onClick={() => goToStep(2)} className="flex-1">Siguiente →</Button>
        ) : (
          <Button
            disabled={!validA || !validB}
            onClick={() => onSave(lineupA, lineupB)}
            className="flex-1 bg-gradient-primary text-primary-foreground"
          >
            Confirmar formación
          </Button>
        )}
      </div>
      {!stepValid && (
        <p className="text-[10px] text-center text-muted-foreground">Asigná los 6 jugadores en la cancha.</p>
      )}
    </div>
  );
}

function StepChip({ n, label, active, done, onClick, color, disabled }: {
  n: number; label: string; active: boolean; done: boolean; onClick: () => void; color: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-bold transition-all ${
        active ? "bg-primary text-primary-foreground" : done ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <span className="size-4 rounded-full flex items-center justify-center text-[9px]" style={{ background: active || done ? "rgba(255,255,255,0.25)" : color }}>
        {done ? <Check className="size-3" /> : n}
      </span>
      <span className="truncate max-w-[80px]">{label}</span>
    </button>
  );
}

function LineupSlotCell({ label, sub, role, teamColor, player, onOpen, onClear }: {
  label: string;
  sub?: string;
  role?: string | null;
  teamColor: string;
  player: Team["players"][number] | undefined;
  onOpen: () => void;
  onClear: () => void;
}) {
  const roleColor = role
    ? (role === "A" || role === "O"
        ? "#22d3ee"
        : role.startsWith("P")
        ? "#a3e635"
        : role.startsWith("C")
        ? "#f472b6"
        : null)
    : null;
  return (
    <div className="rounded-md bg-background/40 border border-border/40 p-2 text-center relative min-h-[88px] flex flex-col">
      <div className="absolute top-1 left-1 text-[9px] scoreboard-digit font-bold text-primary px-1 rounded bg-background/80 z-10">P{label}</div>
      {sub && <div className="absolute top-1 right-1 text-[8px] uppercase tracking-widest text-accent font-bold z-10">{sub}</div>}
      {role && (
        <div
          className="absolute bottom-1 left-1 text-[9px] font-black uppercase tracking-widest px-1.5 rounded text-black z-10"
          style={{ background: roleColor ?? "#cbd5e1" }}
        >
          {role}
        </div>
      )}
      {player && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          title="Quitar"
          className="absolute bottom-1 right-1 text-muted-foreground hover:text-destructive z-10"
        >
          <X className="size-3.5" />
        </button>
      )}
      <button type="button" onClick={onOpen} className="flex-1 flex flex-col items-center justify-center gap-1 w-full rounded hover:bg-background/30 transition-colors pt-3">
        {player ? (
          <>
            {player.photoUrl ? (
              <img src={player.photoUrl} alt="" className="size-9 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as any]: teamColor }} />
            ) : (
              <div className="size-9 rounded-full flex items-center justify-center scoreboard-digit font-black text-white text-xs" style={{ background: teamColor }}>
                {player.number}
              </div>
            )}
            <div className="text-[9px] truncate max-w-full font-semibold px-1 leading-tight">#{player.number} {player.name}</div>
          </>
        ) : (
          <>
            <div className="size-9 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
              <Plus className="size-4" />
            </div>
            <div className="text-[9px] text-muted-foreground">Asignar</div>
          </>
        )}
      </button>
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
    { type: "yellow", label: "Amarilla", render: <div className="w-6 h-9 md:w-10 md:h-14 rounded-sm bg-yellow-400 shadow" /> },
    { type: "red", label: "Roja", render: <div className="w-6 h-9 md:w-10 md:h-14 rounded-sm bg-red-600 shadow" /> },
    { type: "yellow_red", label: "Amar+Roja (expulsión)", render: (
      <div className="relative w-6 h-9 md:w-10 md:h-14">
        <div className="absolute inset-0 rounded-sm bg-yellow-400 shadow translate-x-[-2px] translate-y-[-2px] md:translate-x-[-3px] md:translate-y-[-3px]" />
        <div className="absolute inset-0 rounded-sm bg-red-600 shadow translate-x-[2px] translate-y-[2px] md:translate-x-[3px] md:translate-y-[3px]" />
      </div>
    )},
    { type: "red_expulsion", label: "Roja (descalif.)", render: (
      <div className="flex">
        <div className="w-3 h-9 md:w-5 md:h-14 rounded-l-sm bg-yellow-400" />
        <div className="w-3 h-9 md:w-5 md:h-14 rounded-r-sm bg-red-600" />
      </div>
    )},
  ];
  return (
    <>
      <DialogHeader><DialogTitle className="text-sm md:text-lg">Sanción solicitada · {team.name}</DialogTitle></DialogHeader>
      <p className="text-[10px] md:text-xs text-muted-foreground">1. Elegí al jugador sancionado</p>
      <div className="grid grid-cols-2 gap-1.5 p-1.5 md:p-3 rounded-lg bg-secondary/30">
        {sideAColumns.map((col, ci) => (
          <div key={ci} className="grid grid-rows-3 gap-1.5">
            {col.map((idx) => {
              const pid = onCourt[idx];
              const p = team.players.find((x) => x.id === pid);
              const active = pid === playerId;
              return (
                <button key={`${ci}-${idx}`} onClick={() => p && setPlayerId(p.id)} disabled={!p}
                  className={`aspect-square rounded-full flex items-center justify-center text-white font-black scoreboard-digit text-sm md:text-lg mx-auto h-9 md:h-14 transition-all ${active ? "ring-4 ring-primary" : ""}`}
                  style={{ background: team.color }}>
                  {p?.number ?? "?"}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[10px] md:text-xs text-muted-foreground mt-1">2. Elegí el tipo de tarjeta</p>
      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((c) => (
          <button key={c.type} onClick={() => onSubmit(playerId, c.type)}
            className="flex flex-col items-center gap-0.5 md:gap-1 p-1.5 md:p-3 rounded-lg bg-secondary hover:bg-secondary/70 active:scale-95 transition">
            {c.render}
            <span className="text-[9px] md:text-[10px] font-semibold text-center leading-tight">{c.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[9px] md:text-[10px] text-muted-foreground mt-1 text-center">
        Roja y Amarilla+Roja otorgan un punto al rival.
      </p>
    </>
  );
}

function LiveStatsPanel({ match, teamA, teamB, isCoach }: { match: Match; teamA: Team; teamB: Team; isCoach: boolean }) {
  const [selectedSet, setSelectedSet] = useState(match.currentSet);
  useEffect(() => setSelectedSet(match.currentSet), [match.currentSet]);
  const setNumber = match.sets.some((s) => s.number === selectedSet) ? selectedSet : match.currentSet;
  const orderedSets = useMemo(() => {
    const current = match.sets.find((s) => s.number === match.currentSet);
    const others = match.sets.filter((s) => s.number !== match.currentSet).sort((a, b) => a.number - b.number);
    return current ? [current, ...others] : match.sets;
  }, [match.sets, match.currentSet]);
  const stats = useMemo(() => computeSetStats(match, setNumber), [match, setNumber]);
  const setEvents = useMemo(() => match.events.filter((e) => "setNumber" in e && e.setNumber === setNumber), [match.events, setNumber]);
  const recA = useMemo(() => computeReceptionStats(setEvents, "A"), [setEvents]);
  const recB = useMemo(() => computeReceptionStats(setEvents, "B"), [setEvents]);
  const renderTeam = (team: Team, recMap: Map<string, ReturnType<typeof computeReceptionStats> extends Map<string, infer V> ? V : never>) => {
    const tStat = stats.teams.get(team.id);
    const recTotals = [...recMap.values()].reduce(
      (acc, r) => ({ pos: acc.pos + r.positive, neu: acc.neu + r.neutral, neg: acc.neg + r.negative, total: acc.total + r.total }),
      { pos: 0, neu: 0, neg: 0, total: 0 },
    );
    const teamEff = recTotals.total > 0 ? ((recTotals.pos - recTotals.neg) / recTotals.total) * 100 : 0;
    const players = team.players
      .map((tp) => {
        const p = stats.players.get(tp.id);
        const r = recMap.get(tp.id);
        return {
          playerId: tp.id,
          name: tp.name,
          number: tp.number,
          attack: p?.attack ?? 0,
          block: p?.block ?? 0,
          ace: p?.ace ?? 0,
          serveError: p?.serveError ?? 0,
          unforcedError: p?.unforcedError ?? 0,
          total: p?.total ?? 0,
          recTotal: r?.total ?? 0,
          recEff: r?.efficiency ?? 0,
        };
      })
      .sort((a, b) => b.total - a.total || a.number - b.number);
    return (
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="px-4 py-2 flex items-center gap-2 border-b border-border/60" style={{ background: `${team.color}22` }}>
          <span className="size-6 rounded text-white text-[10px] font-black flex items-center justify-center" style={{ background: team.color }}>{team.shortName}</span>
          <h3 className="font-bold text-sm truncate flex-1">{team.name}</h3>
          <span className="scoreboard-digit text-lg font-black text-primary">{tStat?.total ?? 0}</span>
        </div>
        <div className="grid grid-cols-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/40 py-1.5">
          <div>ATK</div><div>BLK</div><div>ACE</div><div>Err Rival</div><div>Err Saq</div><div>Err NF</div>
        </div>
        <div className="grid grid-cols-6 text-center scoreboard-digit font-black text-lg py-2 border-b border-border/40">
          <div>{tStat?.attack ?? 0}</div>
          <div>{tStat?.block ?? 0}</div>
          <div>{tStat?.ace ?? 0}</div>
          <div>{tStat?.opponentErrors ?? 0}</div>
          <div className="text-destructive">{tStat?.serveErrors ?? 0}</div>
          <div className="text-destructive">{tStat?.unforcedErrors ?? 0}</div>
        </div>
        <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between gap-2 text-[11px] bg-secondary/20">
          <span className="uppercase tracking-widest text-muted-foreground font-bold">Recepción</span>
          <span className="flex items-center gap-2 tabular-nums">
            <span className="text-success font-bold">+{recTotals.pos}</span>
            <span className="text-muted-foreground">0:{recTotals.neu}</span>
            <span className="text-destructive font-bold">−{recTotals.neg}</span>
            <span className="text-muted-foreground">· {recTotals.total}</span>
            <span className={`scoreboard-digit font-black ${teamEff >= 30 ? "text-success" : teamEff <= 0 ? "text-destructive" : "text-primary"}`}>
              {recTotals.total > 0 ? `${teamEff.toFixed(0)}%` : "—"}
            </span>
          </span>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[9px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
            <tr>
              <th className="text-left py-1.5 px-3">Jugador</th>
              <th className="text-center">ATK</th><th className="text-center">BLK</th>
              <th className="text-center">ACE</th>
              <th className="text-center text-destructive">E.SAQ</th>
              <th className="text-center">REC</th>
              <th className="text-center px-3 text-primary">TOT</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.playerId} className="border-t border-border/40">
                <td className="py-1 px-3"><span className="scoreboard-digit font-bold mr-2">#{p.number}</span>{p.name}</td>
                <td className="text-center tabular-nums">{p.attack}</td>
                <td className="text-center tabular-nums">{p.block}</td>
                <td className="text-center tabular-nums">{p.ace}</td>
                <td className={`text-center tabular-nums ${p.serveError > 0 ? "text-destructive font-bold" : ""}`}>{p.serveError}</td>
                <td className="text-center tabular-nums">
                  {p.recTotal > 0 ? (
                    <span className={`font-bold ${p.recEff >= 30 ? "text-success" : p.recEff <= 0 ? "text-destructive" : ""}`}>
                      {p.recEff.toFixed(0)}%<span className="text-muted-foreground font-normal"> ({p.recTotal})</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-center tabular-nums font-bold text-primary px-3">{p.total}</td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr><td colSpan={7} className="text-center py-3 text-muted-foreground">Sin puntos aún.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };
  return (
    <div className="space-y-3 mt-2">
      <div className="sticky top-0 z-10 -mx-4 -mt-2 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {orderedSets.map((s) => (
            <button
              key={s.number}
              type="button"
              onClick={() => setSelectedSet(s.number)}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-widest transition ${
                s.number === setNumber
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              Set {s.number}
              <span className="ml-1.5 scoreboard-digit tabular-nums opacity-80">{s.scoreA}-{s.scoreB}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">{renderTeam(teamA, recA)}{renderTeam(teamB, recB)}</div>
      {isCoach && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">
            Rotaciones · Set {setNumber}
          </p>
          <RotationStatsPanel match={match} teamA={teamA} teamB={teamB} setNumber={setNumber} compact />
        </div>
      )}
      {isCoach && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">
            Zonas de ataque · Set {setNumber}
          </p>
          <AttackZonesPanel match={match} teamA={teamA} teamB={teamB} setNumber={setNumber} />
        </div>
      )}
    </div>
  );
}


function ScoreCorrectionDialog({ setNumber, teamA, teamB, scoreA, scoreB, onSave, onCancel }: {
  setNumber: number;
  teamA: Team; teamB: Team;
  scoreA: number; scoreB: number;
  onSave: (sa: number, sb: number) => void;
  onCancel: () => void;
}) {
  const [sa, setSa] = useState(scoreA);
  const [sb, setSb] = useState(scoreB);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center text-sm md:text-base">Corregir marcador · Set {setNumber}</DialogTitle>
      </DialogHeader>
      <div className="flex items-center justify-center gap-4 md:gap-6 py-3">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] md:text-xs uppercase tracking-widest font-bold" style={{ color: teamA.color }}>{teamA.shortName}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSa((v) => Math.max(0, v - 1))} className="size-8 md:size-10 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center active:scale-95 transition"><Minus className="size-4" /></button>
            <span className="scoreboard-digit text-3xl md:text-4xl font-black w-12 text-center">{sa}</span>
            <button type="button" onClick={() => setSa((v) => v + 1)} className="size-8 md:size-10 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center active:scale-95 transition"><Plus className="size-4" /></button>
          </div>
        </div>
        <span className="text-muted-foreground font-bold text-lg">–</span>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] md:text-xs uppercase tracking-widest font-bold" style={{ color: teamB.color }}>{teamB.shortName}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSb((v) => Math.max(0, v - 1))} className="size-8 md:size-10 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center active:scale-95 transition"><Minus className="size-4" /></button>
            <span className="scoreboard-digit text-3xl md:text-4xl font-black w-12 text-center">{sb}</span>
            <button type="button" onClick={() => setSb((v) => v + 1)} className="size-8 md:size-10 rounded-lg bg-secondary hover:bg-secondary/70 flex items-center justify-center active:scale-95 transition"><Plus className="size-4" /></button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button className="flex-1" onClick={() => onSave(sa, sb)}>Guardar</Button>
      </div>
    </>
  );
}

function FormatDialog({ match, onSave, onCancel }: {
  match: Match;
  onSave: (setsToWin: number, pointsPerSet: number) => void;
  onCancel: () => void;
}) {
  const setsWonA = match.sets.filter((s) => s.finished && s.scoreA > s.scoreB).length;
  const setsWonB = match.sets.filter((s) => s.finished && s.scoreB > s.scoreA).length;
  const maxWon = Math.max(setsWonA, setsWonB);
  const [setsToWin, setSetsToWin] = useState(match.setsToWin);
  const [pointsPerSet, setPointsPerSet] = useState(match.pointsPerSet);
  const willFinish = maxWon >= setsToWin && maxWon > 0;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-center">Formato del partido</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Sets para ganar</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSetsToWin(2)}
              className={`flex-1 rounded-lg border px-2 py-3 text-center transition-colors ${
                setsToWin === 2
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-background text-foreground'
              }`}
            >
              <div className="text-sm font-semibold">Mejor de 3</div>
              <div className="text-xs opacity-70">gana al 2do set</div>
            </button>
            <button
              type="button"
              onClick={() => setSetsToWin(3)}
              className={`flex-1 rounded-lg border px-2 py-3 text-center transition-colors ${
                setsToWin === 3
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input bg-background text-foreground'
              }`}
            >
              <div className="text-sm font-semibold">Mejor de 5</div>
              <div className="text-xs opacity-70">gana al 3er set</div>
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Puntos por set</label>
          <div className="flex gap-2">
            {[15, 21, 25].map((pts) => (
              <button
                key={pts}
                type="button"
                onClick={() => setPointsPerSet(pts)}
                className={`flex-1 rounded-lg border px-2 py-3 text-center transition-colors ${
                  pointsPerSet === pts
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background text-foreground'
                }`}
              >
                <div className="text-sm font-semibold">{pts} puntos</div>
              </button>
            ))}
          </div>
        </div>
        {willFinish && (
          <p className="text-xs text-warning">
            Con este formato el partido queda <strong>finalizado</strong> ({setsWonA}-{setsWonB} en sets).
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button className="flex-1" onClick={() => onSave(setsToWin, pointsPerSet)}>Guardar</Button>
        </div>
      </div>
    </>
  );
}
