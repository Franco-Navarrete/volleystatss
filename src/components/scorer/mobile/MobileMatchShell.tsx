import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Undo2,
  Target,
  Users,
  ChartBarBig,
  MoreVertical,
  ArrowLeftRight,
  Shirt,
  Hourglass,
  AlertTriangle,
  Flag,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RallyProgressBar } from "@/components/scorer/RallyProgressBar";
import type { Match, Team } from "@/lib/volley-store";
import type { RallyContext } from "@/lib/rally-phase";

interface Props {
  match: Match;
  teamA: Team;
  teamB: Team;
  leftTeam: Team;
  rightTeam: Team;
  leftSide: "A" | "B";
  rightSide: "A" | "B";
  scoreLeft: number;
  scoreRight: number;
  setsLeft: number;
  setsRight: number;
  serverSide: "A" | "B";
  setNumber: number;
  setTimerLabel: string | null;
  isLive: boolean;
  isCoach: boolean;
  toUsedA: number;
  toUsedB: number;
  actionsDisabled: boolean;
  rallyCtx: RallyContext;
  // Handlers
  onUndo: () => void;
  canUndo: boolean;
  onOpenSetting: () => void;
  onOpenFormation: () => void;
  onOpenLineup: () => void;
  onOpenLiveStats: () => void;
  hideStats?: boolean;
  onOpenFormat: () => void;
  onOpenScore: () => void;
  onOpenRotate: () => void;
  onFinishMatch: () => void;
  onCambio: (side: "A" | "B") => void;
  onLibero: (side: "A" | "B") => void;
  onTimeout: (side: "A" | "B") => void;
  onSancion: (side: "A" | "B") => void;
  onStartSet: () => void;
  onToggleSides: () => void;
  needsLineup: boolean;
  needsSetStart: boolean;
  courtSlot: ReactNode;
}

