import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useVolley, POINT_TYPE_LABEL, type PointType, type ReceptionRating, type DefenseRating } from "@/lib/volley-store";
import { useMatchVideo, getSignedVideoUrl } from "@/hooks/use-match-video";
import { buildVideoMarks, type VideoMark } from "@/lib/video-marks";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/video/VideoPlayer";
import { VideoSourceSwitcher, type VideoSourceKind } from "@/components/video/VideoSourceSwitcher";
import { AnalysisPanel } from "@/components/video/analysis/AnalysisPanel";
import { useAnalysisStore } from "@/lib/video/analysis-store";

import { Button } from "@/components/ui/button";

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
import { ArrowLeft, Zap, PauseCircle, Undo2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/video/$matchId/scout")({
  head: () => ({
    meta: [
      { title: "Scouting en vivo — RALLY" },
      { name: "description", content: "Registro rápido de acciones sincronizado al video, estilo Data Volley." },
    ],
  }),
  component: ScoutRoute,
});

type Side = "A" | "B";

// Mapea (fundamento, resultado) a un evento del volley-store.
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

function ScoutRoute() {
  const { matchId } = Route.useParams();
  const match = useVolley((s) => s.matches.find((m) => m.id === matchId));
  const teams = useVolley((s) => s.teams);
  const store = useVolley.getState.bind(useVolley);
  const { video } = useMatchVideo(matchId);
  const playerRef = useRef<VideoPlayerHandle | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [sourceKind, setSourceKind] = useState<VideoSourceKind>("linked");
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null);
  const [overrideStream, setOverrideStream] = useState<MediaStream | null>(null);
  const selectedMarkId = useAnalysisStore((s) => s.selectedMarkId);
  const selectMark = useAnalysisStore((s) => s.selectMark);
  const shortcuts = useAnalysisStore((s) => s.shortcuts);
  const autoPauseAtEnd = useAnalysisStore((s) => s.autoPauseAtEnd);
  const prerollMs = useAnalysisStore((s) => s.prerollMs);
  const postrollMs = useAnalysisStore((s) => s.postrollMs);



  const teamA = teams.find((t) => t.id === match?.teamAId);
  const teamB = teams.find((t) => t.id === match?.teamBId);

  const mode = useScoutStore((s) => s.mode);
  const autoPauseMs = useScoutStore((s) => s.autoPauseMs);
  const setMode = useScoutStore((s) => s.setMode);

  // Selection state — 4 pasos
  const [side, setSide] = useState<Side | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [fund, setFund] = useState<ScoutFundamento | null>(null);
  const [ghost, setGhost] = useState<string | null>(null);

  // Resolve video source
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!video) { setVideoSrc(null); return; }
      if (video.source === "url" && video.external_url) {
        setVideoSrc(video.external_url);
        return;
      }
      if (video.source === "upload" && video.storage_path) {
        const url = await getSignedVideoUrl(video.storage_path, 60 * 60 * 4);
        if (!cancelled) setVideoSrc(url);
      }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [video?.id, video?.source, video?.external_url, video?.storage_path]);

  const isYouTube = useMemo(() => !!videoSrc && /youtube\.com|youtu\.be/.test(videoSrc), [videoSrc]);
  const displaySrc = useMemo(() => {
    if (!videoSrc) return "";
    if (!isYouTube) return videoSrc;
    const m = videoSrc.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
    return m ? `https://www.youtube.com/embed/${m[1]}?enablejsapi=1&modestbranding=1&rel=0` : videoSrc;
  }, [videoSrc, isYouTube]);

  const marks = useMemo(() => {
    if (!match) return [] as VideoMark[];
    return buildVideoMarks(match, teamA, teamB, video?.sync_offset_ms ?? 0);
  }, [match, teamA, teamB, video?.sync_offset_ms]);

  const showGhost = (text: string) => {
    setGhost(text);
    window.clearTimeout((showGhost as unknown as { t?: number }).t);
    const t = window.setTimeout(() => setGhost(null), 900);
    (showGhost as unknown as { t?: number }).t = t;
  };

  const resetStep = useCallback(() => {
    setPlayerId(null);
    setFund(null);
  }, []);

  const commit = useCallback((result: ScoutResultado) => {
    if (!match || !side || !fund) return;
    const v = useVolley.getState();
    // Cada handler del volley-store persiste automáticamente a Supabase vía cloud-sync.
    switch (fund) {
      case "saque": {
        const pt = pointTypeForServe(result);
        if (pt) v.recordPoint(match.id, side, pt, playerId);
        else showGhost(`Saque ${RESULT_LABEL[result]} sin punto — se ignora`);
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
        // Sin evento nativo: se registra como intento de ataque neutro para conservar el timestamp.
        if (playerId) v.recordAttackAttempt(match.id, side, playerId, {});
        break;
      case "error":
        v.recordPoint(match.id, side, "unforced_error", playerId);
        break;
      case "punto":
        v.recordPoint(match.id, side, "opponent_error", playerId);
        break;
    }
    const team = side === "A" ? teamA : teamB;
    const p = team?.players.find((pp) => pp.id === playerId);
    showGhost(`${FUND_LABEL[fund]} · ${RESULT_LABEL[result]} · ${p ? `#${p.number} ${p.name}` : team?.name ?? side}`);
    resetStep();
    if (mode === "completo" && playerRef.current) {
      playerRef.current.pause();
      window.setTimeout(() => playerRef.current?.play(), autoPauseMs);
    }
  }, [match, side, fund, playerId, teamA, teamB, mode, autoPauseMs, resetStep, store]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      // Video controls
      if (e.code === "Space") { e.preventDefault(); const pl = playerRef.current; if (!pl) return; if (currentMs === 0) pl.play(); else pl.pause(); return; }
      if (e.key === "ArrowLeft" && !e.ctrlKey) { e.preventDefault(); playerRef.current?.seekMs(Math.max(0, playerRef.current.getCurrentMs() - 1000)); return; }
      if (e.key === "ArrowRight" && !e.ctrlKey) { e.preventDefault(); playerRef.current?.seekMs(playerRef.current.getCurrentMs() + 1000); return; }
      if (e.key === "ArrowLeft" && e.ctrlKey) { e.preventDefault(); playerRef.current?.seekMs(Math.max(0, playerRef.current.getCurrentMs() - 33)); return; }
      if (e.key === "ArrowRight" && e.ctrlKey) { e.preventDefault(); playerRef.current?.seekMs(playerRef.current.getCurrentMs() + 33); return; }
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (match) { useVolley.getState().undoLastEvent(match.id); showGhost("Última acción deshecha"); }
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); resetStep(); setSide(null); showGhost("Selección cancelada"); return; }
      // Fund shortcut
      const fundKey = FUND_KEY[e.key.toLowerCase()];
      if (fundKey) { e.preventDefault(); setFund(fundKey); return; }
      // Result shortcut
      const resKey = RESULT_KEY[e.key];
      if (resKey && side && fund) { e.preventDefault(); commit(resKey); return; }
      // Team A/B via 'y' 'x'
      if (e.key === "y") { e.preventDefault(); setSide("A"); return; }
      if (e.key === "x") { e.preventDefault(); setSide("B"); return; }
      // Player by number 1..9
      if (/^[1-9]$/.test(e.key) && side) {
        e.preventDefault();
        const n = Number(e.key);
        const team = side === "A" ? teamA : teamB;
        const onCourt = side === "A" ? match?.onCourtA : match?.onCourtB;
        const found = (team?.players ?? [])
          .filter((p) => onCourt?.includes(p.id))
          .find((p) => p.number === n);
        if (found) setPlayerId(found.id);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [side, fund, match, teamA, teamB, currentMs, commit, resetStep]);

  const seekToMark = (m: VideoMark) => playerRef.current?.seekMs(Math.max(0, m.tMs - 500));

  if (!match) {
    return (
      <AppShell>
        <div className="text-center py-20 text-muted-foreground">
          Partido no encontrado. <Link to="/video" className="text-primary underline">Volver a la biblioteca</Link>
        </div>
      </AppShell>
    );
  }

  const currentTeam = side === "A" ? teamA : side === "B" ? teamB : null;
  const currentPlayer = currentTeam?.players.find((p) => p.id === playerId) ?? null;
  const onCourt = side === "A" ? match.onCourtA : side === "B" ? match.onCourtB : [];

  const scoreA = match.sets[match.currentSet - 1]?.scoreA ?? 0;
  const scoreB = match.sets[match.currentSet - 1]?.scoreB ?? 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-3">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/video/$matchId" params={{ matchId }} className="p-2 rounded-md hover:bg-secondary/50"><ArrowLeft className="size-4" /></Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">Scouting en vivo — {teamA?.name ?? "A"} vs {teamB?.name ?? "B"}</h1>
              <div className="text-xs text-muted-foreground">Set {match.currentSet} · {scoreA}-{scoreB} · {match.events.length} eventos</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === "rapido" ? "default" : "outline"}
              onClick={() => setMode("rapido")}
              title="Nunca pausa el video"
            >
              <Zap className="size-4 mr-1" /> Rápido
            </Button>
            <Button
              size="sm"
              variant={mode === "completo" ? "default" : "outline"}
              onClick={() => setMode("completo")}
              title={`Pausa ${autoPauseMs / 1000}s tras cada acción`}
            >
              <PauseCircle className="size-4 mr-1" /> Completo
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { useVolley.getState().undoLastEvent(match.id); showGhost("Última acción deshecha"); }}>
              <Undo2 className="size-4 mr-1" /> Deshacer
            </Button>
          </div>
        </header>

        {(() => {
          const usingOverride = sourceKind !== "linked";
          const effectiveSrc = usingOverride ? (overrideSrc ?? "") : (videoSrc ?? "");
          const effectiveStream = usingOverride ? overrideStream : null;
          const effectiveIsYouTube = !usingOverride && isYouTube;
          const hasSomething = !!effectiveStream || !!effectiveSrc;

          return (
          <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
            {/* LEFT — info */}
            <aside className="flex flex-col gap-3 min-w-0">
              <InfoBlock label="Set" value={String(match.currentSet)} />
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
                <div>Y / X: equipo · 1-9: jugadora en cancha</div>
                <div>S saque · R recep · A armado · F ataque · B bloq · D def</div>
                <div>! + 0 - = : resultado · Ctrl+Z deshacer · Esc cancelar</div>
                <div>Espacio: play/pausa · ←/→ ±1s · Ctrl+←/→ frame</div>
              </div>
            </aside>

            {/* CENTER — video + timeline */}
            <div className="flex flex-col gap-3 min-w-0">
              <VideoSourceSwitcher
                hasLinked={!!videoSrc}
                current={sourceKind}
                onChange={(kind, { src, stream }) => {
                  setSourceKind(kind);
                  setOverrideSrc(src ?? null);
                  setOverrideStream(stream ?? null);
                }}
              />
              {hasSomething ? (
                <VideoPlayer
                  ref={playerRef}
                  src={effectiveSrc}
                  marks={marks}
                  isYouTube={effectiveIsYouTube}
                  stream={effectiveStream}
                  onTimeUpdate={setCurrentMs}
                  onDurationChange={setDurationSec}
                />
              ) : (
                <div className="p-8 bg-card/40 border border-border rounded-lg text-center text-muted-foreground text-sm">
                  Elegí una fuente arriba (archivo, cámara, ventana o pantalla) o <Link to="/video/$matchId" params={{ matchId }} className="text-primary underline">vinculá un video</Link>.
                </div>
              )}
              <AnalysisPanel
                matchId={matchId}
                marks={marks}
                currentMs={currentMs}
                totalMs={durationSec * 1000}
                onSeek={(ms) => playerRef.current?.seekMs(Math.max(0, ms))}
                onSelectMark={(m) => {
                  selectMark(m.id);
                  playerRef.current?.seekMs(Math.max(0, m.inicioClipMs));
                }}
              />
            </div>



            {/* RIGHT — registro rápido */}
            <aside className="flex flex-col gap-3 min-w-0">
              <StepBreadcrumb side={side} team={currentTeam?.name ?? null} player={currentPlayer ? `#${currentPlayer.number} ${currentPlayer.name}` : null} fund={fund ? FUND_LABEL[fund] : null} />
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
                    {currentTeam.players
                      .filter((p) => onCourt.includes(p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPlayerId(p.id)}
                          className="rounded-lg border border-border bg-card/60 py-3 text-center hover:border-primary/60 transition-colors"
                        >
                          <div className="text-2xl font-black scoreboard-digit">{p.number ?? "?"}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{p.name}</div>
                        </button>
                      ))}
                  </div>
                  <button onClick={() => { setSide(null); }} className="mt-2 text-xs text-muted-foreground hover:text-foreground">← cambiar equipo</button>
                </div>
              )}
              {side && playerId && !fund && (
                <div>
                  <SubTitle>Fundamento</SubTitle>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(FUND_LABEL) as ScoutFundamento[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFund(f)}
                        className="rounded-lg border border-border py-3 text-sm font-semibold transition-colors hover:border-primary/60"
                        style={{ background: FUND_COLOR[f] + "22", borderColor: FUND_COLOR[f] + "66" }}
                      >
                        {FUND_LABEL[f]}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setPlayerId(null); }} className="mt-2 text-xs text-muted-foreground hover:text-foreground">← cambiar jugadora</button>
                </div>
              )}
              {side && playerId && fund && (
                <div>
                  <SubTitle>Resultado</SubTitle>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.keys(RESULT_LABEL) as ScoutResultado[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => commit(r)}
                        className="rounded-lg border py-4 text-base font-bold transition-colors hover:brightness-110"
                        style={{ background: RESULT_COLOR[r] + "33", borderColor: RESULT_COLOR[r], color: "var(--color-foreground)" }}
                      >
                        {RESULT_LABEL[r]}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setFund(null); }} className="mt-2 text-xs text-muted-foreground hover:text-foreground">← cambiar fundamento</button>
                </div>
              )}
            </aside>
          </div>
          );
        })()}


        {/* Ghost toast */}
        {ghost && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-card border border-primary shadow-glow text-sm font-semibold pointer-events-none animate-in fade-in slide-in-from-bottom-2">
            {ghost}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/40 border border-border rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-2xl font-black">{value}</div>
    </div>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{children}</div>;
}

