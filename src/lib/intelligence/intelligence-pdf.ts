// Rally Intelligence — Exportación editorial a PDF.
// Diseño A4 tipo publicación técnica (VolleyMetrics / Wyscout).
// Cada página tiene un propósito narrativo y responde 4 preguntas:
// ¿Qué pasó? ¿Por qué? ¿Qué consecuencia tuvo? ¿Qué entrenar?
// Preflight de validación antes del save.

import type {
  MatchAnalysis, RallyIndexItem, WeaknessCard, StrengthCard, Importance,
} from "./analysis";
import {
  CHAPTER_QUESTION, beatFundamental, beatRotation, beatPlayer,
  buildMatchStory, mapBlocksToWeek, interpretRally,
} from "./pdf/narrative";

type Format = "executive" | "full";
type RGB = [number, number, number];

interface TocEntry { title: string; page: number; level: 1 | 2 }

interface RenderCtx {
  doc: any;
  pageW: number;
  pageH: number;
  margin: number;
  gutter: number;
  contentTop: number;
  contentBottom: number;
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
  warnings: string[];
}

// ---------------- Paleta editorial ----------------
const C = {
  ink:   [17, 24, 39]      as RGB,
  navy:  [30, 58, 138]     as RGB,
  slate: [71, 85, 105]     as RGB,
  mute:  [148, 163, 184]   as RGB,
  hair:  [226, 232, 240]   as RGB,
  paper: [248, 250, 252]   as RGB,
  zebra: [244, 246, 249]   as RGB,
  good:  [22, 163, 74]     as RGB,
  goodSoft: [220, 252, 231] as RGB,
  warn:  [202, 138, 4]     as RGB,
  warnSoft: [254, 249, 195] as RGB,
  bad:   [220, 38, 38]     as RGB,
  badSoft: [254, 226, 226] as RGB,
  info:  [37, 99, 235]     as RGB,
  infoSoft: [219, 234, 254] as RGB,
  white: [255, 255, 255]   as RGB,
  courtA: [59, 130, 246]   as RGB, // franja lateral
};

// ---------------- Sanitizadores ----------------
const NA = "—";
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const clampPct = (n: number) => clamp(n, 0, 100);
const fmtInt = (n: unknown, suffix = "") => (isNum(n) ? `${Math.round(n)}${suffix}` : NA);
const fmtPct = (n: unknown) => (isNum(n) ? `${Math.round(clampPct(n))}%` : NA);
const fmtDelta = (n: unknown) => (isNum(n) ? `${n > 0 ? "+" : ""}${Math.round(n * 10) / 10}` : NA);
const fmtText = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : NA);
const fmtDuration = (min: unknown) => {
  if (!isNum(min) || min <= 0 || min > 300) return NA;
  return `${Math.round(min)} min`;
};
const fmtScoreline = (s: unknown) => {
  if (typeof s !== "string" || !s.trim()) return NA;
  if (/NaN|Infinity|undefined|null/i.test(s)) return NA;
  return s;
};

function statusColor(score: unknown): RGB {
  if (!isNum(score)) return C.mute;
  if (score >= 70) return C.good;
  if (score >= 50) return C.warn;
  return C.bad;
}
function statusSoft(score: unknown): RGB {
  if (!isNum(score)) return C.paper;
  if (score >= 70) return C.goodSoft;
  if (score >= 50) return C.warnSoft;
  return C.badSoft;
}
function statusLabel(s: string | undefined) {
  return ({ excellent: "Excelente", good: "Bueno", regular: "Regular", low: "Bajo", critical: "Crítico" } as Record<string, string>)[s ?? ""] ?? NA;
}
function importanceLabel(i: Importance | undefined) {
  return ({ muy_alta: "Muy alta", alta: "Alta", media: "Media", baja: "Baja" } as Record<string, string>)[i ?? ""] ?? NA;
}
function importanceColor(i: Importance | undefined): RGB {
  if (i === "muy_alta") return C.bad;
  if (i === "alta") return C.warn;
  if (i === "media") return C.info;
  return C.slate;
}
function rallyBand(n: number) {
  if (n >= 85) return "excellent";
  if (n >= 70) return "good";
  if (n >= 55) return "regular";
  if (n >= 40) return "low";
  return "critical";
}

// ---------------- Primitivas geométricas ----------------
function contentW(ctx: RenderCtx) { return ctx.pageW - ctx.margin * 2; }
function pageBreak(ctx: RenderCtx) { ctx.doc.addPage(); ctx.y = ctx.contentTop; }
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
function circle(doc: any, cx: number, cy: number, r: number, fill?: RGB, stroke?: RGB, weight = 0.3) {
  if (fill) doc.setFillColor(fill[0], fill[1], fill[2]);
  if (stroke) { doc.setDrawColor(stroke[0], stroke[1], stroke[2]); doc.setLineWidth(weight); }
  const mode = fill && stroke ? "FD" : fill ? "F" : "S";
  doc.circle(cx, cy, r, mode);
}
function textCenter(doc: any, t: string, x: number, y: number) { doc.text(t, x, y, { align: "center" }); }

// ---------------- Chart primitives ----------------

// Semicircle gauge 0-100 con color por banda.
function drawGauge(doc: any, cx: number, cy: number, radius: number, score: number | null, label?: string) {
  const outerR = radius;
  const innerR = radius * 0.68;
  // Track de fondo: 3 arcos coloreados
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const a0 = Math.PI + t0 * Math.PI;
    const a1 = Math.PI + t1 * Math.PI;
    const value = t0 * 100;
    const col = value >= 70 ? C.good : value >= 50 ? C.warn : C.bad;
    // Wedge poligonal fino
    const x0o = cx + outerR * Math.cos(a0), y0o = cy + outerR * Math.sin(a0);
    const x1o = cx + outerR * Math.cos(a1), y1o = cy + outerR * Math.sin(a1);
    const x0i = cx + innerR * Math.cos(a0), y0i = cy + innerR * Math.sin(a0);
    const x1i = cx + innerR * Math.cos(a1), y1i = cy + innerR * Math.sin(a1);
    doc.setFillColor(col[0], col[1], col[2]);
    // Poligono via triangle strip
    (doc as any).triangle(x0o, y0o, x1o, y1o, x0i, y0i, "F");
    (doc as any).triangle(x1o, y1o, x1i, y1i, x0i, y0i, "F");
  }
  // Máscara de opacidad reducida: overlay blanco parcial (simulado con paper zebra)
  // Aguja
  const val = isNum(score) ? clampPct(score) : 0;
  if (isNum(score)) {
    const ang = Math.PI + (val / 100) * Math.PI;
    const nx = cx + (outerR - 1) * Math.cos(ang);
    const ny = cy + (outerR - 1) * Math.sin(ang);
    doc.setDrawColor(C.ink[0], C.ink[1], C.ink[2]);
    doc.setLineWidth(1.2);
    doc.line(cx, cy, nx, ny);
    circle(doc, cx, cy, 1.6, C.ink);
  }
  // Base
  fillRect(doc, cx - outerR - 1, cy, (outerR + 1) * 2, 0.6, C.hair);
  // Valor
  setFont(doc, "bold", radius * 0.55, isNum(score) ? statusColor(score) : C.mute);
  textCenter(doc, isNum(score) ? String(Math.round(score)) : NA, cx, cy - radius * 0.05);
  setFont(doc, "normal", radius * 0.18, C.mute);
  textCenter(doc, "/ 100", cx, cy - radius * 0.05 + radius * 0.22);
  if (label) {
    setFont(doc, "bold", radius * 0.22, C.slate);
    textCenter(doc, label, cx, cy + radius * 0.45);
  }
}

// Radar chart hasta 8 ejes, hasta 3 series.
function drawRadar(
  doc: any, cx: number, cy: number, r: number,
  axes: string[],
  series: Array<{ label: string; values: number[]; color: RGB }>,
) {
  const n = axes.length;
  if (n < 3) return;
  // Rejilla
  const rings = 4;
  for (let ring = 1; ring <= rings; ring++) {
    const rr = (r * ring) / rings;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    doc.setDrawColor(C.hair[0], C.hair[1], C.hair[2]);
    doc.setLineWidth(0.15);
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % n];
      doc.line(x1, y1, x2, y2);
    }
  }
  // Ejes
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    hairline(doc, cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a), C.hair, 0.2);
  }
  // Series
  for (const s of series) {
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const v = isNum(s.values[i]) ? clampPct(s.values[i]) : 0;
      const rr = (r * v) / 100;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    doc.setDrawColor(s.color[0], s.color[1], s.color[2]);
    doc.setLineWidth(0.9);
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pts[i]; const [x2, y2] = pts[(i + 1) % n];
      doc.line(x1, y1, x2, y2);
    }
    for (const [px, py] of pts) circle(doc, px, py, 0.9, s.color);
  }
  // Etiquetas
  setFont(doc, "bold", 7.5, C.slate);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const lx = cx + (r + 5) * Math.cos(a);
    const ly = cy + (r + 5) * Math.sin(a) + 1;
    const align = Math.cos(a) > 0.3 ? "left" : Math.cos(a) < -0.3 ? "right" : "center";
    doc.text(axes[i], lx, ly, { align } as any);
  }
}

