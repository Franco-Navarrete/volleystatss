import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  POINT_TYPE_LABEL,
  useVolley,
  setsWon,
  currentServer,
  type PointType,
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
  LogOut,
  Play,
  StopCircle,
  Undo2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/matches/$id")({
  head: () => ({ meta: [{ title: "Partido en vivo · RALLY" }] }),
  component: LiveMatch,
});

function LiveMatch() {
  const { id } = Route.useParams();
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

  const [pendingPlayer, setPendingPlayer] = useState<{
    side: "A" | "B";
    playerId: string;
  } | null>(null);
  const [subState, setSubState] = useState<{
    side: "A" | "B";
    playerOutId: string;
  } | null>(null);

  if (!match || !teamA || !teamB) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Partido no encontrado.</p>
          <Button asChild className="mt-4">
            <Link to="/matches">Volver</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const w = setsWon(match);
  const currentSet = match.sets.find((s) => s.number === match.currentSet)!;
  const server = currentServer(match);
  const isLive = match.status === "live";

  const onPlayerClick = (side: "A" | "B", playerId: string) => {
    if (!isLive) return;
    setPendingPlayer({ side, playerId });
  };

  const submitAction = (type: PointType) => {
    if (!pendingPlayer) return;
    recordPoint(match.id, pendingPlayer.side, type, pendingPlayer.playerId);
    setPendingPlayer(null);
  };

  return (
    <AppShell>
      {/* Scoreboard header */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-4 rounded-2xl bg-card border border-border/60 px-4 sm:px-8 py-4">
        <ScoreColumn team={teamA} score={currentSet.scoreA} sets={w.a} align="right" serving={server.side === "A"} />
        <div className="text-center px-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Set {match.currentSet}
          </div>
          <div className="text-lg font-extrabold text-primary leading-none mt-1">RALLY</div>
          {match.status === "live" ? (
            <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-destructive">
              <span className="size-1.5 rounded-full bg-destructive animate-pulse" /> En vivo
            </span>
          ) : match.status === "finished" ? (
            <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-widest text-success">
              Final
            </span>
          ) : (
            <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Programado
            </span>
          )}
        </div>
        <ScoreColumn team={teamB} score={currentSet.scoreB} sets={w.b} align="left" serving={server.side === "B"} />
      </header>

      {match.status === "scheduled" && (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-center mb-4">
          <p className="text-muted-foreground mb-3">
            Iniciá el partido para registrar puntos sobre la cancha.
          </p>
          <Button onClick={() => startMatch(match.id)} className="bg-gradient-primary text-primary-foreground shadow-glow">
            <Play className="size-4" /> Iniciar partido
          </Button>
        </div>
      )}

      {/* Court + side controls */}
      <div className="grid grid-cols-[auto_1fr_auto] gap-3 sm:gap-4 items-start">
        <SideActions
          side="left"
          disabled={!isLive}
          onCambio={() => {
            // Choose player to take out from side A
            const first = match.onCourtA[0];
            if (first) setSubState({ side: "A", playerOutId: "" });
          }}
          onTiempo={() => recordTimeout(match.id, "A")}
          onSancion={() => alert("Sanción: registrada (placeholder)")}
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
          onCambio={() => setSubState({ side: "B", playerOutId: "" })}
          onTiempo={() => recordTimeout(match.id, "B")}
          onSancion={() => alert("Sanción: registrada (placeholder)")}
        />
      </div>

      {/* Bottom action row */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Button
          variant="secondary"
          disabled={!isLive || match.events.length === 0}
          onClick={() => undo(match.id)}
        >
          <Undo2 className="size-4" /> Deshacer
        </Button>
        <Button asChild variant="secondary">
          <Link to="/matches/$id/stats" params={{ id: match.id }}>
            <ChartBarBig className="size-4" /> Estadísticas
          </Link>
        </Button>
        <Button
          variant="outline"
          disabled={!isLive}
          onClick={() => {
            if (confirm("¿Forzar fin de set actual?")) {
              // Heuristic: push points so set closes? Simpler: just leave to engine.
              alert("El set se cierra automáticamente al alcanzar la meta de puntos.");
            }
          }}
        >
          <StopCircle className="size-4" /> Fin Set
        </Button>
        <Button
          variant="destructive"
          disabled={match.status === "finished"}
          onClick={() => {
            if (confirm("¿Finalizar el partido manualmente?")) finishMatch(match.id);
          }}
        >
          <Flag className="size-4" /> Fin Partido
        </Button>
      </div>

      {/* Sets history */}
      {match.sets.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {match.sets.map((s) => (
            <div
              key={s.number}
              className={`px-3 py-1.5 rounded-md text-xs scoreboard-digit font-bold tabular-nums border ${
                s.number === match.currentSet
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border/60 text-muted-foreground"
              }`}
            >
              Set {s.number}: <span className="text-foreground">{s.scoreA}–{s.scoreB}</span>
              {s.finished && (
                <span className="ml-1 text-success">
                  {s.scoreA > s.scoreB ? `▲${teamA.shortName}` : `▲${teamB.shortName}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {match.status === "finished" && (
        <div className="mt-6 flex justify-center">
          <Button
            asChild
            size="lg"
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Link to="/matches/$id/stats" params={{ id: match.id }}>
              <ChartBarBig className="size-4" /> Ver estadísticas finales
            </Link>
          </Button>
        </div>
      )}

      {/* Action menu when a player is tapped */}
      <Dialog open={!!pendingPlayer} onOpenChange={(o) => !o && setPendingPlayer(null)}>
        <DialogContent className="max-w-sm">
          {pendingPlayer && (() => {
            const t = pendingPlayer.side === "A" ? teamA : teamB;
            const other = pendingPlayer.side === "A" ? teamB : teamA;
            const player = t.players.find((p) => p.id === pendingPlayer.playerId);
            const isServer =
              server.side === pendingPlayer.side && server.playerId === pendingPlayer.playerId;
            const actions: { type: PointType; label: string; tone: "primary" | "neutral" | "danger" }[] = [
              { type: "attack", label: "Ataque", tone: "primary" },
              { type: "block", label: "Bloqueo", tone: "primary" },
              ...(isServer
                ? ([{ type: "ace", label: "Saque (Ace)", tone: "primary" }] as const)
                : []),
              { type: "opponent_error", label: `Error del rival (${other.shortName})`, tone: "neutral" },
              { type: "unforced_error", label: "Error no forzado", tone: "danger" },
              ...(isServer
                ? ([{ type: "serve_error", label: "Error de saque", tone: "danger" }] as const)
                : []),
            ];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <span
                      className="size-10 rounded-full flex items-center justify-center scoreboard-digit font-black text-white"
                      style={{ background: t.color }}
                    >
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
                    <button
                      key={a.type}
                      onClick={() => submitAction(a.type)}
                      className={`w-full text-left px-4 py-3 rounded-lg font-semibold text-sm transition-all active:scale-[0.98] ${
                        a.tone === "primary"
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : a.tone === "danger"
                          ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                          : "bg-secondary hover:bg-secondary/70"
                      }`}
                    >
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
                <DialogHeader>
                  <DialogTitle>Cambio · {t.name}</DialogTitle>
                </DialogHeader>
                {!subState.playerOutId ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">Jugador que SALE</p>
                    <div className="grid grid-cols-2 gap-2">
                      {onCourt.map((pid) => {
                        const p = t.players.find((x) => x.id === pid);
                        if (!p) return null;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setSubState({ ...subState, playerOutId: p.id })}
                            className="flex items-center gap-2 p-3 rounded-lg bg-secondary hover:bg-destructive/20"
                          >
                            <span className="size-8 rounded scoreboard-digit font-bold bg-background flex items-center justify-center text-xs">
                              {p.number}
                            </span>
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
                      {t.players
                        .filter((p) => !onCourtSet.has(p.id))
                        .map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              recordSub(match.id, subState.side, p.id, subState.playerOutId);
                              setSubState(null);
                            }}
                            className="flex items-center gap-2 p-3 rounded-lg bg-secondary hover:bg-success/20"
                          >
                            <span className="size-8 rounded scoreboard-digit font-bold bg-background flex items-center justify-center text-xs">
                              {p.number}
                            </span>
                            <span className="text-sm truncate">{p.name}</span>
                          </button>
                        ))}
                      {t.players.filter((p) => !onCourtSet.has(p.id)).length === 0 && (
                        <p className="col-span-2 text-center text-sm text-muted-foreground py-4">
                          No hay suplentes disponibles.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ScoreColumn({
  team,
  score,
  sets,
  align,
  serving,
}: {
  team: Team;
  score: number;
  sets: number;
  align: "left" | "right";
  serving: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 ${
        align === "right" ? "justify-end text-right flex-row-reverse" : "text-left"
      }`}
    >
      <div
        className="size-10 sm:size-12 rounded-md flex items-center justify-center font-black text-white text-xs sm:text-sm shrink-0"
        style={{ background: team.color }}
      >
        {team.shortName}
      </div>
      <div>
        <div className="text-xs sm:text-sm font-bold truncate flex items-center gap-1.5">
          {team.name}
          {serving && <span className="text-[9px] uppercase tracking-widest text-primary">● Saque</span>}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Sets <span className="text-foreground font-bold">{sets}</span>
        </div>
        <div className="scoreboard-digit text-5xl sm:text-7xl font-black leading-none mt-1 text-primary">
          {score}
        </div>
      </div>
    </div>
  );
}

function SideActions({
  side,
  disabled,
  onCambio,
  onTiempo,
  onSancion,
}: {
  side: "left" | "right";
  disabled: boolean;
  onCambio: () => void;
  onTiempo: () => void;
  onSancion: () => void;
}) {
  const reverse = side === "right";
  return (
    <div className="flex flex-col gap-2 w-[88px] sm:w-[120px]">
      <SideButton icon={<ArrowLeftRight className="size-4" />} label="Cambio" onClick={onCambio} disabled={disabled} reverse={reverse} />
      <SideButton icon={<Hourglass className="size-4" />} label="Tiempo" onClick={onTiempo} disabled={disabled} reverse={reverse} />
      <SideButton icon={<X className="size-4" />} label="Sanción" onClick={onSancion} disabled={disabled} reverse={reverse} />
    </div>
  );
}

function SideButton({
  icon,
  label,
  onClick,
  disabled,
  reverse,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  reverse: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center ${reverse ? "flex-row-reverse" : ""} justify-between gap-2 px-3 py-2.5 rounded-lg bg-card border border-border/60 hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold`}
    >
      <span className="truncate">{label}</span>
      <span className="text-muted-foreground">{icon}</span>
    </button>
  );
}

function CourtView({
  match,
  teamA,
  teamB,
  serverPlayerId,
  serverSide,
  onPlayerClick,
}: {
  match: Match;
  teamA: Team;
  teamB: Team;
  serverPlayerId: string | null;
  serverSide: "A" | "B";
  onPlayerClick: (side: "A" | "B", playerId: string) => void;
}) {
  // Volleyball position grid per side, mapped to onCourt indices [0..5].
  // Index 0 = position 1 (server, back-right). Clockwise positions:
  // 1 (back-right), 2 (front-right), 3 (front-middle), 4 (front-left),
  // 5 (back-left), 6 (back-middle).
  //
  // For team A (left of court), the net is on the right edge of A's half.
  //   Front row (closer to net = right column):  pos4 (top), pos3 (mid), pos2 (bot)
  //   Back row  (left column):                  pos5 (top), pos6 (mid), pos1 (bot)
  // For team B (right of court), the net is on the left edge of B's half. Mirror it.

  const cellOrderA = [
    // 2 columns × 3 rows: [col0 row0, col0 row1, col0 row2, col1 row0, col1 row1, col1 row2]
    4, // back top
    5, // back mid (pos6)
    0, // back bot (pos1 server)
    3, // front top (pos4)
    2, // front mid (pos3)
    1, // front bot (pos2)
  ];
  const cellOrderB = [
    // mirror: front col first
    1, // front top (pos2)
    2, // front mid (pos3)
    3, // front bot (pos4)
    0, // back top would be pos1 (server) bottom-back-right from B's perspective.
    5, // back mid (pos6)
    4, // back bot (pos5)
  ];
  // Simpler: just render same 2x3 mirrored
  // We'll use: A columns = [back, front], B columns = [front, back] with same vertical ordering [pos4/3/2 or pos5/6/1].
  // Redo cleanly below.

  const a = match.onCourtA;
  const b = match.onCourtB;

  // Final layout per side: 2 columns × 3 rows of indices into onCourt
  // For both sides we'll show same pattern; visually the net is in the middle of the court image.
  // Column near net = front row [pos4 top, pos3 mid, pos2 bot] -> indices [3,2,1]
  // Column away from net = back row [pos5 top, pos6 mid, pos1 bot] -> indices [4,5,0]
  const sideAColumns: number[][] = [
    [4, 5, 0], // back (left)
    [3, 2, 1], // front (right, near net)
  ];
  const sideBColumns: number[][] = [
    [3, 2, 1], // front (left, near net)
    [4, 5, 0], // back (right)
  ];

  return (
    <div className="relative rounded-xl border border-court-line/40 bg-gradient-to-b from-[#1e293b] to-[#0b1322] p-3 sm:p-4 overflow-hidden">
      {/* Court markings */}
      <div className="absolute inset-3 sm:inset-4 rounded-md border-2 border-court-line/60 pointer-events-none" />
      <div className="absolute left-1/2 top-3 bottom-3 sm:top-4 sm:bottom-4 w-1 bg-primary -translate-x-1/2 pointer-events-none" />

      <div className="relative grid grid-cols-2 gap-4 sm:gap-6">
        <CourtHalf
          team={teamA}
          onCourt={a}
          columns={sideAColumns}
          serverPlayerId={serverSide === "A" ? serverPlayerId : null}
          onClick={(pid) => onPlayerClick("A", pid)}
        />
        <CourtHalf
          team={teamB}
          onCourt={b}
          columns={sideBColumns}
          serverPlayerId={serverSide === "B" ? serverPlayerId : null}
          onClick={(pid) => onPlayerClick("B", pid)}
        />
      </div>
    </div>
  );
}

function CourtHalf({
  team,
  onCourt,
  columns,
  serverPlayerId,
  onClick,
}: {
  team: Team;
  onCourt: string[];
  columns: number[][];
  serverPlayerId: string | null;
  onClick: (playerId: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      {columns.map((col, ci) => (
        <div key={ci} className="flex flex-col gap-2 sm:gap-3">
          {col.map((idx) => {
            const pid = onCourt[idx];
            const p = team.players.find((x) => x.id === pid);
            const isServer = pid && pid === serverPlayerId;
            return (
              <button
                key={`${ci}-${idx}`}
                onClick={() => p && onClick(p.id)}
                disabled={!p}
                className={`relative aspect-square rounded-full flex items-center justify-center text-white font-black scoreboard-digit text-xl sm:text-2xl shadow-md transition-all active:scale-95 hover:ring-4 hover:ring-white/30 ${
                  isServer ? "ring-4 ring-primary" : ""
                }`}
                style={{ background: team.color }}
                title={p ? `#${p.number} ${p.name}` : ""}
              >
                {p?.number ?? "?"}
                {isServer && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[8px] font-bold uppercase tracking-widest">
                    Saque
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