function BigButton({ children, onClick, color }: { children: React.ReactNode; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border py-4 px-3 text-base font-bold transition-colors hover:brightness-110 text-left"
      style={{ background: color + "22", borderColor: color + "88" }}
    >
      {children}
    </button>
  );
}

function StepBreadcrumb({ side, team, player, fund }: { side: Side | null; team: string | null; player: string | null; fund: string | null }) {
  const items = [
    side ? `Equipo ${side}${team ? ` · ${team}` : ""}` : "Equipo",
    player ?? "Jugadora",
    fund ?? "Fundamento",
    "Resultado",
  ];
  const activeIdx = [side, player, fund].filter(Boolean).length;
  return (
    <div className="bg-card/40 border border-border rounded-lg p-2 flex items-center gap-1 text-[11px]">
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
  label: string;
  side: Side;
  currentSide: Side | null;
  onPickSide: () => void;
  onCourtIds: string[];
  onPickPlayer: (id: string) => void;
  selectedId: string | null;
}) {
  const active = currentSide === side;
  return (
    <div className={`bg-card/40 border rounded-lg p-2 ${active ? "border-primary" : "border-border"}`}>
      <button onClick={onPickSide} className="w-full flex items-center justify-between mb-1 text-xs">
        <span className="font-semibold truncate">{team?.name ?? label}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </button>
      <div className="grid grid-cols-3 gap-1">
        {(team?.players ?? [])
          .filter((p) => onCourtIds.includes(p.id))
          .map((p) => {
            const sel = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { if (!active) onPickSide(); onPickPlayer(p.id); }}
                className={`rounded border py-1 text-center text-xs ${sel ? "border-primary bg-primary/20" : "border-border bg-background/40"}`}
                title={p.name}
              >
                <div className="font-black scoreboard-digit">{p.number ?? "?"}</div>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function ScoutTimeline({ marks, currentMs, onSeek }: { marks: VideoMark[]; currentMs: number; onSeek: (ms: number) => void }) {
  const maxMs = Math.max(currentMs + 5000, ...marks.map((m) => m.tMs), 60_000);
  return (
    <div className="bg-card/40 border border-border rounded-lg p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 flex justify-between">
        <span>Línea de tiempo</span>
        <span className="tabular-nums">{(currentMs / 1000).toFixed(1)}s</span>
      </div>
      <div className="relative h-8 bg-background/60 rounded overflow-hidden">
        {marks.map((m) => {
          const left = (m.tMs / maxMs) * 100;
          const color = fundColorForKind(m.kind);
          return (
            <button
              key={m.id}
              onClick={() => onSeek(m.tMs)}
              title={`${m.fundamento} · ${m.result ?? ""} · ${m.playerName ?? ""} · ${(m.tMs / 1000).toFixed(1)}s`}
              className="absolute top-0 bottom-0 w-1 hover:w-1.5 transition-all"
              style={{ left: `${left}%`, background: color }}
            />
          );
        })}
        <div className="absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${Math.min(100, (currentMs / maxMs) * 100)}%` }} />
      </div>
    </div>
  );
}

function fundColorForKind(kind: string) {
  switch (kind) {
    case "serve": return FUND_COLOR.saque;
    case "reception": return FUND_COLOR.recepcion;
    case "attack": return FUND_COLOR.ataque;
    case "block": return FUND_COLOR.bloqueo;
    case "defense": return FUND_COLOR.defensa;
    case "error": return FUND_COLOR.error;
    case "point": return FUND_COLOR.punto;
    default: return "oklch(0.6 0.02 250)";
  }
}

function ActionsTable({ marks, currentMs, onSeek }: { marks: VideoMark[]; currentMs: number; onSeek: (m: VideoMark) => void }) {
  const recent = marks.slice(-80).reverse();
  return (
    <div className="bg-card/40 border border-border rounded-lg flex flex-col min-h-[240px] max-h-[420px]">
      <div className="px-3 py-2 border-b border-border/60 text-[10px] uppercase tracking-widest text-muted-foreground flex items-center justify-between">
        <span>Acciones</span>
        <span className="text-foreground tabular-nums">{marks.length}</span>
      </div>
      <div className="overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/95 backdrop-blur">
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1 font-medium">t</th>
              <th className="px-2 py-1 font-medium">Set</th>
              <th className="px-2 py-1 font-medium">Jugadora</th>
              <th className="px-2 py-1 font-medium">Fundamento</th>
              <th className="px-2 py-1 font-medium">Resultado</th>
              <th className="px-2 py-1 font-medium">Marc.</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((m) => {
              const isCurrent = Math.abs(m.tMs - currentMs) < 1500;
              return (
                <tr
                  key={m.id}
                  onClick={() => onSeek(m)}
                  className={`cursor-pointer border-t border-border/40 hover:bg-primary/10 ${isCurrent ? "bg-primary/15" : ""}`}
                >
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{(m.tMs / 1000).toFixed(1)}s</td>
                  <td className="px-2 py-1 tabular-nums">{m.setNumber}</td>
                  <td className="px-2 py-1 truncate max-w-[120px]">{m.playerNumber != null ? `#${m.playerNumber} ` : ""}{m.playerName ?? "—"}</td>
                  <td className="px-2 py-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px]" style={{ background: fundColorForKind(m.kind) + "33", color: fundColorForKind(m.kind) }}>
                      {m.fundamento}
                    </span>
                  </td>
                  <td className="px-2 py-1 truncate max-w-[120px]">{m.result ?? "—"}</td>
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{m.score}</td>
                </tr>
              );
            })}
            {recent.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground text-xs">Sin acciones aún. Selecciona equipo → jugadora → fundamento → resultado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Silence unused imports typing warnings
void POINT_TYPE_LABEL;
void toast;