// Donut chart con segmentos etiquetados.
function drawDonut(
  doc: any, cx: number, cy: number, rOut: number, rIn: number,
  segments: Array<{ label: string; value: number; color: RGB }>,
) {
  const total = segments.reduce((a, s) => a + (isNum(s.value) ? Math.max(0, s.value) : 0), 0);
  if (total <= 0) {
    circle(doc, cx, cy, rOut, C.paper, C.hair, 0.3);
    setFont(doc, "italic", 8, C.mute);
    textCenter(doc, "Sin datos", cx, cy);
    return;
  }
  let a0 = -Math.PI / 2;
  const steps = 80;
  for (const s of segments) {
    const frac = Math.max(0, s.value) / total;
    if (frac <= 0) continue;
    const a1 = a0 + frac * 2 * Math.PI;
    const sub = Math.max(2, Math.round(steps * frac));
    doc.setFillColor(s.color[0], s.color[1], s.color[2]);
    for (let i = 0; i < sub; i++) {
      const t0 = a0 + (a1 - a0) * (i / sub);
      const t1 = a0 + (a1 - a0) * ((i + 1) / sub);
      const x0o = cx + rOut * Math.cos(t0), y0o = cy + rOut * Math.sin(t0);
      const x1o = cx + rOut * Math.cos(t1), y1o = cy + rOut * Math.sin(t1);
      const x0i = cx + rIn * Math.cos(t0), y0i = cy + rIn * Math.sin(t0);
      const x1i = cx + rIn * Math.cos(t1), y1i = cy + rIn * Math.sin(t1);
      (doc as any).triangle(x0o, y0o, x1o, y1o, x0i, y0i, "F");
      (doc as any).triangle(x1o, y1o, x1i, y1i, x0i, y0i, "F");
    }
    a0 = a1;
  }
  // Hueco central
  circle(doc, cx, cy, rIn - 0.1, C.white);
}

// Sparkline compacta.
function drawSparkline(
  doc: any, x: number, y: number, w: number, h: number,
  values: number[], color: RGB = C.info,
) {
  if (!values.length) return;
  const valid = values.filter(isNum);
  if (!valid.length) return;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 1;
  fillRect(doc, x, y, w, h, C.paper, 1);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.8);
  const step = w / Math.max(values.length - 1, 1);
  let prev: [number, number] | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = isNum(values[i]) ? values[i] : min;
    const px = x + i * step;
    const py = y + h - ((v - min) / range) * h;
    if (prev) doc.line(prev[0], prev[1], px, py);
    prev = [px, py];
  }
  if (prev) circle(doc, prev[0], prev[1], 1, color);
}

// Bullet chart horizontal (score + target opcional).
function drawBullet(
  doc: any, x: number, y: number, w: number, h: number,
  value: number | null, targetPct = 70, color: RGB = C.info,
) {
  fillRect(doc, x, y, w, h, C.zebra, h / 2);
  if (isNum(value)) {
    const v = clampPct(value);
    fillRect(doc, x, y, (v / 100) * w, h, color, h / 2);
  }
  // Marca objetivo
  const tx = x + (clampPct(targetPct) / 100) * w;
  doc.setDrawColor(C.ink[0], C.ink[1], C.ink[2]);
  doc.setLineWidth(0.8);
  doc.line(tx, y - 0.5, tx, y + h + 0.5);
}

// Barra horizontal simple.
function drawBar(doc: any, x: number, y: number, w: number, h: number, value: unknown, color: RGB) {
  const v = isNum(value) ? clampPct(value) : 0;
  fillRect(doc, x, y, w, h, C.zebra, h / 2);
  if (v > 0) fillRect(doc, x, y, (v / 100) * w, h, color, h / 2);
}

// Cancha de vóley (una mitad) con 6 zonas coloreadas por intensidad.
// zonas: array de 6 valores 0-100 (o null) en orden [1,2,3,4,5,6].
// Layout FIVB: fila delantera 4-3-2, fila zaga 5-6-1.
function drawCourt(
  doc: any, x: number, y: number, w: number, h: number,
  intensities: (number | null)[],
  labels?: string[],
  title?: string,
) {
  if (title) {
    setFont(doc, "bold", 8.5, C.slate);
    doc.text(title, x + w / 2, y - 1.5, { align: "center" });
  }
  // Marco cancha
  fillRect(doc, x, y, w, h, C.white);
  strokeRect(doc, x, y, w, h, C.slate, 0, 0.5);
  // Línea de 3m (a 1/3 desde arriba = zona delantera)
  const front = h / 3;
  hairline(doc, x, y + front, x + w, y + front, C.slate, 0.3);
  // 6 celdas: fila 0 (delantera) 4-3-2, fila 1 (zaga) 5-6-1
  const cellW = w / 3;
  const rows: number[][] = [[4, 3, 2], [5, 6, 1]];
  const rowH = [front, h - front];
  const yRow = [y, y + front];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const zone = rows[r][c];
      const idx = zone - 1;
      const val = intensities[idx];
      const cx = x + c * cellW;
      const cy = yRow[r];
      // Fill por intensidad (interpolación paper→color)
      if (isNum(val) && val > 0) {
        const alpha = clampPct(val) / 100;
        const base = val >= 70 ? C.good : val >= 40 ? C.warn : C.bad;
        // Simular alpha mezclando con paper
        const mix: RGB = [
          Math.round(C.paper[0] + (base[0] - C.paper[0]) * alpha),
          Math.round(C.paper[1] + (base[1] - C.paper[1]) * alpha),
          Math.round(C.paper[2] + (C.paper[2] - C.paper[2]) * 0 + (base[2] - C.paper[2]) * alpha),
        ];
        fillRect(doc, cx + 0.3, cy + 0.3, cellW - 0.6, rowH[r] - 0.6, mix);
      }
      // Borde suave
      strokeRect(doc, cx, cy, cellW, rowH[r], C.hair, 0, 0.15);
      // Zona label
      setFont(doc, "bold", 7, C.slate);
      doc.text(String(zone), cx + 2, cy + 4);
      // Valor
      if (isNum(val)) {
        setFont(doc, "bold", 10, C.ink);
        textCenter(doc, `${Math.round(val)}%`, cx + cellW / 2, cy + rowH[r] / 2 + 1);
      } else {
        setFont(doc, "italic", 7, C.mute);
        textCenter(doc, NA, cx + cellW / 2, cy + rowH[r] / 2 + 1);
      }
      if (labels && labels[idx]) {
        setFont(doc, "normal", 6, C.slate);
        textCenter(doc, labels[idx], cx + cellW / 2, cy + rowH[r] - 1.5);
      }
    }
  }
  // Red central (arriba)
  doc.setDrawColor(C.ink[0], C.ink[1], C.ink[2]);
  doc.setLineWidth(0.9);
  doc.line(x, y, x + w, y);
}

// Timeline visual: barra por set con eventos marcados.
function drawTimelineVis(
  doc: any, x: number, y: number, w: number, h: number,
  events: Array<{ setNumber: number; scoreFor: number; scoreAgainst: number; kind: string; title: string }>,
  sets: Array<{ setNumber: number; scoreFor: number; scoreAgainst: number }>,
) {
  if (!sets.length) {
    setFont(doc, "italic", 9, C.mute);
    doc.text("Sin eventos.", x, y + h / 2);
    return;
  }
  const setW = w / sets.length;
  for (let i = 0; i < sets.length; i++) {
    const sx = x + i * setW;
    fillRect(doc, sx + 1, y + 4, setW - 2, h - 12, C.paper, 2);
    strokeRect(doc, sx + 1, y + 4, setW - 2, h - 12, C.hair, 2, 0.2);
    setFont(doc, "bold", 8, C.slate);
    textCenter(doc, `SET ${sets[i].setNumber}`, sx + setW / 2, y + 2);
    setFont(doc, "bold", 10, sets[i].scoreFor > sets[i].scoreAgainst ? C.good : C.bad);
    textCenter(doc, `${sets[i].scoreFor}-${sets[i].scoreAgainst}`, sx + setW / 2, y + h - 3);

    // Marcadores dentro del set
    const setEvts = events.filter((e) => e.setNumber === sets[i].setNumber);
    const maxScore = Math.max(sets[i].scoreFor, sets[i].scoreAgainst, 1);
    for (const e of setEvts) {
      const total = Math.max(e.scoreFor + e.scoreAgainst, 1);
      const pos = total / (maxScore * 2);
      const my = y + 5 + pos * (h - 14);
      const col = e.kind === "run" || e.kind === "peak" ? C.good
        : e.kind === "opp_run" || e.kind === "drop" ? C.bad
        : e.kind === "timeout" ? C.warn : C.info;
      circle(doc, sx + setW / 2, my, 1.4, col);
    }
  }
  // Leyenda
  const legend: Array<[string, RGB]> = [
    ["Racha +", C.good], ["Racha −", C.bad], ["Timeout", C.warn], ["Otro", C.info],
  ];
  let lx = x;
  const ly = y + h + 5;
  setFont(doc, "normal", 7.5, C.slate);
  for (const [t, col] of legend) {
    circle(doc, lx + 1.5, ly - 1, 1.2, col);
    doc.text(t, lx + 4, ly);
    lx += doc.getTextWidth(t) + 10;
  }
}

// Matriz de riesgo 2D: impacto (Y) vs probabilidad (X).
function drawRiskMatrix(
  doc: any, x: number, y: number, w: number, h: number,
  items: Array<{ title: string; level: Importance }>,
) {
  // Cuadrantes
  const bands: [RGB, RGB, RGB, RGB] = [C.goodSoft, C.warnSoft, C.warnSoft, C.badSoft];
  const cw = w / 2, ch = h / 2;
  fillRect(doc, x, y + ch, cw, ch, bands[0]);         // bajo-bajo
  fillRect(doc, x + cw, y + ch, cw, ch, bands[1]);    // alto prob / bajo impacto
  fillRect(doc, x, y, cw, ch, bands[2]);              // bajo prob / alto impacto
  fillRect(doc, x + cw, y, cw, ch, bands[3]);         // alto-alto
  strokeRect(doc, x, y, w, h, C.hair, 0, 0.3);
  hairline(doc, x + cw, y, x + cw, y + h, C.hair, 0.3);
  hairline(doc, x, y + ch, x + w, y + ch, C.hair, 0.3);
  // Ejes
  setFont(doc, "bold", 7.5, C.slate);
  doc.text("PROBABILIDAD →", x + w / 2, y + h + 5, { align: "center" });
  doc.saveGraphicsState?.();
  doc.text("← IMPACTO", x - 4, y + h / 2, { align: "center", angle: 90 } as any);
  doc.restoreGraphicsState?.();
  // Items
  for (const it of items) {
    const impact = it.level === "muy_alta" ? 0.85 : it.level === "alta" ? 0.65 : it.level === "media" ? 0.4 : 0.2;
    const prob = it.level === "muy_alta" ? 0.75 : it.level === "alta" ? 0.6 : it.level === "media" ? 0.4 : 0.25;
    const px = x + prob * w + (Math.random() - 0.5) * 4;
    const py = y + (1 - impact) * h + (Math.random() - 0.5) * 4;
    circle(doc, px, py, 2, importanceColor(it.level));
    setFont(doc, "normal", 6.5, C.ink);
    doc.text(doc.splitTextToSize(fmtText(it.title), 32)[0], px + 3, py + 1);
  }
}

