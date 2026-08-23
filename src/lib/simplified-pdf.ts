import type { Match, Team } from "@/lib/volley-store";
import { formatDurationMs } from "@/lib/volley-store";
import { buildSimplifiedReport, type SimplifiedReport } from "@/lib/simplified-report";

/**
 * "Reporte simplificado": PDF visual y resumido para el entrenador.
 * Independiente del reporte oficial (`match-pdf.ts`): sólo consume datos ya
 * registrados en el partido a través de `buildSimplifiedReport`.
 */

type RGB = [number, number, number];

const C = {
  bg: [15, 20, 32] as RGB,
  card: [23, 30, 46] as RGB,
  cardAlt: [30, 39, 58] as RGB,
  border: [51, 65, 85] as RGB,
  text: [232, 237, 245] as RGB,
  muted: [148, 163, 184] as RGB,
  home: [249, 115, 22] as RGB,
  away: [59, 130, 246] as RGB,
  good: [34, 197, 94] as RGB,
  bad: [239, 68, 68] as RGB,
  warn: [245, 158, 11] as RGB,
};

export type SimplifiedPdfResult = {
  method: "share" | "download" | "cancelled";
  fileName: string;
  sizeKb: number;
  url?: string;
};

const safe = (s: string) => s.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "_");

export async function downloadSimplifiedMatchPdf(
  match: Match,
  teamA: Team,
  teamB: Team,
  opts: { competition?: string | null; ownSide?: "A" | "B" } = {},
): Promise<SimplifiedPdfResult> {
  const { jsPDF } = await import("jspdf");
  const r = buildSimplifiedReport(match, teamA, teamB, opts);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 12;
  const W = pageW - M * 2;
  let y = 0;

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  const paintBg = () => {
    setFill(C.bg);
    doc.rect(0, 0, pageW, pageH, "F");
  };

  const newPage = () => {
    doc.addPage();
    paintBg();
    y = M + 4;
  };

  const ensure = (h: number) => {
    if (y + h > pageH - 14) newPage();
  };

  /** Dibuja una tarjeta con título y devuelve la coordenada Y interior. */
  const card = (title: string | null, height: number) => {
    ensure(height + 6);
    const top = y;
    setFill(C.card);
    setStroke(C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(M, top, W, height, 3, 3, "FD");
    let inner = top + 7;
    if (title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(C.muted);
      doc.text(title.toUpperCase(), M + 6, inner);
      inner += 6;
    }
    y = top + height + 6;
    return inner;
  };

  const bar = (x: number, yy: number, w: number, h: number, color: RGB) => {
    setFill(color);
    doc.roundedRect(x, yy, Math.max(0.6, w), h, h / 2, h / 2, "F");
  };

  paintBg();

  // ─────────────── Encabezado ───────────────
  y = 0;
  setFill(C.cardAlt);
  doc.rect(0, 0, pageW, 46, "F");
  setFill(C.home);
  doc.rect(0, 0, pageW, 1.6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setText(C.home);
  doc.text("RALLY", M, 14);
  doc.setFontSize(10);
  setText(C.muted);
  doc.text("REPORTE SIMPLIFICADO", M, 20);

  doc.setFontSize(9);
  setText(r.meta.live ? C.warn : C.good);
  doc.text(r.meta.statusLabel, pageW - M, 14, { align: "right" });

  doc.setFontSize(15);
  setText(C.text);
  doc.setFont("helvetica", "bold");
  doc.text(`${r.meta.teamAName}   vs   ${r.meta.teamBName}`, M, 31);

  const metaBits = [
    r.meta.dateLabel,
    r.meta.timeLabel ? `${r.meta.timeLabel} hs` : null,
    r.meta.competition,
    r.meta.category ? `Cat. ${r.meta.category}` : null,
    r.meta.venue,
  ].filter(Boolean) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(C.muted);
  doc.text(metaBits.join("  ·  "), M, 39);

  y = 52;

  // ─────────────── Resultado ───────────────
  {
    const inner = card("Resultado", 40);
    const mid = pageW / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(C.home);
    doc.text(r.meta.teamAName, M + 10, inner + 6, { maxWidth: mid - M - 30 });
    setText(C.away);
    doc.text(r.meta.teamBName, pageW - M - 10, inner + 6, { align: "right", maxWidth: mid - M - 30 });

    doc.setFontSize(34);
    setText(C.home);
    doc.text(String(r.score.a), mid - 16, inner + 18, { align: "center" });
    setText(C.muted);
    doc.setFontSize(18);
    doc.text("-", mid, inner + 17, { align: "center" });
    doc.setFontSize(34);
    setText(C.away);
    doc.text(String(r.score.b), mid + 16, inner + 18, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(C.muted);
    doc.text(`Sets ganados: ${r.score.a} - ${r.score.b}`, mid, inner + 25, { align: "center" });
  }

  // ─────────────── Sets ───────────────
  if (r.sets.length > 0) {
    const rowH = 12;
    const inner = card("Resumen de sets", 12 + r.sets.length * rowH + 4);
    let ry = inner;
    for (const s of r.sets) {
      const maxScore = Math.max(s.scoreA, s.scoreB, 1);
      const barW = W - 78;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(C.muted);
      doc.text(`SET ${s.number}`, M + 6, ry + 3);

      bar(M + 26, ry, (barW * s.scoreA) / maxScore, 3, C.home);
      bar(M + 26, ry + 5, (barW * s.scoreB) / maxScore, 3, C.away);

      doc.setFontSize(9);
      setText(C.home);
      doc.text(String(s.scoreA), pageW - M - 30, ry + 3, { align: "right" });
      setText(C.away);
      doc.text(String(s.scoreB), pageW - M - 30, ry + 8, { align: "right" });

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      if (s.winner) {
        setText(s.winner === "A" ? C.home : C.away);
        doc.text(s.winner === "A" ? "Local" : "Visitante", pageW - M - 6, ry + 5.5, { align: "right" });
      } else {
        setText(C.muted);
        doc.text("En juego", pageW - M - 6, ry + 5.5, { align: "right" });
      }
      ry += rowH;
    }
  }

  // ─────────────── Duración ───────────────
  if (r.duration) {
    const inner = card("Duración", 26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    setText(C.text);
    doc.text(formatDurationMs(r.duration.totalMs), M + 6, inner + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(C.muted);
    doc.text(
      r.duration.perSet.map((s) => `Set ${s.number}: ${formatDurationMs(s.ms)}`).join("   ·   "),
      M + 6,
      inner + 13,
    );
  }

  // ─────────────── Momentum ───────────────
  if (r.momentum && r.momentum.points.length > 1) {
    const h = 62;
    const inner = card("Momentum del partido", h);
    const chartX = M + 8;
    const chartW = W - 16;
    const chartY = inner + 2;
    const chartH = 30;
    const maxAbs = Math.max(3, ...r.momentum.points.map((p) => Math.abs(p.delta)));
    const midY = chartY + chartH / 2;
    setStroke(C.border);
    doc.setLineWidth(0.2);
    doc.line(chartX, midY, chartX + chartW, midY);

    const pts = r.momentum.points;
    const stepX = chartW / Math.max(1, pts.length - 1);
    doc.setLineWidth(0.7);
    for (let i = 1; i < pts.length; i++) {
      const x1 = chartX + (i - 1) * stepX;
      const x2 = chartX + i * stepX;
      const y1 = midY - (pts[i - 1].delta / maxAbs) * (chartH / 2);
      const y2 = midY - (pts[i].delta / maxAbs) * (chartH / 2);
      setStroke(pts[i].delta >= 0 ? C.home : C.away);
      doc.line(x1, y1, x2, y2);
      if (pts[i].setNumber !== pts[i - 1].setNumber) {
        setStroke(C.border);
        doc.setLineWidth(0.2);
        doc.line(x2, chartY, x2, chartY + chartH);
        doc.setLineWidth(0.7);
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(C.home);
    doc.text(`▲ ${r.meta.teamAName}`, chartX, chartY - 1);
    setText(C.away);
    doc.text(`▼ ${r.meta.teamBName}`, chartX + chartW, chartY - 1, { align: "right" });

    setText(C.text);
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(r.momentum.conclusion, chartW), chartX, chartY + chartH + 8);
  }

  // ─────────────── Racha ───────────────
  if (r.streaks) {
    const inner = card("Racha máxima", 26);
    const half = W / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    setText(C.home);
    doc.text(`${r.streaks.A}×`, M + 8, inner + 8);
    setText(C.away);
    doc.text(`${r.streaks.B}×`, M + half + 4, inner + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(C.muted);
    doc.text(`${r.meta.teamAName} · puntos consecutivos`, M + 8, inner + 14);
    doc.text(`${r.meta.teamBName} · puntos consecutivos`, M + half + 4, inner + 14);
  }

  // ─────────────── Rotaciones ───────────────
  if (r.rotations) {
    const rows = r.rotations[opts.ownSide ?? "A"];
    const played = rows.filter((x) => x.pf + x.pc > 0);
    const best = played.length ? [...played].sort((a, b) => b.diff - a.diff)[0] : null;
    const worst = played.length ? [...played].sort((a, b) => a.diff - b.diff)[0] : null;
    const inner = card("Eficiencia por rotación", 20 + rows.length * 7);
    let ry = inner;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    setText(C.muted);
    doc.text("ROT", M + 8, ry);
    doc.text("A FAVOR", M + 40, ry);
    doc.text("EN CONTRA", M + 75, ry);
    doc.text("DIF", M + 120, ry);
    ry += 5;
    for (const row of rows) {
      const tone = best && row.rotation === best.rotation && row.diff > 0 ? C.good : worst && row.rotation === worst.rotation && row.diff < 0 ? C.bad : C.text;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setText(tone);
      doc.text(`R${row.rotation}`, M + 8, ry);
      doc.setFont("helvetica", "normal");
      setText(C.text);
      doc.text(row.pf + row.pc === 0 ? "Sin datos" : String(row.pf), M + 40, ry);
      if (row.pf + row.pc > 0) {
        doc.text(String(row.pc), M + 75, ry);
        setText(row.diff > 0 ? C.good : row.diff < 0 ? C.bad : C.muted);
        doc.text(`${row.diff > 0 ? "+" : ""}${row.diff}`, M + 120, ry);
      }
      ry += 7;
    }
  }

  // ─────────────── Comparativas (saque / recepción / ataque / bloqueo) ─
  const compareCard = (
    title: string,
    lines: { label: string; a: string; b: string; ratio?: [number, number] }[],
  ) => {
    const inner = card(title, 20 + lines.length * 9);
    let ry = inner;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    setText(C.home);
    doc.text(r.meta.teamAName, M + 6, ry, { maxWidth: 50 });
    setText(C.away);
    doc.text(r.meta.teamBName, pageW - M - 6, ry, { align: "right", maxWidth: 50 });
    ry += 6;
    for (const l of lines) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(C.text);
      doc.text(l.a, M + 6, ry);
      doc.text(l.b, pageW - M - 6, ry, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setText(C.muted);
      doc.text(l.label, pageW / 2, ry, { align: "center" });
      if (l.ratio) {
        const total = l.ratio[0] + l.ratio[1];
        const barW = (W - 30) / 2;
        const aW = total > 0 ? (barW * l.ratio[0]) / Math.max(l.ratio[0], l.ratio[1], 1) : 0;
        const bW = total > 0 ? (barW * l.ratio[1]) / Math.max(l.ratio[0], l.ratio[1], 1) : 0;
        bar(M + 6, ry + 2, aW, 2, C.home);
        bar(pageW - M - 6 - bW, ry + 2, bW, 2, C.away);
      }
      ry += 9;
    }
  };

  if (r.serve) {
    compareCard("Saque", [
      { label: "Saques", a: String(r.serve.A.serves), b: String(r.serve.B.serves), ratio: [r.serve.A.serves, r.serve.B.serves] },
      { label: "Aces", a: String(r.serve.A.aces), b: String(r.serve.B.aces), ratio: [r.serve.A.aces, r.serve.B.aces] },
      { label: "Errores de saque", a: String(r.serve.A.errors), b: String(r.serve.B.errors), ratio: [r.serve.A.errors, r.serve.B.errors] },
      { label: "Puntos con saque", a: String(r.serve.A.pointsWhileServing), b: String(r.serve.B.pointsWhileServing), ratio: [r.serve.A.pointsWhileServing, r.serve.B.pointsWhileServing] },
      { label: "Eficiencia", a: `${r.serve.A.efficiency.toFixed(0)}%`, b: `${r.serve.B.efficiency.toFixed(0)}%` },
    ]);
  }

  if (r.reception) {
    const a = r.reception.A;
    const b = r.reception.B;
    const v = (x: number | undefined, suffix = "") => (x === undefined ? "Sin datos" : `${Math.round(x)}${suffix}`);
    compareCard("Recepción", [
      { label: "Recepción positiva", a: v(a?.positivePct, "%"), b: v(b?.positivePct, "%"), ratio: [a?.positivePct ?? 0, b?.positivePct ?? 0] },
      { label: "Recepción perfecta", a: v(a?.perfectPct, "%"), b: v(b?.perfectPct, "%"), ratio: [a?.perfectPct ?? 0, b?.perfectPct ?? 0] },
      { label: "Errores", a: v(a?.errors), b: v(b?.errors) },
      { label: "Total recepciones", a: v(a?.total), b: v(b?.total) },
    ]);
  }

  if (r.attack) {
    const a = r.attack.A;
    const b = r.attack.B;
    const v = (x: number | undefined, suffix = "") => (x === undefined ? "Sin datos" : `${Math.round(x)}${suffix}`);
    compareCard("Ataque", [
      { label: "Ataques", a: v(a?.attempts), b: v(b?.attempts), ratio: [a?.attempts ?? 0, b?.attempts ?? 0] },
      { label: "Puntos de ataque", a: v(a?.points), b: v(b?.points), ratio: [a?.points ?? 0, b?.points ?? 0] },
      { label: "Errores", a: v(a?.errors), b: v(b?.errors) },
      { label: "Bloqueos recibidos", a: v(a?.blocked), b: v(b?.blocked) },
      { label: "Eficiencia", a: v(a?.efficiency, "%"), b: v(b?.efficiency, "%") },
      { label: "Efectividad", a: v(a?.effectiveness, "%"), b: v(b?.effectiveness, "%") },
    ]);
  }

  if (r.block) {
    compareCard("Bloqueo", [
      { label: "Bloqueos punto", a: String(r.block.A.points), b: String(r.block.B.points), ratio: [r.block.A.points, r.block.B.points] },
      { label: "Errores de bloqueo", a: String(r.block.A.errors), b: String(r.block.B.errors) },
      { label: "Bloqueos recibidos", a: String(r.block.A.received), b: String(r.block.B.received) },
    ]);
  }

  // ─────────────── Jugadores destacados ───────────────
  const p = r.players;
  const anyPlayers = p.mvp || p.topAttack.length || p.topBlock.length || p.topServe.length || p.topReception.length;
  if (anyPlayers) {
    const listBlocks: { title: string; items: string[] }[] = [];
    if (p.topAttack.length) listBlocks.push({ title: "Top ataque", items: p.topAttack.map((x) => `${x.label} — ${x.value} pts`) });
    if (p.topBlock.length) listBlocks.push({ title: "Mejores bloqueadores", items: p.topBlock.map((x) => `${x.label} — ${x.value} bloqueos`) });
    if (p.topServe.length) listBlocks.push({ title: "Mejor saque", items: p.topServe.map((x) => `${x.label} — ${x.value} aces`) });
    if (p.topReception.length) listBlocks.push({ title: "Mejor recepción", items: p.topReception.map((x) => `${x.label} — ${x.value}% (${x.detail})`) });

    const maxItems = Math.max(0, ...listBlocks.map((b) => b.items.length));
    const height = 16 + (p.mvp ? 18 : 0) + Math.ceil(listBlocks.length / 2) * (10 + maxItems * 5);
    const inner = card("Jugadores destacados", height);
    let ry = inner;
    if (p.mvp) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setText(C.home);
      doc.text(`★ ${p.mvp.label}`, M + 6, ry + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(C.muted);
      const bits = [
        `${p.mvp.value} puntos`,
        p.mvp.attackPoints > 0 ? `${p.mvp.attackPoints} de ataque` : null,
        p.mvp.blocks > 0 ? `${p.mvp.blocks} bloqueos` : null,
        p.mvp.aces > 0 ? `${p.mvp.aces} aces` : null,
      ].filter(Boolean) as string[];
      doc.text(bits.join("  ·  "), M + 6, ry + 9);
      ry += 18;
    }
    const colW = W / 2 - 8;
    listBlocks.forEach((blockItem, i) => {
      const col = i % 2;
      const rowIdx = Math.floor(i / 2);
      const bx = M + 6 + col * (colW + 8);
      const by = ry + rowIdx * (10 + maxItems * 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(C.muted);
      doc.text(blockItem.title.toUpperCase(), bx, by);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(C.text);
      blockItem.items.forEach((item, k) => {
        doc.text(doc.splitTextToSize(item, colW)[0], bx, by + 5 + k * 5);
      });
    });
  }

  // ─────────────── Análisis táctico ───────────────
  {
    const sit = r.tactical.situation;
    const rec = r.tactical.recommendations;
    const wrapped: { color: RGB; text: string[] }[] = [];
    if (sit.length === 0 && rec.length === 0) {
      wrapped.push({ color: C.muted, text: ["No se detectaron alertas tácticas relevantes."] });
    } else {
      for (const s of sit) wrapped.push({ color: C.warn, text: doc.splitTextToSize(`Situación: ${s}`, W - 14) });
      for (const s of rec) wrapped.push({ color: C.good, text: doc.splitTextToSize(`Recomendación: ${s}`, W - 14) });
    }
    const lines = wrapped.reduce((n, x) => n + x.text.length, 0);
    const inner = card("Análisis táctico", 14 + lines * 5);
    let ry = inner;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const item of wrapped) {
      setText(item.color);
      doc.text(item.text, M + 6, ry);
      ry += item.text.length * 5;
    }
  }

  // ─────────────── Resumen final ───────────────
  if (r.summary.length > 0) {
    const wrapped = r.summary.map((s) => ({
      color: s.tone === "good" ? C.good : s.tone === "bad" ? C.bad : C.warn,
      text: doc.splitTextToSize(s.text, W - 18),
    }));
    const lines = wrapped.reduce((n, x) => n + x.text.length, 0);
    const inner = card("Resumen del partido", 14 + lines * 5);
    let ry = inner;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    for (const item of wrapped) {
      setFill(item.color);
      doc.circle(M + 7, ry - 1.2, 1.2, "F");
      setText(C.text);
      doc.text(item.text, M + 11, ry);
      ry += item.text.length * 5;
    }
  }

  // ─────────────── Pie ───────────────
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    setText(C.muted);
    doc.setFont("helvetica", "normal");
    doc.text(
      `RALLY · Reporte simplificado · ${r.meta.teamAName} vs ${r.meta.teamBName} · Página ${i}/${pages}`,
      pageW / 2,
      pageH - 6,
      { align: "center" },
    );
  }

  const fileName = `Reporte_Simplificado_${safe(teamA.shortName || teamA.name)}_vs_${safe(teamB.shortName || teamB.name)}_${r.meta.fileDate}.pdf`;
  const blob = doc.output("blob");
  const sizeKb = Math.round(blob.size / 1024);

  const file = new File([blob], fileName, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return { method: "share", fileName, sizeKb };
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") {
        return { method: "cancelled", fileName, sizeKb };
      }
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return { method: "download", fileName, sizeKb };
}

export type { SimplifiedReport };
