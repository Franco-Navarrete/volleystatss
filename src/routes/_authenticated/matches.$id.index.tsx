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
  getCurrentRallyReceptionSide,
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
import { AttackHeatmap } from "@/components/AttackHeatmap";
import { ServeHeatmapPanel } from "@/components/serve/ServeHeatmapPanel";
import { LiveStatsTable, type LiveStatsRow, type LiveStatsTeamSummary } from "@/components/LiveStatsTable";
import { SettingDialog } from "@/components/scorer/SettingDialog";
import { AttackTypeDialog } from "@/components/scorer/AttackTypeDialog";
import { AttackResultDialog } from "@/components/scorer/AttackResultDialog";
import { AttackDirectionDialog } from "@/components/scorer/AttackDirectionDialog";
import {
  IntegratedRallyDialog,
  settingZoneToAttackZone,
} from "@/components/scorer/IntegratedRallyDialog";
import { useCoachAccess } from "@/hooks/use-coach-access";
import { isTabletHardware } from "@/hooks/use-device-mode";
import { useFormation } from "@/hooks/use-formation";
import { CourtFormation } from "@/components/court/CourtFormation";
import { FormationEditor } from "@/components/court/FormationEditor";
import { CourtPlayerBadge } from "@/components/court/CourtPlayerBadge";
import { SideActionsRail } from "@/components/scorer/SideActionsRail";
import { RallyProgressBar } from "@/components/scorer/RallyProgressBar";
import { RallyContextCards } from "@/components/scorer/RallyContextCards";
import { computeRallyContext } from "@/lib/rally-phase";
import { useIsMobileLayout } from "@/hooks/use-is-mobile-layout";
import { MobileMatchShell } from "@/components/scorer/mobile/MobileMatchShell";
import { useCoachShortcuts } from "@/hooks/use-coach-shortcuts";
import { CoachHelpDialog } from "@/components/coach/CoachHelpDialog";
import { CoachModeBadge } from "@/components/coach/CoachModeBadge";
import { CoachHelpBar } from "@/components/coach/CoachHelpBar";
import { CoachRallyPanel } from "@/components/coach/CoachRallyPanel";
import { toast } from "sonner";
import type { CoachAction } from "@/lib/coach-mode-store";
import { useCoachMode } from "@/lib/coach-mode-store";



import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Keyboard,
  Minus,
  MoreVertical,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Settings2,
  Shirt,
  Target,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { PLAYER_POSITION_LABEL, type PlayerPosition } from "@/lib/volley-store";

export const Route = createFileRoute("/_authenticated/matches/$id/")({
  head: () => ({ meta: [{ title: "Partido en vivo · RALLY" }] }),
  component: LiveMatch,
});




