import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useVolley, type PointType, type ReceptionRating, type DefenseRating } from "@/lib/volley-store";
import { buildVideoMarks, type VideoMark } from "@/lib/video-marks";
import { Button } from "@/components/ui/button";
import { LiveCameraPanel } from "@/components/video/live/LiveCameraPanel";
import {
  useScoutStore,
  FUND_LABEL,
  FUND_COLOR,
  FUND_KEY,
  RESULT_KEY,
  RESULT_LABEL,
  RESULT_COLOR,
  type ScoutFundamento,
  type ScoutResultado,
} from "@/lib/video-scout-store";
import { ArrowLeft, Zap, PauseCircle, Undo2, ChevronRight, Radio, Film } from "lucide-react";
import type { LiveRecorder } from "@/lib/live-recording";
import { RecordingReviewDialog } from "@/components/video/live/RecordingReviewDialog";

export const Route = createFileRoute("/_authenticated/video/$matchId/live")({
  head: () => ({
    meta: [
      { title: "Scouting en Vivo (cámara) — RALLY" },
      { name: "description", content: "Registro en tiempo real con cámara. Cada acción queda anclada al video para reproducirla con un clic." },
    ],
  }),
  component: LiveRoute,
});

type Side = "A" | "B";

function ratingForReception(r: ScoutResultado): ReceptionRating {
  switch (r) {
    case "excelente": return "double_positive";
    case "positivo": return "positive";
    case "neutro": return "neutral";
    case "negativo": return "negative";
    case "error": return "double_negative";
  }
}
function ratingForDefense(r: ScoutResultado): DefenseRating {
  switch (r) {
    case "excelente": return "excellent";
    case "positivo": return "positive";
    case "neutro": return "controlled";
    case "negativo": return "weak";
    case "error": return "error";
  }
}
function pointTypeForServe(r: ScoutResultado): PointType | null {
  if (r === "excelente") return "ace";
  if (r === "error") return "serve_error";
  return null;
}
function pointTypeForAttack(r: ScoutResultado): PointType | null {
  if (r === "excelente" || r === "positivo") return "attack";
  if (r === "error") return "attack_error";
  return null;
}
function pointTypeForBlock(r: ScoutResultado): PointType | null {
  if (r === "excelente" || r === "positivo") return "block";
  if (r === "error") return "block_error";
  return null;
}

