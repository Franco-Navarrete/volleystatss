// Rally Intelligence — Exportación editorial a PDF.
// Diseño propio A4 optimizado para impresión y lectura, no una captura de la UI.
// Dos formatos: "executive" (2–3 pág.) y "full" (10–20 pág.).

import type { MatchAnalysis, RallyIndexItem, WeaknessCard, StrengthCard, Importance } from "./analysis";

type Format = "executive" | "full";
type RGB = [number, number, number];

interface TocEntry { title: string; page: number; level: 1 | 2 }

interface RenderCtx {
  doc: any;
  pageW: number;
  pageH: number;
  margin: number;
  gutter: number;        // margen interno de cards
  contentTop: number;    // primera línea utilizable
  contentBottom: number; // último Y utilizable (antes del footer)
  y: number;
  autoTable: (opts: any) => void;
  meta: {
    teamName: string;
    opponentName: string;
    date: string;
    competition: string;
    format: Format;
    version: string;
    generatedAt: string;
  };
  toc: TocEntry[];
}

// ---------------- Paleta editorial ----------------
// Azul reservado sólo para títulos y detalles finos. Semánticos claros.
const C = {
  ink:   [17, 24, 39]      as RGB, // texto principal
  navy:  [30, 58, 138]     as RGB, // sólo títulos
  slate: [71, 85, 105]     as RGB, // texto secundario
  mute:  [148, 163, 184]   as RGB, // labels / notas
  hair:  [226, 232, 240]   as RGB, // hairlines
  paper: [248, 250, 252]   as RGB, // fondos suaves
  zebra: [244, 246, 249]   as RGB, // filas alternadas
  good:  [22, 163, 74]     as RGB,
  warn:  [202, 138, 4]     as RGB,
  bad:   [220, 38, 38]     as RGB,
  white: [255, 255, 255]   as RGB,
};

// ---------------- Sanitizadores ----------------
const NA = "No disponible";
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const clampPct = (n: number) => Math.max(0, Math.min(100, n));
const fmtInt = (n: unknown, suffix = "") => (isNum(n) ? `${Math.round(n)}${suffix}` : NA);
const fmtPct = (n: unknown) => (isNum(n) ? `${Math.round(clampPct(n))}%` : NA);
const fmtDelta = (n: unknown) => (isNum(n) ? `${n > 0 ? "+" : ""}${Math.round(n * 10) / 10}` : "—");
const fmtText = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : NA);
const fmtDuration = (min: unknown) => {
  if (!isNum(min) || min <= 0 || min > 300) return NA;
  return `${Math.round(min)} min`;
};
const fmtScoreline = (s: unknown) => {
  if (typeof s !== "string" || !s.trim()) return NA;
  // básico: descartar valores absurdos
  if (/NaN|Infinity|undefined|null/i.test(s)) return NA;
  return s;
};

function statusColor(score: unknown): RGB {
  if (!isNum(score)) return C.mute;
  if (score >= 70) return C.good;
  if (score >= 50) return C.warn;
  return C.bad;
}
function statusLabel(s: string | undefined) {
  return ({ excellent: "Excelente", good: "Bueno", regular: "Regular", low: "Bajo", critical: "Crítico" } as Record<string, string>)[s ?? ""] ?? "—";
}
function importanceLabel(i: Importance | undefined) {
  return ({ muy_alta: "Muy alta", alta: "Alta", media: "Media", baja: "Baja" } as Record<string, string>)[i ?? ""] ?? "—";
}

// ---------------- Primitivas geométricas ----------------
function contentW(ctx: RenderCtx) { return ctx.pageW - ctx.margin * 2; }

function pageBreak(ctx: RenderCtx) {
  ctx.doc.addPage();
  ctx.y = ctx.contentTop;
}
function ensureSpace(ctx: RenderCtx, needed: number) {
  if (ctx.y + needed > ctx.contentBottom) pageBreak(ctx);
}
function spacer(ctx: RenderCtx, mm: number) { ctx.y += mm; }

function setFont(doc: any, weight: "normal" | "bold" | "italic", size: number, color: RGB = C.ink) {
  doc.setFont("helvetica", weight);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}
function fillRect(doc: any, x: number, y: number, w: number, h: number, color: RGB, radius = 0) {
  doc.setFillColor(color[0], color[1], color[2]);
  if (radius > 0) doc.roundedRect(x, y, w, h, radius, radius, "F");
  else doc.rect(x, y, w, h, "F");
}
function strokeRect(doc: any, x: number, y: number, w: number, h: number, color: RGB, radius = 0, weight = 0.2) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(weight);
  if (radius > 0) doc.roundedRect(x, y, w, h, radius, radius, "S");
  else doc.rect(x, y, w, h, "S");
}
function hairline(doc: any, x1: number, y1: number, x2: number, y2: number, color: RGB = C.hair, weight = 0.2) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(weight);
  doc.line(x1, y1, x2, y2);
}

// ---------------- Bloques tipográficos ----------------
function drawH1(ctx: RenderCtx, title: string) {
  // 40mm de reserva mínima para evitar títulos huérfanos (H1 + primer bloque).
  ensureSpace(ctx, 40);
  ctx.toc.push({ title, page: ctx.(doc as any).internal.getCurrentPageInfo().pageNumber, level: 1 });
  setFont(ctx.doc, "bold", 16, C.navy);
  ctx.doc.text(title, ctx.margin, ctx.y);
  ctx.y += 2.5;
  hairline(ctx.doc, ctx.margin, ctx.y, ctx.margin + 40, ctx.y, C.navy, 0.7);
  ctx.y += 8;
}
function drawH2(ctx: RenderCtx, title: string) {
  ensureSpace(ctx, 14);
  setFont(ctx.doc, "bold", 12, C.ink);
  ctx.doc.text(title, ctx.margin, ctx.y);
  ctx.y += 6;
}
function drawEyebrow(ctx: RenderCtx, text: string) {
  setFont(ctx.doc, "bold", 8.5, C.mute);
  ctx.doc.text(text.toUpperCase(), ctx.margin, ctx.y);
  ctx.y += 4.5;
}
function drawParagraph(ctx: RenderCtx, text: string, opts?: { size?: number; color?: RGB; italic?: boolean }) {
  const size = opts?.size ?? 10.5;
  const color = opts?.color ?? C.ink;
  const weight = opts?.italic ? "italic" : "normal";
  setFont(ctx.doc, weight, size, color);
  const lineH = size * 0.42 + 1.2;
  const lines: string[] = ctx.doc.splitTextToSize(text, contentW(ctx));
  for (const line of lines) {
    ensureSpace(ctx, lineH);
    ctx.doc.text(line, ctx.margin, ctx.y);
    ctx.y += lineH;
  }
  spacer(ctx, 2);
}

