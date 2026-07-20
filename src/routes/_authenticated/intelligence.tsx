import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVolley } from "@/lib/volley-store";
import { buildMatchAnalysis } from "@/lib/intelligence/analysis";
import { ReportView } from "@/components/intelligence/ReportView";
import type { IntelligenceReport } from "@/lib/intelligence/reports.functions";
import {
  deleteIntelligenceReport,
  generateIntelligenceReport,
  listIntelligenceReports,
} from "@/lib/intelligence/reports.functions";
import { Brain, Loader2, Sparkles, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({
    meta: [
      { title: "Rally Intelligence · Análisis de rendimiento" },
      { name: "description", content: "Informes profesionales de rendimiento con datos accionables, gráficos y recomendaciones." },
    ],
  }),
  component: IntelligencePage,
});

function IntelligencePage() {
  const matches = useVolley((s) => s.matches);
  const teams = useVolley((s) => s.teams);
  const players = useVolley((s) => s.players);
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
  const [openReports, setOpenReports] = useState<Set<string>>(new Set());

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

  const analysis = useMemo(() => {
    if (!match) return null;
    return buildMatchAnalysis({ match, side, teams, players, history: matches });
  }, [match, side, teams, players, matches]);

  const teamName = (id?: string) => (id ? teamById.get(id)?.name ?? "Equipo" : "—");

  async function handleGenerate() {
    if (!match || !analysis) return;
    setGenerating(true);
    setError(null);
    try {
      const title = `${teamName(side === "A" ? match.teamAId : match.teamBId)} vs ${teamName(side === "A" ? match.teamBId : match.teamAId)}`;
      const report = await genFn({
        data: {
          scope: "match",
          scopeRef: match.id,
          title,
          analysis: analysis as unknown as never,
        },
      });
      setReports((prev) => [report, ...prev]);
      if (report.id) setOpenReports((s) => new Set(s).add(report.id!));
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
  }

  function toggleReport(id: string) {
    setOpenReports((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        <header className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <Brain className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rally Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              Informes profesionales de rendimiento con datos, gráficos y recomendaciones accionables.
            </p>
          </div>
        </header>

        {/* Selector de partido */}
        <Card className="p-4 space-y-4 bg-card/40">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Analizar partido</h2>
          {finishedMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tenés partidos finalizados. Finalizá al menos uno para analizarlo.
            </p>
          ) : (
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <div className="flex-1 min-w-0">
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
              <div className="w-full md:w-56">
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
                Generar informe con IA
              </Button>
            </div>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </Card>

        {/* Preview en vivo del análisis */}
        {analysis && (
          <section className="space-y-2">
            <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Vista previa del informe</h2>
            <ReportView analysis={analysis} />
          </section>
        )}

        {/* Historial de informes guardados */}
        <section className="space-y-3">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Informes guardados</h2>
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no generaste ningún informe.</p>
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => {
                const isOpen = r.id ? openReports.has(r.id) : false;
                return (
                  <li key={r.id} className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
                    <div className="flex items-center gap-2 p-3">
                      <button
                        onClick={() => r.id && toggleReport(r.id)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{r.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}
                            {r.analysis ? ` · Índice ${r.analysis.dashboard.rallyIndex}/100` : ""}
                            {r.model ? ` · ${r.model}` : ""}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-2 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        title="Eliminar informe"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {isOpen && (
                      <div className="p-4 border-t border-border/50">
                        {r.analysis ? (
                          <ReportView analysis={r.analysis} summaryMd={r.summaryMd} />
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
                            {r.summaryMd || "Informe legacy sin análisis estructurado."}
                          </pre>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