function LiveRoute() {
  const { matchId } = Route.useParams();
  const match = useVolley((s) => s.matches.find((m) => m.id === matchId));
  const teams = useVolley((s) => s.teams);
  const teamA = teams.find((t) => t.id === match?.teamAId);
  const teamB = teams.find((t) => t.id === match?.teamBId);

  const mode = useScoutStore((s) => s.mode);
  const autoPauseMs = useScoutStore((s) => s.autoPauseMs);
  const setMode = useScoutStore((s) => s.setMode);

  // Estado de grabación
  const recordingStartedRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<LiveRecorder | null>(null);
  const [bufferedMs, setBufferedMs] = useState(0);
  const [bufferedBytes, setBufferedBytes] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  // Selección
  const [side, setSide] = useState<Side | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [fund, setFund] = useState<ScoutFundamento | null>(null);
  const [ghost, setGhost] = useState<string | null>(null);
  const [overlayUntil, setOverlayUntil] = useState(0);

  const resetStep = useCallback(() => { setPlayerId(null); setFund(null); }, []);

  const showGhost = useCallback((text: string) => {
    setGhost(text);
    const t = window.setTimeout(() => setGhost(null), 900);
    return () => window.clearTimeout(t);
  }, []);

  const videoTMsNow = useCallback((): number | undefined => {
    if (recordingStartedRef.current == null) return undefined;
    return Math.max(0, performance.now() - recordingStartedRef.current);
  }, []);

  const commit = useCallback((result: ScoutResultado) => {
    if (!match || !side || !fund) return;
    const v = useVolley.getState();
    const tMs = videoTMsNow();
    switch (fund) {
      case "saque": {
        const pt = pointTypeForServe(result);
        if (pt) v.recordPoint(match.id, side, pt, playerId);
        else showGhost(`Saque ${RESULT_LABEL[result]} sin punto`);
        break;
      }
      case "recepcion":
        if (playerId) v.recordReception(match.id, side, playerId, ratingForReception(result));
        break;
      case "defensa":
        if (playerId) v.recordDefense(match.id, side, playerId, ratingForDefense(result));
        break;
      case "ataque": {
        const pt = pointTypeForAttack(result);
        if (pt) v.recordPoint(match.id, side, pt, playerId);
        else if (playerId) v.recordAttackAttempt(match.id, side, playerId, {});
        break;
      }
      case "bloqueo": {
        const pt = pointTypeForBlock(result);
        if (pt) v.recordPoint(match.id, side, pt, playerId);
        break;
      }
      case "armado":
      case "freeball":
      case "cobertura":
      case "pase":
        if (playerId) v.recordAttackAttempt(match.id, side, playerId, {});
        break;
      case "error":
        v.recordPoint(match.id, side, "unforced_error", playerId);
        break;
      case "punto":
        v.recordPoint(match.id, side, "opponent_error", playerId);
        break;
    }
    // Anclar videoTMs al último evento agregado (mismo store, mismo tick).
    if (tMs != null) {
      const state = useVolley.getState();
      const m = state.matches.find((mm) => mm.id === match.id);
      const last = m?.events[m.events.length - 1] as unknown as { videoTMs?: number } | undefined;
      if (last && last.videoTMs == null) last.videoTMs = tMs;
    }

    const team = side === "A" ? teamA : teamB;
    const p = team?.players.find((pp) => pp.id === playerId);
    showGhost(`${FUND_LABEL[fund]} · ${RESULT_LABEL[result]} · ${p ? `#${p.number} ${p.name}` : team?.name ?? side}${tMs != null ? ` · ${(tMs/1000).toFixed(1)}s` : ""}`);
    resetStep();
    if (mode === "completo") setOverlayUntil(Date.now() + autoPauseMs);
  }, [match, side, fund, playerId, teamA, teamB, mode, autoPauseMs, resetStep, videoTMsNow, showGhost]);


  // Atajos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (match) { useVolley.getState().undoLastEvent(match.id); showGhost("Deshecho"); }
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); resetStep(); setSide(null); return; }
      const fk = FUND_KEY[e.key.toLowerCase()];
      if (fk) { e.preventDefault(); setFund(fk); return; }
      const rk = RESULT_KEY[e.key];
      if (rk && side && fund) { e.preventDefault(); commit(rk); return; }
      if (e.key === "y") { e.preventDefault(); setSide("A"); return; }
      if (e.key === "x") { e.preventDefault(); setSide("B"); return; }
      if (/^[1-9]$/.test(e.key) && side) {
        e.preventDefault();
        const n = Number(e.key);
        const team = side === "A" ? teamA : teamB;
        const onCourt = side === "A" ? match?.onCourtA : match?.onCourtB;
        const found = (team?.players ?? []).filter((p) => onCourt?.includes(p.id)).find((p) => p.number === n);
        if (found) setPlayerId(found.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [side, fund, match, teamA, teamB, commit, resetStep, showGhost]);

  const marks = useMemo(() => {
    if (!match) return [] as VideoMark[];
    return buildVideoMarks(match, teamA, teamB, 0);
  }, [match, teamA, teamB]);

  if (!match) {
    return (
      <AppShell>
        <div className="text-center py-20 text-muted-foreground">
          Partido no encontrado. <Link to="/video" className="text-primary underline">Volver</Link>
        </div>
      </AppShell>
    );
  }

  const currentTeam = side === "A" ? teamA : side === "B" ? teamB : null;
  const currentPlayer = currentTeam?.players.find((p) => p.id === playerId) ?? null;
  const onCourt = side === "A" ? match.onCourtA : side === "B" ? match.onCourtB : [];
  const scoreA = match.sets[match.currentSet - 1]?.scoreA ?? 0;
  const scoreB = match.sets[match.currentSet - 1]?.scoreB ?? 0;

  const showOverlay = mode === "completo" && overlayUntil > Date.now();

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/video/$matchId" params={{ matchId }} className="p-2 rounded-md hover:bg-secondary/50"><ArrowLeft className="size-4" /></Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate flex items-center gap-2">
                <Radio className="size-5 text-red-500" />
                Scouting en Vivo — {teamA?.name ?? "A"} vs {teamB?.name ?? "B"}
              </h1>
              <div className="text-xs text-muted-foreground">Set {match.currentSet} · {scoreA}-{scoreB} · {match.events.length} eventos {recording && `· grabando ${(elapsedMs/1000).toFixed(0)}s`}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setReviewOpen(true)}
              disabled={!recorder || bufferedMs < 1000}
              title={recorder ? "Revisar la jugada anterior sin detener la captura" : "Iniciá REC para habilitar la revisión"}
              className="border-primary/60 text-primary hover:bg-primary/10"
            >
              <Film className="size-4 mr-1" /> Analizar grabación
              {bufferedMs > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                  {(bufferedMs / 1000).toFixed(0)}s
                </span>
              )}
            </Button>
            <Button size="sm" variant={mode === "rapido" ? "default" : "outline"} onClick={() => setMode("rapido")} title="Nunca pausa">
              <Zap className="size-4 mr-1" /> Rápido
            </Button>
            <Button size="sm" variant={mode === "completo" ? "default" : "outline"} onClick={() => setMode("completo")} title={`Overlay ${autoPauseMs/1000}s tras cada acción`}>
              <PauseCircle className="size-4 mr-1" /> Completo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { useVolley.getState().undoLastEvent(match.id); showGhost("Deshecho"); }}>
              <Undo2 className="size-4 mr-1" /> Deshacer
            </Button>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
          {/* LEFT */}
          <aside className="flex flex-col gap-3 min-w-0">
            <div className="bg-card/40 border border-border rounded-lg p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Marcador</div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground truncate">{teamA?.name ?? "A"}</div>
                  <div className="text-3xl font-black scoreboard-digit">{scoreA}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground truncate">{teamB?.name ?? "B"}</div>
                  <div className="text-3xl font-black scoreboard-digit">{scoreB}</div>
                </div>
              </div>
            </div>
            <TeamOnCourt team={teamA} label="A" side="A" currentSide={side} onPickSide={() => setSide("A")} onCourtIds={match.onCourtA} onPickPlayer={setPlayerId} selectedId={playerId} />
            <TeamOnCourt team={teamB} label="B" side="B" currentSide={side} onPickSide={() => setSide("B")} onCourtIds={match.onCourtB} onPickPlayer={setPlayerId} selectedId={playerId} />
            <div className="bg-card/40 border border-border rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed">
              <div className="font-semibold text-foreground mb-1">Atajos</div>
              <div>Y / X: equipo · 1-9: jugadora</div>
              <div>S saque · R recep · A armado · F ataque · B bloq · D def</div>
              <div>! + 0 - = : resultado · Ctrl+Z deshacer · Esc cancelar</div>
            </div>
          </aside>

          {/* CENTER */}
          <div className="flex flex-col gap-3 min-w-0 relative">
            <LiveCameraPanel
              matchId={matchId}
              onStarted={(t) => { recordingStartedRef.current = t; setRecording(true); }}
              onStopped={() => { recordingStartedRef.current = null; setRecording(false); setElapsedMs(0); }}
              onTick={setElapsedMs}
            />
            {showOverlay && (
              <div className="absolute inset-0 top-0 h-[56%] bg-black/30 backdrop-blur-[1px] pointer-events-none flex items-center justify-center rounded-lg">
                <div className="px-4 py-2 rounded-full bg-black/70 text-white text-xs font-bold">Acción registrada · continúa en {Math.max(0, Math.ceil((overlayUntil - Date.now())/1000))}s</div>
              </div>
            )}
            <ScoutTimeline marks={marks} elapsedMs={elapsedMs} />
            <ActionsTable marks={marks} />
          </div>

          {/* RIGHT */}
          <aside className="flex flex-col gap-3 min-w-0">
            <StepBreadcrumb side={side} team={currentTeam?.name ?? null} player={currentPlayer ? `#${currentPlayer.number} ${currentPlayer.name}` : null} fund={fund ? FUND_LABEL[fund] : null} />
            {!recording && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                Presiona <b>REC</b> arriba para iniciar la grabación. Cada acción se anclará al segundo exacto del video.
              </div>
            )}
            {!side && (
              <div className="grid grid-cols-1 gap-2">
                <BigButton onClick={() => setSide("A")} color="oklch(0.72 0.19 38)">Equipo A · {teamA?.name}</BigButton>
                <BigButton onClick={() => setSide("B")} color="oklch(0.78 0.16 195)">Equipo B · {teamB?.name}</BigButton>
              </div>
            )}
            {side && !playerId && currentTeam && (
              <div>
                <SubTitle>Jugadora en cancha</SubTitle>
                <div className="grid grid-cols-3 gap-2">
                  {currentTeam.players.filter((p) => onCourt.includes(p.id)).map((p) => (
                    <button key={p.id} onClick={() => setPlayerId(p.id)} className="rounded-lg border border-border bg-card/60 py-3 text-center hover:border-primary/60">
                      <div className="text-2xl font-black scoreboard-digit">{p.number ?? "?"}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.name}</div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setSide(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">← cambiar equipo</button>
              </div>
            )}
            {side && playerId && !fund && (
              <div>
                <SubTitle>Fundamento</SubTitle>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(FUND_LABEL) as ScoutFundamento[]).map((f) => (
                    <button key={f} onClick={() => setFund(f)} className="rounded-lg border py-3 text-sm font-semibold hover:border-primary/60"
                      style={{ background: FUND_COLOR[f] + "22", borderColor: FUND_COLOR[f] + "66" }}>
                      {FUND_LABEL[f]}
                    </button>
                  ))}
                </div>
                <button onClick={() => setPlayerId(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">← cambiar jugadora</button>
              </div>
            )}
            {side && playerId && fund && (
              <div>
                <SubTitle>Resultado</SubTitle>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(RESULT_LABEL) as ScoutResultado[]).map((r) => (
                    <button key={r} onClick={() => commit(r)} className="rounded-lg border py-4 text-base font-bold hover:brightness-110"
                      style={{ background: RESULT_COLOR[r] + "33", borderColor: RESULT_COLOR[r] }}>
                      {RESULT_LABEL[r]}
                    </button>
                  ))}
                </div>
                <button onClick={() => setFund(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">← cambiar fundamento</button>
              </div>
            )}
          </aside>
        </div>

        {ghost && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-card border border-primary shadow-glow text-sm font-semibold pointer-events-none animate-in fade-in slide-in-from-bottom-2">
            {ghost}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{children}</div>;
}
function BigButton({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="rounded-lg border py-4 px-3 text-base font-bold hover:brightness-110 text-left"
      style={{ background: color + "22", borderColor: color + "88" }}>
      {children}
    </button>
  );
}
function StepBreadcrumb({ side, team, player, fund }: { side: Side | null; team: string | null; player: string | null; fund: string | null }) {
  const items = [side ? `Equipo ${side}${team ? ` · ${team}` : ""}` : "Equipo", player ?? "Jugadora", fund ?? "Fundamento", "Resultado"];
  const activeIdx = [side, player, fund].filter(Boolean).length;
  return (
    <div className="bg-card/40 border border-border rounded-lg p-2 flex items-center gap-1 text-[11px] flex-wrap">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className={i === activeIdx ? "text-primary font-bold" : i < activeIdx ? "text-foreground" : "text-muted-foreground"}>{it}</span>
          {i < items.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}
function TeamOnCourt({ team, label, side, currentSide, onPickSide, onCourtIds, onPickPlayer, selectedId }: {
  team: { players: { id: string; number?: number | null; name: string }[]; name: string } | undefined;
  label: string; side: Side; currentSide: Side | null; onPickSide: () => void;
  onCourtIds: string[]; onPickPlayer: (id: string) => void; selectedId: string | null;
}) {
  const active = currentSide === side;
  return (
    <div className={`bg-card/40 border rounded-lg p-2 ${active ? "border-primary" : "border-border"}`}>
      <button onClick={onPickSide} className="w-full flex items-center justify-between mb-1 text-xs">
        <span className="font-semibold truncate">{team?.name ?? label}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </button>
      <div className="grid grid-cols-3 gap-1">
        {(team?.players ?? []).filter((p) => onCourtIds.includes(p.id)).map((p) => {
          const sel = selectedId === p.id;
          return (
            <button key={p.id} onClick={() => { if (!active) onPickSide(); onPickPlayer(p.id); }}
              className={`rounded border py-1 text-center text-xs ${sel ? "border-primary bg-primary/20" : "border-border bg-background/40"}`}
              title={p.name}>
              <div className="font-black scoreboard-digit">{p.number ?? "?"}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function ScoutTimeline({ marks, elapsedMs }: { marks: VideoMark[]; elapsedMs: number }) {
  const maxMs = Math.max(elapsedMs + 5000, ...marks.map((m) => m.tMs), 60_000);
  return (
    <div className="bg-card/40 border border-border rounded-lg p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex justify-between">
        <span>Línea de tiempo (grabación)</span>
        <span className="tabular-nums">{(elapsedMs/1000).toFixed(1)}s</span>
      </div>
      <div className="relative h-8 bg-background/60 rounded overflow-hidden">
        {marks.map((m) => {
          const left = (m.tMs / maxMs) * 100;
          return <div key={m.id} title={`${m.fundamento} · ${(m.tMs/1000).toFixed(1)}s`} className="absolute top-0 bottom-0 w-1" style={{ left: `${left}%`, background: "oklch(0.7 0.2 25)" }} />;
        })}
        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: `${Math.min(100, (elapsedMs/maxMs)*100)}%` }} />
      </div>
    </div>
  );
}
function ActionsTable({ marks }: { marks: VideoMark[] }) {
  const recent = marks.slice(-40).reverse();
  return (
    <div className="bg-card/40 border border-border rounded-lg flex flex-col max-h-[300px]">
      <div className="px-3 py-2 border-b border-border/60 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
        <span>Acciones registradas</span>
        <span className="text-foreground tabular-nums">{marks.length}</span>
      </div>
      <div className="overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/95 backdrop-blur">
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">t</th><th className="px-2 py-1">Set</th><th className="px-2 py-1">Jugadora</th><th className="px-2 py-1">Fund.</th><th className="px-2 py-1">Result.</th><th className="px-2 py-1">Marc.</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((m) => (
              <tr key={m.id} className="border-t border-border/40">
                <td className="px-2 py-1 tabular-nums text-muted-foreground">{(m.tMs/1000).toFixed(1)}s</td>
                <td className="px-2 py-1 tabular-nums">{m.setNumber}</td>
                <td className="px-2 py-1 truncate max-w-[120px]">{m.playerNumber != null ? `#${m.playerNumber} ` : ""}{m.playerName ?? "—"}</td>
                <td className="px-2 py-1">{m.fundamento}</td>
                <td className="px-2 py-1">{m.result ?? "—"}</td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">{m.score}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground text-xs">Sin acciones aún. Registra la primera con los botones de la derecha.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
