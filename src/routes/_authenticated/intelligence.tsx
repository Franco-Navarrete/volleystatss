import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVolley } from "@/lib/volley-store";
import { buildMatchIntelligenceStats } from "@/lib/intelligence/stats";
import { runAllEngines } from "@/lib/intelligence/insights/engines";
import type { Insight, IntelligenceReport } from "@/lib/intelligence/types";
import {
  deleteIntelligenceReport,
  generateIntelligenceReport,
  listIntelligenceReports,
} from "@/lib/intelligence/reports.functions";
import { Brain, Loader2, Sparkles, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({
    meta: [
      { title: "Rally Intelligence · Análisis táctico" },
      { name: "description", content: "Motor de análisis táctico e informes de IA para partidos de vóley." },
    ],
  }),
  component: IntelligencePage,
});

const SEV_COLOR: Record<Insight["severity"], string> = {
  info: "bg-secondary/60 text-foreground",
  positive: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
};

const CAT_LABEL: Record<Insight["category"], string> = {
  attack: "Ataque",
  reception: "Recepción",
  serve: "Saque",
  setting: "Armado",
  block: "Bloqueo",
  rotation: "Rotación",
};

function IntelligencePage() {
  const router = useRouter();
  const matches = useVolley((s) => s.matches);
  const teams = useVolley((s) => s.teams);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const finishedMatches = useMemo(
    () => matches.filter((m) => m.status === "finished").sort((a, b) => b.scheduledAt - a.scheduledAt),
    [matches],
  );

  const [matchId, setMatchId] = useState<string>(finishedMatches[0]?.id ?? "");
  const [side, setSide] = useState<"A" | "B">("A");
  const [reports, setReports] = useState<IntelligenceReport[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const genFn = useServerFn(generateIntelligenceReport);
  const listFn = useServerFn(listIntelligenceReports);
  const delFn = useServerFn(deleteIntelligenceReport);

  useEffect(() => {
    let cancel = false;
    listFn()
      .then((rows) => { if (!cancel) setReports(rows); })
      .catch((e: Error) => { if (!cancel) setError(e.message); })
      .finally(() => { if (!cancel) setLoadingList(false); });
    return () => { cancel = true; };
  }, [listFn]);

  const match = useMemo(() => finishedMatches.find((m) => m.id === matchId), [finishedMatches, matchId]);
  const previewInsights = useMemo(() => {
    if (!match) return [] as Insight[];
    const stats = buildMatchIntelligenceStats(match, side);
    return runAllEngines(stats);
  }, [match, side]);

  const teamName = (id?: string) => (id ? teamById.get(id)?.name ?? "Equipo" : "—");

  async function handleGenerate() {
    if (!match) return;
    setGenerating(true);
    setError(null);
    try {
      const title = `${teamName(side === "A" ? match.teamAId : match.teamBId)} vs ${teamName(side === "A" ? match.teamBId : match.teamAId)}`;
      const report = await genFn({
        data: {
          scope: "match",
          scopeRef: match.id,
          title,
          insights: previewInsights,
        },
      });
      setReports((prev) => [report, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando informe");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    try {
      await delFn({ data: { id } });
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando informe");
    }
    router.invalidate();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
        <header className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <Brain className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rally Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              Insights automáticos + informes redactados por IA a partir de tus partidos.
            </p>
          </div>
        </header>

        <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-4">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Generar informe</h2>
          {finishedMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tenés partidos finalizados. Finalizá al menos uno para analizarlo.
            </p>
          ) : (
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Partido</label>
                <Select value={matchId} onValueChange={setMatchId}>
                  <SelectTrigger><SelectValue placeholder="Elegí un partido" /></SelectTrigger>
                  <SelectContent>
                    {finishedMatches.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {teamName(m.teamAId)} vs {teamName(m.teamBId)} — {new Date(m.scheduledAt).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-48">
                <label className="text-xs text-muted-foreground">Equipo a analizar</label>
                <Select value={side} onValueChange={(v) => setSide(v as "A" | "B")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">{match ? teamName(match.teamAId) : "Equipo A"}</SelectItem>
                    <SelectItem value="B">{match ? teamName(match.teamBId) : "Equipo B"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerate} disabled={!match || generating} className="gap-2">
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Generar informe
              </Button>
            </div>
          )}

          {previewInsights.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                Insights detectados ({previewInsights.length})
              </h3>
              <ul className="grid gap-2 md:grid-cols-2">
                {previewInsights.map((i) => (
                  <li key={i.id} className={`rounded-lg border px-3 py-2 text-sm ${SEV_COLOR[i.severity]}`}>
                    <div className="text-[10px] uppercase tracking-widest opacity-70">{CAT_LABEL[i.category]}</div>
                    <div className="font-semibold">{i.title}</div>
                    <div className="opacity-90">{i.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Informes anteriores</h2>
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no generaste ningún informe.</p>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="rounded-xl border border-border/60 bg-card/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""} · {r.insights.length} insights
                        {r.model ? ` · ${r.model}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-2 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      title="Eliminar informe"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {r.summaryMd && (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
                      {r.summaryMd}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