// Bloque atómico: mide primero, si no entra completo salta de página, luego dibuja.
function drawBlock(ctx: RenderCtx, height: number, gapAfter: number, render: (x: number, y: number, w: number) => void) {
  ensureSpace(ctx, height + gapAfter);
  render(ctx.margin, ctx.y, contentW(ctx));
  ctx.y += height + gapAfter;
}

// Card estándar (bordes + fondo blanco).
function drawCard(ctx: RenderCtx, height: number, render: (x: number, y: number, w: number) => void, gapAfter = 4) {
  drawBlock(ctx, height, gapAfter, (x, y, w) => {
    fillRect(ctx.doc, x, y, w, height, C.white);
    strokeRect(ctx.doc, x, y, w, height, C.hair, 3, 0.25);
    render(x, y, w);
  });
}

// Barra de progreso normalizada.
function drawBar(doc: any, x: number, y: number, w: number, h: number, value: unknown, color: RGB) {
  const v = isNum(value) ? clampPct(value) : 0;
  fillRect(doc, x, y, w, h, C.zebra, h / 2);
  if (v > 0) fillRect(doc, x, y, (v / 100) * w, h, color, h / 2);
}

// Pill / chip.
function drawPill(doc: any, x: number, y: number, label: string, color: RGB) {
  setFont(doc, "bold", 8, C.white);
  const padX = 3;
  const tw = doc.getTextWidth(label);
  const w = tw + padX * 2;
  const h = 5;
  fillRect(doc, x, y - h + 1.2, w, h, color, h / 2);
  doc.text(label, x + padX, y);
  return w;
}

// ---------------- Header / footer ----------------
function paintChrome(ctx: RenderCtx, totalPages: number) {
  const { doc, pageW, pageH, margin } = ctx;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i === 1) continue; // portada limpia
    // Header
    setFont(doc, "bold", 8.5, C.navy);
    doc.text("RALLY INTELLIGENCE", margin, 11);
    setFont(doc, "normal", 8.5, C.slate);
    const mid = `${ctx.meta.teamName}  vs  ${ctx.meta.opponentName}`;
    doc.text(mid, pageW / 2, 11, { align: "center" });
    doc.text(ctx.meta.format === "executive" ? "Informe Ejecutivo" : "Informe Técnico", pageW - margin, 11, { align: "right" });
    hairline(doc, margin, 13.5, pageW - margin, 13.5);
    // Footer
    hairline(doc, margin, pageH - 14, pageW - margin, pageH - 14);
    setFont(doc, "normal", 8, C.mute);
    doc.text(`Generado por Rally Intelligence  ·  ${ctx.meta.generatedAt}  ·  ${ctx.meta.version}`, margin, pageH - 9);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 9, { align: "right" });
  }
}

// ================================================================
// PORTADA
// ================================================================
function renderCover(ctx: RenderCtx, a: MatchAnalysis, coachName?: string, venue?: string) {
  const { doc, pageW, pageH, margin } = ctx;
  // Banda superior
  fillRect(doc, 0, 0, pageW, 78, C.ink);
  fillRect(doc, 0, 78, pageW, 2.2, C.navy);

  // Marca
  setFont(doc, "bold", 11, C.white);
  doc.text("RALLY", margin, 20);
  setFont(doc, "normal", 11, [200, 210, 225]);
  doc.text("  INTELLIGENCE", margin + doc.getTextWidth("RALLY"), 20);
  setFont(doc, "normal", 9, [190, 200, 220]);
  doc.text(ctx.meta.format === "executive" ? "INFORME EJECUTIVO" : "INFORME TÉCNICO COMPLETO", margin, 27);

  // Título del enfrentamiento
  setFont(doc, "bold", 26, C.white);
  const titleLines: string[] = doc.splitTextToSize(`${a.teamName}  vs  ${a.opponentName}`, pageW - margin * 2);
  let ty = 50;
  for (const line of titleLines.slice(0, 2)) { doc.text(line, margin, ty); ty += 10; }

  // Resultado central
  const d = a.dashboard;
  const scoreLine = fmtScoreline(d.scoreline);
  const setsOnly = scoreLine !== NA ? scoreLine.split(" ")[0] : NA;

  const centerX = pageW / 2;
  const blockY = 108;

  setFont(doc, "normal", 10, C.mute);
  doc.text("RESULTADO", centerX, blockY, { align: "center" });
  setFont(doc, "bold", 44, C.ink);
  doc.text(setsOnly, centerX, blockY + 18, { align: "center" });
  setFont(doc, "bold", 11, d.result === "victoria" ? C.good : d.result === "derrota" ? C.bad : C.slate);
  doc.text(d.result.toUpperCase(), centerX, blockY + 25, { align: "center" });
  if (scoreLine !== NA && scoreLine.includes("(")) {
    setFont(doc, "normal", 9, C.slate);
    const detail = scoreLine.substring(scoreLine.indexOf("("));
    doc.text(detail, centerX, blockY + 31, { align: "center" });
  }

  // Índice Rally (composición limpia, sin "/100" encima del número)
  const boxW = 72, boxH = 46;
  const bx = centerX - boxW / 2, by = blockY + 42;
  fillRect(doc, bx, by, boxW, boxH, C.paper, 3);
  strokeRect(doc, bx, by, boxW, boxH, C.hair, 3, 0.3);
  setFont(doc, "bold", 8.5, C.mute);
  doc.text("ÍNDICE RALLY", bx + boxW / 2, by + 6.5, { align: "center" });
  const idx = isNum(d.rallyIndex) ? Math.round(d.rallyIndex) : null;
  setFont(doc, "bold", 32, idx == null ? C.mute : statusColor(idx));
  doc.text(idx == null ? "—" : `${idx}`, bx + boxW / 2, by + 26, { align: "center" });
  hairline(doc, bx + boxW / 2 - 12, by + 30, bx + boxW / 2 + 12, by + 30, C.hair, 0.4);
  setFont(doc, "bold", 9.5, C.ink);
  doc.text(idx == null ? "—" : statusLabel(rallyBand(idx)), bx + boxW / 2, by + 35, { align: "center" });
  setFont(doc, "normal", 7.5, C.mute);
  doc.text("de 100 puntos posibles", bx + boxW / 2, by + 40, { align: "center" });

  // Metadatos (dos columnas)
  const metaTop = 218;
  hairline(doc, margin, metaTop - 6, pageW - margin, metaTop - 6);
  const rows: [string, string][] = [
    ["Equipo", fmtText(a.teamName)],
    ["Rival", fmtText(a.opponentName)],
    ["Fecha", fmtText(d.date)],
    ["Competencia", fmtText(d.competition)],
    ["Lugar", fmtText(venue)],
    ["Duración", fmtDuration(d.durationMin)],
    ["Entrenador", fmtText(coachName)],
    ["MVP", fmtText(d.awards.mvp?.name)],
  ];
  const colW = (pageW - margin * 2) / 2;
  let ry = metaTop;
  for (let i = 0; i < rows.length; i++) {
    const [k, v] = rows[i];
    const col = i % 2;
    const cx = margin + col * colW;
    if (i > 0 && col === 0) ry += 7;
    setFont(doc, "bold", 8, C.mute);
    doc.text(k.toUpperCase(), cx, ry);
    setFont(doc, "normal", 10.5, C.ink);
    doc.text(doc.splitTextToSize(v, colW - 4)[0], cx, ry + 5);
  }

  // Pie de portada
  hairline(doc, margin, pageH - 22, pageW - margin, pageH - 22);
  setFont(doc, "italic", 8, C.mute);
  doc.text(
    "Documento generado automáticamente por Rally Intelligence. Todos los datos provienen de eventos registrados en tiempo real durante el partido.",
    margin, pageH - 16,
  );
  setFont(doc, "normal", 8, C.slate);
  doc.text(ctx.meta.generatedAt, margin, pageH - 10);
  doc.text(ctx.meta.version, pageW - margin, pageH - 10, { align: "right" });
}
function rallyBand(n: number) {
  if (n >= 85) return "excellent";
  if (n >= 70) return "good";
  if (n >= 55) return "regular";
  if (n >= 40) return "low";
  return "critical";
}