// ---------------- Bloques tipográficos ----------------
function drawH1(ctx: RenderCtx, title: string, question?: string) {
  // Cada capítulo abre en una página nueva
  if (ctx.y > ctx.contentTop + 1) pageBreak(ctx);
  ctx.toc.push({ title, page: (ctx.doc as any).internal.getCurrentPageInfo().pageNumber, level: 1 });
  setFont(ctx.doc, "bold", 8.5, C.mute);
  ctx.doc.text("CAPÍTULO", ctx.margin, ctx.y);
  ctx.y += 5;
  setFont(ctx.doc, "bold", 22, C.navy);
  ctx.doc.text(title, ctx.margin, ctx.y);
  ctx.y += 4;
  hairline(ctx.doc, ctx.margin, ctx.y, ctx.margin + 50, ctx.y, C.navy, 0.9);
  ctx.y += 6;
  if (question) {
    setFont(ctx.doc, "italic", 10.5, C.slate);
    const lines: string[] = ctx.doc.splitTextToSize(question, contentW(ctx));
    for (const l of lines) { ctx.doc.text(l, ctx.margin, ctx.y); ctx.y += 5; }
    ctx.y += 2;
  } else {
    ctx.y += 4;
  }
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
function drawBlock(ctx: RenderCtx, height: number, gapAfter: number, render: (x: number, y: number, w: number) => void) {
  ensureSpace(ctx, height + gapAfter);
  render(ctx.margin, ctx.y, contentW(ctx));
  ctx.y += height + gapAfter;
}
function drawCard(ctx: RenderCtx, height: number, render: (x: number, y: number, w: number) => void, gapAfter = 4) {
  drawBlock(ctx, height, gapAfter, (x, y, w) => {
    fillRect(ctx.doc, x, y, w, height, C.white);
    strokeRect(ctx.doc, x, y, w, height, C.hair, 3, 0.25);
    render(x, y, w);
  });
}
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
    if (i === 1) continue;
    setFont(doc, "bold", 8.5, C.navy);
    doc.text("RALLY INTELLIGENCE", margin, 11);
    setFont(doc, "normal", 8.5, C.slate);
    const mid = `${ctx.meta.teamName}  vs  ${ctx.meta.opponentName}`;
    doc.text(mid, pageW / 2, 11, { align: "center" });
    doc.text(ctx.meta.format === "executive" ? "Informe Ejecutivo" : "Informe Técnico", pageW - margin, 11, { align: "right" });
    hairline(doc, margin, 13.5, pageW - margin, 13.5);
    hairline(doc, margin, pageH - 14, pageW - margin, pageH - 14);
    setFont(doc, "normal", 8, C.mute);
    doc.text(`Rally Intelligence  ·  ${ctx.meta.generatedAt}  ·  ${ctx.meta.version}`, margin, pageH - 9);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 9, { align: "right" });
  }
}

// ================================================================
// PORTADA
// ================================================================
function renderCover(ctx: RenderCtx, a: MatchAnalysis, coachName?: string, venue?: string) {
  const { doc, pageW, pageH, margin } = ctx;

  // Fondo hero superior editorial
  fillRect(doc, 0, 0, pageW, 96, C.ink);
  // Franja de acento
  fillRect(doc, 0, 96, pageW, 3, C.navy);

  // Marca
  setFont(doc, "bold", 10, C.white);
  doc.text("RALLY", margin, 18);
  setFont(doc, "normal", 10, [200, 210, 225]);
  doc.text("  INTELLIGENCE", margin + doc.getTextWidth("RALLY"), 18);

  // Subtítulo formato
  setFont(doc, "normal", 8.5, [180, 195, 220]);
  doc.text(ctx.meta.format === "executive" ? "INFORME EJECUTIVO" : "INFORME TÉCNICO COMPLETO", margin, 25);

  // Título editorial: equipo vs rival
  setFont(doc, "bold", 30, C.white);
  const titleLines: string[] = doc.splitTextToSize(fmtText(a.teamName), pageW - margin * 2);
  doc.text(titleLines[0], margin, 52);
  setFont(doc, "normal", 14, [200, 210, 225]);
  doc.text("vs", margin, 63);
  setFont(doc, "bold", 22, C.white);
  const oppLines: string[] = doc.splitTextToSize(fmtText(a.opponentName), pageW - margin * 2 - 12);
  doc.text(oppLines[0], margin + 10, 63);

  // Fecha + competencia en línea de subtítulo
  const d = a.dashboard;
  setFont(doc, "normal", 10, [190, 205, 225]);
  const meta1 = [fmtText(d.date), fmtText(d.competition)].filter((s) => s !== NA).join("  ·  ");
  if (meta1) doc.text(meta1, margin, 78);
  if (venue) {
    setFont(doc, "italic", 9, [170, 190, 215]);
    doc.text(fmtText(venue), margin, 86);
  }

  // ---- Bloque central: Resultado + Índice Rally ----
  const scoreLine = fmtScoreline(d.scoreline);
  const setsOnly = scoreLine !== NA ? scoreLine.split(" ")[0] : NA;
  const idx = isNum(d.rallyIndex) ? Math.round(d.rallyIndex) : null;

  // Columna izquierda: resultado
  setFont(doc, "normal", 9, C.mute);
  doc.text("RESULTADO FINAL", margin, 122);
  setFont(doc, "bold", 60, C.ink);
  doc.text(setsOnly, margin, 158);
  setFont(doc, "bold", 12, d.result === "victoria" ? C.good : d.result === "derrota" ? C.bad : C.slate);
  doc.text((d.result || NA).toUpperCase(), margin, 168);
  if (scoreLine !== NA && scoreLine.includes("(")) {
    setFont(doc, "normal", 9.5, C.slate);
    const detail = scoreLine.substring(scoreLine.indexOf("("));
    doc.text(detail, margin, 176);
  }
  setFont(doc, "italic", 9, C.mute);
  doc.text(fmtDuration(d.durationMin), margin, 184);

  // Columna derecha: Gauge Rally
  const gaugeCX = pageW - margin - 40;
  drawGauge(doc, gaugeCX, 156, 32, idx, "ÍNDICE RALLY");
  setFont(doc, "normal", 8.5, C.slate);
  const level = idx == null ? NA : statusLabel(rallyBand(idx));
  textCenter(doc, level.toUpperCase(), gaugeCX, 194);

  // ---- Bloque MVP editorial ----
  const mvpY = 208;
  fillRect(doc, margin, mvpY, pageW - margin * 2, 32, C.paper, 4);
  fillRect(doc, margin, mvpY, 2, 32, C.navy);
  const mvp = d.awards.mvp;
  setFont(doc, "bold", 8, C.mute);
  doc.text("★  JUGADOR MÁS VALIOSO", margin + 8, mvpY + 8);
  setFont(doc, "bold", 18, C.ink);
  doc.text(fmtText(mvp?.name), margin + 8, mvpY + 20);
  if (mvp?.number != null) {
    setFont(doc, "bold", 11, C.navy);
    doc.text(`#${mvp.number}`, margin + 8, mvpY + 27);
  }
  setFont(doc, "normal", 9, C.slate);
  doc.text(fmtText(mvp?.detail), margin + 40, mvpY + 27);

  // ---- Meta editorial minimalista (sin tabla) ----
  const metaY = 254;
  setFont(doc, "bold", 8, C.mute);
  const items: Array<[string, string]> = [
    ["ENTRENADOR", fmtText(coachName)],
    ["CATEGORÍA", fmtText(d.competition)],
    ["DURACIÓN", fmtDuration(d.durationMin)],
    ["FORMATO", ctx.meta.format === "executive" ? "Ejecutivo" : "Técnico completo"],
  ];
  const cw = (pageW - margin * 2) / items.length;
  for (let i = 0; i < items.length; i++) {
    const cx = margin + i * cw;
    setFont(doc, "bold", 7.5, C.mute);
    doc.text(items[i][0], cx, metaY);
    setFont(doc, "normal", 10, C.ink);
    doc.text(doc.splitTextToSize(items[i][1], cw - 4)[0], cx, metaY + 6);
  }

  // Firma inferior
  hairline(doc, margin, pageH - 22, pageW - margin, pageH - 22);
  setFont(doc, "italic", 8, C.mute);
  doc.text(
    "Informe generado por Rally Intelligence. Datos derivados exclusivamente de eventos registrados en tiempo real.",
    margin, pageH - 15,
  );
  setFont(doc, "normal", 8, C.slate);
  doc.text(ctx.meta.generatedAt, margin, pageH - 9);
  doc.text(ctx.meta.version, pageW - margin, pageH - 9, { align: "right" });
}

