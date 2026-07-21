import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/TeamBadge";
import {
  computeMatchStats, computeSetStats, computeReceptionStats, setsWon, useVolley, getSetDuration, formatDurationMs, formatLocalTime,
  getMatchStatsMode,
  type PlayerStat, type ReceptionStat, type Team, type MatchEvent,
} from "@/lib/volley-store";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Crown, Download, ExternalLink, Shield, Target, Trophy, Zap, Sparkles } from "lucide-react";
import { downloadMatchPdf, openPdfDataUrlInNewTab } from "@/lib/match-pdf";
import { ReclassifyEventsPanel } from "@/components/ReclassifyEventsPanel";
import { RotationStatsPanel } from "@/components/RotationStatsPanel";
import { AttackZonesPanel } from "@/components/AttackZonesPanel";
import { AttackHeatmap } from "@/components/AttackHeatmap";
import { ServeHeatmapPanel } from "@/components/serve/ServeHeatmapPanel";
import { AttackTypesPanel } from "@/components/AttackTypesPanel";
import { ShareMatchCard } from "@/components/ShareMatchCard";
import { SettingPanel } from "@/components/SettingPanel";
import { useCoachAccess } from "@/hooks/use-coach-access";
import { CoachLiveDashboard } from "@/components/live/CoachLiveDashboard";
import { toast } from "sonner";

type EnrichedPlayer = PlayerStat & { teamId: string; teamName: string; teamColor: string };

const MVP_WEIGHTS = { attack: 1, block: 1.2, ace: 1.5, unforcedError: -0.5 };
const mvpScore = (p: PlayerStat) =>
  p.attack * MVP_WEIGHTS.attack +
  p.block * MVP_WEIGHTS.block +
  p.ace * MVP_WEIGHTS.ace +
  p.unforcedError * MVP_WEIGHTS.unforcedError;

export const Route = createFileRoute("/_authenticated/matches/$id/stats")({
  head: () => ({ meta: [{ title: "Estadísticas · RALLY" }] }),
  component: StatsPage,
});