// ================================================================
// ÍNDICE (TOC)
// ================================================================
function renderToc(ctx: RenderCtx, tocPage: number) {
  ctx.doc.setPage(tocPage);
  ctx.y = ctx.contentTop;
  drawEyebrow(ctx, "Contenido");
  setFont(ctx.doc, "bold", 20, C.navy);
  ctx.doc.text("Índice del documento", ctx.margin, ctx.y + 3);
  ctx.y += 10;
  hairline(ctx.doc, ctx.margin, ctx.y, ctx.margin + 40, ctx.y, C.navy, 0.6);
  ctx.y += 10;

  for (const e of ctx.toc) {
    if (ctx.y > ctx.contentBottom) break;
    const indent = e.level === 2 ? 6 : 0;
    setFont(ctx.doc, e.level === 1 ? "bold" : "normal", e.level === 1 ? 10.5 : 10, C.ink);
    ctx.doc.text(e.title, ctx.margin + indent, ctx.y);
    const pageStr = String(e.page);
    setFont(ctx.doc, "normal", 10, C.slate);
    ctx.doc.text(pageStr, ctx.pageW - ctx.margin, ctx.y, { align: "right" });
    // Línea punteada
    const start = ctx.margin + indent + ctx.doc.getTextWidth(e.title) + 2;
    const end = ctx.pageW - ctx.margin - ctx.doc.getTextWidth(pageStr) - 2;
    if (end > start + 4) {
      ctx.doc.setLineDashPattern([0.5, 1.4], 0);
      hairline(ctx.doc, start, ctx.y - 0.9, end, ctx.y - 0.9, C.hair, 0.3);
      ctx.doc.setLineDashPattern([], 0);
    }
    ctx.y += 7.5;
  }
}

// ================================================================
// SECCIONES
// ================================================================

function renderDashboardBlock(ctx: RenderCtx, a: MatchAnalysis, coach?: string, venue?: string) {
  drawH1(ctx, "Dashboard del partido");
  const d = a.dashboard;
  const rows: [string, string][] = [
    ["Equipo", fmtText(a.teamName)],
    ["Rival", fmtText(a.opponentName)],
    ["Fecha", fmtText(d.date)],
    ["Competencia", fmtText(d.competition)],
    ["Lugar", fmtText(venue)],
    ["Duración", fmtDuration(d.durationMin)],
    ["Entrenador", fmtText(coach)],
    ["Resultado", `${fmtText(d.result?.toUpperCase())}  ·  ${fmtScoreline(d.scoreline)}`],
    ["Índice Rally", isNum(d.rallyIndex) ? `${Math.round(d.rallyIndex)} / 100` : NA],
    ["Fortaleza principal", fmtText(d.topStrength)],
    ["Foco de mejora", fmtText(d.topWeakness)],
  ];
  drawCard(ctx, 6.6 * rows.length + 6, (x, y, w) => {
    for (let i = 0; i < rows.length; i++) {
      const ry = y + 6 + i * 6.6;
      if (i % 2 === 1) fillRect(ctx.doc, x + 1, ry - 4.6, w - 2, 6.4, C.paper);
      setFont(ctx.doc, "bold", 8.5, C.mute);
      ctx.doc.text(rows[i][0].toUpperCase(), x + 4, ry);
      setFont(ctx.doc, "normal", 10, C.ink);
      const val: string[] = ctx.doc.splitTextToSize(rows[i][1], w - 60);
      ctx.doc.text(val[0], x + 50, ry);
    }
  });
}

function renderExecutiveSummary(ctx: RenderCtx, a: MatchAnalysis, summaryMd?: string) {
  drawH1(ctx, "Resumen del analista");
  const text = (summaryMd && summaryMd.trim() && !summaryMd.trim().startsWith("_No")) ? summaryMd : a.analystSummary;
  drawParagraph(ctx, fmtText(text));
}

