import type { Match, Team } from "@/lib/volley-store";
import { formatDurationMs } from "@/lib/volley-store";
import { buildSimplifiedReport, type SimplifiedReport } from "@/lib/simplified-report";

/**
 * "Reporte simplificado": planilla visual de UNA sola hoja (A4) pensada para el
 * entrenador. Densa pero legible, con comparativa por equipo, eficiencia por
 * rotación, rendimiento del armador por zona y destacados.
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
const n0 = (x: number | null | undefined, suffix = "") =>
  x === null || x === undefined ? "-" : `${Math.round(x)}${suffix}`;

export async function downloadSimplifiedMatchPdf(
  match: Match,
  teamA: Team,
  teamB: Team,
  opts: { competition?: string | null; ownSide?: "A" | "B" } = {},
): Promise<SimplifiedPdfResult> {
  const { jsPDF } = await import("jspdf");
  const r = buildSimplifiedReport(match, teamA, teamB, opts);
  const ownSide = opts.ownSide ?? "A";
  const ownName = ownSide === "A" ? r.meta.teamAName : r.meta.teamBName;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 10;
  const W = pageW - M * 2;

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  setFill(C.bg);
  doc.rect(0, 0, pageW, pageH, "F");

  /** Tarjeta con título; devuelve la Y interior de contenido. */
  const card = (x: number, y: number, w: number, h: number, title: string | null) => {
    setFill(C.card);
    setStroke(C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
    if (!title) return y + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(C.muted);
    doc.text(title.toUpperCase(), x + 3.5, y + 4.6);
    return y + 9.5;
  };

  // ─────────────── Encabezado ───────────────
  setFill(C.cardAlt);
  doc.rect(0, 0, pageW, 26, "F");
  setFill(C.home);
  doc.rect(0, 0, pageW, 1.4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setText(C.home);
  doc.text("RALLY", M, 10);
  doc.setFontSize(7);
  setText(C.muted);
  doc.text("REPORTE SIMPLIFICADO", M + 20, 10);

  doc.setFontSize(12);
  setText(C.text);
  doc.text(`${r.meta.teamAName}  vs  ${r.meta.teamBName}`, M, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(C.muted);
  const metaBits = [
    r.meta.dateLabel,
    r.meta.timeLabel ? `${r.meta.timeLabel} hs` : null,
    r.meta.competition,
    r.meta.category ? `Cat. ${r.meta.category}` : null,
    r.meta.venue,
    r.duration ? `Duración ${formatDurationMs(r.duration.totalMs)}` : null,
  ].filter(Boolean) as string[];
  doc.text(metaBits.join("  ·  "), M, 23);

  // Marcador a la derecha
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setText(C.home);
  doc.text(String(r.score.a), pageW - M - 16, 18, { align: "right" });
  setText(C.muted);
  doc.setFontSize(12);
  doc.text("-", pageW - M - 11, 17.5, { align: "center" });
  doc.setFontSize(20);
  setText(C.away);
  doc.text(String(r.score.b), pageW - M - 6, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  setText(r.meta.live ? C.warn : C.good);
  doc.text(r.meta.statusLabel, pageW - M, 23, { align: "right" });

  let y = 30;

  // ─────────────── Parciales por set ───────────────
  {
    const h = 13 + Math.max(1, r.sets.length) * 5;
    const inner = card(M, y, W, h, "Parciales por set");
    const colW = W / 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    setText(C.muted);
    doc.text("SET", M + 4, inner);
    doc.text("PARCIAL", M + 4 + colW * 1.4, inner);
    doc.text("DURACIÓN", M + 4 + colW * 3.4, inner);
    doc.text("GANADOR", M + 4 + colW * 5.4, inner);
    let ry = inner + 4.5;
    if (r.sets.length === 0) {
      doc.setFont("helvetica", "normal");
      setText(C.muted);
      doc.text("Sin sets registrados", M + 4, ry);
    }
    for (const s of r.sets) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(C.text);
      doc.text(`Set ${s.number}`, M + 4, ry);
      setText(C.home);
      doc.text(String(s.scoreA), M + 4 + colW * 1.4, ry);
      setText(C.muted);
      doc.text("-", M + 8 + colW * 1.4, ry);
      setText(C.away);
      doc.text(String(s.scoreB), M + 11 + colW * 1.4, ry);
      doc.setFont("helvetica", "normal");
      setText(C.muted);
      doc.text(s.durationMs ? formatDurationMs(s.durationMs) : "-", M + 4 + colW * 3.4, ry);
      if (s.winner) {
        setText(s.winner === "A" ? C.home : C.away);
        doc.text(s.winner === "A" ? r.meta.teamAName : r.meta.teamBName, M + 4 + colW * 5.4, ry, {
          maxWidth: colW * 2.4,
        });
      } else {
        setText(C.warn);
        doc.text("En juego", M + 4 + colW * 5.4, ry);
      }
      ry += 5;
    }
    y += h + 4;
  }

  // ─────────────── Comparativa por equipo ───────────────
  const cmp: { label: string; a: string; b: string }[] = [];
  if (r.serve) {
    cmp.push({ label: "Saques", a: String(r.serve.A.serves), b: String(r.serve.B.serves) });
    cmp.push({ label: "Aces", a: String(r.serve.A.aces), b: String(r.serve.B.aces) });
    cmp.push({ label: "Errores de saque", a: String(r.serve.A.errors), b: String(r.serve.B.errors) });
  }
  if (r.attack) {
    cmp.push({ label: "Ataques", a: n0(r.attack.A?.attempts), b: n0(r.attack.B?.attempts) });
    cmp.push({ label: "Puntos de ataque", a: n0(r.attack.A?.points), b: n0(r.attack.B?.points) });
    cmp.push({ label: "Errores de ataque", a: n0(r.attack.A?.errors), b: n0(r.attack.B?.errors) });
    cmp.push({ label: "Efectividad ataque", a: n0(r.attack.A?.effectiveness, "%"), b: n0(r.attack.B?.effectiveness, "%") });
  }
  if (r.block) {
    cmp.push({ label: "Bloqueos punto", a: String(r.block.A.points), b: String(r.block.B.points) });
  }
  if (r.reception) {
    cmp.push({ label: "Recepción positiva", a: n0(r.reception.A?.positivePct, "%"), b: n0(r.reception.B?.positivePct, "%") });
    cmp.push({ label: "Recepciones", a: n0(r.reception.A?.total), b: n0(r.reception.B?.total) });
  }
  if (r.streaks) {
    cmp.push({ label: "Racha máxima", a: `${r.streaks.A}x`, b: `${r.streaks.B}x` });
  }

  const leftW = W * 0.47;
  const rightX = M + leftW + 4;
  const rightW = W - leftW - 4;
  const cmpH = 14 + Math.max(1, cmp.length) * 4.6;

  {
    const inner = card(M, y, leftW, cmpH, "Comparativa de equipos");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    setText(C.home);
    doc.text(r.meta.teamAName, M + 4, inner, { maxWidth: leftW * 0.3 });
    setText(C.away);
    doc.text(r.meta.teamBName, M + leftW - 4, inner, { align: "right", maxWidth: leftW * 0.3 });
    let ry = inner + 5;
    for (const row of cmp) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(C.text);
      doc.text(row.a, M + 4, ry);
      doc.text(row.b, M + leftW - 4, ry, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      setText(C.muted);
      doc.text(row.label, M + leftW / 2, ry, { align: "center" });
      ry += 4.6;
    }
    if (cmp.length === 0) {
      doc.setFont("helvetica", "normal");
      setText(C.muted);
      doc.text("Sin datos cargados", M + 4, ry);
    }
  }

  // ─────────────── Rotaciones + Armador (columna derecha) ───────────────
  const rotRows = r.rotations ? r.rotations[ownSide] : [];
  const rotH = 14 + 6 * 4.4;
  {
    const inner = card(rightX, y, rightW, rotH, `Eficiencia por rotación · ${ownName}`);
    const cx = [rightX + 4, rightX + rightW * 0.34, rightX + rightW * 0.56, rightX + rightW * 0.8];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    setText(C.muted);
    doc.text("ROT", cx[0], inner);
    doc.text("A FAVOR", cx[1], inner);
    doc.text("EN CONTRA", cx[2], inner);
    doc.text("DIF", cx[3], inner);
    let ry = inner + 4.4;
    for (const row of rotRows) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      setText(C.text);
      doc.text(`R${row.rotation}`, cx[0], ry);
      doc.setFont("helvetica", "normal");
      if (row.pf + row.pc === 0) {
        setText(C.muted);
        doc.text("Sin datos", cx[1], ry);
      } else {
        setText(C.text);
        doc.text(String(row.pf), cx[1], ry);
        doc.text(String(row.pc), cx[2], ry);
        setText(row.diff > 0 ? C.good : row.diff < 0 ? C.bad : C.muted);
        doc.setFont("helvetica", "bold");
        doc.text(`${row.diff > 0 ? "+" : ""}${row.diff}`, cx[3], ry);
      }
      ry += 4.4;
    }
    if (rotRows.length === 0) {
      doc.setFont("helvetica", "normal");
      setText(C.muted);
      doc.setFontSize(7);
      doc.text("Sin rallies registrados", cx[0], ry);
    }
  }

  y += Math.max(cmpH, rotH) + 4;

  // ─────────────── Armador por rotación ───────────────
  {
    const s = r.setter;
    const rows = s?.rows ?? [];
    const h = 20 + Math.max(1, rows.length) * 4.4;
    const inner = card(M, y, W, h, `Armador por rotación · ${ownName}`);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setText(C.muted);
    const headBits = s
      ? [
          s.name ?? "Armadora sin identificar",
          s.sets > 0 ? `${s.sets} armados` : null,
          s.positivePct !== null ? `Armado positivo ${Math.round(s.positivePct)}%` : null,
          s.efficiencyPct !== null ? `Eficiencia ${Math.round(s.efficiencyPct)}%` : null,
        ].filter(Boolean).join("  ·  ")
      : "Sin datos de rotación de la armadora";
    doc.text(headBits, M + 3.5, inner - 1.5);

    const colX = (i: number) => M + 4 + (W - 8) * (i / 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    setText(C.muted);
    doc.text("ZONA ARMADORA", colX(0), inner + 4);
    doc.text("RALLIES", colX(2), inner + 4);
    doc.text("A FAVOR", colX(3), inner + 4);
    doc.text("EN CONTRA", colX(4), inner + 4);
    doc.text("DIF / % GANADOS", colX(5), inner + 4);

    let ry = inner + 8.6;
    for (const row of rows) {
      const isBest = s?.best?.zone === row.zone && row.diff > 0;
      const isWorst = s?.worst?.zone === row.zone && row.diff < 0;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setText(isBest ? C.good : isWorst ? C.bad : C.text);
      doc.text(row.label, colX(0), ry);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      if (row.rallies === 0) {
        setText(C.muted);
        doc.text("Sin datos", colX(2), ry);
      } else {
        setText(C.text);
        doc.text(String(row.rallies), colX(2), ry);
        doc.text(String(row.pf), colX(3), ry);
        doc.text(String(row.pc), colX(4), ry);
        setText(row.diff > 0 ? C.good : row.diff < 0 ? C.bad : C.muted);
        doc.setFont("helvetica", "bold");
        doc.text(
          `${row.diff > 0 ? "+" : ""}${row.diff}  (${Math.round(row.winPct)}%)`,
          colX(5),
          ry,
        );
      }
      // Barra de diferencia
      if (row.rallies > 0) {
        const maxAbs = Math.max(1, ...rows.map((x) => Math.abs(x.diff)));
        const barMax = (W - 8) / 6 - 4;
        const bw = (Math.abs(row.diff) / maxAbs) * barMax;
        setFill(row.diff >= 0 ? C.good : C.bad);
        doc.roundedRect(colX(1), ry - 2, Math.max(0.6, bw), 2, 1, 1, "F");
      }
      ry += 4.4;
    }
    if (rows.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(C.muted);
      doc.text("Sin rallies registrados para la armadora.", colX(0), ry);
    } else if (s) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      setText(C.muted);
      doc.text(s.conclusion, M + 3.5, ry + 1.5, { maxWidth: W - 8 });
    }
    y += h + 4;
  }

  // ─────────────── Destacados ───────────────
  {
    const p = r.players;
    const blocks: { title: string; items: string[] }[] = [];
    if (p.topAttack.length) blocks.push({ title: "Top ataque", items: p.topAttack.slice(0, 4).map((x) => `${x.label} — ${x.value} pts`) });
    if (p.topBlock.length) blocks.push({ title: "Bloqueo", items: p.topBlock.slice(0, 4).map((x) => `${x.label} — ${x.value}`) });
    if (p.topServe.length) blocks.push({ title: "Saque", items: p.topServe.slice(0, 4).map((x) => `${x.label} — ${x.value} aces`) });
    if (p.topReception.length) blocks.push({ title: "Recepción", items: p.topReception.slice(0, 4).map((x) => `${x.label} — ${x.value}%`) });
    const maxItems = Math.max(1, ...blocks.map((b) => b.items.length));
    const h = 14 + (p.mvp ? 6 : 0) + maxItems * 4;
    const inner = card(M, y, W, h, "Jugadores destacados");
    let top = inner;
    if (p.mvp) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(C.home);
      doc.text(`MVP · ${p.mvp.label}`, M + 4, top);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      setText(C.muted);
      const bits = [
        `${p.mvp.value} puntos`,
        p.mvp.attackPoints > 0 ? `${p.mvp.attackPoints} ataque` : null,
        p.mvp.blocks > 0 ? `${p.mvp.blocks} bloqueos` : null,
        p.mvp.aces > 0 ? `${p.mvp.aces} aces` : null,
      ].filter(Boolean) as string[];
      doc.text(bits.join("  ·  "), M + 44, top);
      top += 6;
    }
    const colW = (W - 8) / Math.max(1, blocks.length);
    blocks.forEach((b, i) => {
      const bx = M + 4 + i * colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      setText(C.muted);
      doc.text(b.title.toUpperCase(), bx, top);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      setText(C.text);
      b.items.forEach((item, k) => {
        doc.text(doc.splitTextToSize(item, colW - 3)[0], bx, top + 4 + k * 4);
      });
    });
    if (blocks.length === 0 && !p.mvp) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(C.muted);
      doc.text("Sin estadísticas individuales cargadas.", M + 4, top);
    }
    y += h + 4;
  }

  // ─────────────── Conclusiones ───────────────
  {
    const items: { color: RGB; text: string }[] = r.summary
      .slice(0, 4)
      .map((s) => ({ color: s.tone === "good" ? C.good : s.tone === "bad" ? C.bad : C.warn, text: s.text }));
    for (const s of r.tactical.recommendations.slice(0, 2)) items.push({ color: C.good, text: `Recomendación: ${s}` });
    if (items.length === 0) items.push({ color: C.muted, text: "Sin conclusiones automáticas disponibles." });
    const wrapped = items.map((it) => ({ color: it.color, lines: doc.splitTextToSize(it.text, W - 12) as string[] }));
    const lines = wrapped.reduce((n, x) => n + x.lines.length, 0);
    const available = pageH - 10 - y;
    const h = Math.min(12 + lines * 3.8, Math.max(14, available));
    const inner = card(M, y, W, h, "Conclusiones");
    let ry = inner;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    for (const it of wrapped) {
      if (ry + it.lines.length * 3.8 > y + h - 1) break;
      setFill(it.color);
      doc.circle(M + 5, ry - 1, 0.9, "F");
      setText(C.text);
      doc.text(it.lines, M + 8, ry);
      ry += it.lines.length * 3.8;
    }
    y += h;
  }

  // ─────────────── Pie ───────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  setText(C.muted);
  doc.text(
    `RALLY · Reporte simplificado · ${r.meta.teamAName} vs ${r.meta.teamBName} · ${r.meta.dateLabel}`,
    pageW / 2,
    pageH - 4,
    { align: "center" },
  );

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