function useForceLandscape(active: boolean) {
  useEffect(() => {
    if (!active) return;
    // Forzamos landscape en teléfonos y también en tablets en portrait
    // (la vista en vivo se rompe si la tablet queda vertical).
    const phoneMq = window.matchMedia("(orientation: portrait) and (max-width: 640px)");
    const tabletPortraitMq = window.matchMedia("(orientation: portrait)");
    const so: any = (screen as any).orientation;
    let orientationLocked = false;
    const apply = () => {
      const html = document.documentElement;
      const isTablet = html.dataset.deviceResolved === "tablet" || html.classList.contains("device-tablet") || isTabletHardware();
      const shouldForce = isTablet ? tabletPortraitMq.matches : phoneMq.matches;
      html.classList.toggle("force-landscape", shouldForce);
      if (shouldForce && !orientationLocked) {
        orientationLocked = true;
        so?.lock?.("landscape").catch(() => {
          orientationLocked = false;
        });
      } else if (!shouldForce && orientationLocked) {
        orientationLocked = false;
        so?.unlock?.();
      }
    };
    apply();
    phoneMq.addEventListener("change", apply);
    tabletPortraitMq.addEventListener("change", apply);
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-device-resolved"] });
    return () => {
      phoneMq.removeEventListener("change", apply);
      tabletPortraitMq.removeEventListener("change", apply);
      observer.disconnect();
      document.documentElement.classList.remove("force-landscape");
      if (orientationLocked) so?.unlock?.();
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
  const recordDefense = useVolley((s) => s.recordDefense);
  const recordSetting = useVolley((s) => s.recordSetting);
  const updateMatchFormat = useVolley((s) => s.updateMatchFormat);
  const overrideScore = useVolley((s) => s.overrideScore);
  const undo = useVolley((s) => s.undoLastEvent);
  const finishMatch = useVolley((s) => s.finishMatch);

  const teamA = useMemo(() => teams.find((t) => t.id === match?.teamAId), [teams, match]);
  const teamB = useMemo(() => teams.find((t) => t.id === match?.teamBId), [teams, match]);

  const [pendingPlayer, setPendingPlayer] = useState<{ side: "A" | "B"; playerId: string } | null>(null);
  const [pendingReception, setPendingReception] = useState<{ side: "A" | "B"; playerId: string } | null>(null);
  const [pendingAttackType, setPendingAttackType] = useState<{
    side: "A" | "B";
    playerId: string;
    type: PointType;
    zone: AttackZone;
  } | null>(null);
  const [pendingAttackResult, setPendingAttackResult] = useState<{
    side: "A" | "B";
    playerId: string;
    type: PointType;
    zone: AttackZone;
    attackType: import("@/lib/formations/attack-types").AttackType | null;
  } | null>(null);
  const [pendingAttackDirection, setPendingAttackDirection] = useState<{
    side: "A" | "B";
    playerId: string;
    /** Cuando kind === "point": tipo original (rotation_attack | counter_attack). */
    type: PointType;
    zone: AttackZone;
    attackType: import("@/lib/formations/attack-types").AttackType | null;
    /** point = suma al marcador; continue = intento neutro (no afecta). */
    kind: "point" | "continue";
    isCounter: boolean;
  } | null>(null);
  const [subState, setSubState] = useState<{ side: "A" | "B"; playerOutId: string } | null>(null);
  const [liberoState, setLiberoState] = useState<{ side: "A" | "B"; liberoId: string | null } | null>(null);
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const [timeoutSide, setTimeoutSide] = useState<"A" | "B" | null>(null);
  const [sanctionSide, setSanctionSide] = useState<"A" | "B" | null>(null);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [showSettingDialog, setShowSettingDialog] = useState(false);
  const [integratedRally, setIntegratedRally] = useState<{ side: "A" | "B"; receptionQuality?: SettingQuality; receiverId?: string; defenderId?: string } | null>(null);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [showFormationDialog, setShowFormationDialog] = useState(false);
  const [showRotateDialog, setShowRotateDialog] = useState(false);
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
  const isMobile = useIsMobileLayout();
  const coachEnabled = useCoachMode((s) => s.enabled);
  const setCoachEnabled = useCoachMode((s) => s.setEnabled);

  // Primera activación de Coach Mode dentro de este partido → abre la ayuda una sola vez.
  useEffect(() => {
    if (!coachOverride || !match?.id || !coachEnabled) return;
    const key = `rally.coachHelpShown.${match.id}`;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    window.dispatchEvent(new CustomEvent("coach:help:open"));
  }, [coachEnabled, coachOverride, match?.id]);

  const toggleCoachMode = () => {
    const next = !coachEnabled;
    setCoachEnabled(next);
    toast(next ? "Coach Mode activado" : "Coach Mode desactivado", {
      description: next
        ? "Los comandos de teclado ya están disponibles."
        : "Los atajos de teclado se han deshabilitado.",
      duration: 2000,
    });
  };
  // Coach Mode: solo activo para coach/admin, no móvil, y partido en vivo.
  useCoachShortcuts({
    active: coachOverride && !isMobile && match?.status === "live",
    matchId: match?.id ?? null,
  });

  // Dispatcher central: sólo atajos EXTERNOS al rally (los fundamentos
  // los maneja directamente la máquina de estados en CoachRallyPanel).
  useEffect(() => {
    if (!coachEnabled || !match) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ action?: CoachAction }>).detail;
      const action = detail?.action;
      if (!action) return;
      const side = match.servingSide as "A" | "B";
      switch (action) {
        case "timeout":
          handleTimeout(side);
          break;
        case "cambio":
          setSubState({ side, playerOutId: "" });
          break;
        case "libero":
          setLiberoState({ side, liberoId: null });
          break;
        case "sancion":
          setSanctionSide(side);
          break;
      }
    };

    window.addEventListener("coach:action", handler as EventListener);
    return () => window.removeEventListener("coach:action", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachEnabled, match?.id, match?.servingSide, match?.status]);




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
  // Configuración de formación por equipo (modo entrenador):
  //   - Equipo que RECIBE:
  //       · Sin recepción registrada en el rally → plantilla "reception" (W).
  //       · Apenas se registra la recepción → cada jugadora se reubica en su
  //         posición táctica de ataque (P1=armadora/opuesta, P6=punta zaguero,
  //         P5=líbero/central; opp→z2, mid→z3, out→z4).
  //   - Equipo que SACA → SIEMPRE formación de ataque.
  const lastReceptionSide = getCurrentRallyReceptionSide(match, match.currentSet);
  const receptionRegistered = lastReceptionSide === receivingSide;
  const receivingPhase: "reception" | "attack" = receptionRegistered ? "attack" : "reception";
  const servingSide: "A" | "B" = receivingSide === "A" ? "B" : "A";
  const formationByTeam: Partial<Record<"A" | "B", "reception" | "attack">> =
    isCoach && isLive && !actionsDisabled
      ? { [receivingSide]: receivingPhase, [servingSide]: "attack" }
      : {};

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
      if (isCoach) {
        // Flujo continuo: abrimos el panel único directamente en el paso "Recepción".
        setIntegratedRally({ side, receiverId: playerId });
      } else {
        setPendingReception({ side, playerId });
      }
      return;
    }
    // Continuidad del rally: si toca defender y el usuario clickea a un
    // jugador de ese equipo, abrimos el flujo integrado en el paso "Defensa".
    if (
      isCoach &&
      rallyCtx.currentPhase === "defense" &&
      rallyCtx.currentPhaseSide === side &&
      !rallyCtx.finished
    ) {
      setIntegratedRally({ side, defenderId: playerId });
      return;
    }
    setPendingPlayer({ side, playerId });
  };

  const submitAction = (type: PointType) => {
    if (!pendingPlayer) return;
    if (isCoach && (type === "rotation_attack" || type === "counter_attack")) {
      // La zona de origen se deduce de la posición del jugador en cancha:
      // índices onCourt [P1, P2, P3, P4, P5, P6] → zonas [1, 2, 3, 4, 5, 6].
      const onCourt = pendingPlayer.side === "A" ? match.onCourtA : match.onCourtB;
      const idx = onCourt.indexOf(pendingPlayer.playerId);
      const zoneFromIdx: Record<number, AttackZone> = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
      const zone: AttackZone = zoneFromIdx[idx] ?? 3;
      setPendingAttackType({ side: pendingPlayer.side, playerId: pendingPlayer.playerId, type, zone });
      setPendingPlayer(null);
      return;
    }
    recordPoint(match.id, pendingPlayer.side, type, pendingPlayer.playerId);
    setPendingPlayer(null);
  };

  const submitAttackType = (attackType: import("@/lib/formations/attack-types").AttackType | null) => {
    if (!pendingAttackType) return;
    const { side, playerId, type, zone } = pendingAttackType;
    setPendingAttackType(null);
    // Siguiente paso: resultado (Punto / Continúa / Error).
    setPendingAttackResult({ side, playerId, type, zone, attackType });
  };

  const submitAttackResult = (result: import("@/components/scorer/AttackResultDialog").AttackResult) => {
    if (!pendingAttackResult) return;
    const { side, playerId, type, zone, attackType } = pendingAttackResult;
    setPendingAttackResult(null);
    if (result === "error") {
      recordPoint(match.id, side, "attack_error", playerId, zone, attackType ?? undefined);
      return;
    }
    const isCounter = type === "counter_attack";
    // Punto o Continúa → pedir zona destino (opcional).
    setPendingAttackDirection({
      side,
      playerId,
      type,
      zone,
      attackType,
      kind: result,
      isCounter,
    });
  };

  const submitAttackDirection = (
    dir: import("@/lib/volley-store").AttackDirection | null,
  ) => {
    if (!pendingAttackDirection) return;
    const { side, playerId, type, zone, attackType, kind, isCounter } = pendingAttackDirection;
    setPendingAttackDirection(null);
    if (kind === "point") {
      recordPoint(
        match.id,
        side,
        type,
        playerId,
        zone,
        attackType ?? undefined,
        dir ?? undefined,
      );
    } else {
      // Continúa el rally → intento de ataque neutro (no afecta marcador ni eficiencia).
      useVolley.getState().recordAttackAttempt(match.id, side, playerId, {
        attackZone: zone,
        attackType: attackType ?? undefined,
        attackDirection: dir ?? undefined,
        isCounter,
      });
    }
  };

  const submitReception = (rating: ReceptionRating) => {
    if (!pendingReception) return;
    const side = pendingReception.side;
    recordReception(match.id, side, pendingReception.playerId, rating);
    setPendingReception(null);
    // Solo continuar el flujo integrado si la recepción permite armar.
    const canSet = rating === "double_positive" || rating === "positive" || rating === "neutral";
    if (isCoach && canSet) {
      const map: Record<"double_positive" | "positive" | "neutral", SettingQuality> = {
        double_positive: "++",
        positive: "+",
        neutral: "!",
      };
      setIntegratedRally({ side, receptionQuality: map[rating] });
    }
  };

  const handleTimeout = (side: "A" | "B") => {
    const ok = recordTimeout(match.id, side);
    if (ok) setTimeoutSide(side);
    else alert(`${side === "A" ? teamA.name : teamB.name} ya usó los 2 tiempos del set.`);
  };

  // Contexto del rally (fase actual + posesión + última acción) para las guías
  // visuales sobre la cancha. Solo lectura — no altera el store ni el flujo.
  const rallyCtx = useMemo(
    () => computeRallyContext(match, { A: teamA, B: teamB }),
    [match, teamA, teamB],
  );


  return (
    <CompactShell>
      <CoachRallyPanel match={match} teamA={teamA} teamB={teamB} />
      <CoachHelpDialog />
      <CoachHelpBar />
      <div className="fixed top-2 right-2 z-[9998] pointer-events-none">
        <CoachModeBadge />
      </div>

      {isMobile ? (
        <MobileMatchShell
          match={match}
          teamA={teamA}
          teamB={teamB}
          leftTeam={leftTeam}
          rightTeam={rightTeam}
          leftSide={leftSide}
          rightSide={rightSide}
          scoreLeft={leftSide === "A" ? currentSet.scoreA : currentSet.scoreB}
          scoreRight={rightSide === "A" ? currentSet.scoreA : currentSet.scoreB}
          setsLeft={leftSide === "A" ? w.a : w.b}
          setsRight={rightSide === "A" ? w.a : w.b}
          serverSide={server.side}
          setNumber={match.currentSet}
          setTimerLabel={setTimerLabel}
          isLive={isLive}
          isCoach={isCoach}
          toUsedA={toUsedA}
          toUsedB={toUsedB}
          actionsDisabled={actionsDisabled}
          rallyCtx={rallyCtx}
          canUndo={match.status !== "scheduled" && match.events.length > 0}
          onUndo={() => undo(match.id)}
          onOpenSetting={() => setShowSettingDialog(true)}
          onOpenFormation={() => setShowFormationDialog(true)}
          onOpenLineup={() => setShowLineupEditor(true)}
          onOpenLiveStats={() => setShowLiveStats(true)}
          onOpenFormat={() => setShowFormatDialog(true)}
          onOpenScore={() => setShowScoreDialog(true)}
          onOpenRotate={() => setShowRotateDialog(true)}
          onFinishMatch={() => finishMatch(match.id)}
          onCambio={(side) => setSubState({ side, playerOutId: "" })}
          onLibero={(side) => setLiberoState({ side, liberoId: null })}
          onTimeout={(side) => handleTimeout(side)}
          onSancion={(side) => setSanctionSide(side)}
          onStartSet={() => startSet(match.id)}
          onToggleSides={() => toggleSidesFlipped(match.id)}
          needsLineup={needsLineup}
          needsSetStart={needsSetStart}
          courtSlot={
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
              formationByTeam={formationByTeam}
              activePlayerId={pendingPlayer?.playerId ?? null}
            />
          }
        />
      ) : (
      <div className="relative flex flex-col gap-1.5 md:gap-3 device-tablet:gap-1.5 h-full min-h-0 px-2 md:px-6 device-tablet:px-2 py-2 md:py-4 device-tablet:py-1 mx-auto w-full max-w-[1400px] device-tablet:max-w-none select-none">

        {/* Scoreboard header */}
        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 md:gap-6 device-tablet:gap-3 rounded-lg md:rounded-xl bg-card border border-border/60 px-2 sm:px-4 md:px-8 device-tablet:px-3 py-0.5 md:py-4 device-tablet:py-1 shrink-0">
          <ScoreColumn team={leftTeam} score={leftSide === "A" ? currentSet.scoreA : currentSet.scoreB} sets={leftSide === "A" ? w.a : w.b} align="right" serving={server.side === leftSide} onScoreClick={() => isLive && setShowScoreDialog(true)} />
          <div className="text-center px-1 md:px-4 flex flex-row md:flex-col items-center justify-center gap-1.5 md:gap-0">
            <div className="flex flex-col items-center">
              <div className="text-[8px] md:text-xs device-tablet:text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Set {match.currentSet}</div>
              {match.status === "live" ? (
                <span className="md:mt-1 device-tablet:mt-0 inline-flex items-center gap-1 text-[8px] md:text-xs device-tablet:text-[10px] font-bold uppercase tracking-widest text-destructive">
                  <span className="size-1 md:size-2 device-tablet:size-1.5 rounded-full bg-destructive animate-pulse" /> Live
                </span>
              ) : match.status === "finished" ? (
                <span className="md:mt-1 device-tablet:mt-0 inline-block text-[8px] md:text-xs device-tablet:text-[10px] font-bold uppercase tracking-widest text-success">Final</span>
              ) : (
                <span className="md:mt-1 device-tablet:mt-0 inline-block text-[8px] md:text-xs device-tablet:text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prog.</span>
              )}
              {setTimerLabel && (
                <span className="md:mt-0.5 device-tablet:mt-0 scoreboard-digit tabular-nums text-[10px] md:text-sm device-tablet:text-[11px] font-bold text-foreground">
                  {setTimerLabel}
                </span>
              )}

            </div>
            <div>
              <button
                type="button"
                onClick={() => toggleSidesFlipped(match.id)}
                title="Invertir lados"
                className="md:mt-2 device-tablet:mt-0 inline-flex items-center justify-center size-6 md:size-9 device-tablet:size-7 rounded-md md:rounded-lg border border-border/60 text-muted-foreground hover:text-primary hover:border-primary transition-colors active:scale-95"
              >
                <ArrowLeftRight className="size-3.5 md:size-5 device-tablet:size-4" />
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
        <div className="grid grid-cols-[auto_1fr_auto] device-tablet:grid-cols-[64px_minmax(0,1fr)_64px] gap-2 [@media(max-width:360px)]:gap-1 sm:gap-3 md:gap-5 device-tablet:gap-2 items-stretch flex-1 min-h-0 overflow-hidden">
          <SideActionsRail
            side="left"
            disabled={actionsDisabled}
            timeoutsUsed={leftSide === "A" ? toUsedA : toUsedB}
            onCambio={() => setSubState({ side: leftSide, playerOutId: "" })}
            onLibero={() => setLiberoState({ side: leftSide, liberoId: null })}
            onTiempo={() => handleTimeout(leftSide)}
            onSancion={() => setSanctionSide(leftSide)}
          />

          <div className="relative min-h-0 flex flex-col gap-1">
            {/* Barra de progreso del rally (fase actual) */}
            {isLive && (
              <RallyProgressBar ctx={rallyCtx} />
            )}

            <div className="relative flex-1 min-h-0">
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
                formationByTeam={formationByTeam}
                activePlayerId={pendingPlayer?.playerId ?? null}
              />

              {/* Chips flotantes de contexto (no consumen alto de layout) */}
              {isLive && (
                <RallyContextCards
                  ctx={rallyCtx}
                  teamA={teamA}
                  teamB={teamB}
                />
              )}
            </div>
          </div>

          <SideActionsRail
            side="right"
            disabled={actionsDisabled}
            timeoutsUsed={rightSide === "A" ? toUsedA : toUsedB}
            onCambio={() => setSubState({ side: rightSide, playerOutId: "" })}
            onLibero={() => setLiberoState({ side: rightSide, liberoId: null })}
            onTiempo={() => handleTimeout(rightSide)}
            onSancion={() => setSanctionSide(rightSide)}
          />
        </div>

        {/* Bottom action row — solo primarias visibles; el resto en un menú "⋮" */}
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1 md:gap-3 shrink-0">
          <Button size="sm" variant="secondary" className="h-9 md:h-11 text-xs md:text-sm" disabled={match.status === "scheduled" || match.events.length === 0} onClick={() => undo(match.id)}>
            <Undo2 className="size-4" /> Deshacer
          </Button>
          {isCoach ? (
            <Button size="sm" variant="secondary" className="h-9 md:h-11 text-xs md:text-sm bg-primary/10 hover:bg-primary/20 border border-primary/30" disabled={!isLive || actionsDisabled} onClick={() => setShowSettingDialog(true)}>
              <Target className="size-4" /> Armado
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="h-9 md:h-11 text-xs md:text-sm" disabled={!isLive} onClick={() => setShowLineupEditor(true)}>
              <Users className="size-4" /> Formación
            </Button>
          )}
          {coachOverride ? (
            <Button
              size="sm"
              variant="secondary"
              className={`h-9 md:h-11 text-xs md:text-sm transition-all ${
                coachEnabled
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary shadow-glow animate-in fade-in"
                  : "bg-secondary hover:bg-secondary/80 border border-border/60"
              }`}
              onClick={toggleCoachMode}
              aria-pressed={coachEnabled}
              title={coachEnabled ? "Desactivar Coach Mode" : "Activar Coach Mode (atajos de teclado)"}
            >
              <Keyboard className="size-4" />
              {coachEnabled ? "Coach Mode Activo" : "Coach Mode"}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="h-9 md:h-11 text-xs md:text-sm bg-primary/10 hover:bg-primary/20 border border-primary/30" onClick={() => setShowFormationDialog(true)}>
              <Users className="size-4" /> Cancha 5-1
            </Button>
          )}
          <Button size="sm" variant="secondary" className="h-9 md:h-11 text-xs md:text-sm" onClick={() => setShowLiveStats(true)}>
            <ChartBarBig className="size-4" /> Stats vivo
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 md:h-11 px-3" aria-label="Más acciones">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Más acciones</DropdownMenuLabel>
              {isCoach && (
                <DropdownMenuItem onSelect={() => setShowLineupEditor(true)} disabled={!isLive}>
                  <Users className="size-4" /> Formación
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link to="/matches/$id/stats" params={{ id: match.id }}>
                  <ChartBarBig className="size-4" /> Estadísticas completas
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowFormatDialog(true)} disabled={match.status === "finished"}>
                <Hourglass className="size-4" /> Formato del partido
              </DropdownMenuItem>
              {coachOverride && (
                <DropdownMenuItem onSelect={() => setShowFormationDialog(true)}>
                  <Users className="size-4" /> Cancha 5-1
                </DropdownMenuItem>
              )}
              {coachOverride && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Coach Mode</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={toggleCoachMode}>
                    <Keyboard className="size-4" /> {coachEnabled ? "Desactivar" : "Activar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.dispatchEvent(new CustomEvent("coach:help:open"))}>
                    <Keyboard className="size-4" /> Ayuda de atajos (F1)
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings2 className="size-4" /> Configuración
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={match.status === "finished"}
                onSelect={() => {
                  if (confirm("¿Finalizar el partido manualmente?")) finishMatch(match.id);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Flag className="size-4" /> Finalizar partido
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      )}



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
            const allActions: { type: PointType; label: string; tone: "primary" | "neutral" | "danger"; positive: boolean }[] = [
              { type: "ace", label: isCoach ? "Saque (Ace)" : "Saque", tone: "primary", positive: true },
              { type: "serve_error", label: "Error de saque", tone: "danger", positive: false },
              { type: "rotation_attack", label: isCoach ? "Ataque de rotación" : "Ataque", tone: "primary", positive: true },
              { type: "attack_error", label: "Error de ataque", tone: "danger", positive: false },
              { type: "counter_attack", label: "Contraataque", tone: "primary", positive: true },
              { type: "unforced_error", label: "Error no forzado", tone: "danger", positive: false },
              { type: "block", label: "Bloqueo", tone: "primary", positive: true },
              { type: "block_error", label: "Error de bloqueo", tone: "danger", positive: false },
            ];
            // Sólo el sacador (P1) puede registrar Saque / Error de saque; el líbero nunca saca.
            const isLiberoPlayer = player?.position === "libero" || isActiveLibero;
            const canServe = isServer && !isLiberoPlayer;
            // Modo planillero (no entrenador): sólo 6 opciones básicas.
            const planilleroTypes: PointType[] = ["ace", "serve_error", "rotation_attack", "attack_error", "block", "unforced_error"];
            const actions = (isCoach ? allActions : allActions.filter((a) => planilleroTypes.includes(a.type)))
              .filter((a) => canServe || (a.type !== "ace" && a.type !== "serve_error"));
            const positiveActions = actions.filter((a) => a.positive);
            const negativeActions = actions.filter((a) => !a.positive);
            const ActionButton = ({ a }: { a: (typeof allActions)[number] }) => (
              <button key={a.type} onClick={() => submitAction(a.type)}
                className={`min-h-11 w-full text-center px-2 py-2 rounded-lg font-semibold text-[13px] leading-tight transition-all active:scale-[0.98] ${
                  a.tone === "primary" ? "bg-primary text-primary-foreground hover:opacity-90"
                    : a.tone === "danger" ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                    : "bg-secondary hover:bg-secondary/70"
                }`}>
                {a.label}
              </button>
            );
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
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="flex flex-col gap-2">
                    {positiveActions.map((a) => <ActionButton a={a} />)}
                  </div>
                  <div className="flex flex-col gap-2">
                    {negativeActions.map((a) => <ActionButton a={a} />)}
                  </div>
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

      {/* Attack type picker (modo entrenador) — la zona de origen se deduce
          del pin del jugador, así que se salta el paso "¿desde qué zona?". */}
      <AttackTypeDialog
        open={!!pendingAttackType}
        team={pendingAttackType ? (pendingAttackType.side === "A" ? teamA : teamB) : null}
        playerId={pendingAttackType?.playerId ?? null}
        isBackRow={(() => {
          if (!pendingAttackType) return false;
          const onCourt = pendingAttackType.side === "A" ? match.onCourtA : match.onCourtB;
          const idx = onCourt.indexOf(pendingAttackType.playerId);
          // Posiciones zagueras: índices 0 (P1), 4 (P5), 5 (P6).
          return idx === 0 || idx === 4 || idx === 5;
        })()}
        onSelect={submitAttackType}
        onClose={() => {
          // Sin clasificar: sigue el flujo (resultado → dirección) con attackType nulo.
          if (pendingAttackType) {
            const { side, playerId, type, zone } = pendingAttackType;
            setPendingAttackType(null);
            setPendingAttackResult({ side, playerId, type, zone, attackType: null });
          } else {
            setPendingAttackType(null);
          }
        }}
      />

      {/* Resultado del ataque: Punto / Continúa el rally / Error */}
      <AttackResultDialog
        open={!!pendingAttackResult}
        team={pendingAttackResult ? (pendingAttackResult.side === "A" ? teamA : teamB) : null}
        playerId={pendingAttackResult?.playerId ?? null}
        onSelect={submitAttackResult}
        onClose={() => setPendingAttackResult(null)}
      />

      {/* Zona de destino del ataque (opcional) */}
      <AttackDirectionDialog
        open={!!pendingAttackDirection}
        team={pendingAttackDirection ? (pendingAttackDirection.side === "A" ? teamA : teamB) : null}
        playerId={pendingAttackDirection?.playerId ?? null}
        onSelect={submitAttackDirection}
        onClose={() => {
          // Cerrar sin elegir zona = guardar igual sin dirección.
          submitAttackDirection(null);
        }}
      />







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
                    onClick={() => submitReception("double_positive")}
                    className="min-h-14 rounded-lg bg-success text-success-foreground font-black text-2xl active:scale-95 transition"
                    title="# Doble+"
                  >
                    #
                  </button>
                  <button
                    onClick={() => submitReception("positive")}
                    className="min-h-14 rounded-lg bg-success/80 text-success-foreground font-black text-2xl active:scale-95 transition"
                    title="+ Positiva"
                  >
                    +
                  </button>
                  <button
                    onClick={() => submitReception("neutral")}
                    className="min-h-14 rounded-lg bg-yellow-400 text-black font-black text-2xl active:scale-95 transition"
                    title="0 Neutra"
                  >
                    0
                  </button>
                  <button
                    onClick={() => submitReception("negative")}
                    className="min-h-14 rounded-lg bg-yellow-500 text-black font-black text-2xl active:scale-95 transition"
                    title="- Negativa"
                  >
                    −
                  </button>
                  <button
                    onClick={() => submitReception("double_negative")}
                    className="min-h-14 rounded-lg bg-destructive text-destructive-foreground font-black text-2xl active:scale-95 transition"
                    title="= Doble-"
                  >
                    =
                  </button>
                  <button
                    onClick={() => submitReception("overpass")}
                    className="min-h-14 rounded-lg bg-destructive/80 text-destructive-foreground font-black text-2xl active:scale-95 transition"
                    title="≠ Punto saque"
                  >
                    ≠
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  # Doble+ · + Positiva · 0 Neutra · − Negativa · = Doble− · ≠ Punto saque
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

      {/* Rotación manual (corrección) */}
      <Dialog open={showRotateDialog} onOpenChange={setShowRotateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rotar manualmente</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Corregí la rotación de un equipo si quedó desfasada. Sentido del saque: P2→P1→P6→P5→P4→P3.
          </p>
          {(["A", "B"] as const).map((side) => {
            const team = side === "A" ? teamA : teamB;
            const current = side === "A" ? match.onCourtA : match.onCourtB;
            const players = side === "A" ? teamA.players : teamB.players;
            const setter = players.find((p) => p.position === "armador");
            const setterIdx = setter ? current.indexOf(setter.id) : -1;
            const setterPos = setterIdx >= 0 ? setterIdx + 1 : null;
            const rotateBy = (steps: number) => {
              if (current.filter(Boolean).length !== 6) return;
              const n = ((steps % 6) + 6) % 6;
              const next = current.map((_, i) => current[(i + n) % 6]);
              overrideLineup(match.id, side, next);
            };
            const setSetterAt = (targetPos: number) => {
              if (setterIdx < 0) return;
              // rotateBy(n) hace newLineup[i] = current[(i+n)%6],
              // por lo tanto el armador que estaba en setterIdx queda en (setterIdx - n).
              // Para dejarlo en (targetPos-1): n = setterIdx - (targetPos-1).
              rotateBy(setterIdx - (targetPos - 1));
            };
            return (
              <div key={side} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="size-7 rounded text-white text-[10px] font-black flex items-center justify-center shrink-0" style={{ background: team.color }}>
                    {team.shortName}
                  </span>
                  <span className="flex-1 text-sm font-bold truncate">{team.name}</span>
                  <Button size="sm" variant="outline" onClick={() => rotateBy(-1)} title="Rotar en sentido contrario">
                    <RotateCcw className="size-4" />
                  </Button>
                  <Button size="sm" onClick={() => rotateBy(1)} title="Rotar en sentido del saque">
                    <RotateCw className="size-4" />
                  </Button>
                </div>
                {setter ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      Armador en {setterPos ? `P${setterPos}` : "—"}
                    </p>
                    <div className="grid grid-cols-6 gap-1">
                      {[1, 2, 3, 4, 5, 6].map((p) => (
                        <Button
                          key={p}
                          size="sm"
                          variant={setterPos === p ? "default" : "outline"}
                          className="h-8 px-0 text-xs font-bold"
                          onClick={() => setSetterAt(p)}
                          disabled={setterIdx < 0}
                        >
                          P{p}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Definí un armador en el plantel para ubicarlo por P1–P6.</p>
                )}
              </div>
            );
          })}
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
        <DialogContent className="live-stats-dialog flex h-[90dvh] max-h-[90dvh] w-[calc(100dvw-16px)] max-w-6xl flex-col overflow-hidden rounded-xl border-border/60 p-0 gap-0">
          <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left">
            <DialogTitle>Estadísticas en vivo</DialogTitle>
          </DialogHeader>
          <div className="live-stats-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
            <LiveStatsPanel key={`${showLiveStats}-${match.currentSet}`} match={match} teamA={teamA} teamB={teamB} isCoach={isCoach} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Formación 5-1 · Modo Entrenador */}
      {isCoach && (
        <FormationDialog
          open={showFormationDialog}
          onClose={() => setShowFormationDialog(false)}
          match={match}
          teamA={teamA}
          teamB={teamB}
        />
      )}

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

      {/* Flujo integrado (tablet · Modo Entrenador) — aparece auto tras la recepción */}
      {isCoach && integratedRally && (
        <IntegratedRallyDialog
          open={!!integratedRally}
          onClose={() => setIntegratedRally(null)}
          match={match}
          team={integratedRally.side === "A" ? teamA : teamB}
          side={integratedRally.side}
          onCourt={integratedRally.side === "A" ? match.onCourtA : match.onCourtB}
          receptionQuality={integratedRally.receptionQuality}
          receptionStep={integratedRally.receiverId ? {
            playerId: integratedRally.receiverId,
            onRegister: (rating) => {
              const side = integratedRally.side;
              recordReception(match.id, side, integratedRally.receiverId!, rating);
              const map: Partial<Record<ReceptionRating, SettingQuality>> = {
                double_positive: "++",
                positive: "+",
                neutral: "!",
              };
              const quality = map[rating];
              return { proceed: !!quality, quality };
            },
          } : undefined}
          defenseStep={integratedRally.defenderId ? {
            playerId: integratedRally.defenderId,
            onRegister: (rating) => {
              const side = integratedRally.side;
              recordDefense(match.id, side, integratedRally.defenderId!, rating);
              // Toda defensa que no cierra el rally habilita armado (calidad neutra).
              return { proceed: rating !== "error", quality: "!" };
            },
          } : undefined}
          onSubmit={(payload) => {
            const attackZone = settingZoneToAttackZone(payload.attackZone);
            const isNeutral =
              payload.action === "attack_neutral" || payload.action === "counter_neutral";
            const isKill =
              payload.action === "rotation_attack" || payload.action === "counter_attack";
            const isCounter =
              payload.action === "counter_attack" || payload.action === "counter_neutral";
            recordSetting(match.id, integratedRally.side, {
              setterId: payload.setterId,
              quality: payload.setterQuality,
              attackZone: payload.attackZone,
              attackerId: payload.attackerId,
              attackResult: isKill
                ? "point"
                : isNeutral
                ? "continuity"
                : payload.action === "block"
                ? "blocked"
                : "error",
              receptionQuality: payload.receptionQuality,
              attackDirection: payload.attackDirection,
            });
            if (isNeutral) {
              useVolley.getState().recordAttackAttempt(
                match.id,
                integratedRally.side,
                payload.attackerId,
                { attackZone, attackDirection: payload.attackDirection, isCounter },
              );
              setIntegratedRally(null);
              return;
            }
            const type: PointType =
              payload.action === "block"
                ? "attack_error"
                : (payload.action as PointType);
            recordPoint(
              match.id,
              integratedRally.side,
              type,
              payload.attackerId,
              attackZone,
              undefined,
              payload.attackDirection,
            );
            setIntegratedRally(null);
          }}
        />
      )}

    </CompactShell>
  );
}

function CompactShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const handleBack = () => {
    // Prefer real browser history so we return to whichever page (perfil de jugador,
    // liga, equipo, dashboard, etc.) originó la navegación al detalle del partido.
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate({ to: "/matches" });
  };
  return (
    <div className="live-match-shell h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-border/60 bg-card px-3 md:px-8 h-8 md:h-14 flex items-center justify-between shrink-0">
        <Link to="/" className="flex items-center gap-2 md:gap-3 min-h-10">
          <div className="size-6 md:size-9 rounded-md md:rounded-lg bg-gradient-primary flex items-center justify-center">
            <Volleyball className="size-3.5 md:size-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xs md:text-base tracking-tight">RALLY</span>
        </Link>
        <button
          type="button"
          onClick={handleBack}
          className="text-[10px] md:text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground font-bold min-h-10 flex items-center bg-transparent border-0 cursor-pointer"
        >
          ← Volver
        </button>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
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
      <span className="scoreboard-digit text-3xl sm:text-4xl md:text-7xl device-tablet:text-4xl font-black leading-none text-primary">{score}</span>
      {onScoreClick && <Edit3 className="size-3 md:size-4 text-muted-foreground opacity-60" />}
    </button>
  );
  return (
    <div className={`flex items-center gap-1.5 md:gap-4 device-tablet:gap-2 ${align === "right" ? "justify-end text-right flex-row-reverse" : "text-left"}`}>
      {team.logoUrl ? (
        <div className="size-7 md:size-14 device-tablet:size-9 rounded-md md:rounded-lg overflow-hidden bg-background border border-border/60 shrink-0">
          <img src={team.logoUrl} alt={team.shortName} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="size-7 md:size-14 device-tablet:size-9 rounded-md md:rounded-lg flex items-center justify-center font-black text-white text-[10px] md:text-base device-tablet:text-xs shrink-0" style={{ background: team.color }}>
          {team.shortName}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[11px] md:text-lg device-tablet:text-sm font-bold truncate flex items-center gap-1 md:gap-1.5">
          {team.name}
          {serving && <span className="text-[8px] md:text-[11px] uppercase tracking-widest text-primary">● Saque</span>}
        </div>
        <div className="text-[8px] md:text-[11px] uppercase tracking-widest text-muted-foreground">
          Sets <span className="text-foreground font-bold">{sets}</span>
        </div>
        <div className="hidden md:block device-tablet:hidden mt-1">{scoreEl}</div>
      </div>
      <div className="md:hidden device-tablet:block shrink-0">{scoreEl}</div>
    </div>
  );
}

function SideActions({ side, disabled, timeoutsUsed, onCambio, onLibero, onTiempo, onSancion }: {
  side: "left" | "right"; disabled: boolean; timeoutsUsed: number;
  onCambio: () => void; onLibero: () => void; onTiempo: () => void; onSancion: () => void;
}) {
  const reverse = side === "right";
  return (
    <div className="flex flex-col gap-1 md:gap-2.5 device-tablet:gap-1.5 w-[52px] [@media(max-width:360px)]:w-[44px] sm:w-[92px] md:w-[140px] device-tablet:w-[110px] shrink-0">
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


function CourtView({ match, teamA, teamB, leftSide, serverPlayerId, serverSide, onPlayerClick, receivingSide, needsReception, receiverIds, formationByTeam, activePlayerId }: {
  match: Match; teamA: Team; teamB: Team; leftSide: "A" | "B";
  serverPlayerId: string | null; serverSide: "A" | "B";
  onPlayerClick: (side: "A" | "B", playerId: string) => void;
  receivingSide: "A" | "B"; needsReception: boolean; receiverIds: Set<string>;
  formationByTeam?: Partial<Record<"A" | "B", "reception" | "attack">>;
  activePlayerId?: string | null;
}) {
  // Formación efectiva: SIEMPRE 6 IDs únicos por equipo aplicando el swap
  // automático del líbero (si liberoActive existe, la central reemplazada
  // deja de renderizarse y el líbero ocupa su slot). Cualquier duplicado o
  // exceso se descarta antes de llegar a la UI.
  const buildEffective = (
    side: "A" | "B",
    raw: string[],
    lineup: string[],
    active: { liberoId: string; replacedId: string } | null | undefined,
  ): string[] => {
    let arr = raw.slice(0, 8);
    if (active) {
      // Garantiza swap: si la central sigue en cancha y el líbero también,
      // sacamos la central del render (regla: nunca ambos a la vez).
      const libIdx = arr.indexOf(active.liberoId);
      arr = arr.filter((id, i) => id !== active.replacedId || i === libIdx);
    }
    const seen = new Set<string>();
    const unique = arr.filter((id) => id && !seen.has(id) && seen.add(id));
    // Completar hasta 6 con lineup si algo faltara.
    if (unique.length < 6) {
      for (const id of lineup) {
        if (unique.length >= 6) break;
        if (id && !seen.has(id) && (!active || id !== active.replacedId)) {
          seen.add(id);
          unique.push(id);
        }
      }
    }
    const effective = unique.slice(0, 6);
    if (import.meta.env.DEV && effective.length !== 6) {
      // eslint-disable-next-line no-console
      console.warn(`[cancha] lado ${side}: efectivos=${effective.length}/6`, {
        raw, active, effective,
      });
    }
    if (import.meta.env.DEV && (raw.length !== 6 || raw.length !== effective.length)) {
      // eslint-disable-next-line no-console
      console.debug(`[cancha][libero] lado=${side} onCourt=${raw.length} efectivo=${effective.length} libero=${active?.liberoId ?? "—"} reemplaza=${active?.replacedId ?? "—"}`);
    }
    return effective;
  };
  const a = buildEffective("A", match.onCourtA, match.startingLineupA, match.liberoActiveA);
  const b = buildEffective("B", match.onCourtB, match.startingLineupB, match.liberoActiveB);
  const rightSide: "A" | "B" = leftSide === "A" ? "B" : "A";
  const teamFor = (s: "A" | "B") => (s === "A" ? teamA : teamB);
  const phaseFor = (s: "A" | "B"): "reception" | "attack" => formationByTeam?.[s] ?? "attack";
  const formationA = useFormation(match, teamA, "A", "5-1", phaseFor("A"));
  const formationB = useFormation(match, teamB, "B", "5-1", phaseFor("B"));
  const formationFor = (s: "A" | "B") => (s === "A" ? formationA : formationB);
  const hasFormationFor = (s: "A" | "B") => !!formationByTeam?.[s];

  // 4 columns left→right: left back, left front, right front, right back
  const columns: Array<{ side: "A" | "B"; team: Team; idxs: number[] }> = [
    { side: leftSide, team: teamFor(leftSide), idxs: [4, 5, 0] },
    { side: leftSide, team: teamFor(leftSide), idxs: [3, 2, 1] },
    { side: rightSide, team: teamFor(rightSide), idxs: [1, 2, 3] },
    { side: rightSide, team: teamFor(rightSide), idxs: [0, 5, 4] },
  ];
  return (
    <div className="live-court-surface relative rounded-lg md:rounded-xl overflow-hidden h-full min-h-0 bg-[#1e5fa8] p-1.5 [@media(max-width:360px)]:p-1 sm:p-5 md:p-7 device-tablet:p-3">
      {/* court inner (orange) with white perimeter line */}
      <div className="absolute inset-2 [@media(max-width:360px)]:inset-1.5 sm:inset-5 md:inset-7 device-tablet:inset-3 bg-[#f4a36a] border-2 border-white rounded-sm" />
      {/* attack zones (darker orange) — front-row band each side */}
      <div className="absolute inset-y-2 [@media(max-width:360px)]:inset-y-1.5 sm:inset-y-5 md:inset-y-7 device-tablet:inset-y-3 left-1/4 right-1/4 bg-[#ec7a3c]/70 pointer-events-none" />
      {/* dashed center net line */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-white pointer-events-none z-10" />
      {/* antenna dots top/bottom of net */}
      <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white z-10" />
      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-white z-10" />
      {/* attack-line dashes (3m lines) */}
      <div className="absolute top-0 bottom-0 left-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />
      <div className="absolute top-0 bottom-0 right-1/4 w-0 border-l-2 border-dashed border-white/90 pointer-events-none" />

      <div className="absolute inset-3 [@media(max-width:360px)]:inset-2 sm:inset-8 md:inset-10 device-tablet:inset-4 grid grid-cols-2 z-20">
        {(["left", "right"] as const).map((half) => {
          const side = half === "left" ? leftSide : rightSide;
          const halfColumns = half === "left" ? [columns[0], columns[1]] : [columns[2], columns[3]];
          if (hasFormationFor(side) && formationFor(side)) {
            return (
              <FormationSide
                key={half}
                side={side}
                team={teamFor(side)}
                onCourt={side === "A" ? a : b}
                formation={formationFor(side)}
                half={half}
                match={match}
                serverPlayerId={serverSide === side ? serverPlayerId : null}
                needsReception={needsReception}
                receivingSide={receivingSide}
                receiverIds={receiverIds}
                onPlayerClick={onPlayerClick}
                activePlayerId={activePlayerId ?? null}
              />
            );
          }
          return (
            <div key={half} className="grid grid-cols-2 h-full w-full">
              {halfColumns.map((col, localCi) => {
                const ci = half === "left" ? localCi : localCi + 2;
                const onCourt = col.side === "A" ? a : b;
                const serverPid = serverSide === col.side ? serverPlayerId : null;
                const isFront = ci === 1 || ci === 2;
                return (
                  <div
                    key={ci}
                    className={`grid grid-rows-3 place-items-center gap-1 [@media(max-width:360px)]:gap-0.5 sm:gap-3 h-full min-h-0 px-0.5 [@media(max-width:360px)]:px-0 sm:px-2 ${isFront ? "bg-[#ec7a3c]/70" : ""}`}
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
                      const pairColor = p && !isLibero
                        ? (p.position === "armador" || p.position === "opuesto"
                            ? "#22d3ee"
                            : p.position === "punta"
                            ? "#a3e635"
                            : p.position === "central"
                            ? "#f472b6"
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
                          className={`relative rounded-full flex flex-col items-center justify-center text-white font-black shadow-md transition-all active:scale-95 hover:ring-2 sm:hover:ring-4 hover:ring-white/30 aspect-square size-[clamp(2rem,8vw,4.5rem)] md:size-[clamp(3rem,6vw,6rem)] device-tablet:size-[clamp(3.25rem,7vw,6.25rem)] max-w-[86%] max-h-[86%] overflow-hidden ${isServer ? "ring-2 [@media(max-width:360px)]:ring-1 sm:ring-4 ring-primary" : ""} ${pairColor || isLibero ? "border-[2px] [@media(max-width:360px)]:border sm:border-[3px] md:border-4" : ""} ${isReceiverHighlight ? "ring-2 [@media(max-width:360px)]:ring-1 sm:ring-4 ring-yellow-300 animate-pulse" : ""} ${isReceptionTarget && !isReceiverHighlight ? "ring-2 [@media(max-width:360px)]:ring-1 ring-white/50" : ""} ${activePlayerId && pid === activePlayerId ? "player-active" : ""}`}
                          style={isLibero
                            ? { background: "#ffffff", color: col.team.color, borderColor: col.team.color }
                            : { background: col.team.color, borderColor: pairColor ?? undefined }}
                          title={p ? `#${p.number} ${p.name}` : ""}
                        >
                          <span className="scoreboard-digit leading-none text-sm [@media(max-width:360px)]:text-xs sm:text-xl md:text-3xl device-tablet:text-4xl" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{p?.number ?? "?"}</span>
                          {p && (
                            <span className="max-w-[90%] truncate text-[9px] [@media(max-width:360px)]:text-[7px] sm:text-[13px] md:text-[16px] device-tablet:text-[17px] font-bold leading-tight" style={{ textShadow: '-0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000' }}>{p.name}</span>
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
          );
        })}
      </div>
    </div>
  );
}

function FormationSide({
  side, team, onCourt, formation, half, match, serverPlayerId, needsReception, receivingSide, receiverIds, onPlayerClick, activePlayerId,
}: {
  side: "A" | "B"; team: Team; onCourt: string[];
  formation: ReturnType<typeof useFormation>;
  half: "left" | "right";
  match: Match; serverPlayerId: string | null;
  needsReception: boolean; receivingSide: "A" | "B"; receiverIds: Set<string>;
  onPlayerClick: (side: "A" | "B", playerId: string) => void;
  activePlayerId?: string | null;
}) {
  // Mapeo del slot (formation coords) → coords absolutas dentro de la mitad de cancha.
  //   formation.y: 0 = en la red, 100 = línea final
  //   formation.x: 0 = lado izquierdo del equipo, 100 = lado derecho
  //   Pantalla: half "left" tiene la red en la derecha; half "right" en la izquierda.
  const projectX = (fx: number, fy: number) => (half === "left" ? 100 - fy : fy);
  const projectY = (fx: number, _fy: number) => (half === "left" ? fx : 100 - fx);

  if (!formation) {
    return (
      <div className="relative h-full w-full flex items-center justify-center text-white/70 text-xs px-2 text-center">
        Asigná posiciones (armadora / central / punta / opuesta / líbero) en las jugadoras del equipo {team.shortName}.
      </div>
    );
  }
  const designated = (side === "A"
    ? [match.liberoA1Id, match.liberoA2Id]
    : [match.liberoB1Id, match.liberoB2Id]
  ).filter(Boolean) as string[];

  // El saque siempre sale de P1 (zaguera derecha → coords {x:85, y:82}).
  // Si la jugadora servidora no coincide con el slot que ya está en P1,
  // intercambiamos sus coordenadas para que el server quede dibujado en P1
  // y la jugadora desplazada ocupe la posición original del server.
  let renderSlots = formation.slots;
  if (serverPlayerId) {
    const serverSlot = formation.slots.find((s) => s.playerId === serverPlayerId);
    const p1Slot = formation.slots.find((s) => s.x === 85 && s.y === 82);
    if (serverSlot && p1Slot && serverSlot !== p1Slot) {
      renderSlots = formation.slots.map((s) => {
        if (s === serverSlot) return { ...s, x: p1Slot.x, y: p1Slot.y };
        if (s === p1Slot) return { ...s, x: serverSlot.x, y: serverSlot.y };
        return s;
      });
    }
  }

  // Garantía: siempre se renderiza UN badge por cada jugadora de `onCourt`.
  // Construimos la lista desde onCourt (no desde formation.slots) para evitar
  // que una jugadora se pierda cuando la plantilla no le asigna slot (p.ej.
  // middle_back sin líbero activo, o roles duplicados por lineup ambiguo).
  const POS_COORDS: Array<{ x: number; y: number }> = [
    { x: 85, y: 82 }, // idx 0 → P1
    { x: 85, y: 18 }, // idx 1 → P2
    { x: 50, y: 15 }, // idx 2 → P3
    { x: 15, y: 18 }, // idx 3 → P4
    { x: 15, y: 82 }, // idx 4 → P5
    { x: 50, y: 82 }, // idx 5 → P6
  ];
  const usedSlotIdx = new Set<number>();
  renderSlots = onCourt
    .map((pid, idx) => {
      if (!pid) return null;
      // Buscar el primer slot no usado que apunte a esta jugadora.
      let slotIdx = -1;
      for (let i = 0; i < renderSlots.length; i++) {
        if (!usedSlotIdx.has(i) && renderSlots[i].playerId === pid) {
          slotIdx = i;
          break;
        }
      }
      if (slotIdx >= 0) {
        usedSlotIdx.add(slotIdx);
        return renderSlots[slotIdx];
      }
      const coords = POS_COORDS[idx] ?? { x: 50, y: 50 };
      return {
        ...(renderSlots[0] ?? ({} as (typeof renderSlots)[number])),
        role: `fallback_${pid}` as unknown as (typeof renderSlots)[number]["role"],
        x: coords.x,
        y: coords.y,
        playerId: pid,
        rotationPosition: null,
        isFrontRow: false,
        isBackRow: false,
      };
    })
    .filter(Boolean) as typeof renderSlots;

  // Validación final: la cancha SIEMPRE debe mostrar 6 jugadoras.
  // Si algo se coló hasta acá con menos, el store ya intentó auto-corregir;
  // avisamos que el badge faltante NO pudo repararse automáticamente.
  if (renderSlots.length !== 6) {
    // eslint-disable-next-line no-console
    console.warn(
      `[cancha][auto-fix parcial] ${renderSlots.length}/6 jugadoras renderizadas (equipo=${team.shortName}). onCourt=`,
      onCourt,
    );
  }



  return (
    <div className="relative h-full w-full">
      {renderSlots.map((slot) => {
        const pid = slot.playerId;
        const p = pid ? team.players.find((x) => x.id === pid) : null;
        // Si la jugadora del slot no está en cancha (sustituida) seguimos mostrándola
        // pero atenuada para que el entrenador la corrija. Si no hay player skip.
        if (!p) return null;
        const onCourtActive = onCourt.includes(p.id);
        const isServer = !!serverPlayerId && p.id === serverPlayerId;
        const isLibero = designated.length > 0 ? designated.includes(p.id) : p.position === "libero";
        const isReceptionTarget = needsReception && side === receivingSide;
        const isReceiverHighlight = isReceptionTarget && receiverIds.has(p.id);
        const dx = projectX(slot.x, slot.y);
        const dy = projectY(slot.x, slot.y);
        return (
          <div
            key={slot.role}
            className="absolute -translate-x-1/2 -translate-y-1/2 h-[18%] sm:h-[20%] md:h-[22%] aspect-square"
            style={{ left: `${dx}%`, top: `${dy}%` }}
          >
            <CourtPlayerBadge
              player={p}
              team={team}
              match={match}
              isServer={isServer}
              isLibero={isLibero}
              isReceiverHighlight={isReceiverHighlight}
              active={!!activePlayerId && activePlayerId === p.id}
              dimmed={!onCourtActive}
              onClick={() => onPlayerClick(side, p.id)}
              className="w-full h-full"
            />
          </div>
        );
      })}
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

const POSITION_BADGE_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  armador: { bg: "#3b82f6", text: "#fff", dot: "🔵" },
  opuesto: { bg: "#a855f7", text: "#fff", dot: "🟣" },
  central: { bg: "#ef4444", text: "#fff", dot: "🔴" },
  punta: { bg: "#f97316", text: "#fff", dot: "🟠" },
  libero: { bg: "#22c55e", text: "#fff", dot: "🟢" },
  universal: { bg: "#e2e8f0", text: "#0f172a", dot: "⚪" },
};
const POSITION_ORDER: Record<string, number> = {
  armador: 0,
  opuesto: 1,
  central: 2,
  punta: 3,
  libero: 4,
  universal: 5,
};
const POSITION_FILTERS: { key: "all" | PlayerPosition; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "armador", label: "Armadores" },
  { key: "opuesto", label: "Opuestos" },
  { key: "central", label: "Centrales" },
  { key: "punta", label: "Puntas" },
  { key: "libero", label: "Líberos" },
  { key: "universal", label: "Universales" },
];

function PositionBadge({ position }: { position?: PlayerPosition }) {
  if (!position) {
    return (
      <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        S/P
      </span>
    );
  }
  const c = POSITION_BADGE_COLOR[position] ?? POSITION_BADGE_COLOR.universal;
  return (
    <span
      className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
      style={{ background: c.bg, color: c.text }}
    >
      {PLAYER_POSITION_LABEL[position]}
    </span>
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
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFilter, setPickerFilter] = useState<"all" | PlayerPosition>("all");

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
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            title="Rotar en sentido contrario"
            disabled={lineup.filter(Boolean).length !== 6}
            onClick={() => setLineup([lineup[5], lineup[0], lineup[1], lineup[2], lineup[3], lineup[4]])}
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            title="Rotar en sentido del saque"
            disabled={lineup.filter(Boolean).length !== 6}
            onClick={() => setLineup([lineup[1], lineup[2], lineup[3], lineup[4], lineup[5], lineup[0]])}
          >
            <RotateCw className="size-3.5" />
          </Button>
          <span className="text-xs scoreboard-digit font-bold">
            <span className={stepValid ? "text-success" : "text-primary"}>{filled}</span>
            <span className="text-muted-foreground"> / 6</span>
          </span>
        </div>

      </div>



      <div className="relative rounded-xl bg-gradient-to-b from-[#1e293b] to-[#0b1322] p-3 border border-court-line/40">
        <div className="text-center text-[9px] uppercase tracking-widest text-muted-foreground mb-1">— red —</div>
        {(() => {
          // Rol por slot en base a la posición del armador (sentido antihorario).
          // slotIdx 0..5 ↔ pos 1..6; secuencia CCW: 1→6→5→4→3→2.
          const ccwIndexByPos: Record<number, number> = { 1: 0, 6: 1, 5: 2, 4: 3, 3: 4, 2: 5 };
          // Diagonales: A↔O (P1/P4), P1↔P2 (P2/P5), C2↔C1/L (P3/P6).
          const roleOrder = ["A", "C1/L", "P2", "O", "C2", "P1"];
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
                onClick={() => { setPickingSlot(null); setPickerSearch(""); setPickerFilter("all"); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-2 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Buscar por nombre, número o posición…"
                className="w-full pl-7 pr-2 py-1.5 rounded-md bg-secondary/60 border border-border/60 text-xs focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            <div className="mt-2 flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              {POSITION_FILTERS.map((f) => {
                const active = pickerFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setPickerFilter(f.key)}
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/60 border-border/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto mt-2 grid grid-cols-2 gap-1.5">
              {team.players.length === 0 && (
                <p className="col-span-2 text-xs text-muted-foreground text-center py-4">Sin jugadores en el equipo.</p>
              )}
              {(() => {
                const q = pickerSearch.trim().toLowerCase();
                const filtered = team.players
                  .filter((pl) => {
                    if (pickerFilter !== "all" && pl.position !== pickerFilter) return false;
                    if (!q) return true;
                    const posLabel = pl.position ? PLAYER_POSITION_LABEL[pl.position].toLowerCase() : "";
                    return (
                      pl.name.toLowerCase().includes(q) ||
                      String(pl.number).includes(q) ||
                      posLabel.includes(q)
                    );
                  })
                  .sort((a, b) => {
                    const oa = a.position ? POSITION_ORDER[a.position] ?? 99 : 99;
                    const ob = b.position ? POSITION_ORDER[b.position] ?? 99 : 99;
                    if (oa !== ob) return oa - ob;
                    return (a.number ?? 0) - (b.number ?? 0);
                  });
                if (filtered.length === 0) {
                  return (
                    <p className="col-span-2 text-xs text-muted-foreground text-center py-4">
                      Sin resultados.
                    </p>
                  );
                }
                return filtered.map((pl) => {
                  const slotOfPl = lineup.indexOf(pl.id);
                  const onCourt = slotOfPl >= 0;
                  const takenElsewhere = onCourt && slotOfPl !== pickingSlot;
                  const isCurrent = lineup[pickingSlot] === pl.id;
                  const isLib = isLiberoPlayer(pl.id);
                  const liberoInFront = isLib && isFrontRowSlot(pickingSlot);
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
                      onClick={() => { setSlot(pickingSlot, pl.id); setPickingSlot(null); setPickerSearch(""); setPickerFilter("all"); }}
                      className={`flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs transition-colors min-w-0 border-2 ${
                        isCurrent
                          ? "bg-success/15 border-success text-foreground"
                          : takenElsewhere
                            ? "bg-primary/10 border-primary/60 text-foreground hover:bg-primary/20"
                            : "bg-secondary border-transparent hover:bg-secondary/70"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {pl.photoUrl ? (
                        <img src={pl.photoUrl} alt="" className="size-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="size-9 rounded-full scoreboard-digit font-bold flex items-center justify-center text-sm shrink-0" style={{ background: team.color, color: "#fff" }}>
                          {pl.number}
                        </span>
                      )}
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="truncate leading-tight">
                          <span className="scoreboard-digit font-bold mr-1">#{pl.number}</span>
                          <span className="font-semibold">{pl.name}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <PositionBadge position={pl.position} />
                          {reason && (
                            <span className="text-[9px] uppercase font-bold text-primary/90 truncate">
                              {reason}
                            </span>
                          )}
                        </span>
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 size-5 rounded-full bg-success text-white flex items-center justify-center">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                });
              })()}
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
      (acc, r) => ({
        dpos: acc.dpos + r.doublePositive,
        pos: acc.pos + r.positive,
        neu: acc.neu + r.neutral,
        neg: acc.neg + r.negative,
        dneg: acc.dneg + r.doubleNegative,
        over: acc.over + r.overpass,
        total: acc.total + r.total,
      }),
      { dpos: 0, pos: 0, neu: 0, neg: 0, dneg: 0, over: 0, total: 0 },
    );
    const teamPositivity = recTotals.total > 0 ? ((recTotals.dpos + recTotals.pos) / recTotals.total) * 100 : 0;
    const rows: LiveStatsRow[] = team.players.map((tp) => {
      const p = stats.players.get(tp.id);
      const r = recMap.get(tp.id);
      const attackAttempts = (p?.attack ?? 0) + (p?.attackError ?? 0);
      const kills = Math.max(0, (p?.total ?? 0) - (p?.block ?? 0) - (p?.ace ?? 0));
      const effAtk = attackAttempts > 0 ? (kills / attackAttempts) * 100 : 0;
      const blkAttempts = (p?.block ?? 0) + (p?.blockError ?? 0);
      const effBlk = blkAttempts > 0 ? (((p?.block ?? 0) - (p?.blockError ?? 0)) / blkAttempts) * 100 : 0;
      return {
        playerId: tp.id,
        name: tp.name,
        number: tp.number,
        kills,
        attackAttempts,
        attackError: p?.attackError ?? 0,
        effAtk,
        block: p?.block ?? 0,
        blockError: p?.blockError ?? 0,
        effBlk,
        ace: p?.ace ?? 0,
        serveError: p?.serveError ?? 0,
        total: p?.total ?? 0,
        recTotal: r?.total ?? 0,
        recDoublePos: r?.doublePositive ?? 0,
        recPositive: r?.positive ?? 0,
        recNeutral: r?.neutral ?? 0,
        recNegative: r?.negative ?? 0,
        recDoubleNeg: r?.doubleNegative ?? 0,
        recOverpass: r?.overpass ?? 0,
        recPositivity: r?.positivity ?? 0,
        recEff: r?.efficiency ?? 0,
        unforcedErrors: 0,
      };
    });
    const summary: LiveStatsTeamSummary = {
      attack: tStat?.attack ?? 0,
      block: tStat?.block ?? 0,
      ace: tStat?.ace ?? 0,
      errors: (tStat?.serveErrors ?? 0) + (tStat?.unforcedErrors ?? 0),
      recPositivity: teamPositivity,
      recTotal: recTotals.total,
    };
    return <LiveStatsTable team={team} rows={rows} summary={summary} />;
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
      {isCoach && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">
            Mapas de calor de ataque
          </p>
          <AttackHeatmap match={match} teamA={teamA} teamB={teamB} />
        </div>
      )}
      {isCoach && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">
            Mapas de calor de saque
          </p>
          <ServeHeatmapPanel match={match} teamA={teamA} teamB={teamB} />
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

function FormationDialog({
  open,
  onClose,
  match,
  teamA,
  teamB,
}: {
  open: boolean;
  onClose: () => void;
  match: Match;
  teamA: Team;
  teamB: Team;
}) {
  const formationA = useFormation(match, teamA, "A");
  const formationB = useFormation(match, teamB, "B");
  const [editing, setEditing] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[calc(100dvw-24px)] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formación de recepción · Sistema 5-1</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant={editing ? "default" : "secondary"}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Ver formación" : "Editar posiciones"}
          </Button>
        </div>
        {editing ? (
          <FormationEditor previewTeam={teamA} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-bold text-foreground">{teamA.name}</div>
              <CourtFormation team={teamA} formation={formationA} />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold text-foreground">{teamB.name}</div>
              <CourtFormation team={teamB} formation={formationB} />
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {editing
            ? "Arrastrá cada jugadora a la zona que quieras. Los cambios se aplican a todos los equipos y rotaciones que muestren esta formación."
            : "Las posiciones se recalculan automáticamente cuando el equipo rota. Los colores indican el rol táctico de cada jugadora. Asigná la posición (armadora / central / punta / opuesta / líbero) en la ficha de cada jugadora para que la formación se ajuste correctamente."}
        </p>
      </DialogContent>
    </Dialog>
  );
}


