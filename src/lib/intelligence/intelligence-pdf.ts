// Rally Intelligence — Exportación profesional a PDF.
// Dos formatos: "executive" (2-3 páginas) y "full" (10-20 páginas).
// Diseñado como documento imprimible, no como captura de la UI.

import type { MatchAnalysis, RallyIndexItem, WeaknessCard, StrengthCard } from "./analysis";

type Format = "executive" | "full";

interface RenderCtx {
  doc: any;
  pageW: number;
  pageH: number;
  margin: number;
  y: number;
  autoTable: any;
  meta: { teamName: string; opponentName: string; date: string; format: Format };
  toc: { title: string; page: number }[];
}

// --- paleta ---
const C = {
  primary: [37, 99, 235] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  light: [241, 245, 249] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  good: [16, 185, 129] as [number, number, number],
  warn: [245, 158, 11] as [number, number, number],
  bad: [239, 68, 68] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
};

function statusColor(score: number): [number, number, number] {
  if (score >= 65) return C.good;
  if (score >= 50) return C.warn;
  return C.bad;
}

function ensureSpace(ctx: RenderCtx, needed: number) {
  if (ctx.y + needed > ctx.pageH - 22) {
    ctx.doc.addPage();
    ctx.y = ctx.margin + 14;
  }
}

function drawH1(ctx: RenderCtx, text: string, opts?: { toc?: boolean }) {
  ensureSpace(ctx, 18);
  const { doc, margin } = ctx;
  if (opts?.toc) ctx.toc.push({ title: text, page: (doc as any).internal.getCurrentPageInfo().pageNumber });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...C.dark);
  doc.text(text, margin, ctx.y);
  ctx.y += 4;
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(0.6);
  doc.line(margin, ctx.y, margin + 30, ctx.y);
  ctx.y += 7;
  doc.setLineWidth(0.2);
}

function drawH2(ctx: RenderCtx, text: string) {
  ensureSpace(ctx, 12);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(...C.dark);
  ctx.doc.text(text, ctx.margin, ctx.y);
  ctx.y += 6;
}

function drawParagraph(ctx: RenderCtx, text: string, opts?: { size?: number; color?: [number,number,number] }) {
  const size = opts?.size ?? 10;
  const color = opts?.color ?? C.text;
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...color);
  const lines = ctx.doc.splitTextToSize(text, ctx.pageW - ctx.margin * 2);
  for (const line of lines) {
    ensureSpace(ctx, size * 0.5);
    ctx.doc.text(line, ctx.margin, ctx.y);
    ctx.y += size * 0.45 + 0.6;
  }
  ctx.y += 2;
}

function drawKeyValue(ctx: RenderCtx, label: string, value: string) {
  ensureSpace(ctx, 6);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...C.muted);
  ctx.doc.text(label.toUpperCase(), ctx.margin, ctx.y);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(...C.text);
  ctx.doc.text(value, ctx.margin + 45, ctx.y);
  ctx.y += 5;
}

function drawBar(ctx: RenderCtx, x: number, y: number, w: number, h: number, pct: number, color: [number,number,number]) {
  ctx.doc.setFillColor(...C.light);
  ctx.doc.roundedRect(x, y, w, h, 1, 1, "F");
  const fw = Math.max(0, Math.min(1, pct / 100)) * w;
  ctx.doc.setFillColor(...color);
  ctx.doc.roundedRect(x, y, fw, h, 1, 1, "F");
}

function drawCard(ctx: RenderCtx, height: number, render: (x: number, y: number, w: number) => void) {
  ensureSpace(ctx, height + 4);
  const x = ctx.margin;
  const w = ctx.pageW - ctx.margin * 2;
  ctx.doc.setDrawColor(...C.border);
  ctx.doc.setFillColor(255, 255, 255);
  ctx.doc.roundedRect(x, ctx.y, w, height, 2, 2, "FD");
  render(x + 4, ctx.y + 5, w - 8);
  ctx.y += height + 4;
}