// ================================================================
// TOC
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
// DASHBOARD EJECUTIVO — solo tarjetas grandes, sin tablas
// ================================================================
function renderDashboardBlock(ctx: RenderCtx, a: MatchAnalysis, _coach?: string, _venue?: string) {
  drawH1(ctx, "Dashboard ejecutivo", CHAPTER_QUESTION.dashboard);
  const d = a.dashboard;
  const doc = ctx.doc;
  const w = contentW(ctx);
  const idx = isNum(d.rallyIndex) ? Math.round(d.rallyIndex) : null;

  // Fila 1: Gauge Rally (izq) + Resultado + MVP
  drawBlock(ctx, 62, 5, (x, y) => {
    const w1 = 68, w3 = (w - w1 - 8) / 2;
    // Card Rally con gauge
    fillRect(doc, x, y, w1, 62, C.paper, 3);
    strokeRect(doc, x, y, w1, 62, C.hair, 3, 0.25);
    drawGauge(doc, x + w1 / 2, y + 38, 22, idx, "ÍNDICE RALLY");
    setFont(doc, "bold", 8, C.mute);
    textCenter(doc, idx == null ? NA : statusLabel(rallyBand(idx)).toUpperCase(), x + w1 / 2, y + 58);

    // Card Resultado
    const rx = x + w1 + 4;
    fillRect(doc, rx, y, w3, 62, C.white, 3);
    strokeRect(doc, rx, y, w3, 62, C.hair, 3, 0.25);
    setFont(doc, "bold", 8, C.mute);
    doc.text("RESULTADO", rx + 5, y + 8);
    const scoreLine = fmtScoreline(d.scoreline);
    const setsOnly = scoreLine !== NA ? scoreLine.split(" ")[0] : NA;
    setFont(doc, "bold", 28, C.ink);
    textCenter(doc, setsOnly, rx + w3 / 2, y + 30);
    setFont(doc, "bold", 11, d.result === "victoria" ? C.good : d.result === "derrota" ? C.bad : C.slate);
    textCenter(doc, (d.result || NA).toUpperCase(), rx + w3 / 2, y + 40);
    setFont(doc, "normal", 8, C.slate);
    textCenter(doc, fmtDuration(d.durationMin), rx + w3 / 2, y + 52);

    // Card MVP
    const mx = rx + w3 + 4;
    fillRect(doc, mx, y, w3, 62, C.white, 3);
    strokeRect(doc, mx, y, w3, 62, C.hair, 3, 0.25);
    fillRect(doc, mx, y, w3, 12, C.navy, 3);
    setFont(doc, "bold", 8, C.white);
    doc.text("★ MVP DEL PARTIDO", mx + 5, y + 8);
    const mvp = d.awards.mvp;
    setFont(doc, "bold", 14, C.ink);
    doc.text(doc.splitTextToSize(fmtText(mvp?.name), w3 - 10)[0], mx + 5, y + 24);
    if (mvp?.number != null) {
      setFont(doc, "bold", 9, C.navy);
      doc.text(`#${mvp.number}`, mx + 5, y + 30);
    }
    setFont(doc, "normal", 8.5, C.slate);
    const det: string[] = doc.splitTextToSize(fmtText(mvp?.detail), w3 - 10);
    let dy = y + 38;
    for (const l of det.slice(0, 3)) { doc.text(l, mx + 5, dy); dy += 4.2; }
  });

  // Fila 2: Fortaleza / Debilidad / Confianza
  drawBlock(ctx, 34, 5, (x, y) => {
    const cw = (w - 8) / 3;
    const cards: Array<{ title: string; value: string; icon: string; color: RGB; soft: RGB }> = [
      { title: "FORTALEZA PRINCIPAL", value: fmtText(d.topStrength), icon: "▲", color: C.good, soft: C.goodSoft },
      { title: "PRINCIPAL DEBILIDAD", value: fmtText(d.topWeakness), icon: "▼", color: C.bad, soft: C.badSoft },
      { title: "CONFIANZA DEL ANÁLISIS", value: fmtPct(avgConfidence(a)), icon: "◆", color: C.info, soft: C.infoSoft },
    ];
    for (let i = 0; i < cards.length; i++) {
      const cx = x + i * (cw + 4);
      fillRect(doc, cx, y, cw, 34, C.white, 3);
      strokeRect(doc, cx, y, cw, 34, C.hair, 3, 0.25);
      fillRect(doc, cx, y, 1.6, 34, cards[i].color);
      setFont(doc, "bold", 14, cards[i].color);
      doc.text(cards[i].icon, cx + 5, y + 10);
      setFont(doc, "bold", 7.5, C.mute);
      doc.text(cards[i].title, cx + 14, y + 8);
      setFont(doc, "bold", 11, C.ink);
      const lines: string[] = doc.splitTextToSize(cards[i].value, cw - 18);
      let ly = y + 15;
      for (const l of lines.slice(0, 3)) { doc.text(l, cx + 14, ly); ly += 4.4; }
    }
  });

  // Fila 3: Probabilidad de victoria + Indicador general
  const winProb = winProbability(a);
  drawBlock(ctx, 30, 5, (x, y) => {
    const cw = (w - 4) / 2;
    // Prob de victoria (barra grande)
    fillRect(doc, x, y, cw, 30, C.white, 3);
    strokeRect(doc, x, y, cw, 30, C.hair, 3, 0.25);
    setFont(doc, "bold", 8, C.mute);
    doc.text("PROBABILIDAD DE VICTORIA (ESTIMADA)", x + 5, y + 7);
    setFont(doc, "bold", 20, statusColor(winProb));
    doc.text(fmtPct(winProb), x + 5, y + 18);
    drawBar(doc, x + 5, y + 22, cw - 10, 3.5, winProb, statusColor(winProb));

    // Indicador general
    const gx = x + cw + 4;
    fillRect(doc, gx, y, cw, 30, C.white, 3);
    strokeRect(doc, gx, y, cw, 30, C.hair, 3, 0.25);
    setFont(doc, "bold", 8, C.mute);
    doc.text("INDICADOR GENERAL DE RENDIMIENTO", gx + 5, y + 7);
    const level = idx == null ? NA : statusLabel(rallyBand(idx));
    setFont(doc, "bold", 16, idx == null ? C.mute : statusColor(idx));
    doc.text(level, gx + 5, y + 18);
    drawBar(doc, gx + 5, y + 22, cw - 10, 3.5, idx, idx == null ? C.mute : statusColor(idx));
  });
}

function avgConfidence(a: MatchAnalysis): number | null {
  const vals = a.rallyIndex.breakdown.map((b) => b.confidence).filter(isNum);
  if (!vals.length) return null;
  return vals.reduce((x, y) => x + y, 0) / vals.length;
}
function winProbability(a: MatchAnalysis): number | null {
  const r = a.dashboard.rallyIndex;
  if (!isNum(r)) return null;
  // Sigmoide simple centrada en 55
  const p = 100 / (1 + Math.exp(-(r - 55) / 8));
  return clampPct(p);
}

// ================================================================
// ÍNDICE RALLY EN PROFUNDIDAD
// ================================================================
function renderRallyIndexSection(ctx: RenderCtx, a: MatchAnalysis, opts: { full: boolean }) {
  drawH1(ctx, "Índice Rally", CHAPTER_QUESTION.rally);
  const { overall, breakdown } = a.rallyIndex;
  const idx = isNum(overall) ? Math.round(overall) : null;

  // Card hero: gauge XL + donut de impacto
  drawCard(ctx, 78, (x, y, w) => {
    const halfW = w / 2;
    drawGauge(ctx.doc, x + halfW / 2, y + 46, 32, idx);
    setFont(ctx.doc, "bold", 9, C.slate);
    textCenter(ctx.doc, idx == null ? NA : statusLabel(rallyBand(idx)).toUpperCase(), x + halfW / 2, y + 72);

    // Donut de impacto
    const segments = breakdown
      .filter((b) => isNum(b.impact) && b.impact > 0)
      .slice(0, 8)
      .map((b, i) => ({
        label: b.label,
        value: b.impact as number,
        color: [
          C.navy, C.info, C.good, C.warn, C.bad, [147, 51, 234], [14, 165, 233], C.slate,
        ][i % 8] as RGB,
      }));
    drawDonut(ctx.doc, x + halfW + halfW / 2 - 18, y + 40, 26, 14, segments);
    // Leyenda
    setFont(ctx.doc, "bold", 7.5, C.mute);
    ctx.doc.text("IMPACTO POR FUNDAMENTO", x + halfW + halfW / 2 + 12, y + 10);
    let ly = y + 15;
    for (const s of segments.slice(0, 6)) {
      fillRect(ctx.doc, x + halfW + halfW / 2 + 12, ly - 2.4, 2.4, 2.4, s.color);
      setFont(ctx.doc, "normal", 8, C.ink);
      ctx.doc.text(`${s.label}`, x + halfW + halfW / 2 + 17, ly);
      setFont(ctx.doc, "bold", 8, C.slate);
      ctx.doc.text(`${Math.round(s.value)}%`, x + w - 4, ly, { align: "right" });
      ly += 5;
    }
  }, 6);

  // Nota IA breve
  if (opts.full) {
    drawParagraph(ctx,
      `Este índice combina ${breakdown.length} fundamentos ponderados por su impacto real en el resultado. La confianza promedio es ${fmtPct(avgConfidence(a))}.`,
      { color: C.slate, size: 9.5 });
  }

  // Barras horizontales por fundamento (sustituye la tabla)
  drawH2(ctx, "Desglose por fundamento");
  const rowH = 9;
  for (const b of breakdown) {
    const totalH = rowH + 2;
    drawBlock(ctx, totalH, 0.5, (x, y, w) => {
      setFont(ctx.doc, "bold", 9, C.ink);
      ctx.doc.text(fmtText(b.label), x, y + 4);
      setFont(ctx.doc, "normal", 8, C.slate);
      ctx.doc.text(statusLabel(b.status), x + 60, y + 4);
      const barX = x + 90;
      const barW = w - 90 - 30;
      drawBullet(ctx.doc, barX, y + 1.5, barW, 4, isNum(b.score) ? b.score : null, 70, statusColor(b.score));
      setFont(ctx.doc, "bold", 10, statusColor(b.score));
      ctx.doc.text(fmtInt(b.score), x + w, y + 4, { align: "right" });
      // Delta temporada
      if (isNum(b.seasonDelta)) {
        setFont(ctx.doc, "normal", 7.5, b.seasonDelta >= 0 ? C.good : C.bad);
        ctx.doc.text(fmtDelta(b.seasonDelta), x + w - 14, y + 8.5, { align: "right" });
      }
    });
  }
  spacer(ctx, 5);
}