function StatsPage() {
  const { id } = Route.useParams();
  const match = useVolley((s) => s.matches.find((m) => m.id === id));
  const teams = useVolley((s) => s.teams);
  const leagues = useVolley((s) => s.leagues);
  const statsMode = useMemo(() => getMatchStatsMode(match, teams, leagues), [match, teams, leagues]);
  const { hasAccess: coachOverride } = useCoachAccess();
  const isCoach = statsMode === "entrenador" || coachOverride;

  const teamA = useMemo(() => teams.find((t) => t.id === match?.teamAId), [teams, match]);
  const teamB = useMemo(() => teams.find((t) => t.id === match?.teamBId), [teams, match]);
  const stats = useMemo(() => match ? computeMatchStats(match) : null, [match]);

  if (!match || !teamA || !teamB || !stats) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Partido no encontrado.</p>
          <Button asChild className="mt-4"><Link to="/matches">Volver</Link></Button>
        </div>
      </AppShell>
    );
  }

  // attach player meta
  const enrichPlayers = (teamId: string): PlayerStat[] => {
    const team = teamId === teamA.id ? teamA : teamB;
    return [...stats.players.values()]
      .filter((p) => team.players.some((tp) => tp.id === p.playerId))
      .map((p) => {
        const tp = team.players.find((x) => x.id === p.playerId)!;
        return { ...p, name: tp.name, number: tp.number };
      })
      .sort((a, b) => b.total - a.total);
  };
  const playersA = enrichPlayers(teamA.id);
  const playersB = enrichPlayers(teamB.id);
  const teamStatA = stats.teams.get(teamA.id) ?? null;
  const teamStatB = stats.teams.get(teamB.id) ?? null;
  const w = setsWon(match);

  const currentSetNumber = match.currentSet;
  const orderedSets = useMemo(() => {
    const current = match.sets.find((s) => s.number === currentSetNumber);
    const others = match.sets.filter((s) => s.number !== currentSetNumber).sort((a, b) => a.number - b.number);
    return current ? [current, ...others] : match.sets;
  }, [match.sets, currentSetNumber]);


  const allPlayers: EnrichedPlayer[] = [
    ...playersA.map((p) => ({ ...p, teamId: teamA.id, teamName: teamA.name, teamColor: teamA.color })),
    ...playersB.map((p) => ({ ...p, teamId: teamB.id, teamName: teamB.name, teamColor: teamB.color })),
  ];
  const mvpRanking = [...allPlayers].sort((a, b) => mvpScore(b) - mvpScore(a));
  const mvp = mvpRanking[0];
  const topScorers = [...allPlayers].filter((p) => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
  const topBlockers = [...allPlayers].filter((p) => p.block > 0).sort((a, b) => b.block - a.block).slice(0, 5);
  const topServers = [...allPlayers].filter((p) => p.ace > 0).sort((a, b) => b.ace - a.ace).slice(0, 5);

  type PdfStatus =
    | { kind: "idle" }
    | { kind: "generating" }
    | { kind: "awaiting"; method: "share" | "download" | "opened"; fileName: string; sizeKb: number; url?: string }
    | { kind: "confirmed"; method: "share" | "download" | "opened"; fileName: string }
    | { kind: "failed"; reason: string };
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>({ kind: "idle" });
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (/Mac/.test(userAgent) && "ontouchend" in (globalThis as object));

  const handleDownloadPdf = async () => {
    setPdfStatus({ kind: "generating" });
    const loadingId = toast.loading("Generando PDF…");
    const targetWindow = window.open("", "_blank");
    try {
      const result = await downloadMatchPdf(match, teamA, teamB, { targetWindow });
      toast.dismiss(loadingId);
      if (result.method === "cancelled") {
        setPdfStatus({ kind: "idle" });
        toast("Se canceló la descarga del PDF");
        return;
      }
      setPdfStatus({ kind: "awaiting", method: result.method, fileName: result.fileName, sizeKb: result.sizeKb, url: result.url });
      toast.success(
        result.method === "share"
          ? "PDF compartido. Confirmá si lo guardaste."
          : result.method === "opened"
          ? "PDF abierto en una pestaña nueva."
          : "PDF enviado a tu carpeta de descargas.",
        { description: `${result.fileName} · ${result.sizeKb} KB` },
      );
    } catch (e) {
      toast.dismiss(loadingId);
      console.error(e);
      const reason = e instanceof Error ? e.message : "Error desconocido";
      setPdfStatus({ kind: "failed", reason });
      toast.error("No se pudo generar el PDF", { description: reason });
    }
  };

  const confirmPdfOk = () => {
    if (pdfStatus.kind !== "awaiting") return;
    setPdfStatus({ kind: "confirmed", method: pdfStatus.method, fileName: pdfStatus.fileName });
    toast.success("¡Listo! Validaste que el PDF se descargó correctamente.");
  };
  const confirmPdfFail = () => {
    if (pdfStatus.kind !== "awaiting") return;
    const isAndroid = /Android/.test(userAgent);
    const tip = isIOS
      ? "En iOS: tocá 'Abrir en pestaña', esperá que se vea el archivo y luego usá Safari para guardarlo en Archivos."
      : isAndroid
      ? "En Android: revisá la carpeta Descargas o probá con Chrome."
      : "Probá con otro navegador (Chrome/Safari) o revisá los permisos de descarga.";
    setPdfStatus({ kind: "failed", reason: tip });
    toast.error("Reportaste que el PDF no se descargó", { description: tip, duration: 8000 });
  };

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/matches/$id" params={{ id: match.id }}><ArrowLeft className="size-4" /> Volver al partido</Link>
        </Button>
        <Button size="sm" onClick={handleDownloadPdf} disabled={pdfStatus.kind === "generating"}>
          <Download className="size-4" /> {pdfStatus.kind === "generating" ? "Generando…" : "Descargar PDF"}
        </Button>
      </div>

      {pdfStatus.kind === "awaiting" && (
        <div className="mb-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm">
          <p className="font-semibold mb-1">¿Se descargó/guardó el PDF correctamente?</p>
          <p className="text-muted-foreground text-xs mb-3">
            {pdfStatus.method === "opened"
              ? "Se abrió una pestaña nueva con el PDF. Desde ahí podés tocar Abrir o Descargar."
              : pdfStatus.method === "share"
              ? "Usamos el diálogo nativo para compartir. Confirmá si pudiste guardarlo."
              : isIOS
              ? "Si no se descargó automático, abrí el PDF en una pestaña nueva y guardalo desde Safari."
              : "El archivo se envió a tu carpeta de descargas. Verificá que esté ahí."}
            {" · "}
            <span className="tabular-nums">{pdfStatus.fileName} ({pdfStatus.sizeKb} KB)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {pdfStatus.url && (
              <Button size="sm" variant="secondary" onClick={() => openPdfDataUrlInNewTab(pdfStatus.url!, pdfStatus.fileName, pdfStatus.sizeKb)}>
                <ExternalLink className="size-4" /> Abrir en pestaña
              </Button>
            )}
            <Button size="sm" onClick={confirmPdfOk}>Sí, lo tengo</Button>
            <Button size="sm" variant="outline" onClick={confirmPdfFail}>No se descargó</Button>
          </div>
        </div>
      )}
      {pdfStatus.kind === "confirmed" && (
        <div className="mb-4 rounded-2xl border border-success/40 bg-success/10 p-3 text-sm text-success-foreground">
          ✅ PDF validado: <span className="font-semibold">{pdfStatus.fileName}</span> ({pdfStatus.method === "share" ? "compartido" : pdfStatus.method === "opened" ? "abierto" : "descargado"}).
        </div>
      )}
      {pdfStatus.kind === "failed" && (
        <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          ⚠️ <span className="font-semibold">Problema con el PDF.</span> {pdfStatus.reason}
        </div>
      )}


      {/* Cockpit táctico en vivo para el entrenador */}
      <div className="mb-6">
        <CoachLiveDashboard match={match} teamA={teamA} teamB={teamB} coachSide="A" />
      </div>

      <details className="mb-6 rounded-2xl border border-border/60 bg-card">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center justify-between">
          <span>Estadísticas detalladas y descarga</span>
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">Ver todo</span>
        </summary>
        <div className="p-4">
      <ShareMatchCard match={match} />

      {/* Final */}
      <section className="rounded-3xl bg-gradient-surface border border-border/60 p-6 sm:p-8 shadow-elevated mb-6">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center mb-3">
          {match.status === "finished" ? "Resultado final" : "En progreso"}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 sm:gap-8 items-center">
          <div className="flex items-center gap-4">
            <TeamBadge team={teamA} size="lg" />
            <div>
              <div className="font-bold">{teamA.name}</div>
              <div className="scoreboard-digit text-6xl font-black mt-1 leading-none">
                <span className={w.a > w.b ? "text-primary" : "text-muted-foreground"}>{w.a}</span>
              </div>
            </div>
          </div>
          <div className="text-2xl text-muted-foreground font-bold">–</div>
          <div className="flex items-center gap-4 flex-row-reverse text-right">
            <TeamBadge team={teamB} size="lg" />
            <div>
              <div className="font-bold">{teamB.name}</div>
              <div className="scoreboard-digit text-6xl font-black mt-1 leading-none">
                <span className={w.b > w.a ? "text-primary" : "text-muted-foreground"}>{w.b}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {match.sets.map((s) => {
            const dur = getSetDuration(match, s.number);
            return (
              <span key={s.number} className="px-3 py-1.5 rounded-md bg-background/40 border border-border/60 text-xs scoreboard-digit font-bold tabular-nums">
                Set {s.number}: {s.scoreA}–{s.scoreB}
                {dur !== null && <span className="ml-1.5 text-muted-foreground">· {formatDurationMs(dur)}</span>}
              </span>
            );
          })}
        </div>
        {(() => {
          const start = match.setStartTimes?.[1];
          if (!start) return null;
          const totalMs = match.sets.reduce((acc, s) => acc + (getSetDuration(match, s.number) ?? 0), 0);
          return (
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
              <span>Inicio: <span className="text-foreground scoreboard-digit tabular-nums">{formatLocalTime(start)}</span></span>
              {totalMs > 0 && (
                <span>Duración total: <span className="text-foreground scoreboard-digit tabular-nums">{formatDurationMs(totalMs)}</span></span>
              )}
            </div>
          );
        })()}

      </section>

      {/* MVP */}
      {mvp && (
        <section className="rounded-2xl bg-gradient-primary p-[1px] mb-6 shadow-glow">
          <div className="rounded-[calc(theme(borderRadius.2xl)-1px)] bg-card p-5 flex items-center gap-4">
            <div className="size-14 rounded-full bg-gradient-primary flex items-center justify-center">
              <Crown className="size-7 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-primary font-bold flex items-center gap-1">
                <Sparkles className="size-3" /> MVP del partido
              </div>
              <div className="text-xl font-extrabold mt-0.5 truncate">#{mvp.number} {mvp.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {mvp.teamName} · {mvp.attack} ATK · {mvp.block} BLK · {mvp.ace} ACE · {mvp.unforcedError} errores
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                Fórmula: ATK×1 + BLK×1.2 + ACE×1.5 − Errores×0.5
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Índice MVP</div>
              <div className="scoreboard-digit text-5xl font-black text-primary tabular-nums">{mvpScore(mvp).toFixed(1)}</div>
              <div className="text-[10px] text-muted-foreground">{mvp.total} pts totales</div>
            </div>
          </div>
        </section>
      )}

      {/* Rankings */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <RankingCard title="Máximos anotadores" icon={Zap} rows={topScorers} valueKey="total" />
        <RankingCard title="Mejores bloqueadores" icon={Shield} rows={topBlockers} valueKey="block" />
        <RankingCard title="Mejores sacadores" icon={Target} rows={topServers} valueKey="ace" />
      </div>

      {/* Team totals */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <TeamSummary team={teamA} stat={teamStatA} />
        <TeamSummary team={teamB} stat={teamStatB} />
      </div>

      <div className="mb-6 flex justify-end">
        <ReclassifyEventsPanel match={match} teamA={teamA} teamB={teamB} />
      </div>

      {/* Set breakdown — current set first */}
      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-3">Desglose por set</h2>
        <Tabs defaultValue={`set-${currentSetNumber}`}>
          <TabsList className="mb-4 flex-wrap h-auto">
            {orderedSets.map((s) => {
              const dur = getSetDuration(match, s.number);
              return (
                <TabsTrigger key={s.number} value={`set-${s.number}`}>
                  Set {s.number}
                  <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">({s.scoreA}-{s.scoreB}{dur !== null ? ` · ${formatDurationMs(dur)}` : ""})</span>
                </TabsTrigger>
              );
            })}

          </TabsList>
          {orderedSets.map((s) => {
            const setStats = computeSetStats(match, s.number);
            const setPlayersA = enrichTeamPlayers(teamA, setStats.players);
            const setPlayersB = enrichTeamPlayers(teamB, setStats.players);
            const setTeamA = setStats.teams.get(teamA.id) ?? null;
            const setTeamB = setStats.teams.get(teamB.id) ?? null;
            const setEvents: MatchEvent[] = match.events.filter((e) => "setNumber" in e && e.setNumber === s.number);
            const setRecA = computeReceptionStats(setEvents, "A");
            const setRecB = computeReceptionStats(setEvents, "B");
            return (
              <TabsContent key={s.number} value={`set-${s.number}`}>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <TeamSummary team={teamA} stat={setTeamA} />
                  <TeamSummary team={teamB} stat={setTeamB} />
                </div>
                <div className="grid lg:grid-cols-2 gap-6">
                  <PlayerStatsTable team={teamA} rows={setPlayersA} />
                  <PlayerStatsTable team={teamB} rows={setPlayersB} />
                </div>
                {isCoach && (
                  <div className="grid lg:grid-cols-2 gap-6 mt-6">
                    <ReceptionTable team={teamA} recMap={setRecA} />
                    <ReceptionTable team={teamB} recMap={setRecB} />
                  </div>
                )}
                {isCoach && (
                  <div className="mt-6">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Rotaciones</h3>
                    <RotationStatsPanel match={match} teamA={teamA} teamB={teamB} setNumber={s.number} />
                  </div>
                )}
                {isCoach && (
                  <div className="mt-6">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Zonas de ataque</h3>
                    <AttackZonesPanel match={match} teamA={teamA} teamB={teamB} setNumber={s.number} />
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </section>

      {/* Mapas de calor: Ataque + Saque (tabs) */}
      {isCoach && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-3">Mapas de calor</h2>
          <Tabs defaultValue="ataque">
            <TabsList className="mb-3">
              <TabsTrigger value="ataque">Ataque</TabsTrigger>
              <TabsTrigger value="saque">Saque</TabsTrigger>
            </TabsList>
            <TabsContent value="ataque">
              <AttackHeatmap match={match} teamA={teamA} teamB={teamB} />
            </TabsContent>
            <TabsContent value="saque">
              <ServeHeatmapPanel match={match} teamA={teamA} teamB={teamB} />
            </TabsContent>
          </Tabs>
        </section>
      )}

      {/* Zonas de ataque (total partido) */}
      {isCoach && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-3">Zonas de ataque · Total</h2>
          <AttackZonesPanel match={match} teamA={teamA} teamB={teamB} />
        </section>
      )}

      {/* Armado · Modo Entrenador */}
      {isCoach && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-3">Armado · Distribución y eficiencia</h2>
          <SettingPanel match={match} teamA={teamA} teamB={teamB} />
        </section>
      )}

      {/* Tipos de ataque · Modo Entrenador */}
      {isCoach && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-3">Tipos de ataque</h2>
          <AttackTypesPanel match={match} teamA={teamA} teamB={teamB} />
        </section>
      )}

      {/* Player tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        <PlayerStatsTable team={teamA} rows={playersA} />
        <PlayerStatsTable team={teamB} rows={playersB} />
      </div>

      {/* Reception */}
      {isCoach && (
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <ReceptionTable team={teamA} recMap={computeReceptionStats(match.events, "A")} />
          <ReceptionTable team={teamB} recMap={computeReceptionStats(match.events, "B")} />
        </div>
      )}
        </div>
      </details>

    </AppShell>
  );
}

function enrichTeamPlayers(team: Team, playerMap: Map<string, PlayerStat>): PlayerStat[] {
  return [...playerMap.values()]
    .filter((p) => team.players.some((tp) => tp.id === p.playerId))
    .map((p) => {
      const tp = team.players.find((x) => x.id === p.playerId)!;
      return { ...p, name: tp.name, number: tp.number };
    })
    .sort((a, b) => b.total - a.total);
}

function RankingCard({
  title, icon: Icon, rows, valueKey,
}: {
  title: string;
  icon: typeof Trophy;
  rows: EnrichedPlayer[];
  valueKey: "total" | "block" | "ace";
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-4 py-3 flex items-center gap-2 border-b border-border/60 bg-secondary/30">
        <Icon className="size-4 text-primary" />
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
      </header>
      <ol className="divide-y divide-border/40">
        {rows.map((p, i) => (
          <li key={p.playerId} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`scoreboard-digit font-black text-sm w-5 text-center ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="size-2 rounded-full shrink-0" style={{ background: p.teamColor }} />
            <span className="size-6 rounded scoreboard-digit font-bold bg-background border border-border/60 flex items-center justify-center text-[11px] shrink-0">{p.number}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{p.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{p.teamName}</div>
            </div>
            <span className="scoreboard-digit font-black text-xl text-primary tabular-nums">{p[valueKey]}</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">Sin registros.</li>
        )}
      </ol>
    </section>
  );
}

function TeamSummary({
  team, stat,
}: {
  team: ReturnType<typeof useVolley.getState>["teams"][number];
  stat: ReturnType<typeof computeMatchStats>["teams"] extends Map<string, infer V> ? V | null : never;
}) {
  const items = [
    { icon: Zap, label: "Puntos", value: stat?.total ?? 0, accent: true },
    { icon: Target, label: "Ataque", value: stat?.attack ?? 0 },
    { icon: Shield, label: "Bloqueo", value: stat?.block ?? 0 },
    { icon: Trophy, label: "Ace", value: stat?.ace ?? 0 },
  ];
  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-5 py-3 flex items-center gap-3 border-b border-border/60" style={{ background: `linear-gradient(90deg, ${team.color}1a, transparent)` }}>
        <TeamBadge team={team} size="sm" />
        <h2 className="font-bold truncate">{team.name}</h2>
      </header>
      <div className="grid grid-cols-4 divide-x divide-border/40">
        {items.map((it) => (
          <div key={it.label} className="p-4 text-center">
            <it.icon className={`size-4 mx-auto mb-1 ${it.accent ? "text-primary" : "text-muted-foreground"}`} />
            <div className={`scoreboard-digit font-black text-2xl ${it.accent ? "text-primary" : ""}`}>{it.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{it.label}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-border/40 flex justify-between text-xs text-muted-foreground">
        <span>Errores rival a favor: <span className="text-foreground font-bold">{stat?.opponentErrors ?? 0}</span></span>
        <span>Errores no forzados: <span className="text-destructive font-bold">{stat?.unforcedErrors ?? 0}</span></span>
      </div>
    </section>
  );
}

function PlayerStatsTable({
  team, rows,
}: {
  team: ReturnType<typeof useVolley.getState>["teams"][number];
  rows: PlayerStat[];
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-5 py-3 flex items-center gap-3 border-b border-border/60">
        <TeamBadge team={team} size="sm" />
        <h2 className="font-bold truncate">{team.name} · jugadores</h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
            <tr>
              <th className="text-left py-2 px-4">Jugador</th>
              <th className="text-center py-2 px-2" title="Ataques kill (puntos)">ATK</th>
              <th className="text-center py-2 px-2 text-muted-foreground" title="Intentos totales de ataque (kills + neutros + errores)">INT</th>
              <th className="text-center py-2 px-2 text-muted-foreground" title="Errores de ataque">ERR ATK</th>
              <th className="text-center py-2 px-2 text-muted-foreground" title="Eficiencia de ataque: kills / intentos totales">EFF ATK%</th>
              <th className="text-center py-2 px-2">BLK</th>
              <th className="text-center py-2 px-2 text-muted-foreground" title="Errores de bloqueo">ERR BLK</th>
              <th className="text-center py-2 px-2 text-muted-foreground" title="Eficiencia de bloqueo: (puntos − errores) / (puntos + errores)">EFF BLK%</th>
              <th className="text-center py-2 px-2">ACE</th>
              <th className="text-center py-2 px-4 text-primary">TOT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const kills = Math.max(0, p.total - p.block - p.ace);
              const intentosTotales = p.attack + p.attackError;
              const effAtk = intentosTotales > 0 ? (kills / intentosTotales) * 100 : 0;
              const intentosBloqueo = p.block + p.blockError;
              const effBlk = intentosBloqueo > 0 ? ((p.block - p.blockError) / intentosBloqueo) * 100 : 0;
              return (
                <tr key={p.playerId} className="border-t border-border/40">
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <span className="size-7 rounded scoreboard-digit font-bold bg-background border border-border/60 flex items-center justify-center text-xs">{p.number}</span>
                      <span className="font-medium truncate">{p.name}</span>
                    </div>
                  </td>
                  <td className="text-center tabular-nums">{kills}</td>
                  <td className="text-center tabular-nums text-muted-foreground">{intentosTotales}</td>
                  <td className="text-center tabular-nums text-muted-foreground">{p.attackError}</td>
                  <td className="text-center tabular-nums text-muted-foreground">{intentosTotales > 0 ? `${effAtk.toFixed(0)}%` : "–"}</td>
                  <td className="text-center tabular-nums">{p.block}</td>
                  <td className="text-center tabular-nums text-muted-foreground">{p.blockError}</td>
                  <td className="text-center tabular-nums text-muted-foreground">{intentosBloqueo > 0 ? `${effBlk.toFixed(0)}%` : "–"}</td>
                  <td className="text-center tabular-nums">{p.ace}</td>
                  <td className="text-center tabular-nums font-bold text-primary px-4">{p.total}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-sm text-muted-foreground">Sin puntos registrados.</td></tr>
            )}

          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceptionTable({
  team, recMap,
}: {
  team: Team;
  recMap: Map<string, ReceptionStat>;
}) {
  const rows = team.players
    .map((tp) => {
      const r = recMap.get(tp.id);
      return {
        playerId: tp.id,
        name: tp.name,
        number: tp.number,
        doublePositive: r?.doublePositive ?? 0,
        positive: r?.positive ?? 0,
        neutral: r?.neutral ?? 0,
        negative: r?.negative ?? 0,
        doubleNegative: r?.doubleNegative ?? 0,
        overpass: r?.overpass ?? 0,
        total: r?.total ?? 0,
        positivity: r?.positivity ?? 0,
        efficiency: r?.efficiency ?? 0,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || b.efficiency - a.efficiency);

  const totals = rows.reduce(
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
  const teamPositivity = totals.total > 0 ? ((totals.dpos + totals.pos) / totals.total) * 100 : 0;
  const teamEff = totals.total > 0 ? ((totals.dpos * 4 + totals.pos * 3 + totals.neu * 2 + totals.neg - totals.over) / (totals.total * 4)) * 100 : 0;
  const effClass = (eff: number) => (eff >= 30 ? "text-success" : eff <= 0 ? "text-destructive" : "text-primary");
  const posClass = (p: number) => (p >= 50 ? "text-success" : p <= 30 ? "text-destructive" : "text-primary");

  return (
    <section className="rounded-2xl bg-card border border-border/60 overflow-hidden">
      <header className="px-5 py-3 flex items-center gap-3 border-b border-border/60">
        <TeamBadge team={team} size="sm" />
        <h2 className="font-bold truncate flex-1">{team.name} · recepción</h2>
        {totals.total > 0 && (
          <span className={`scoreboard-digit font-black text-xl tabular-nums ${effClass(teamEff)}`}>
            {teamEff.toFixed(0)}%
          </span>
        )}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-secondary/30">
              <tr>
              <th className="text-left py-2 px-4">Receptor</th>
              <th className="text-center py-2 px-2 text-success" title="# Doble+">#</th>
              <th className="text-center py-2 px-2 text-success" title="+ Positiva">+</th>
              <th className="text-center py-2 px-2" title="0 Neutra">0</th>
              <th className="text-center py-2 px-2 text-destructive" title="- Negativa">−</th>
              <th className="text-center py-2 px-2 text-destructive" title="= Doble-">=</th>
              <th className="text-center py-2 px-2 text-destructive" title="≠ Punto saque">≠</th>
              <th className="text-center py-2 px-2">Total</th>
              <th className="text-center py-2 px-2 text-primary" title="Efectividad = (# + +) / total × 100">Efect%</th>
              <th className="text-center py-2 px-4 text-primary" title="Eficiencia ponderada: (#×4 + +×3 + 0×2 + −×1 + =×0 + ≠×(-1)) / (total×4) × 100">Efic%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.playerId} className="border-t border-border/40">
                <td className="py-2 px-4">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded scoreboard-digit font-bold bg-background border border-border/60 flex items-center justify-center text-xs">{p.number}</span>
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                </td>
                <td className="text-center tabular-nums text-success font-bold">{p.doublePositive}</td>
                <td className="text-center tabular-nums text-success font-bold">{p.positive}</td>
                <td className="text-center tabular-nums">{p.neutral}</td>
                <td className="text-center tabular-nums text-destructive font-bold">{p.negative}</td>
                <td className="text-center tabular-nums text-destructive font-bold">{p.doubleNegative}</td>
                <td className="text-center tabular-nums text-destructive font-bold">{p.overpass}</td>
                <td className="text-center tabular-nums">{p.total}</td>
                <td className={`text-center tabular-nums font-bold ${posClass(p.positivity)}`}>{p.positivity.toFixed(0)}%</td>
                <td className={`text-center tabular-nums font-bold px-4 ${effClass(p.efficiency)}`}>
                  {p.efficiency.toFixed(0)}%
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-sm text-muted-foreground">Sin recepciones registradas.</td></tr>
            )}
            {rows.length > 0 && (
              <tr className="border-t-2 border-border bg-secondary/30">
                <td className="py-2 px-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Total equipo</td>
                <td className="text-center tabular-nums text-success font-bold">{totals.dpos}</td>
                <td className="text-center tabular-nums text-success font-bold">{totals.pos}</td>
                <td className="text-center tabular-nums">{totals.neu}</td>
                <td className="text-center tabular-nums text-destructive font-bold">{totals.neg}</td>
                <td className="text-center tabular-nums text-destructive font-bold">{totals.dneg}</td>
                <td className="text-center tabular-nums text-destructive font-bold">{totals.over}</td>
                <td className="text-center tabular-nums font-bold">{totals.total}</td>
                <td className={`text-center tabular-nums font-black ${posClass(teamPositivity)}`}>{teamPositivity.toFixed(0)}%</td>
                <td className={`text-center tabular-nums font-black px-4 ${effClass(teamEff)}`}>{teamEff.toFixed(0)}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