// --- headers & footers ---
function addHeaderFooter(ctx: RenderCtx) {
  const total = (ctx.doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    ctx.doc.setPage(i);
    if (i === 1) continue; // portada limpia
    // header
    ctx.doc.setDrawColor(...C.border);
    ctx.doc.setLineWidth(0.2);
    ctx.doc.line(ctx.margin, 12, ctx.pageW - ctx.margin, 12);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(...C.muted);
    ctx.doc.text(`${ctx.meta.teamName} vs ${ctx.meta.opponentName}`, ctx.margin, 9);
    ctx.doc.text(ctx.meta.date, ctx.pageW - ctx.margin, 9, { align: "right" });
    // footer
    ctx.doc.line(ctx.margin, ctx.pageH - 12, ctx.pageW - ctx.margin, ctx.pageH - 12);
    ctx.doc.text("Rally Intelligence · Informe de análisis de rendimiento", ctx.margin, ctx.pageH - 7);
    ctx.doc.text(`Página ${i} / ${total}`, ctx.pageW - ctx.margin, ctx.pageH - 7, { align: "right" });
  }
}

// --- portada ---
function renderCover(ctx: RenderCtx, analysis: MatchAnalysis) {
  const { doc, pageW, pageH, meta } = ctx;
  // banda superior
  doc.setFillColor(...C.dark);
  doc.rect(0, 0, pageW, 60, "F");
  doc.setFillColor(...C.primary);
  doc.rect(0, 60, pageW, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("RALLY INTELLIGENCE", ctx.margin, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 225);
  doc.text(meta.format === "executive" ? "Informe Ejecutivo" : "Informe Técnico Completo", ctx.margin, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  const title = `${analysis.teamName}  vs  ${analysis.opponentName}`;
  const titleLines = doc.splitTextToSize(title, pageW - ctx.margin * 2);
  doc.text(titleLines, ctx.margin, 42);

  // bloque central: resultado + índice
  const cy = 100;
  const d = analysis.dashboard;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.setTextColor(...C.dark);
  doc.text(d.scoreline.split(" ")[0], pageW / 2, cy, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(...C.muted);
  doc.text(d.result.toUpperCase(), pageW / 2, cy + 8, { align: "center" });

  // índice rally grande
  const rx = pageW / 2 - 40;
  const ry = cy + 25;
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.light);
  doc.roundedRect(rx, ry, 80, 40, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.muted);
  doc.text("ÍNDICE RALLY", pageW / 2, ry + 8, { align: "center" });
  doc.setFontSize(30);
  doc.setTextColor(...statusColor(d.rallyIndex));
  doc.text(`${d.rallyIndex}`, pageW / 2 - 8, ry + 28, { align: "right" });
  doc.setFontSize(12);
  doc.setTextColor(...C.muted);
  doc.text("/100", pageW / 2 - 4, ry + 28);

  // metadatos
  const my = 190;
  doc.setDrawColor(...C.border);
  doc.line(ctx.margin, my - 6, pageW - ctx.margin, my - 6);
  const rows: [string, string][] = [
    ["Fecha", d.date],
    ["Competencia", d.competition ?? "—"],
    ["Duración", d.durationMin != null ? `${d.durationMin} min` : "—"],
    ["Marcador", d.scoreline],
    ["MVP", d.awards.mvp?.name ?? "—"],
  ];
  doc.setFontSize(10);
  let ry2 = my;
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.muted);
    doc.text(k.toUpperCase(), ctx.margin, ry2);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.text);
    doc.text(v, ctx.margin + 45, ry2);
    ry2 += 6;
  }

  // pie de portada
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(
    "Documento generado automáticamente por Rally Intelligence. Todos los datos provienen de eventos registrados durante el partido.",
    ctx.margin,
    pageH - 15,
  );
}

// --- índice ---
function renderToc(ctx: RenderCtx) {
  ctx.doc.addPage();
  ctx.y = ctx.margin + 14;
  drawH1(ctx, "Índice del documento");
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(10);
  for (const e of ctx.toc) {
    ensureSpace(ctx, 7);
    ctx.doc.setTextColor(...C.text);
    ctx.doc.text(e.title, ctx.margin, ctx.y);
    ctx.doc.setTextColor(...C.muted);
    ctx.doc.text(String(e.page), ctx.pageW - ctx.margin, ctx.y, { align: "right" });
    // línea punteada
    const start = ctx.doc.getTextWidth(e.title) + ctx.margin + 2;
    const end = ctx.pageW - ctx.margin - ctx.doc.getTextWidth(String(e.page)) - 2;
    if (end > start) {
      ctx.doc.setLineDashPattern([0.6, 1.2], 0);
      ctx.doc.setDrawColor(...C.border);
      ctx.doc.line(start, ctx.y - 1, end, ctx.y - 1);
      ctx.doc.setLineDashPattern([], 0);
    }
    ctx.y += 7;
  }
}