// ================================================================
// RADAR COMPARATIVO
// ================================================================
function renderRadar(ctx: RenderCtx, a: MatchAnalysis) {
  if (!a.radarCompare?.length) return;
  drawH1(ctx, "Radar comparativo", "¿Cómo se comparan nuestros fundamentos con los del rival y con la temporada?");
  drawParagraph(ctx, "Comparación por fundamento entre equipo, rival y promedio de temporada.", { color: C.slate, size: 9.5 });

  drawCard(ctx, 100, (x, y, w) => {
    const axes = a.radarCompare.map((r) => r.axis);
    const equipo = a.radarCompare.map((r) => isNum(r.equipo) ? r.equipo : 0);
    const rival = a.radarCompare.map((r) => isNum(r.rival) ? r.rival : 0);
    const temp = a.radarCompare.map((r) => isNum(r.temporada) ? r.temporada : 0);
    drawRadar(ctx.doc, x + 55, y + 50, 38, axes, [
      { label: "Equipo", values: equipo, color: C.navy },
      { label: "Rival", values: rival, color: C.bad },
      { label: "Temporada", values: temp, color: C.mute },
    ]);
    // Leyenda
    setFont(ctx.doc, "bold", 8.5, C.slate);
    ctx.doc.text("LEYENDA", x + 120, y + 10);
    const legend: Array<[string, RGB]> = [
      ["Equipo", C.navy], ["Rival", C.bad], ["Temporada", C.mute],
    ];
    let ly = y + 18;
    for (const [t, col] of legend) {
      fillRect(ctx.doc, x + 120, ly - 2, 4, 1.5, col);
      setFont(ctx.doc, "normal", 9, C.ink);
      ctx.doc.text(t, x + 126, ly);
      ly += 6;
    }
    // Δ vs rival
    setFont(ctx.doc, "bold", 8.5, C.slate);
    ctx.doc.text("Δ VS RIVAL", x + 120, ly + 4);
    ly += 10;
    for (let i = 0; i < axes.length && ly < y + 96; i++) {
      const d = equipo[i] - rival[i];
      setFont(ctx.doc, "normal", 8, C.ink);
      ctx.doc.text(axes[i], x + 120, ly);
      setFont(ctx.doc, "bold", 8, d >= 0 ? C.good : C.bad);
      ctx.doc.text(fmtDelta(d), x + w - 4, ly, { align: "right" });
      ly += 5;
    }
  });
}

// ================================================================
// FUNDAMENTOS — tarjetas ricas
// ================================================================
function renderFundamentalChapters(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Análisis por fundamento", CHAPTER_QUESTION.fund);
  drawParagraph(ctx, "Cada tarjeta condensa score, comparación con temporada, impacto, confianza y recomendación de trabajo.", { color: C.slate, size: 9.5 });
  for (const item of a.rallyIndex.breakdown) {
    const detailLines: string[] = ctx.doc.splitTextToSize(fmtText(item.detail), contentW(ctx) - 60);
    const h = 44 + Math.max(0, detailLines.length - 2) * 4.4;
    drawCard(ctx, h, (x, y, w) => {
      // Tile score
      const tw = 46;
      fillRect(ctx.doc, x + 1, y + 1, tw, h - 2, statusSoft(item.score), 2.5);
      setFont(ctx.doc, "bold", 7.5, C.mute);
      textCenter(ctx.doc, "SCORE", x + tw / 2 + 1, y + 6.5);
      setFont(ctx.doc, "bold", 22, statusColor(item.score));
      textCenter(ctx.doc, fmtInt(item.score), x + tw / 2 + 1, y + 20);
      hairline(ctx.doc, x + tw / 2 - 7, y + 23, x + tw / 2 + 9, y + 23, C.hair, 0.4);
      setFont(ctx.doc, "bold", 9, C.ink);
      textCenter(ctx.doc, statusLabel(item.status), x + tw / 2 + 1, y + 28);
      // Mini bullet
      drawBullet(ctx.doc, x + 4, y + h - 8, tw - 8, 2, isNum(item.score) ? item.score : null, 70, statusColor(item.score));

      // Cuerpo
      const rx = x + tw + 8;
      const rw = w - tw - 12;
      setFont(ctx.doc, "bold", 12, C.ink);
      ctx.doc.text(fmtText(item.label), rx, y + 8);
      setFont(ctx.doc, "normal", 9.5, C.ink);
      let ly = y + 14;
      for (const l of detailLines.slice(0, 4)) { ctx.doc.text(l, rx, ly); ly += 4.4; }

      // Chips
      const parts: [string, RGB][] = [
        [`Impacto ${fmtPct(item.impact)}`, C.navy],
        [`Confianza ${fmtPct(item.confidence)}`, C.slate],
        [`Δ Temp. ${fmtDelta(item.seasonDelta)}`, isNum(item.seasonDelta) && item.seasonDelta < 0 ? C.bad : C.good],
      ];
      let px = rx;
      for (const [t, col] of parts) { const pw = drawPill(ctx.doc, px, y + h - 10, t, col); px += pw + 3; }
      // Objetivo y ejercicio
      setFont(ctx.doc, "bold", 7.5, C.mute);
      ctx.doc.text("OBJETIVO / EJERCICIO SUGERIDO", rx, y + h - 3);
      setFont(ctx.doc, "italic", 8.5, C.slate);
      ctx.doc.text(suggestExercise(item.label), rx + 62, y + h - 3);
    });
  }
}

function suggestExercise(label: string): string {
  const key = (label || "").toLowerCase();
  if (key.includes("saque")) return "Serie de 30 saques con targets a zona 5/6.";
  if (key.includes("recep")) return "Circuito 3v3 recepción a target del armador.";
  if (key.includes("arma")) return "Sombra + K1 con lectura de bloqueo.";
  if (key.includes("ataque")) return "Ataque contra bloqueo doble, alternando por zonas.";
  if (key.includes("bloqueo")) return "Lectura + doble bloqueo con salto en cadena.";
  if (key.includes("defensa")) return "Base + defensa low con transición a contraataque.";
  return "Trabajo específico según diagnóstico técnico.";
}

// ================================================================
// CANCHA ANALÍTICA (mapas de calor por fundamento)
// ================================================================
function renderCourtAnalytics(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Mapas de cancha", CHAPTER_QUESTION.court);
  drawParagraph(ctx, "Distribución por zona. La intensidad del color indica la frecuencia; el porcentaje muestra eficacia.", { color: C.slate, size: 9.5 });

  // Mapa de ataque (usa attackZones si están)
  const attackByZone: (number | null)[] = [null, null, null, null, null, null];
  for (const z of a.attackZones || []) {
    const zoneKey = String(z.zone).toUpperCase();
    const zoneNum = parseInt(zoneKey.replace(/\D/g, ""), 10);
    if (zoneNum >= 1 && zoneNum <= 6) attackByZone[zoneNum - 1] = isNum(z.eff) ? z.eff : null;
  }

  drawCard(ctx, 100, (x, y, w) => {
    setFont(ctx.doc, "bold", 10, C.ink);
    ctx.doc.text("Mapa de ataque — eficacia por zona (%)", x + 4, y + 8);
    drawCourt(ctx.doc, x + 8, y + 14, 80, 76, attackByZone);
    // Barras uso por zona
    setFont(ctx.doc, "bold", 8, C.mute);
    ctx.doc.text("USO POR ZONA", x + 100, y + 14);
    let ly = y + 22;
    for (const z of (a.attackZones || []).slice(0, 6)) {
      setFont(ctx.doc, "normal", 8.5, C.ink);
      ctx.doc.text(fmtText(z.label), x + 100, ly);
      drawBar(ctx.doc, x + 130, ly - 2.2, w - 130 - 20, 2.6, z.pct, C.navy);
      setFont(ctx.doc, "bold", 8, C.slate);
      ctx.doc.text(fmtPct(z.pct), x + w - 4, ly, { align: "right" });
      ly += 6.5;
    }
  }, 6);

  // Placeholders para otros mapas (fuera de scope de datos disponibles)
  drawCard(ctx, 58, (x, y, w) => {
    setFont(ctx.doc, "bold", 10, C.ink);
    ctx.doc.text("Otros mapas del partido", x + 4, y + 7);
    setFont(ctx.doc, "normal", 8.5, C.slate);
    ctx.doc.text("Recepción, saque, bloqueo y defensa se registran automáticamente cuando hay volumen suficiente de eventos.", x + 4, y + 14);
    const cw = (w - 12) / 3;
    const modes = ["Recepción", "Saque", "Bloqueo"] as const;
    for (let i = 0; i < 3; i++) {
      const cx = x + 4 + i * (cw + 2);
      drawCourt(ctx.doc, cx, y + 20, cw, 32, [null, null, null, null, null, null], undefined, modes[i]);
    }
  });
}