function renderRallyIndexSection(ctx: RenderCtx, a: MatchAnalysis, opts: { full: boolean }) {
  drawH1(ctx, "Índice Rally");
  const { overall, breakdown } = a.rallyIndex;
  const overallSafe = isNum(overall) ? Math.round(overall) : null;

  // Card superior con composición vertical (número → regla → estado → nota)
  drawCard(ctx, 34, (x, y, w) => {
    // columna izquierda: score grande
    const tileW = 58;
    fillRect(ctx.doc, x + 1, y + 1, tileW, 32, C.paper, 2.5);
    setFont(ctx.doc, "bold", 8, C.mute);
    ctx.doc.text("RENDIMIENTO GLOBAL", x + tileW / 2 + 1, y + 6.5, { align: "center" });
    setFont(ctx.doc, "bold", 26, overallSafe == null ? C.mute : statusColor(overallSafe));
    ctx.doc.text(overallSafe == null ? "—" : `${overallSafe}`, x + tileW / 2 + 1, y + 19, { align: "center" });
    hairline(ctx.doc, x + tileW / 2 - 9, y + 22, x + tileW / 2 + 11, y + 22, C.hair, 0.5);
    setFont(ctx.doc, "bold", 9, C.ink);
    ctx.doc.text(overallSafe == null ? "—" : statusLabel(rallyBand(overallSafe)), x + tileW / 2 + 1, y + 27, { align: "center" });
    setFont(ctx.doc, "normal", 7.5, C.mute);
    ctx.doc.text("100 puntos posibles", x + tileW / 2 + 1, y + 31, { align: "center" });

    // columna derecha: descripción
    setFont(ctx.doc, "normal", 9.5, C.ink);
    const desc = "El Índice Rally combina 10 fundamentos ponderados por su impacto en el resultado. Cada uno se evalúa por eficacia, volumen y estabilidad set a set.";
    const lines: string[] = ctx.doc.splitTextToSize(desc, w - tileW - 10);
    let ly = y + 8;
    for (const l of lines) { ctx.doc.text(l, x + tileW + 6, ly); ly += 4.4; }
    // top fortaleza / debilidad
    setFont(ctx.doc, "bold", 8, C.mute);
    ctx.doc.text("FORTALEZA", x + tileW + 6, y + 22);
    ctx.doc.text("FOCO DE MEJORA", x + tileW + 6, y + 28);
    setFont(ctx.doc, "normal", 9, C.good);
    ctx.doc.text(ctx.doc.splitTextToSize(fmtText(a.dashboard.topStrength), w - tileW - 44)[0], x + tileW + 36, y + 22);
    setFont(ctx.doc, "normal", 9, C.bad);
    ctx.doc.text(ctx.doc.splitTextToSize(fmtText(a.dashboard.topWeakness), w - tileW - 44)[0], x + tileW + 36, y + 28);
  }, 6);

  // Tabla de desglose
  const head = opts.full
    ? [["Fundamento", "Score", "Estado", "Impacto", "Confianza", "Δ Temporada"]]
    : [["Fundamento", "Score", "Estado", "Impacto", "Detalle"]];
  ctx.autoTable({
    startY: ctx.y,
    head,
    body: breakdown.map((b: RallyIndexItem) => {
      const base = [
        fmtText(b.label),
        fmtInt(b.score),
        statusLabel(b.status),
        fmtPct(b.impact),
      ];
      return opts.full
        ? [...base, fmtPct(b.confidence), fmtDelta(b.seasonDelta)]
        : [...base, fmtText(b.detail)];
    }),
    styles: { fontSize: 9.5, cellPadding: 2.6, textColor: C.ink, lineColor: C.hair, lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: {
      0: { cellWidth: opts.full ? 50 : 55 },
      1: { halign: "right", cellWidth: 16 },
      2: { cellWidth: 22 },
      3: { halign: "right", cellWidth: 20 },
      4: { halign: opts.full ? "right" : "left", cellWidth: opts.full ? 22 : undefined },
      5: opts.full ? { halign: "right", cellWidth: 24 } : undefined,
    },
    theme: "grid",
    didDrawCell: (data: any) => {
      if (data.section === "body" && data.column.index === 1) {
        const row = breakdown[data.row.index];
        if (isNum(row.score)) {
          const color = statusColor(row.score);
          ctx.doc.setFillColor(color[0], color[1], color[2]);
          ctx.doc.rect(data.cell.x, data.cell.y + data.cell.height - 1.1, (clampPct(row.score) / 100) * data.cell.width, 1.1, "F");
        }
      }
    },
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderRadar(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Radar comparativo");
  drawParagraph(ctx, "Comparación por fundamento entre el equipo, el rival y el promedio de temporada.", { color: C.slate, size: 9.5 });
  ctx.autoTable({
    startY: ctx.y,
    head: [["Fundamento", "Equipo", "Rival", "Temporada", "Δ vs Rival"]],
    body: a.radarCompare.map((r) => {
      const delta = isNum(r.equipo) && isNum(r.rival) ? r.equipo - r.rival : null;
      return [fmtText(r.axis), fmtInt(r.equipo), fmtInt(r.rival), fmtInt(r.temporada), delta == null ? "—" : fmtDelta(delta)];
    }),
    styles: { fontSize: 9.5, cellPadding: 2.6, textColor: C.ink, lineColor: C.hair, lineWidth: 0.15 },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderStrengthsWeaknesses(ctx: RenderCtx, a: MatchAnalysis, executive: boolean) {
  drawH1(ctx, "Fortalezas y debilidades");
  const strengths = a.strengths.slice(0, executive ? 3 : 8);
  const weaknesses = a.weaknesses.slice(0, executive ? 3 : 8);

  drawH2(ctx, "Fortalezas principales");
  if (!strengths.length) drawParagraph(ctx, "Sin fortalezas destacadas en este partido.", { color: C.slate, italic: true });
  else for (const s of strengths) renderInsightCard(ctx, s, "good");

  spacer(ctx, 3);
  drawH2(ctx, "Debilidades principales");
  if (!weaknesses.length) drawParagraph(ctx, "Sin debilidades destacadas en este partido.", { color: C.slate, italic: true });
  else for (const w of weaknesses) renderInsightCard(ctx, w, "bad", (w as WeaknessCard).consequence);
}

function renderInsightCard(ctx: RenderCtx, card: StrengthCard, tone: "good" | "bad", consequence?: string) {
  const tint = tone === "good" ? C.good : C.bad;
  const doc = ctx.doc;
  const metrics = (card.evidence?.metrics ?? []).map((m) => `${m.label}: ${m.value}`);
  const metricsLine = metrics.length ? metrics.join("   ·   ") : "";
  const w = contentW(ctx);
  // Alturas dinámicas
  const conclusion = fmtText(card.conclusion);
  const consLine = consequence ? "Consecuencia: " + fmtText(consequence) : "";
  const wrapW = w - 12;
  const concLines: string[] = doc.splitTextToSize(conclusion, wrapW);
  const consLines: string[] = consequence ? doc.splitTextToSize(consLine, wrapW) : [];
  const bodyLines = Math.min(concLines.length, 4) + (consLines.length ? Math.min(consLines.length, 2) : 0);
  const h = 20 + (metricsLine ? 5 : 0) + bodyLines * 4.6 + 4;
  drawCard(ctx, h, (x, y, cw) => {
    // franja lateral de color
    fillRect(doc, x, y, 1.6, h, tint);
    // título
    setFont(doc, "bold", 11, C.ink);
    doc.text(fmtText(card.title), x + 6, y + 7);
    // pills
    let px = x + cw - 4;
    const impPill = importanceLabel(card.importance);
    const confPill = isNum(card.confidence) ? `Conf. ${Math.round(card.confidence)}%` : null;
    if (confPill) { const wpx = doc.getTextWidth(confPill) + 6; px -= wpx; drawPill(doc, px, y + 7, confPill, C.slate); px -= 3; }
    { const wpx = doc.getTextWidth(impPill) + 6; px -= wpx; drawPill(doc, px, y + 7, impPill, tint); }
    // categoría
    setFont(doc, "normal", 8.5, C.mute);
    doc.text(fmtText(card.category), x + 6, y + 12);
    // métricas
    let cy = y + 17;
    if (metricsLine) {
      setFont(doc, "normal", 9, C.slate);
      const ml: string[] = doc.splitTextToSize(metricsLine, wrapW);
      doc.text(ml.slice(0, 1), x + 6, cy);
      cy += 5;
    }
    // conclusión
    setFont(doc, "normal", 9.5, C.ink);
    for (const l of concLines.slice(0, 4)) { doc.text(l, x + 6, cy); cy += 4.6; }
    // consecuencia
    if (consLines.length) {
      setFont(doc, "bold", 9, C.bad);
      for (const l of consLines.slice(0, 2)) { doc.text(l, x + 6, cy); cy += 4.6; }
    }
  }, 5);
}

function renderAwards(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "MVP y jugadoras destacadas");
  const A = a.dashboard.awards;
  const rows: [string, string, string][] = [];
  const push = (k: string, v?: { name: string; detail: string }) => { if (v) rows.push([k, fmtText(v.name), fmtText(v.detail)]); };
  push("MVP", A.mvp);
  push("Mejor atacante", A.bestAttacker);
  push("Mejor receptora", A.bestReceiver);
  push("Mejor sacadora", A.bestServer);
  push("Más eficiente", A.mostEfficient);
  if (!rows.length) { drawParagraph(ctx, "Sin premios asignables por falta de volumen de datos.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Premio", "Jugadora", "Detalle"]],
    body: rows,
    styles: { fontSize: 9.5, cellPadding: 2.8, textColor: C.ink, lineColor: C.hair, lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" }, 1: { cellWidth: 55 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderPriorities(ctx: RenderCtx, a: MatchAnalysis, limit: number) {
  drawH1(ctx, "Prioridades para el próximo entrenamiento");
  const p = a.priorities.slice(0, limit);
  if (!p.length) { drawParagraph(ctx, "Sin prioridades urgentes detectadas.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["#", "Prioridad", "Nivel", "Razón"]],
    body: p.map((x, i) => [String(i + 1), fmtText(x.title), importanceLabel(x.level), fmtText(x.reason)]),
    styles: { fontSize: 9.5, cellPadding: 2.8, valign: "top", textColor: C.ink, lineColor: C.hair, lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 0: { cellWidth: 9, halign: "center", fontStyle: "bold" }, 1: { cellWidth: 55 }, 2: { cellWidth: 24 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderConclusion(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Conclusión final");
  const d = a.dashboard;
  const doc = ctx.doc;
  const w = contentW(ctx);
  const text =
    fmtText(a.coachInsights.whyResult) + "\n\n" +
    "Fortaleza clave: " + fmtText(d.topStrength) + "\n" +
    "Foco de mejora: " + fmtText(d.topWeakness) + "\n\n" +
    "Fundamento decisivo: " + fmtText(a.coachInsights.fundamentalDrivingResult);
  const wrapped: string[] = doc.splitTextToSize(text, w - 14);
  const h = 20 + wrapped.length * 4.6;
  drawCard(ctx, h, (x, y) => {
    fillRect(doc, x, y, 1.6, h, C.navy);
    setFont(doc, "bold", 11.5, C.ink);
    doc.text(`Resultado: ${fmtText(d.result?.toUpperCase())}  ·  ${fmtScoreline(d.scoreline)}`, x + 6, y + 8);
    setFont(doc, "normal", 10, C.ink);
    let ly = y + 14;
    for (const l of wrapped) { doc.text(l, x + 6, ly); ly += 4.6; }
  }, 4);
}

// ---------------- Análisis por fundamento ----------------
function renderFundamentalChapters(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Análisis por fundamento");
  drawParagraph(ctx, "Un capítulo por fundamento con score, estado, impacto en el resultado y evidencia estadística.", { color: C.slate, size: 9.5 });
  for (const item of a.rallyIndex.breakdown) {
    const detailLines: string[] = ctx.doc.splitTextToSize(fmtText(item.detail), contentW(ctx) - 60);
    const h = 34 + Math.max(0, detailLines.length - 2) * 4.4;
    drawCard(ctx, h, (x, y, w) => {
      // Columna izquierda: score tile
      const tw = 46;
      fillRect(ctx.doc, x + 1, y + 1, tw, h - 2, C.paper, 2.5);
      setFont(ctx.doc, "bold", 8, C.mute);
      ctx.doc.text("SCORE", x + tw / 2 + 1, y + 6.5, { align: "center" });
      setFont(ctx.doc, "bold", 22, statusColor(item.score));
      ctx.doc.text(fmtInt(item.score), x + tw / 2 + 1, y + 19, { align: "center" });
      hairline(ctx.doc, x + tw / 2 - 7, y + 22, x + tw / 2 + 9, y + 22, C.hair, 0.4);
      setFont(ctx.doc, "bold", 9, C.ink);
      ctx.doc.text(statusLabel(item.status), x + tw / 2 + 1, y + 27, { align: "center" });
      setFont(ctx.doc, "normal", 7.5, C.mute);
      ctx.doc.text("de 100", x + tw / 2 + 1, y + 31, { align: "center" });

      // Columna derecha: título + detalle + meta + barra
      const rx = x + tw + 8;
      const rw = w - tw - 12;
      setFont(ctx.doc, "bold", 12, C.ink);
      ctx.doc.text(fmtText(item.label), rx, y + 8);
      setFont(ctx.doc, "normal", 9.5, C.ink);
      let ly = y + 14;
      for (const l of detailLines.slice(0, 4)) { ctx.doc.text(l, rx, ly); ly += 4.4; }
      // meta pills
      const parts: [string, RGB][] = [
        [`Impacto ${fmtPct(item.impact)}`, C.navy],
        [`Confianza ${fmtPct(item.confidence)}`, C.slate],
        [`Δ Temp. ${fmtDelta(item.seasonDelta)}`, isNum(item.seasonDelta) && item.seasonDelta < 0 ? C.bad : C.good],
      ];
      let px = rx;
      for (const [t, col] of parts) { const pw = drawPill(ctx.doc, px, y + h - 6, t, col); px += pw + 3; }
      // barra
      drawBar(ctx.doc, rx, y + h - 12, rw, 2.2, item.score, statusColor(item.score));
    }, 4);
  }
}

function renderSeasonComparison(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Comparación con temporada");
  const rows = a.comparison.rows;
  if (!rows.length) { drawParagraph(ctx, "Sin datos históricos suficientes para comparar.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Métrica", "Este partido", fmtText(a.comparison.label), "Δ", "Tendencia"]],
    body: rows.map((r) => [
      fmtText(r.metric), fmtInt(r.current), fmtInt(r.reference),
      fmtDelta(r.delta),
      r.trend === "up" ? "↑" : r.trend === "down" ? "↓" : "=",
    ]),
    styles: { fontSize: 9.5, cellPadding: 2.6, textColor: C.ink, lineColor: C.hair, lineWidth: 0.15 },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "center", cellWidth: 22 } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderZones(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Distribución del ataque por zona");
  if (!a.attackZones.length) { drawParagraph(ctx, "Sin datos de ataque por zona.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Zona", "% Uso", "Ataques", "Puntos", "Errores", "Eficacia"]],
    body: a.attackZones.map((z) => [fmtText(z.label), fmtPct(z.pct), fmtInt(z.count), fmtInt(z.points), fmtInt(z.errors), fmtPct(z.eff)]),
    styles: { fontSize: 9.5, cellPadding: 2.6, textColor: C.ink, lineColor: C.hair, lineWidth: 0.15 },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderPlayerAnalysis(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Análisis individual de jugadoras");
  if (!a.playerRadar.length) { drawParagraph(ctx, "Sin datos individuales suficientes.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Jugadora", "Ataque", "Bloqueo", "Ace", "Recepción", "Disciplina"]],
    body: a.playerRadar.map((p) => [fmtText(p.name), fmtInt(p.attack), fmtInt(p.block), fmtInt(p.ace), fmtInt(p.reception), fmtInt(p.discipline)]),
    styles: { fontSize: 9.5, cellPadding: 2.6, textColor: C.ink, lineColor: C.hair, lineWidth: 0.15 },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 0: { cellWidth: 55 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderSetTrends(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Tendencias por set");
  if (!a.setTrends.length) { drawParagraph(ctx, "Sin sets registrados.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Set", "Marcador", "Ef. Ataque", "Ef. Recepción", "Err. Saque", "Err. Ataque"]],
    body: a.setTrends.map((s) => [
      fmtInt(s.setNumber), `${fmtInt(s.scoreFor)}–${fmtInt(s.scoreAgainst)}`,
      fmtPct(s.attackEff), fmtPct(s.receptionEff), fmtInt(s.serveErrors), fmtInt(s.attackErrors),
    ]),
    styles: { fontSize: 9.5, cellPadding: 2.6, textColor: C.ink, lineColor: C.hair, lineWidth: 0.15 },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 0: { cellWidth: 14, halign: "center" }, 1: { cellWidth: 26, halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderTimeline(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Timeline del partido");
  if (!a.timeline.length) { drawParagraph(ctx, "Sin eventos destacados.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Set", "Marcador", "Evento", "Detalle"]],
    body: a.timeline.map((t) => [fmtInt(t.setNumber), `${fmtInt(t.scoreFor)}–${fmtInt(t.scoreAgainst)}`, fmtText(t.title), fmtText(t.detail)]),
    styles: { fontSize: 9, cellPadding: 2.4, valign: "top", textColor: C.ink, lineColor: C.hair, lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: 22, halign: "center" }, 2: { cellWidth: 42, fontStyle: "bold" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderRotationBlock(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Análisis por rotación");
  const rot = [...a.strengths, ...a.weaknesses].filter((s) => s.category === "Rotación");
  if (!rot.length) { drawParagraph(ctx, "Sin rotaciones con desempeño destacado.", { color: C.slate, italic: true }); return; }
  for (const r of rot) {
    const isWeak = "consequence" in r;
    renderInsightCard(ctx, r, isWeak ? "bad" : "good", isWeak ? (r as WeaknessCard).consequence : undefined);
  }
}

function renderRisksPredictions(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Riesgos detectados");
  if (!a.risks.length) drawParagraph(ctx, "Sin riesgos destacados.", { color: C.slate, italic: true });
  else {
    ctx.autoTable({
      startY: ctx.y,
      head: [["Nivel", "Riesgo", "Detalle"]],
      body: a.risks.map((r) => [importanceLabel(r.level), fmtText(r.title), fmtText(r.detail)]),
      styles: { fontSize: 9.5, cellPadding: 2.6, valign: "top", textColor: C.ink, lineColor: C.hair, lineWidth: 0.15, overflow: "linebreak" },
      headStyles: { fillColor: C.bad, textColor: C.white, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: C.zebra },
      columnStyles: { 0: { cellWidth: 22, fontStyle: "bold" }, 1: { cellWidth: 55 } },
      theme: "grid",
      margin: { left: ctx.margin, right: ctx.margin },
    });
    ctx.y = (ctx.doc as any).lastAutoTable.finalY + 10;
  }

  // Separación clara antes del siguiente H1
  drawH1(ctx, "Predicciones");
  if (!a.predictions.length) drawParagraph(ctx, "Sin predicciones disponibles.", { color: C.slate, italic: true });
  else for (const p of a.predictions) drawParagraph(ctx, `•  ${fmtText(p.premise)} ${fmtText(p.outcome)}`);
}

function renderRecommendations(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Recomendaciones");
  if (!a.recommendations.length) { drawParagraph(ctx, "Sin recomendaciones.", { color: C.slate, italic: true }); return; }
  const label: Record<string, string> = { inmediata: "Inmediata", mediano_plazo: "Mediano plazo", estrategica: "Estratégica" };
  ctx.autoTable({
    startY: ctx.y,
    head: [["Horizonte", "Recomendación"]],
    body: a.recommendations.map((r) => [label[r.horizon] ?? r.horizon, fmtText(r.text)]),
    styles: { fontSize: 9.5, cellPadding: 2.8, valign: "top", textColor: C.ink, lineColor: C.hair, lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 0: { cellWidth: 32, fontStyle: "bold" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderTrainingPlan(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Plan de entrenamiento sugerido");
  const plan = a.trainingPlan;
  drawParagraph(ctx, `Duración total sugerida: ${isNum(plan.totalMinutes) ? plan.totalMinutes : "—"} minutos.`);
  if (!plan.blocks.length) { drawParagraph(ctx, "Sin bloques definidos.", { color: C.slate, italic: true }); return; }
  ctx.autoTable({
    startY: ctx.y,
    head: [["Min", "Foco", "Ejercicios", "Razón"]],
    body: plan.blocks.map((b) => [`${fmtInt(b.minutes)}'`, fmtText(b.focus), (b.drills || []).map(fmtText).join(" · "), fmtText(b.reason)]),
    styles: { fontSize: 9.5, cellPadding: 2.8, valign: "top", textColor: C.ink, lineColor: C.hair, lineWidth: 0.15, overflow: "linebreak" },
    headStyles: { fillColor: C.ink, textColor: C.white, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: C.zebra },
    columnStyles: { 0: { cellWidth: 14, halign: "right", fontStyle: "bold" }, 1: { cellWidth: 34, fontStyle: "bold" } },
    theme: "grid",
    margin: { left: ctx.margin, right: ctx.margin },
  });
  ctx.y = (ctx.doc as any).lastAutoTable.finalY + 8;
}

function renderCoachInsights(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Coach Insights");
  const ci = a.coachInsights;
  const blocks: [string, string][] = [
    ["Por qué el resultado", ci.whyResult],
    ["Decisión que funcionó", ci.keyDecisionThatWorked],
    ["Decisión a reconsiderar", ci.decisionToReconsider],
    ["Fundamento decisivo", ci.fundamentalDrivingResult],
  ];
  for (const [k, v] of blocks) {
    const text: string[] = ctx.doc.splitTextToSize(fmtText(v), contentW(ctx) - 12);
    const h = 14 + text.length * 4.6;
    drawCard(ctx, h, (x, y, w) => {
      fillRect(ctx.doc, x, y, 1.6, h, C.navy);
      setFont(ctx.doc, "bold", 10, C.ink);
      ctx.doc.text(k, x + 6, y + 7);
      setFont(ctx.doc, "normal", 10, C.ink);
      let ly = y + 12;
      for (const l of text) { ctx.doc.text(l, x + 6, ly); ly += 4.6; }
    }, 3);
  }
  if (a.coachQuestions.length) {
    drawH2(ctx, "Preguntas para el entrenador");
    for (const q of a.coachQuestions) drawParagraph(ctx, `•  ${fmtText(q)}`);
  }
}

// ---------------- Resumen visual (página hero para "full") ----------------
function renderVisualSummary(ctx: RenderCtx, a: MatchAnalysis, summaryMd?: string) {
  pageBreak(ctx);
  drawEyebrow(ctx, "Página resumen");
  setFont(ctx.doc, "bold", 22, C.navy);
  ctx.doc.text("Resumen Ejecutivo", ctx.margin, ctx.y + 3);
  ctx.y += 10;
  hairline(ctx.doc, ctx.margin, ctx.y, ctx.margin + 40, ctx.y, C.navy, 0.6);
  ctx.y += 8;
  ctx.toc.push({ title: "Resumen Ejecutivo (hero)", page: ctx.(doc as any).internal.getCurrentPageInfo().pageNumber, level: 1 });

  const d = a.dashboard;
  const w = contentW(ctx);
  const doc = ctx.doc;

  // Fila 1: Índice + Awards
  const rowH = 44;
  drawBlock(ctx, rowH, 5, (x, y) => {
    const halfW = (w - 4) / 2;
    // Tile Índice
    fillRect(doc, x, y, halfW, rowH, C.paper, 3);
    strokeRect(doc, x, y, halfW, rowH, C.hair, 3, 0.25);
    setFont(doc, "bold", 8, C.mute);
    doc.text("ÍNDICE RALLY", x + halfW / 2, y + 7, { align: "center" });
    const idx = isNum(d.rallyIndex) ? Math.round(d.rallyIndex) : null;
    setFont(doc, "bold", 34, idx == null ? C.mute : statusColor(idx));
    doc.text(idx == null ? "—" : `${idx}`, x + halfW / 2, y + 26, { align: "center" });
    hairline(doc, x + halfW / 2 - 12, y + 29, x + halfW / 2 + 12, y + 29, C.hair, 0.5);
    setFont(doc, "bold", 10, C.ink);
    doc.text(idx == null ? "—" : statusLabel(rallyBand(idx)), x + halfW / 2, y + 35, { align: "center" });
    setFont(doc, "normal", 8, C.mute);
    doc.text("de 100 puntos posibles", x + halfW / 2, y + 40, { align: "center" });

    // Awards
    const ax = x + halfW + 4;
    fillRect(doc, ax, y, halfW, rowH, C.white, 3);
    strokeRect(doc, ax, y, halfW, rowH, C.hair, 3, 0.25);
    setFont(doc, "bold", 8, C.mute);
    doc.text("JUGADORAS DESTACADAS", ax + 5, y + 7);
    const awards: [string, string | undefined][] = [
      ["MVP", d.awards.mvp?.name],
      ["Mejor atacante", d.awards.bestAttacker?.name],
      ["Mejor receptora", d.awards.bestReceiver?.name],
      ["Más eficiente", d.awards.mostEfficient?.name],
    ];
    let ay = y + 13;
    for (const [k, v] of awards) {
      setFont(doc, "bold", 8.5, C.slate);
      doc.text(k.toUpperCase(), ax + 5, ay);
      setFont(doc, "normal", 10, C.ink);
      doc.text(doc.splitTextToSize(fmtText(v), halfW - 45)[0], ax + 32, ay);
      ay += 7;
    }
  });

  // Fila 2: Top 3 fortalezas / debilidades
  drawBlock(ctx, 62, 5, (x, y) => {
    const halfW = (w - 4) / 2;
    const drawSide = (bx: number, title: string, items: StrengthCard[], tint: RGB) => {
      fillRect(doc, bx, y, halfW, 62, C.white, 3);
      strokeRect(doc, bx, y, halfW, 62, C.hair, 3, 0.25);
      fillRect(doc, bx, y, 1.6, 62, tint);
      setFont(doc, "bold", 10.5, C.ink);
      doc.text(title, bx + 6, y + 8);
      let ly = y + 14;
      const top = items.slice(0, 3);
      if (!top.length) {
        setFont(doc, "italic", 9, C.slate);
        doc.text("Sin datos suficientes.", bx + 6, ly);
        return;
      }
      for (let i = 0; i < top.length; i++) {
        const it = top[i];
        setFont(doc, "bold", 9, tint);
        doc.text(`${i + 1}.`, bx + 6, ly);
        setFont(doc, "bold", 9.5, C.ink);
        doc.text(doc.splitTextToSize(fmtText(it.title), halfW - 16)[0], bx + 11, ly);
        setFont(doc, "normal", 8.5, C.slate);
        const conc: string[] = doc.splitTextToSize(fmtText(it.conclusion), halfW - 12);
        doc.text(conc.slice(0, 2), bx + 11, ly + 4);
        ly += 15;
      }
    };
    drawSide(x, "TOP 3 FORTALEZAS", a.strengths, C.good);
    drawSide(x + halfW + 4, "TOP 3 DEBILIDADES", a.weaknesses, C.bad);
  });

  // Fila 3: Prioridades
  drawBlock(ctx, 42, 5, (x, y) => {
    fillRect(doc, x, y, w, 42, C.white, 3);
    strokeRect(doc, x, y, w, 42, C.hair, 3, 0.25);
    setFont(doc, "bold", 10.5, C.ink);
    doc.text("PRIORIDADES DE ENTRENAMIENTO", x + 6, y + 8);
    const pr = a.priorities.slice(0, 3);
    if (!pr.length) {
      setFont(doc, "italic", 9, C.slate);
      doc.text("Sin prioridades destacadas.", x + 6, y + 15);
      return;
    }
    let ly = y + 14;
    for (let i = 0; i < pr.length; i++) {
      const p = pr[i];
      setFont(doc, "bold", 9.5, C.navy);
      doc.text(`${i + 1}.`, x + 6, ly);
      setFont(doc, "bold", 9.5, C.ink);
      doc.text(doc.splitTextToSize(fmtText(p.title), w - 60)[0], x + 12, ly);
      const pillLabel = importanceLabel(p.level);
      const col = p.level === "muy_alta" ? C.bad : p.level === "alta" ? C.warn : C.slate;
      drawPill(doc, x + w - 6 - (doc.getTextWidth(pillLabel) + 6), ly, pillLabel, col);
      setFont(doc, "normal", 8.5, C.slate);
      doc.text(doc.splitTextToSize(fmtText(p.reason), w - 20).slice(0, 1)[0], x + 12, ly + 4.5);
      ly += 10;
    }
  });

  // Fila 4: Conclusión IA (resumen del analista)
  const text = (summaryMd && summaryMd.trim() && !summaryMd.trim().startsWith("_No")) ? summaryMd : a.analystSummary;
  const wrapped: string[] = doc.splitTextToSize(fmtText(text), w - 14);
  const h = 14 + Math.min(wrapped.length, 8) * 4.5;
  drawBlock(ctx, h, 4, (x, y) => {
    fillRect(doc, x, y, w, h, C.paper, 3);
    strokeRect(doc, x, y, w, h, C.hair, 3, 0.25);
    setFont(doc, "bold", 9, C.mute);
    doc.text("CONCLUSIÓN DEL ANALISTA", x + 6, y + 7);
    setFont(doc, "normal", 9.5, C.ink);
    let ly = y + 12;
    for (const l of wrapped.slice(0, 8)) { doc.text(l, x + 6, ly); ly += 4.5; }
  });
}

// ================================================================
// ENTRY POINT
// ================================================================
export async function downloadIntelligencePdf(
  analysis: MatchAnalysis,
  format: Format,
  summaryMd?: string,
  extras?: { coachName?: string; venue?: string; version?: string },
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;

  const now = new Date();
  const generatedAt = now.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });

  const ctx: RenderCtx = {
    doc, pageW, pageH, margin,
    gutter: 6,
    contentTop: 22,
    contentBottom: pageH - 18,
    y: 22,
    autoTable: (opts: any) => autoTable(doc, opts),
    meta: {
      teamName: fmtText(analysis.teamName),
      opponentName: fmtText(analysis.opponentName),
      date: fmtText(analysis.dashboard.date),
      competition: fmtText(analysis.dashboard.competition),
      format,
      version: extras?.version ?? "v1.0",
      generatedAt,
    },
    toc: [],
  };

  // 1) Portada
  renderCover(ctx, analysis, extras?.coachName, extras?.venue);

  if (format === "executive") {
    pageBreak(ctx);
    renderExecutiveSummary(ctx, analysis, summaryMd);
    renderRallyIndexSection(ctx, analysis, { full: false });
    renderStrengthsWeaknesses(ctx, analysis, true);
    renderAwards(ctx, analysis);
    renderPriorities(ctx, analysis, 3);
    renderConclusion(ctx, analysis);
  } else {
    // 2) Reservar página TOC
    doc.addPage();
    const tocPageNo = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // 3) Resumen visual (hero)
    renderVisualSummary(ctx, analysis, summaryMd);

    // 4) Cuerpo del informe
    pageBreak(ctx);
    renderDashboardBlock(ctx, analysis, extras?.coachName, extras?.venue);
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

    // 5) Rellenar TOC (paginación real)
    renderToc(ctx, tocPageNo);
  }

  // 6) Chrome (header/footer con "Página X de Y")
  const total = (doc as any).internal.getNumberOfPages();
  paintChrome(ctx, total);

  // 7) Metadatos del documento (impresión)
  doc.setProperties({
    title: `Rally Intelligence — ${ctx.meta.teamName} vs ${ctx.meta.opponentName}`,
    subject: format === "executive" ? "Informe Ejecutivo" : "Informe Técnico Completo",
    author: "Rally Intelligence",
    keywords: "voleibol, análisis, rendimiento, rally intelligence",
    creator: "Rally Intelligence",
  });

  const suffix = format === "executive" ? "ejecutivo" : "completo";
  const safe = `${ctx.meta.teamName}-vs-${ctx.meta.opponentName}-${suffix}`.replace(/[^\w-]+/g, "_");
  doc.save(`rally-intelligence-${safe}.pdf`);
}