export function MobileMatchShell(p: Props) {
  const {
    match,
    teamA,
    teamB,
    leftTeam,
    rightTeam,
    leftSide,
    rightSide,
    scoreLeft,
    scoreRight,
    setsLeft,
    setsRight,
    serverSide,
    setNumber,
    setTimerLabel,
    isLive,
    isCoach,
    toUsedA,
    toUsedB,
    actionsDisabled,
    rallyCtx,
    onUndo,
    canUndo,
    onOpenSetting,
    onOpenFormation,
    onOpenLineup,
    onOpenLiveStats,
    onOpenFormat,
    onOpenScore,
    onOpenRotate,
    onFinishMatch,
    onCambio,
    onLibero,
    onTimeout,
    onSancion,
    onStartSet,
    onToggleSides,
    needsLineup,
    needsSetStart,
    courtSlot,
  } = p;

  const [moreOpen, setMoreOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [chipVisible, setChipVisible] = useState(true);
  const swipeStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const chipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide "última acción" chip después de 4s
  useEffect(() => {
    if (!rallyCtx.lastActionLabel) return;
    setChipVisible(true);
    if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
    chipTimerRef.current = setTimeout(() => setChipVisible(false), 4000);
    return () => {
      if (chipTimerRef.current) clearTimeout(chipTimerRef.current);
    };
  }, [rallyCtx.lastActionLabel, rallyCtx.lastActionDetail, rallyCtx.lastActionSide]);

  // Al abrir el menú → volver a mostrar la nav
  useEffect(() => {
    if (moreOpen) setNavVisible(true);
  }, [moreOpen]);

  const onCourtTap = () => {
    setNavVisible((v) => !v);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    swipeStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = Date.now() - s.t;
    // Swipe hacia arriba desde el borde inferior → mostrar nav
    if (dy < -60 && Math.abs(dx) < 60 && dt < 600) {
      setNavVisible(true);
      return;
    }
    // Swipe izquierda → deshacer
    if (canUndo && dx < -80 && Math.abs(dy) < 60 && dt < 600) {
      onUndo();
      if ("vibrate" in navigator) navigator.vibrate?.(15);
    }
  };


  const short = (s: "A" | "B") => (s === "A" ? teamA.shortName : teamB.shortName);
  const phaseLabel = rallyCtx.finished
    ? "Rally finalizado"
    : rallyCtx.currentActionText;

  const posLeft = serverSide === leftSide;

  return (
    <div className="mobile-live-shell relative flex flex-col h-full min-h-0 select-none">
      {/* TopBar compacto */}
      <header className="shrink-0 px-2 pt-1.5 pb-1 border-b border-border/60 bg-card/90 backdrop-blur">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <TeamMini
            team={leftTeam}
            score={scoreLeft}
            sets={setsLeft}
            serving={posLeft}
            align="left"
            onScoreClick={isLive ? onOpenScore : undefined}
          />
          <div className="flex flex-col items-center leading-tight px-1">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
              Set {setNumber}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-destructive">
                <span className="size-1 rounded-full bg-destructive animate-pulse" />
                Live
              </span>
            ) : match.status === "finished" ? (
              <span className="text-[9px] font-bold uppercase text-success">Final</span>
            ) : (
              <span className="text-[9px] font-bold uppercase text-muted-foreground">
                Prog.
              </span>
            )}
            {setTimerLabel && (
              <span className="scoreboard-digit tabular-nums text-[11px] font-bold">
                {setTimerLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onToggleSides}
              className="mt-0.5 inline-flex items-center justify-center size-6 rounded-md border border-border/60 text-muted-foreground active:scale-95"
              aria-label="Invertir lados"
            >
              <ArrowLeftRight className="size-3" />
            </button>
          </div>
          <TeamMini
            team={rightTeam}
            score={scoreRight}
            sets={setsRight}
            serving={!posLeft && serverSide === rightSide}
            align="right"
            onScoreClick={isLive ? onOpenScore : undefined}
          />
        </div>
      </header>

      {/* Estados pre-set */}
      {needsLineup && (
        <div className="shrink-0 mx-2 mt-1 rounded-md border-2 border-primary/60 bg-primary/10 px-2 py-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold">
            Confirmá la formación del Set {setNumber}
          </span>
          <Button size="sm" className="h-8 text-[11px]" onClick={onOpenLineup}>
            <Users className="size-3.5" /> Formación
          </Button>
        </div>
      )}
      {needsSetStart && (
        <div className="shrink-0 mx-2 mt-1 rounded-md border-2 border-success/60 bg-success/10 px-2 py-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold">Listos para iniciar el Set {setNumber}</span>
          <Button
            size="sm"
            className="h-8 text-[11px] bg-success text-success-foreground"
            onClick={onStartSet}
          >
            <Play className="size-3.5" /> Iniciar
          </Button>
        </div>
      )}

      {/* Cápsula de fase */}
      {isLive && !needsLineup && !needsSetStart && (
        <div className="shrink-0 px-2 pt-1 flex justify-center">
          <div
            className={`inline-flex max-w-full items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border truncate ${
              rallyCtx.finished
                ? "bg-success/10 text-success border-success/40"
                : rallyCtx.currentPhaseSide
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "bg-muted text-muted-foreground border-border/60"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                rallyCtx.finished ? "bg-success" : "bg-primary animate-pulse"
              }`}
            />
            <span className="truncate">{phaseLabel}</span>
          </div>
        </div>
      )}

      {/* Barra de progreso ultra fina */}
      {isLive && !needsLineup && !needsSetStart && (
        <div className="shrink-0 px-2 pt-1">
          <RallyProgressBar ctx={rallyCtx} />
        </div>
      )}

      {/* Cancha ocupa el resto */}
      <div
        className={`relative flex-1 min-h-0 px-1 pt-1 transition-[padding] duration-200 ${
          navVisible ? "pb-[calc(56px+env(safe-area-inset-bottom))]" : "pb-[env(safe-area-inset-bottom)]"
        }`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={onCourtTap}
      >
        <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
          {courtSlot}
        </div>

        {/* Botón flotante Deshacer (siempre visible) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!canUndo) return;
            onUndo();
            if ("vibrate" in navigator) navigator.vibrate?.(10);
          }}
          disabled={!canUndo}
          aria-label="Deshacer"
          className={`absolute left-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 grid place-items-center size-12 rounded-full shadow-xl border border-border/60 bg-card/95 backdrop-blur text-foreground active:scale-95 transition-all ${
            !navVisible ? "bottom-[calc(16px+env(safe-area-inset-bottom))]" : ""
          } ${!canUndo ? "opacity-40" : "hover:bg-secondary"}`}
        >
          <Undo2 className="size-5" />
        </button>

        {/* Chip flotante "última acción" (auto-hide) */}
        {rallyCtx.lastActionLabel && chipVisible && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLiveStats();
            }}
            className={`absolute right-2 max-w-[65%] animate-fade-in z-20 ${
              navVisible
                ? "bottom-[calc(72px+env(safe-area-inset-bottom))]"
                : "bottom-[calc(16px+env(safe-area-inset-bottom))]"
            }`}
          >
            <div className="rounded-full bg-card/95 backdrop-blur border border-border/60 shadow-md px-2.5 py-1 text-[10.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
              <span
                className="scoreboard-digit tabular-nums font-black shrink-0"
                style={{
                  color:
                    (rallyCtx.lastActionSide === "A" ? teamA.color : teamB.color) ??
                    undefined,
                }}
              >
                {rallyCtx.lastActionSide === "A" ? short("A") : short("B")}
              </span>
              <span className="truncate">{rallyCtx.lastActionLabel}</span>
              {rallyCtx.lastActionDetail && (
                <span className="text-muted-foreground truncate">
                  · {rallyCtx.lastActionDetail}
                </span>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Zona sensible para hacer swipe-up desde el borde y traer la nav */}
      {!navVisible && (
        <div
          className="fixed bottom-0 inset-x-0 h-6 z-30"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onClick={() => setNavVisible(true)}
        >
          <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-foreground/25" />
        </div>
      )}

      {/* BottomNav fijo (auto-hide) */}
      <nav
        className={`fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur px-1 pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ${
          navVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="grid grid-cols-4 gap-0.5 h-14">
          <NavBtn
            icon={<Target className="size-5" />}
            label="Armado"
            onClick={onOpenSetting}
            disabled={!isLive || actionsDisabled || !isCoach}
            highlight
          />
          <NavBtn
            icon={<Users className="size-5" />}
            label="Cancha"
            onClick={onOpenFormation}
          />
          <NavBtn
            icon={<ChartBarBig className="size-5" />}
            label="Stats"
            onClick={onOpenLiveStats}
          />
          <NavBtn
            icon={<MoreVertical className="size-5" />}
            label="Menú"
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>


      {/* Sheet inferior con acciones menos frecuentes */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Más acciones</SheetTitle>
          </SheetHeader>

          <div className="mt-3 space-y-4">
            <MenuGroup title={`${leftTeam.shortName} (izq.)`}>
              <MenuBtn
                icon={<ArrowLeftRight className="size-4" />}
                label="Cambio"
                onClick={() => {
                  setMoreOpen(false);
                  onCambio(leftSide);
                }}
                disabled={actionsDisabled}
              />
              <MenuBtn
                icon={<Shirt className="size-4" />}
                label="Líbero"
                onClick={() => {
                  setMoreOpen(false);
                  onLibero(leftSide);
                }}
                disabled={actionsDisabled}
              />
              <MenuBtn
                icon={<Hourglass className="size-4" />}
                label={`Tiempo (${(leftSide === "A" ? toUsedA : toUsedB)}/2)`}
                onClick={() => {
                  setMoreOpen(false);
                  onTimeout(leftSide);
                }}
                disabled={actionsDisabled || (leftSide === "A" ? toUsedA : toUsedB) >= 2}
              />
              <MenuBtn
                icon={<AlertTriangle className="size-4" />}
                label="Sanción"
                danger
                onClick={() => {
                  setMoreOpen(false);
                  onSancion(leftSide);
                }}
                disabled={actionsDisabled}
              />
            </MenuGroup>

            <MenuGroup title={`${rightTeam.shortName} (der.)`}>
              <MenuBtn
                icon={<ArrowLeftRight className="size-4" />}
                label="Cambio"
                onClick={() => {
                  setMoreOpen(false);
                  onCambio(rightSide);
                }}
                disabled={actionsDisabled}
              />
              <MenuBtn
                icon={<Shirt className="size-4" />}
                label="Líbero"
                onClick={() => {
                  setMoreOpen(false);
                  onLibero(rightSide);
                }}
                disabled={actionsDisabled}
              />
              <MenuBtn
                icon={<Hourglass className="size-4" />}
                label={`Tiempo (${(rightSide === "A" ? toUsedA : toUsedB)}/2)`}
                onClick={() => {
                  setMoreOpen(false);
                  onTimeout(rightSide);
                }}
                disabled={actionsDisabled || (rightSide === "A" ? toUsedA : toUsedB) >= 2}
              />
              <MenuBtn
                icon={<AlertTriangle className="size-4" />}
                label="Sanción"
                danger
                onClick={() => {
                  setMoreOpen(false);
                  onSancion(rightSide);
                }}
                disabled={actionsDisabled}
              />
            </MenuGroup>

            <MenuGroup title="Partido">
              <MenuBtn
                icon={<Users className="size-4" />}
                label="Formación / Rotación"
                onClick={() => {
                  setMoreOpen(false);
                  onOpenLineup();
                }}
                disabled={!isLive}
              />
              <MenuBtn
                icon={<ArrowLeftRight className="size-4" />}
                label="Corregir rotación"
                onClick={() => {
                  setMoreOpen(false);
                  onOpenRotate();
                }}
                disabled={!isLive}
              />
              <MenuBtn
                icon={<Hourglass className="size-4" />}
                label="Formato del partido"
                onClick={() => {
                  setMoreOpen(false);
                  onOpenFormat();
                }}
                disabled={match.status === "finished"}
              />
              <MenuBtn
                icon={<ChartBarBig className="size-4" />}
                label="Estadísticas completas"
                asChild
              >
                <Link
                  to="/matches/$id/stats"
                  params={{ id: match.id }}
                  onClick={() => setMoreOpen(false)}
                  className="w-full h-11 rounded-md border border-border/60 hover:bg-secondary flex items-center gap-2 px-3 text-sm"
                >
                  <ChartBarBig className="size-4" /> Estadísticas completas
                </Link>
              </MenuBtn>
              <MenuBtn
                icon={<Flag className="size-4" />}
                label="Finalizar partido"
                danger
                disabled={match.status === "finished"}
                onClick={() => {
                  if (confirm("¿Finalizar el partido manualmente?")) {
                    setMoreOpen(false);
                    onFinishMatch();
                  }
                }}
              />
            </MenuGroup>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TeamMini({
  team,
  score,
  sets,
  serving,
  align,
  onScoreClick,
}: {
  team: Team;
  score: number;
  sets: number;
  serving: boolean;
  align: "left" | "right";
  onScoreClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <div
        className="size-8 rounded-md flex items-center justify-center font-black text-white text-[10px] shrink-0"
        style={{ background: team.color }}
      >
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt=""
            className="w-full h-full rounded-md object-cover"
          />
        ) : (
          team.shortName
        )}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[11px] font-bold truncate">{team.shortName}</span>
          {serving && (
            <span
              className="size-1.5 rounded-full bg-primary shrink-0"
              aria-label="Saque"
            />
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <button
            type="button"
            onClick={onScoreClick}
            disabled={!onScoreClick}
            className="scoreboard-digit tabular-nums text-2xl font-black leading-none text-primary active:scale-95 disabled:opacity-100"
          >
            {score}
          </button>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            · S {sets}
          </span>
        </div>
      </div>
    </div>
  );
}

function NavBtn({
  icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-0.5 min-h-11 rounded-md transition-colors active:scale-95 disabled:opacity-40 ${
        highlight ? "text-primary" : "text-foreground/80"
      }`}
    >
      {icon}
      <span className="text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function MenuBtn({
  icon,
  label,
  onClick,
  disabled,
  danger,
  asChild,
  children,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  asChild?: boolean;
  children?: ReactNode;
}) {
  if (asChild && children) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-11 rounded-md border flex items-center gap-2 px-3 text-sm font-semibold text-left transition-colors active:scale-95 disabled:opacity-40 ${
        danger
          ? "bg-destructive/10 border-destructive/40 text-destructive"
          : "bg-card border-border/60 hover:bg-secondary"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