// ================================================================
// ROTACIONES
// ================================================================
function renderRotationBlock(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Rotaciones", CHAPTER_QUESTION.rot);
  const rot = [...a.strengths, ...a.weaknesses].filter((s) => s.category === "Rotación");
  if (!rot.length) { drawParagraph(ctx, "Sin rotaciones con desempeño destacado.", { color: C.slate, italic: true }); return; }

  // Gráfico comparativo de 6 rotaciones (extraído de metrics si posible)
  drawCard(ctx, 60, (x, y, w) => {
    setFont(ctx.doc, "bold", 10, C.ink);
    ctx.doc.text("Comparativa de rotaciones (P1 → P6)", x + 4, y + 7);
    const cw = (w - 8) / 6;
    for (let r = 1; r <= 6; r++) {
      const rx = x + 4 + (r - 1) * cw;
      const found = rot.find((it) => new RegExp(`P${r}\\b|Rotación\\s*${r}`, "i").test(it.title));
      const conf = isNum(found?.confidence) ? found!.confidence : 0;
      fillRect(ctx.doc, rx + 1, y + 12, cw - 2, 44, C.paper, 2);
      strokeRect(ctx.doc, rx + 1, y + 12, cw - 2, 44, C.hair, 2, 0.2);
      setFont(ctx.doc, "bold", 8, C.slate);
      textCenter(ctx.doc, `P${r}`, rx + cw / 2, y + 17);
      const barH = (conf / 100) * 30;
      const col = "consequence" in (found || {}) ? C.bad : found ? C.good : C.mute;
      fillRect(ctx.doc, rx + cw / 2 - 3, y + 12 + 34 - barH, 6, barH, col, 1);
      setFont(ctx.doc, "bold", 8, C.ink);
      textCenter(ctx.doc, `${Math.round(conf)}%`, rx + cw / 2, y + 52);
    }
  }, 6);

  for (const r of rot) {
    const isWeak = "consequence" in r;
    renderInsightCard(ctx, r, isWeak ? "bad" : "good", isWeak ? (r as WeaknessCard).consequence : undefined);
  }
}

// ================================================================
// INSIGHT CARD (fortaleza / debilidad)
// ================================================================
function renderInsightCard(ctx: RenderCtx, card: StrengthCard, tone: "good" | "bad", consequence?: string) {
  const tint = tone === "good" ? C.good : C.bad;
  const doc = ctx.doc;
  const metrics = (card.evidence?.metrics ?? []).map((m) => `${m.label}: ${m.value}`);
  const metricsLine = metrics.length ? metrics.join("   ·   ") : "";
  const w = contentW(ctx);
  const conclusion = fmtText(card.conclusion);
  const consLine = consequence ? "Consecuencia: " + fmtText(consequence) : "";
  const wrapW = w - 12;
  const concLines: string[] = doc.splitTextToSize(conclusion, wrapW);
  const consLines: string[] = consequence ? doc.splitTextToSize(consLine, wrapW) : [];
  const bodyLines = Math.min(concLines.length, 4) + (consLines.length ? Math.min(consLines.length, 2) : 0);
  const h = 20 + (metricsLine ? 5 : 0) + bodyLines * 4.6 + 4;
  drawCard(ctx, h, (x, y, cw) => {
    fillRect(doc, x, y, 1.6, h, tint);
    setFont(doc, "bold", 11, C.ink);
    doc.text(fmtText(card.title), x + 6, y + 7);
    let px = x + cw - 4;
    const impPill = importanceLabel(card.importance);
    const confPill = isNum(card.confidence) ? `Conf. ${Math.round(card.confidence)}%` : null;
    if (confPill) { const wpx = doc.getTextWidth(confPill) + 6; px -= wpx; drawPill(doc, px, y + 7, confPill, C.slate); px -= 3; }
    { const wpx = doc.getTextWidth(impPill) + 6; px -= wpx; drawPill(doc, px, y + 7, impPill, tint); }
    setFont(doc, "normal", 8.5, C.mute);
    doc.text(fmtText(card.category), x + 6, y + 12);
    let cy = y + 17;
    if (metricsLine) {
      setFont(doc, "normal", 9, C.slate);
      const ml: string[] = doc.splitTextToSize(metricsLine, wrapW);
      doc.text(ml.slice(0, 1), x + 6, cy);
      cy += 5;
    }
    setFont(doc, "normal", 9.5, C.ink);
    for (const l of concLines.slice(0, 4)) { doc.text(l, x + 6, cy); cy += 4.6; }
    if (consLines.length) {
      setFont(doc, "bold", 9, C.bad);
      for (const l of consLines.slice(0, 2)) { doc.text(l, x + 6, cy); cy += 4.6; }
    }
  }, 5);
}

// ================================================================
// FORTALEZAS Y DEBILIDADES
// ================================================================
function renderStrengthsWeaknesses(ctx: RenderCtx, a: MatchAnalysis, executive: boolean) {
  drawH1(ctx, "Fortalezas y debilidades", "¿Qué sostuvo al equipo y qué le costó puntos?");
  const strengths = a.strengths.slice(0, executive ? 3 : 8);
  const weaknesses = a.weaknesses.slice(0, executive ? 3 : 8);
  drawH2(ctx, "Fortalezas principales");
  if (!strengths.length) drawParagraph(ctx, "Sin fortalezas destacadas.", { color: C.slate, italic: true });
  else for (const s of strengths) renderInsightCard(ctx, s, "good");
  spacer(ctx, 3);
  drawH2(ctx, "Debilidades principales");
  if (!weaknesses.length) drawParagraph(ctx, "Sin debilidades destacadas.", { color: C.slate, italic: true });
  else for (const w of weaknesses) renderInsightCard(ctx, w, "bad", (w as WeaknessCard).consequence);
}

// ================================================================
// ANÁLISIS INDIVIDUAL — tarjetas de jugadora (grid 2 col)
// ================================================================
function renderPlayerAnalysis(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Jugadores", CHAPTER_QUESTION.player);
  if (!a.playerRadar.length) { drawParagraph(ctx, "Sin datos individuales suficientes.", { color: C.slate, italic: true }); return; }
  const list = a.playerRadar.slice(0, 12);
  const cardH = 46;
  for (let i = 0; i < list.length; i += 2) {
    const pair = [list[i], list[i + 1]].filter(Boolean);
    drawBlock(ctx, cardH, 4, (x, y, w) => {
      const cw = (w - 4) / 2;
      for (let j = 0; j < pair.length; j++) {
        const p = pair[j];
        const px = x + j * (cw + 4);
        fillRect(ctx.doc, px, y, cw, cardH, C.white, 3);
        strokeRect(ctx.doc, px, y, cw, cardH, C.hair, 3, 0.25);
        fillRect(ctx.doc, px, y, 1.6, cardH, C.navy);
        // Nombre
        setFont(ctx.doc, "bold", 10.5, C.ink);
        ctx.doc.text(ctx.doc.splitTextToSize(fmtText(p.name), cw - 42)[0], px + 5, y + 8);
        // Mini radar
        const axes = ["ATK", "BLK", "ACE", "REC", "DIS"];
        const vals = [p.attack, p.block, p.ace, p.reception, p.discipline].map((v) => isNum(v) ? v : 0);
        drawRadar(ctx.doc, px + cw - 18, y + cardH / 2, 14, axes, [
          { label: "", values: vals, color: C.navy },
        ]);
        // KPIs
        const kpis: Array<[string, unknown, RGB]> = [
          ["ATQ", p.attack, C.info],
          ["REC", p.reception, C.good],
          ["BLK", p.block, C.warn],
          ["ACE", p.ace, C.navy],
          ["DIS", p.discipline, C.slate],
        ];
        let ky = y + 14;
        for (const [k, v, col] of kpis) {
          setFont(ctx.doc, "bold", 7.5, C.mute);
          ctx.doc.text(k, px + 5, ky);
          drawBar(ctx.doc, px + 15, ky - 1.8, cw - 55, 1.8, v, col);
          setFont(ctx.doc, "bold", 7.5, col);
          ctx.doc.text(fmtInt(v), px + cw - 42, ky, { align: "right" });
          ky += 4.6;
        }
      }
    });
  }
}

// ================================================================
// TIMELINE VISUAL
// ================================================================
function renderTimeline(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Timeline", "¿En qué momentos se decidió el partido?");
  if (!a.timeline.length && !a.setTrends.length) { drawParagraph(ctx, "Sin eventos destacados.", { color: C.slate, italic: true }); return; }
  drawCard(ctx, 70, (x, y, w) => {
    setFont(ctx.doc, "bold", 10, C.ink);
    ctx.doc.text("Marcadores y momentos críticos por set", x + 4, y + 7);
    const sets = a.setTrends.map((s) => ({ setNumber: s.setNumber, scoreFor: s.scoreFor, scoreAgainst: s.scoreAgainst }));
    drawTimelineVis(ctx.doc, x + 4, y + 12, w - 8, 48, a.timeline, sets);
  }, 6);
  // Sparkline evolución sets
  if (a.setTrends.length) {
    drawCard(ctx, 30, (x, y, w) => {
      setFont(ctx.doc, "bold", 8.5, C.slate);
      ctx.doc.text("EF. ATAQUE (SET A SET)", x + 4, y + 6);
      drawSparkline(ctx.doc, x + 4, y + 8, w / 2 - 8, 18, a.setTrends.map((s) => s.attackEff), C.info);
      setFont(ctx.doc, "bold", 8.5, C.slate);
      ctx.doc.text("EF. RECEPCIÓN (SET A SET)", x + w / 2 + 4, y + 6);
      drawSparkline(ctx.doc, x + w / 2 + 4, y + 8, w / 2 - 8, 18, a.setTrends.map((s) => s.receptionEff), C.good);
    });
  }
}