// --- secciones compartidas ---
function renderExecutiveSummary(ctx: RenderCtx, analysis: MatchAnalysis, summaryMd?: string) {
  drawH1(ctx, "Resumen ejecutivo", { toc: true });
  const text = (summaryMd && !summaryMd.startsWith("_No")) ? summaryMd : analysis.analystSummary;
  drawParagraph(ctx, text || "Sin resumen disponible.");
}

function renderRallyIndexSection(ctx: RenderCtx, analysis: MatchAnalysis, opts: { full: boolean }) {
  drawH1(ctx, "Índice Rally", { toc: true });
  const { overall, breakdown } = analysis.rallyIndex;
  drawCard(ctx, 22, (x, y, w) => {
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(...C.muted);
    ctx.doc.text("RENDIMIENTO GLOBAL", x, y);
    ctx.doc.setFontSize(28);
    ctx.doc.setTextColor(...statusColor(overall));
    ctx.doc.text(`${overall}`, x, y + 12);
    ctx.doc.setFontSize(11);
    ctx.doc.setTextColor(...C.muted);
    ctx.doc.text("/100", x + ctx.doc.getTextWidth(`${overall}`) + 2, y + 12);
    // mini leyenda
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(...C.text);
    ctx.doc.text(
      "El Índice Rally combina 10 fundamentos ponderados por su impacto en el resultado.",
      x + 45,
      y + 6,
    );
    ctx.doc.text(
      "Cada fundamento se evalúa según eficacia, volumen y estabilidad set a set.",
      x + 45,
      y + 11,
    );
  });

  ctx.autoTable({
    startY: ctx.y,
    head: [["Fundamento", "Score", "Estado", "Impacto", opts.full ? "Δ Temporada" : "Detalle"]],
    body: breakdown.map((b: RallyIndexItem) => [
      b.label,
      String(b.score),
      b.status ? statusLabel(b.status) : "—",
      b.impact != null ? `${b.impact}%` : "—",
      opts.full ? (b.seasonDelta != null ? `${b.seasonDelta > 0 ? "+" : ""}${b.seasonDelta}` : "—") : b.detail,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255] },
    columnStyles: {
      1: { halign: "right", cellWidth: 16 },
      2: { cellWidth: 22 },
      3: { halign: "right", cellWidth: 20 },
    },
    theme: "grid",
    didDrawCell: (data: any) => {
      if (data.section === "body" && data.column.index === 1) {
        const row = breakdown[data.row.index];
        const color = statusColor(row.score);
        ctx.doc.setFillColor(...color);
        ctx.doc.rect(data.cell.x, data.cell.y + data.cell.height - 1.2, (row.score / 100) * data.cell.width, 1.2, "F");
      }
    },
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function statusLabel(s: string) {
  return { excellent: "Excelente", good: "Bueno", regular: "Regular", low: "Bajo", critical: "Crítico" }[s] ?? s;
}

function renderStrengthsWeaknesses(ctx: RenderCtx, analysis: MatchAnalysis, executive: boolean) {
  drawH1(ctx, "Fortalezas y debilidades", { toc: true });
  const strengths = analysis.strengths.slice(0, executive ? 3 : 8);
  const weaknesses = analysis.weaknesses.slice(0, executive ? 3 : 8);

  drawH2(ctx, "Fortalezas principales");
  for (const s of strengths) renderStrengthCard(ctx, s, "good");
  if (!strengths.length) drawParagraph(ctx, "Sin fortalezas destacadas.", { color: C.muted });

  drawH2(ctx, "Debilidades principales");
  for (const w of weaknesses) renderStrengthCard(ctx, w, "bad", (w as WeaknessCard).consequence);
  if (!weaknesses.length) drawParagraph(ctx, "Sin debilidades destacadas.", { color: C.muted });
}

function renderStrengthCard(ctx: RenderCtx, card: StrengthCard, tone: "good" | "bad", consequence?: string) {
  const metricsLine = card.evidence.metrics.map((m) => `${m.label}: ${m.value}`).join("  ·  ");
  const h = 28 + (consequence ? 6 : 0);
  drawCard(ctx, h, (x, y, w) => {
    const tint = tone === "good" ? C.good : C.bad;
    ctx.doc.setFillColor(...tint);
    ctx.doc.rect(x - 4, y - 5, 1.5, h - 2, "F");
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(10.5);
    ctx.doc.setTextColor(...C.dark);
    ctx.doc.text(card.title, x, y);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(...C.muted);
    ctx.doc.text(`${card.category}  ·  Importancia ${card.importance.replace("_", " ")}  ·  Confianza ${card.confidence}%`, x, y + 5);
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(...C.text);
    ctx.doc.text(metricsLine, x, y + 11);
    const conc = ctx.doc.splitTextToSize(card.conclusion, w);
    ctx.doc.text(conc.slice(0, 2), x, y + 17);
    if (consequence) {
      ctx.doc.setTextColor(...C.bad);
      ctx.doc.text(ctx.doc.splitTextToSize("Consecuencia: " + consequence, w).slice(0, 2), x, y + 23);
    }
  });
}

function renderAwards(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "MVP y jugadores destacados", { toc: true });
  const a = analysis.dashboard.awards;
  const rows: [string, string, string][] = [];
  const push = (k: string, v?: { name: string; detail: string }) => {
    if (v) rows.push([k, v.name, v.detail]);
  };
  push("MVP", a.mvp);
  push("Mejor atacante", a.bestAttacker);
  push("Mejor receptora", a.bestReceiver);
  push("Mejor sacadora", a.bestServer);
  push("Más eficiente", a.mostEfficient);
  if (!rows.length) { drawParagraph(ctx, "Sin premios asignables por falta de volumen.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Premio", "Jugadora", "Detalle"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: C.primary, textColor: [255, 255, 255] },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderPriorities(ctx: RenderCtx, analysis: MatchAnalysis, limit = 3) {
  drawH1(ctx, "Prioridades para el próximo entrenamiento", { toc: true });
  const p = analysis.priorities.slice(0, limit);
  if (!p.length) { drawParagraph(ctx, "Sin prioridades urgentes detectadas.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["#", "Prioridad", "Nivel", "Razón"]],
    body: p.map((x, i) => [String(i + 1), x.title, x.level.replace("_", " "), x.reason]),
    styles: { fontSize: 9, cellPadding: 2.5, valign: "top" },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 2: { cellWidth: 22 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderConclusion(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Conclusión final", { toc: true });
  const d = analysis.dashboard;
  drawCard(ctx, 40, (x, y, w) => {
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(11);
    ctx.doc.setTextColor(...C.dark);
    ctx.doc.text(`Resultado: ${d.result.toUpperCase()} · ${d.scoreline}`, x, y);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(...C.text);
    const text =
      analysis.coachInsights.whyResult + "\n\n" +
      "Fortaleza clave: " + d.topStrength + "\n" +
      "Foco de mejora: " + d.topWeakness + "\n\n" +
      "Fundamento decisivo: " + analysis.coachInsights.fundamentalDrivingResult;
    const lines = ctx.doc.splitTextToSize(text, w);
    ctx.doc.text(lines, x, y + 7);
  });
}

// --- secciones full only ---
function renderDashboardBlock(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Dashboard del partido", { toc: true });
  const d = analysis.dashboard;
  drawKeyValue(ctx, "Equipo analizado", analysis.teamName);
  drawKeyValue(ctx, "Rival", d.opponent);
  drawKeyValue(ctx, "Fecha", d.date);
  drawKeyValue(ctx, "Competencia", d.competition ?? "—");
  drawKeyValue(ctx, "Duración", d.durationMin != null ? `${d.durationMin} min` : "—");
  drawKeyValue(ctx, "Resultado", `${d.result.toUpperCase()} · ${d.scoreline}`);
  drawKeyValue(ctx, "Índice Rally", `${d.rallyIndex}/100`);
  drawKeyValue(ctx, "Fortaleza principal", d.topStrength);
  drawKeyValue(ctx, "Debilidad principal", d.topWeakness);
}

function renderRadar(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Radar de rendimiento", { toc: true });
  drawParagraph(ctx, "Comparación del equipo contra el rival y el promedio de temporada por fundamento.", { color: C.muted, size: 9 });
  ctx.autoTable({
    startY: ctx.y,
    head: [["Eje", "Equipo", "Rival", "Temporada", "Δ vs Rival"]],
    body: analysis.radarCompare.map((r) => [
      r.axis, String(r.equipo), String(r.rival), String(r.temporada),
      `${r.equipo - r.rival >= 0 ? "+" : ""}${r.equipo - r.rival}`,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderFundamentalChapters(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Análisis por fundamento", { toc: true });
  drawParagraph(ctx, "Un capítulo por fundamento con score, estado, impacto en el resultado y evidencia estadística.", { color: C.muted, size: 9 });
  for (const item of analysis.rallyIndex.breakdown) {
    ensureSpace(ctx, 30);
    drawH2(ctx, item.label);
    drawCard(ctx, 26, (x, y, w) => {
      ctx.doc.setFont("helvetica", "bold");
      ctx.doc.setFontSize(20);
      ctx.doc.setTextColor(...statusColor(item.score));
      ctx.doc.text(`${item.score}`, x, y + 10);
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(...C.muted);
      ctx.doc.text("/100", x + ctx.doc.getTextWidth(`${item.score}`) + 2, y + 10);
      ctx.doc.setFont("helvetica", "normal");
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(...C.text);
      ctx.doc.text(item.detail, x + 30, y + 4);
      ctx.doc.setTextColor(...C.muted);
      const meta = [
        item.status ? `Estado: ${statusLabel(item.status)}` : null,
        item.impact != null ? `Impacto: ${item.impact}%` : null,
        item.confidence != null ? `Confianza: ${item.confidence}%` : null,
        item.seasonDelta != null ? `Δ Temporada: ${item.seasonDelta > 0 ? "+" : ""}${item.seasonDelta}` : null,
      ].filter(Boolean).join("  ·  ");
      ctx.doc.text(meta, x + 30, y + 10);
      // barra
      drawBar(ctx, x + 30, y + 14, w - 30, 3, item.score, statusColor(item.score));
    });
  }
}

function renderSeasonComparison(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Comparación con temporada", { toc: true });
  const rows = analysis.comparison.rows;
  if (!rows.length) { drawParagraph(ctx, "Sin datos históricos suficientes para comparar.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Métrica", "Este partido", analysis.comparison.label, "Δ", "Tendencia"]],
    body: rows.map((r) => [
      r.metric, String(r.current), String(r.reference),
      `${r.delta > 0 ? "+" : ""}${r.delta}`,
      r.trend === "up" ? "↑" : r.trend === "down" ? "↓" : "=",
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center", cellWidth: 20 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderZones(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Distribución del ataque por zona", { toc: true });
  if (!analysis.attackZones.length) { drawParagraph(ctx, "Sin datos de ataque por zona.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Zona", "% Uso", "Ataques", "Puntos", "Errores", "Eficacia"]],
    body: analysis.attackZones.map((z) => [z.label, `${z.pct}%`, String(z.count), String(z.points), String(z.errors), `${z.eff}%`]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: C.primary, textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderPlayerAnalysis(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Análisis individual de jugadoras", { toc: true });
  if (!analysis.playerRadar.length) { drawParagraph(ctx, "Sin datos individuales suficientes.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Jugadora", "Ataque", "Bloqueo", "Ace", "Recepción", "Disciplina"]],
    body: analysis.playerRadar.map((p) => [p.name, String(p.attack), String(p.block), String(p.ace), String(p.reception), String(p.discipline)]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderSetTrends(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Tendencias temporales por set", { toc: true });
  if (!analysis.setTrends.length) { drawParagraph(ctx, "Sin sets registrados.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Set", "Marcador", "Ef. Ataque", "Ef. Recepción", "Err. Saque", "Err. Ataque"]],
    body: analysis.setTrends.map((s) => [
      String(s.setNumber), `${s.scoreFor}-${s.scoreAgainst}`,
      `${s.attackEff}%`, `${s.receptionEff}%`, String(s.serveErrors), String(s.attackErrors),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: C.primary, textColor: [255, 255, 255] },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderTimeline(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Timeline del partido", { toc: true });
  if (!analysis.timeline.length) { drawParagraph(ctx, "Sin eventos destacados.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Set", "Marcador", "Evento", "Detalle"]],
    body: analysis.timeline.map((t) => [String(t.setNumber), `${t.scoreFor}-${t.scoreAgainst}`, t.title, t.detail]),
    styles: { fontSize: 8.5, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 18 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderRotationBlock(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Análisis por rotación", { toc: true });
  const rotationInsights = analysis.strengths.filter((s) => s.category === "Rotación")
    .concat(analysis.weaknesses.filter((w) => w.category === "Rotación"));
  if (!rotationInsights.length) { drawParagraph(ctx, "Sin rotaciones con desempeño destacado.", { color: C.muted }); return; }
  for (const r of rotationInsights) {
    renderStrengthCard(ctx, r, r.category === "Rotación" && "consequence" in r ? "bad" : "good",
      (r as any).consequence);
  }
}

function renderRisksPredictions(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Riesgos detectados y predicciones", { toc: true });
  drawH2(ctx, "Riesgos");
  if (!analysis.risks.length) drawParagraph(ctx, "Sin riesgos destacados.", { color: C.muted });
  else ctx.autoTable({
    startY: ctx.y,
    head: [["Nivel", "Riesgo", "Detalle"]],
    body: analysis.risks.map((r) => [r.level.replace("_", " "), r.title, r.detail]),
    styles: { fontSize: 9, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: C.bad, textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 20 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  if ((ctx.doc as any).lastAutoTable) ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;

  drawH2(ctx, "Predicciones");
  if (!analysis.predictions.length) drawParagraph(ctx, "Sin predicciones disponibles.", { color: C.muted });
  for (const p of analysis.predictions) drawParagraph(ctx, `• ${p.premise} ${p.outcome}`);
}

function renderRecommendations(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Recomendaciones de entrenamiento", { toc: true });
  if (!analysis.recommendations.length) { drawParagraph(ctx, "Sin recomendaciones.", { color: C.muted }); return; }
  const label: Record<string, string> = { inmediata: "Inmediata", mediano_plazo: "Mediano plazo", estrategica: "Estratégica" };
  ctx.autoTable({
    startY: ctx.y,
    head: [["Horizonte", "Recomendación"]],
    body: analysis.recommendations.map((r) => [label[r.horizon] ?? r.horizon, r.text]),
    styles: { fontSize: 9, cellPadding: 2.5, valign: "top" },
    headStyles: { fillColor: C.primary, textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 28 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderTrainingPlan(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Plan de entrenamiento sugerido", { toc: true });
  const plan = analysis.trainingPlan;
  drawParagraph(ctx, `Duración total: ${plan.totalMinutes} minutos.`);
  if (!plan.blocks.length) { drawParagraph(ctx, "Sin bloques definidos.", { color: C.muted }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Min", "Foco", "Ejercicios", "Razón"]],
    body: plan.blocks.map((b) => [`${b.minutes}'`, b.focus, b.drills.join(" · "), b.reason]),
    styles: { fontSize: 9, cellPadding: 2.5, valign: "top" },
    headStyles: { fillColor: C.dark, textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 12, halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 6;
}

function renderCoachInsights(ctx: RenderCtx, analysis: MatchAnalysis) {
  drawH1(ctx, "Coach Insights", { toc: true });
  const ci = analysis.coachInsights;
  drawKeyValue(ctx, "Por qué el resultado", "");
  drawParagraph(ctx, ci.whyResult);
  drawKeyValue(ctx, "Decisión que funcionó", "");
  drawParagraph(ctx, ci.keyDecisionThatWorked);
  drawKeyValue(ctx, "Decisión a reconsiderar", "");
  drawParagraph(ctx, ci.decisionToReconsider);
  drawKeyValue(ctx, "Fundamento decisivo", "");
  drawParagraph(ctx, ci.fundamentalDrivingResult);
  if (analysis.coachQuestions.length) {
    drawH2(ctx, "Preguntas para el entrenador");
    for (const q of analysis.coachQuestions) drawParagraph(ctx, `• ${q}`);
  }
}

function renderNotesPage(ctx: RenderCtx) {
  ctx.doc.addPage();
  ctx.y = ctx.margin + 14;
  drawH1(ctx, "Notas del entrenador");
  const { doc, margin, pageW, pageH } = ctx;
  doc.setDrawColor(...C.border);
  let ly = ctx.y + 4;
  while (ly < pageH - 22) {
    doc.line(margin, ly, pageW - margin, ly);
    ly += 9;
  }
}

// --- entry point ---
export async function downloadIntelligencePdf(
  analysis: MatchAnalysis,
  format: Format,
  summaryMd?: string,
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const ctx: RenderCtx = {
    doc, pageW, pageH, margin: 15, y: 0,
    autoTable,
    meta: {
      teamName: analysis.teamName,
      opponentName: analysis.opponentName,
      date: analysis.dashboard.date,
      format,
    },
    toc: [],
  };

  // portada
  renderCover(ctx, analysis);

  if (format === "executive") {
    doc.addPage();
    ctx.y = ctx.margin + 14;
    renderExecutiveSummary(ctx, analysis, summaryMd);
    renderRallyIndexSection(ctx, analysis, { full: false });
    renderStrengthsWeaknesses(ctx, analysis, true);
    renderAwards(ctx, analysis);
    renderPriorities(ctx, analysis, 3);
    renderConclusion(ctx, analysis);
  } else {
    // reservar página TOC (se rellena al final)
    doc.addPage();
    const tocPageNo = (doc as any).internal.getCurrentPageInfo().pageNumber;

    doc.addPage();
    ctx.y = ctx.margin + 14;

    renderDashboardBlock(ctx, analysis);
    renderExecutiveSummary(ctx, analysis, summaryMd);
    renderRallyIndexSection(ctx, analysis, { full: true });
    renderRadar(ctx, analysis);
    renderFundamentalChapters(ctx, analysis);
    renderSeasonComparison(ctx, analysis);
    renderZones(ctx, analysis);
    renderRotationBlock(ctx, analysis);
    renderPlayerAnalysis(ctx, analysis);
    renderSetTrends(ctx, analysis);
    renderTimeline(ctx, analysis);
    renderStrengthsWeaknesses(ctx, analysis, false);
    renderRisksPredictions(ctx, analysis);
    renderRecommendations(ctx, analysis);
    renderTrainingPlan(ctx, analysis);
    renderCoachInsights(ctx, analysis);
    renderConclusion(ctx, analysis);
    renderNotesPage(ctx);

    // rellenar TOC en su página reservada
    doc.setPage(tocPageNo);
    ctx.y = ctx.margin + 14;
    drawH1(ctx, "Índice del documento");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const e of ctx.toc) {
      if (ctx.y > pageH - 22) break;
      doc.setTextColor(...C.text);
      doc.text(e.title, ctx.margin, ctx.y);
      doc.setTextColor(...C.muted);
      doc.text(String(e.page), pageW - ctx.margin, ctx.y, { align: "right" });
      const start = doc.getTextWidth(e.title) + ctx.margin + 2;
      const end = pageW - ctx.margin - doc.getTextWidth(String(e.page)) - 2;
      if (end > start) {
        doc.setLineDashPattern([0.6, 1.2], 0);
        doc.setDrawColor(...C.border);
        doc.line(start, ctx.y - 1, end, ctx.y - 1);
        doc.setLineDashPattern([], 0);
      }
      ctx.y += 7;
    }
  }

  addHeaderFooter(ctx);

  const suffix = format === "executive" ? "ejecutivo" : "completo";
  const safe = `${analysis.teamName}-vs-${analysis.opponentName}-${suffix}`.replace(/[^\w-]+/g, "_");
  doc.save(`rally-intelligence-${safe}.pdf`);
}