// ================================================================
// COMPARACIÓN CON TEMPORADA
// ================================================================
function renderSeasonComparison(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Comparación con temporada", CHAPTER_QUESTION.season);
  const rows = a.comparison.rows;
  if (!rows.length) { drawParagraph(ctx, "Sin datos históricos suficientes.", { color: C.slate, italic: true }); return; }
  for (const r of rows) {
    drawBlock(ctx, 12, 1, (x, y, w) => {
      setFont(ctx.doc, "bold", 9, C.ink);
      ctx.doc.text(fmtText(r.metric), x, y + 4);
      setFont(ctx.doc, "normal", 8, C.mute);
      ctx.doc.text(`Referencia: ${fmtText(a.comparison.label)}`, x, y + 9);
      // Barras comparativas
      const barX = x + 70, barW = w - 70 - 40;
      const curPct = isNum(r.current) ? clampPct(r.current) : 0;
      const refPct = isNum(r.reference) ? clampPct(r.reference) : 0;
      drawBar(ctx.doc, barX, y + 1, barW, 3.2, curPct, C.info);
      drawBar(ctx.doc, barX, y + 5.5, barW, 3.2, refPct, C.mute);
      setFont(ctx.doc, "bold", 9, r.trend === "up" ? C.good : r.trend === "down" ? C.bad : C.slate);
      ctx.doc.text(`${fmtDelta(r.delta)} ${r.trend === "up" ? "↑" : r.trend === "down" ? "↓" : "="}`, x + w, y + 5, { align: "right" });
    });
  }
  spacer(ctx, 4);
}

// ================================================================
// RIESGOS Y PREDICCIONES — matriz visual
// ================================================================
function renderRisksPredictions(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Riesgos", CHAPTER_QUESTION.risk);
  if (!a.risks.length) drawParagraph(ctx, "Sin riesgos destacados.", { color: C.slate, italic: true });
  else {
    drawCard(ctx, 76, (x, y, w) => {
      setFont(ctx.doc, "bold", 10, C.ink);
      ctx.doc.text("Matriz de riesgo (Impacto × Probabilidad)", x + 4, y + 7);
      drawRiskMatrix(ctx.doc, x + 4, y + 12, w - 8, 56, a.risks.map((r) => ({ title: r.title, level: r.level })));
    });
    // Lista textual complementaria
    for (const r of a.risks.slice(0, 5)) {
      drawBlock(ctx, 12, 1, (x, y, w) => {
        fillRect(ctx.doc, x, y, 1.6, 12, importanceColor(r.level));
        setFont(ctx.doc, "bold", 9, C.ink);
        ctx.doc.text(fmtText(r.title), x + 6, y + 4);
        setFont(ctx.doc, "normal", 8.5, C.slate);
        ctx.doc.text(ctx.doc.splitTextToSize(fmtText(r.detail), w - 40)[0], x + 6, y + 9);
        drawPill(ctx.doc, x + w - 22, y + 4, importanceLabel(r.level), importanceColor(r.level));
      });
    }
  }
  spacer(ctx, 4);
  drawH1(ctx, "Predicciones");
  if (!a.predictions.length) drawParagraph(ctx, "Sin predicciones disponibles.", { color: C.slate, italic: true });
  else for (const p of a.predictions) drawParagraph(ctx, `•  ${fmtText(p.premise)} ${fmtText(p.outcome)}`);
}

// ================================================================
// RECOMENDACIONES
// ================================================================
function renderRecommendations(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Recomendaciones");
  if (!a.recommendations.length) { drawParagraph(ctx, "Sin recomendaciones.", { color: C.slate, italic: true }); return; }
  const label: Record<string, string> = { inmediata: "Inmediata", mediano_plazo: "Mediano plazo", estrategica: "Estratégica" };
  const color: Record<string, RGB> = { inmediata: C.bad, mediano_plazo: C.warn, estrategica: C.info };
  for (const r of a.recommendations) {
    const lines: string[] = ctx.doc.splitTextToSize(fmtText(r.text), contentW(ctx) - 40);
    const h = 6 + Math.max(1, lines.length) * 4.6;
    drawCard(ctx, h, (x, y, w) => {
      const col = color[r.horizon] ?? C.slate;
      fillRect(ctx.doc, x, y, 1.6, h, col);
      drawPill(ctx.doc, x + 6, y + 5, label[r.horizon] ?? r.horizon, col);
      setFont(ctx.doc, "normal", 9.5, C.ink);
      let ly = y + 11;
      for (const l of lines) { ctx.doc.text(l, x + 6, ly); ly += 4.6; }
    }, 2);
  }
}

// ================================================================
// PLAN DE ENTRENAMIENTO — cronograma visual
// ================================================================
function renderTrainingPlan(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Plan de entrenamiento", CHAPTER_QUESTION.plan);
  const plan = a.trainingPlan;
  drawParagraph(ctx, `Duración total sugerida: ${isNum(plan.totalMinutes) ? plan.totalMinutes : NA} minutos.`, { color: C.slate });
  if (!plan.blocks.length) { drawParagraph(ctx, "Sin bloques definidos.", { color: C.slate, italic: true }); return; }

  const total = plan.totalMinutes || plan.blocks.reduce((a, b) => a + (isNum(b.minutes) ? b.minutes : 0), 0) || 1;
  // Barra horizontal proporcional
  drawCard(ctx, 22, (x, y, w) => {
    setFont(ctx.doc, "bold", 8.5, C.slate);
    ctx.doc.text("CRONOGRAMA (proporcional a la duración)", x + 4, y + 7);
    let bx = x + 4;
    const bw = w - 8;
    const palette: RGB[] = [C.navy, C.info, C.good, C.warn, C.bad, [147, 51, 234]];
    for (let i = 0; i < plan.blocks.length; i++) {
      const b = plan.blocks[i];
      const frac = Math.max(0, (isNum(b.minutes) ? b.minutes : 0) / total);
      const seg = frac * bw;
      const col = palette[i % palette.length];
      fillRect(ctx.doc, bx, y + 11, seg, 6, col, 2);
      if (seg > 12) {
        setFont(ctx.doc, "bold", 7, C.white);
        ctx.doc.text(`${fmtInt(b.minutes)}'`, bx + 2, y + 15);
      }
      bx += seg;
    }
  });

  // Bloques como tarjetas
  for (let i = 0; i < plan.blocks.length; i++) {
    const b = plan.blocks[i];
    const palette: RGB[] = [C.navy, C.info, C.good, C.warn, C.bad, [147, 51, 234]];
    const col = palette[i % palette.length];
    const drills = (b.drills || []).map(fmtText);
    const drillLines: string[] = ctx.doc.splitTextToSize(drills.join(" · "), contentW(ctx) - 30);
    const reasonLines: string[] = ctx.doc.splitTextToSize(fmtText(b.reason), contentW(ctx) - 30);
    const h = 14 + drillLines.length * 4.2 + reasonLines.length * 4.2 + 4;
    drawCard(ctx, h, (x, y, w) => {
      fillRect(ctx.doc, x, y, 1.6, h, col);
      setFont(ctx.doc, "bold", 10.5, C.ink);
      ctx.doc.text(`Bloque ${i + 1} · ${fmtText(b.focus)}`, x + 6, y + 7);
      drawPill(ctx.doc, x + w - 22, y + 7, `${fmtInt(b.minutes)}'`, col);
      let ly = y + 13;
      setFont(ctx.doc, "bold", 7.5, C.mute);
      ctx.doc.text("EJERCICIOS", x + 6, ly); ly += 4;
      setFont(ctx.doc, "normal", 9, C.ink);
      for (const l of drillLines) { ctx.doc.text(l, x + 6, ly); ly += 4.2; }
      setFont(ctx.doc, "bold", 7.5, C.mute);
      ctx.doc.text("RAZÓN", x + 6, ly); ly += 4;
      setFont(ctx.doc, "italic", 9, C.slate);
      for (const l of reasonLines) { ctx.doc.text(l, x + 6, ly); ly += 4.2; }
    }, 3);
  }
}

// ================================================================
// COACH INSIGHTS
// ================================================================
function renderCoachInsights(ctx: RenderCtx, a: MatchAnalysis) {
  drawH1(ctx, "Coach Insights", CHAPTER_QUESTION.coach);
  const ci = a.coachInsights;
  const blocks: Array<[string, string, RGB]> = [
    ["¿Por qué se ganó/perdió?", ci.whyResult, C.navy],
    ["¿Qué decisiones funcionaron?", ci.keyDecisionThatWorked, C.good],
    ["¿Qué decisiones reconsiderar?", ci.decisionToReconsider, C.bad],
    ["Fundamento decisivo", ci.fundamentalDrivingResult, C.info],
  ];
  for (const [k, v, col] of blocks) {
    const text: string[] = ctx.doc.splitTextToSize(fmtText(v), contentW(ctx) - 12);
    const h = 14 + text.length * 4.6;
    drawCard(ctx, h, (x, y, w) => {
      fillRect(ctx.doc, x, y, 1.6, h, col);
      setFont(ctx.doc, "bold", 10.5, C.ink);
      ctx.doc.text(k, x + 6, y + 8);
      setFont(ctx.doc, "normal", 10, C.ink);
      let ly = y + 13;
      for (const l of text) { ctx.doc.text(l, x + 6, ly); ly += 4.6; }
    }, 3);
  }
  if (a.coachQuestions.length) {
    drawH2(ctx, "Preguntas para el entrenador");
    for (const q of a.coachQuestions) drawParagraph(ctx, `•  ${fmtText(q)}`);
  }
}

// ================================================================
// RESUMEN EJECUTIVO PARA EL ENTRENADOR (página final)
// ================================================================
function renderCoachExecutiveSummary(ctx: RenderCtx, a: MatchAnalysis) {
  pageBreak(ctx);
  ctx.toc.push({ title: "Resumen ejecutivo para el entrenador", page: (ctx.doc as any).internal.getCurrentPageInfo().pageNumber, level: 1 });
  const doc = ctx.doc;
  const d = a.dashboard;
  const w = contentW(ctx);

  // Hero
  fillRect(doc, ctx.margin, ctx.y, w, 22, C.ink, 3);
  setFont(doc, "bold", 8, [200, 210, 225]);
  doc.text("PÁGINA FINAL", ctx.margin + 6, ctx.y + 7);
  setFont(doc, "bold", 16, C.white);
  doc.text("Resumen ejecutivo para el entrenador", ctx.margin + 6, ctx.y + 14);
  setFont(doc, "normal", 8.5, [200, 210, 225]);
  doc.text("Comprende el partido en menos de un minuto.", ctx.margin + 6, ctx.y + 19);
  ctx.y += 26;

  // Fila 1: Resultado + Rally
  drawBlock(ctx, 26, 4, (x, y) => {
    const cw = (w - 4) / 2;
    fillRect(doc, x, y, cw, 26, C.paper, 3);
    setFont(doc, "bold", 7.5, C.mute);
    doc.text("RESULTADO", x + 5, y + 7);
    setFont(doc, "bold", 18, d.result === "victoria" ? C.good : d.result === "derrota" ? C.bad : C.slate);
    doc.text(`${(d.result || NA).toUpperCase()}  ${fmtScoreline(d.scoreline).split(" ")[0]}`, x + 5, y + 18);

    const rx = x + cw + 4;
    fillRect(doc, rx, y, cw, 26, C.paper, 3);
    setFont(doc, "bold", 7.5, C.mute);
    doc.text("ÍNDICE RALLY", rx + 5, y + 7);
    const idx = isNum(d.rallyIndex) ? Math.round(d.rallyIndex) : null;
    setFont(doc, "bold", 22, idx == null ? C.mute : statusColor(idx));
    doc.text(idx == null ? NA : `${idx} / 100`, rx + 5, y + 20);
  });

  // Fila 2: Top 3 fortalezas / debilidades
  drawBlock(ctx, 46, 4, (x, y) => {
    const cw = (w - 4) / 2;
    const drawSide = (bx: number, title: string, items: StrengthCard[], tint: RGB) => {
      fillRect(doc, bx, y, cw, 46, C.white, 3);
      strokeRect(doc, bx, y, cw, 46, C.hair, 3, 0.25);
      fillRect(doc, bx, y, 1.6, 46, tint);
      setFont(doc, "bold", 9, tint);
      doc.text(title, bx + 6, y + 7);
      let ly = y + 13;
      for (let i = 0; i < 3; i++) {
        const it = items[i];
        setFont(doc, "bold", 8, C.mute);
        doc.text(`${i + 1}.`, bx + 6, ly);
        setFont(doc, "normal", 9, C.ink);
        doc.text(doc.splitTextToSize(fmtText(it?.title), cw - 16)[0], bx + 10, ly);
        ly += 10;
      }
    };
    drawSide(x, "TOP 3 FORTALEZAS", a.strengths, C.good);
    drawSide(x + cw + 4, "TOP 3 DEBILIDADES", a.weaknesses, C.bad);
  });

  // Fila 3: 3 prioridades
  drawBlock(ctx, 34, 4, (x, y) => {
    fillRect(doc, x, y, w, 34, C.white, 3);
    strokeRect(doc, x, y, w, 34, C.hair, 3, 0.25);
    setFont(doc, "bold", 9, C.navy);
    doc.text("PRIORIDADES 1 · 2 · 3", x + 6, y + 7);
    const cw = (w - 12) / 3;
    for (let i = 0; i < 3; i++) {
      const p = a.priorities[i];
      const px = x + 6 + i * cw;
      setFont(doc, "bold", 12, importanceColor(p?.level));
      doc.text(`${i + 1}`, px, y + 18);
      setFont(doc, "bold", 9, C.ink);
      doc.text(doc.splitTextToSize(fmtText(p?.title), cw - 8)[0], px + 6, y + 14);
      setFont(doc, "normal", 8, C.slate);
      const rl: string[] = doc.splitTextToSize(fmtText(p?.reason), cw - 8);
      let ly = y + 20;
      for (const l of rl.slice(0, 2)) { doc.text(l, px + 6, ly); ly += 4; }
    }
  });

  // Fila 4: Jugador destacado + Rotación crítica
  drawBlock(ctx, 24, 4, (x, y) => {
    const cw = (w - 4) / 2;
    const mvp = d.awards.mvp;
    fillRect(doc, x, y, cw, 24, C.paper, 3);
    setFont(doc, "bold", 7.5, C.mute);
    doc.text("JUGADOR DESTACADO", x + 5, y + 7);
    setFont(doc, "bold", 12, C.navy);
    doc.text(doc.splitTextToSize(fmtText(mvp?.name), cw - 10)[0], x + 5, y + 15);
    setFont(doc, "normal", 8, C.slate);
    doc.text(doc.splitTextToSize(fmtText(mvp?.detail), cw - 10)[0], x + 5, y + 20);

    const rx = x + cw + 4;
    fillRect(doc, rx, y, cw, 24, C.paper, 3);
    setFont(doc, "bold", 7.5, C.mute);
    doc.text("ROTACIÓN CRÍTICA", rx + 5, y + 7);
    const critRot = a.weaknesses.find((w) => w.category === "Rotación") || a.strengths.find((s) => s.category === "Rotación");
    setFont(doc, "bold", 12, C.bad);
    doc.text(doc.splitTextToSize(fmtText(critRot?.title || NA), cw - 10)[0], rx + 5, y + 15);
    setFont(doc, "normal", 8, C.slate);
    doc.text(doc.splitTextToSize(fmtText(critRot?.conclusion || ""), cw - 10)[0], rx + 5, y + 20);
  });

  // Fila 5: 3 ejercicios sugeridos
  drawBlock(ctx, 40, 4, (x, y) => {
    fillRect(doc, x, y, w, 40, C.white, 3);
    strokeRect(doc, x, y, w, 40, C.hair, 3, 0.25);
    setFont(doc, "bold", 9, C.navy);
    doc.text("3 EJERCICIOS SUGERIDOS POR IA", x + 6, y + 7);
    const exercises = a.rallyIndex.breakdown
      .filter((b) => isNum(b.score) && b.score < 65)
      .slice(0, 3)
      .map((b) => ({ label: b.label, drill: suggestExercise(b.label) }));
    while (exercises.length < 3 && exercises.length < a.rallyIndex.breakdown.length) {
      const next = a.rallyIndex.breakdown[exercises.length];
      exercises.push({ label: next.label, drill: suggestExercise(next.label) });
    }
    let ly = y + 14;
    for (let i = 0; i < exercises.length; i++) {
      setFont(doc, "bold", 8.5, C.info);
      doc.text(`${i + 1}. ${exercises[i].label}`, x + 6, ly);
      setFont(doc, "normal", 8.5, C.ink);
      const dl: string[] = doc.splitTextToSize(exercises[i].drill, w - 12);
      doc.text(dl[0], x + 6, ly + 4);
      ly += 10;
    }
  });

  // Conclusión final
  drawBlock(ctx, 28, 4, (x, y) => {
    fillRect(doc, x, y, w, 28, C.navy, 3);
    setFont(doc, "bold", 9, [200, 210, 225]);
    doc.text("CONCLUSIÓN FINAL", x + 6, y + 8);
    setFont(doc, "normal", 9.5, C.white);
    const text = fmtText(a.coachInsights.whyResult);
    const lines: string[] = doc.splitTextToSize(text, w - 12);
    let ly = y + 14;
    for (const l of lines.slice(0, 3)) { doc.text(l, x + 6, ly); ly += 4.5; }
  });
}

// ================================================================
// PREFLIGHT — validación previa al save
// ================================================================
function preflight(ctx: RenderCtx) {
  const total = (ctx.doc as any).internal.getNumberOfPages();
  // Verificar que las páginas del TOC estén dentro del rango
  for (const e of ctx.toc) {
    if (e.page < 1 || e.page > total) {
      ctx.warnings.push(`TOC entry "${e.title}" apunta a página ${e.page} fuera de rango.`);
    }
  }
  if (ctx.warnings.length) {
    // eslint-disable-next-line no-console
    console.warn("[rally-pdf-preflight]", ctx.warnings);
  }
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
      version: extras?.version ?? "v2.0",
      generatedAt,
    },
    toc: [],
    warnings: [],
  };

  // 1) Portada
  renderCover(ctx, analysis, extras?.coachName, extras?.venue);

  if (format === "executive") {
    pageBreak(ctx);
    renderDashboardBlock(ctx, analysis, extras?.coachName, extras?.venue);
    renderRallyIndexSection(ctx, analysis, { full: false });
    renderStrengthsWeaknesses(ctx, analysis, true);
    renderCoachExecutiveSummary(ctx, analysis);
  } else {
    // Reservar página TOC
    doc.addPage();
    const tocPageNo = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // Cuerpo
    pageBreak(ctx);
    renderDashboardBlock(ctx, analysis, extras?.coachName, extras?.venue);
    renderRallyIndexSection(ctx, analysis, { full: true });
    renderRadar(ctx, analysis);
    renderFundamentalChapters(ctx, analysis);
    renderCourtAnalytics(ctx, analysis);
    renderRotationBlock(ctx, analysis);
    renderPlayerAnalysis(ctx, analysis);
    renderTimeline(ctx, analysis);
    renderStrengthsWeaknesses(ctx, analysis, false);
    renderSeasonComparison(ctx, analysis);
    renderRisksPredictions(ctx, analysis);
    renderRecommendations(ctx, analysis);
    renderTrainingPlan(ctx, analysis);
    renderCoachInsights(ctx, analysis);
    renderCoachExecutiveSummary(ctx, analysis);

    // TOC
    renderToc(ctx, tocPageNo);
  }

  // Chrome (header + footer + numeración final)
  const total = (doc as any).internal.getNumberOfPages();
  paintChrome(ctx, total);

  // Preflight
  preflight(ctx);

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
