import type { Match, Team } from "@/lib/volley-store";
import { computeMatchStats, computeReceptionStats, formatDurationMs } from "@/lib/volley-store";
import { buildSimplifiedReport, type SimplifiedReport } from "@/lib/simplified-report";

/**
 * "Reporte simplificado": planilla visual de UNA sola hoja (A4) pensada para el
 * entrenador. Densa pero legible, con comparativa por equipo, eficiencia por
 * rotación, rendimiento del armador por zona, destacados y tablas de ataque y
 * recepción por jugador.
 *
 * Para garantizar que SIEMPRE entre en una sola carilla sin perder información,
 * el documento se dibuja en dos pasadas: la primera mide la altura natural del
 * contenido y la segunda lo vuelve a dibujar aplicando un factor de escala
 * vertical/tipográfico (K) que comprime todo hasta caber en la hoja.
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

  const stats = computeMatchStats(match);
  const enrichTeam = (team: Team) =>
    [...stats.players.values()]
      .filter((p) => team.players.some((tp) => tp.id === p.playerId))
      .map((p) => {
        const tp = team.players.find((x) => x.id === p.playerId)!;
        return { ...p, name: tp.name, number: tp.number };
      })
      .filter((p) => p.total > 0 || p.serveError + p.attackError + p.unforcedError > 0)
      .sort((a, b) => b.total - a.total);

  const recRows = (team: Team, side: "A" | "B") =>
    [...computeReceptionStats(match.events, side).values()]
      .filter((x) => x.total > 0 && team.players.some((p) => p.id === x.playerId))
      .map((x) => {
        const tp = team.players.find((p) => p.id === x.playerId)!;
        return { ...x, name: tp.name, number: tp.number };
      })
      .sort((a, b) => b.total - a.total);

  /**
   * Dibuja todo el reporte con el factor de escala K y devuelve la Y final.
   * Con `measure` en true no se pinta nada útil (se usa sólo para medir).
   */
  const render = (doc: any, K: number): number => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 10;
    const W = pageW - M * 2;
    const HEAD = 30; // altura fija del encabezado (no se escala)

    const fk = Math.max(0.5, Math.min(1, K));
    const V = (v: number) => v * K;
    const FS = (v: number) => doc.setFontSize(Math.max(3.6, v * fk));

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
      if (!title) return y + V(5);
      doc.setFont("helvetica", "bold");
      FS(7);
      setText(C.muted);
      doc.text(title.toUpperCase(), x + 3.5, y + V(4.6));
      return y + V(9.5);
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

    let y = HEAD;

    // ─────────────── Parciales por set ───────────────
    {
      const h = V(13 + Math.max(1, r.sets.length) * 5);
      const inner = card(M, y, W, h, "Parciales por set");
      const colW = W / 8;
      doc.setFont("helvetica", "bold");
      FS(6.5);
      setText(C.muted);
      doc.text("SET", M + 4, inner);
      doc.text("PARCIAL", M + 4 + colW * 1.4, inner);
      doc.text("DURACIÓN", M + 4 + colW * 3.4, inner);
      doc.text("GANADOR", M + 4 + colW * 5.4, inner);
      let ry = inner + V(4.5);
      if (r.sets.length === 0) {
        doc.setFont("helvetica", "normal");
        setText(C.muted);
        doc.text("Sin sets registrados", M + 4, ry);
      }
      for (const s of r.sets) {
        doc.setFont("helvetica", "bold");
        FS(7.5);
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
        ry += V(5);
      }
      y += h + V(4);
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
    const cmpH = V(14 + Math.max(1, cmp.length) * 4.6);

    {
      const inner = card(M, y, leftW, cmpH, "Comparativa de equipos");
      doc.setFont("helvetica", "bold");
      FS(6.5);
      setText(C.home);
      doc.text(r.meta.teamAName, M + 4, inner, { maxWidth: leftW * 0.3 });
      setText(C.away);
      doc.text(r.meta.teamBName, M + leftW - 4, inner, { align: "right", maxWidth: leftW * 0.3 });
      let ry = inner + V(5);
      for (const row of cmp) {
        doc.setFont("helvetica", "bold");
        FS(7.5);
        setText(C.text);
        doc.text(row.a, M + 4, ry);
        doc.text(row.b, M + leftW - 4, ry, { align: "right" });
        doc.setFont("helvetica", "normal");
        FS(6.5);
        setText(C.muted);
        doc.text(row.label, M + leftW / 2, ry, { align: "center" });
        ry += V(4.6);
      }
      if (cmp.length === 0) {
        doc.setFont("helvetica", "normal");
        setText(C.muted);
        doc.text("Sin datos cargados", M + 4, ry);
      }
    }

    // ─────────────── Rotaciones (columna derecha) ───────────────
    const rotRows = r.rotations ? r.rotations[ownSide] : [];
    const rotH = V(14 + 6 * 4.4);
    {
      const inner = card(rightX, y, rightW, rotH, `Eficiencia por rotación · ${ownName}`);
      const cx = [rightX + 4, rightX + rightW * 0.34, rightX + rightW * 0.56, rightX + rightW * 0.8];
      doc.setFont("helvetica", "bold");
      FS(6);
      setText(C.muted);
      doc.text("ROT", cx[0], inner);
      doc.text("A FAVOR", cx[1], inner);
      doc.text("EN CONTRA", cx[2], inner);
      doc.text("DIF", cx[3], inner);
      let ry = inner + V(4.4);
      for (const row of rotRows) {
        doc.setFont("helvetica", "bold");
        FS(7);
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
        ry += V(4.4);
      }
      if (rotRows.length === 0) {
        doc.setFont("helvetica", "normal");
        setText(C.muted);
        FS(7);
        doc.text("Sin rallies registrados", cx[0], ry);
      }
    }

    // ─────────────── Momentum (rellena la columna derecha) ───────────────
    const gap = cmpH - rotH - V(4);
    if (r.momentum && r.momentum.points.length > 1 && gap >= V(12)) {
      const my = y + rotH + V(4);
      const inner = card(rightX, my, rightW, gap, "Momentum");
      const chartX = rightX + 5;
      const chartW = rightW - 10;
      const chartH = gap - (inner - my) - V(4);
      const midY = inner + chartH / 2;
      setStroke(C.border);
      doc.setLineWidth(0.15);
      doc.line(chartX, midY, chartX + chartW, midY);
      const pts = r.momentum.points;
      const maxAbs = Math.max(3, ...pts.map((p) => Math.abs(p.delta)));
      const stepX = chartW / Math.max(1, pts.length - 1);
      doc.setLineWidth(0.5);
      for (let i = 1; i < pts.length; i++) {
        const x1 = chartX + (i - 1) * stepX;
        const x2 = chartX + i * stepX;
        const y1 = midY - (pts[i - 1].delta / maxAbs) * (chartH / 2);
        const y2 = midY - (pts[i].delta / maxAbs) * (chartH / 2);
        setStroke(pts[i].delta >= 0 ? C.home : C.away);
        doc.line(x1, y1, x2, y2);
      }
      doc.setFont("helvetica", "normal");
      FS(5.6);
      setText(C.home);
      doc.text(`+ ${r.meta.teamAName}`, chartX, inner - 1);
      setText(C.away);
      doc.text(`+ ${r.meta.teamBName}`, chartX + chartW, inner - 1, { align: "right" });
    }

    y += Math.max(cmpH, rotH) + V(4);

    // ─────────────── Armador por rotación (ambos equipos) ───────────────
    {
      const cardW = (W - 4) / 2;
      const sides: { s: (typeof r)["setter"]; name: string; x: number }[] = [
        { s: r.setters?.A ?? null, name: r.meta.teamAName, x: M },
        { s: r.setters?.B ?? null, name: r.meta.teamBName, x: M + cardW + 4 },
      ];
      const maxRows = Math.max(1, ...sides.map((sd) => sd.s?.rows.length ?? 0));
      const h = V(20 + maxRows * 4.4);

      for (const sd of sides) {
        const s = sd.s;
        const rows = s?.rows ?? [];
        const inner = card(sd.x, y, cardW, h, `Armador por rotación · ${sd.name}`);
        doc.setFont("helvetica", "normal");
        FS(6);
        setText(C.muted);
        const headBits = s
          ? [
              s.name ?? "Armadora sin identificar",
              s.sets > 0 ? `${s.sets} armados` : null,
              s.positivePct !== null ? `Positivo ${Math.round(s.positivePct)}%` : null,
              s.efficiencyPct !== null ? `Efic. ${Math.round(s.efficiencyPct)}%` : null,
            ]
              .filter(Boolean)
              .join("  ·  ")
          : "Sin datos de rotación de la armadora";
        doc.text(headBits, sd.x + 3.5, inner - V(1.5), { maxWidth: cardW - 7 });

        const colX = (i: number) => sd.x + 4 + (cardW - 8) * (i / 6);
        doc.setFont("helvetica", "bold");
        FS(5.4);
        setText(C.muted);
        doc.text("ZONA", colX(0), inner + V(4));
        doc.text("RALL.", colX(2), inner + V(4));
        doc.text("A FAV", colX(3), inner + V(4));
        doc.text("EN C.", colX(4), inner + V(4));
        doc.text("DIF / %", colX(5), inner + V(4));

        let ry = inner + V(8.6);
        for (const row of rows) {
          const isBest = s?.best?.zone === row.zone && row.diff > 0;
          const isWorst = s?.worst?.zone === row.zone && row.diff < 0;
          doc.setFont("helvetica", "bold");
          FS(7);
          setText(isBest ? C.good : isWorst ? C.bad : C.text);
          doc.text(row.label, colX(0), ry);
          doc.setFont("helvetica", "normal");
          FS(6.5);
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
              `${row.diff > 0 ? "+" : ""}${row.diff} (${Math.round(row.winPct)}%)`,
              colX(5),
              ry,
            );
            const maxAbs = Math.max(1, ...rows.map((x) => Math.abs(x.diff)));
            const barMax = (cardW - 8) / 6 - 6;
            const bw = (Math.abs(row.diff) / maxAbs) * barMax;
            setFill(row.diff >= 0 ? C.good : C.bad);
            doc.roundedRect(colX(1), ry - V(2), Math.max(0.6, bw), V(1.8), 1, 1, "F");
          }
          ry += V(4.4);
        }
        if (rows.length === 0) {
          doc.setFont("helvetica", "normal");
          FS(6.5);
          setText(C.muted);
          doc.text("Sin rallies registrados para la armadora.", colX(0), ry, {
            maxWidth: cardW - 8,
          });
        } else if (s) {
          doc.setFont("helvetica", "normal");
          FS(5.8);
          setText(C.muted);
          doc.text(s.conclusion, sd.x + 3.5, ry + V(1.5), { maxWidth: cardW - 8 });
        }
      }
      y += h + V(4);
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
      const h = V(14 + (p.mvp ? 6 : 0) + maxItems * 4);
      const inner = card(M, y, W, h, "Jugadores destacados");
      let top = inner;
      if (p.mvp) {
        doc.setFont("helvetica", "bold");
        FS(8);
        setText(C.home);
        doc.text(`MVP · ${p.mvp.label}`, M + 4, top);
        doc.setFont("helvetica", "normal");
        FS(6.5);
        setText(C.muted);
        const bits = [
          `${p.mvp.value} puntos`,
          p.mvp.attackPoints > 0 ? `${p.mvp.attackPoints} ataque` : null,
          p.mvp.blocks > 0 ? `${p.mvp.blocks} bloqueos` : null,
          p.mvp.aces > 0 ? `${p.mvp.aces} aces` : null,
        ].filter(Boolean) as string[];
        doc.text(bits.join("  ·  "), M + 44, top);
        top += V(6);
      }
      const bColW = (W - 8) / Math.max(1, blocks.length);
      blocks.forEach((b, i) => {
        const bx = M + 4 + i * bColW;
        doc.setFont("helvetica", "bold");
        FS(6);
        setText(C.muted);
        doc.text(b.title.toUpperCase(), bx, top);
        doc.setFont("helvetica", "normal");
        FS(6.8);
        setText(C.text);
        b.items.forEach((item, k) => {
          doc.text(doc.splitTextToSize(item, bColW - 3)[0], bx, top + V(4) + k * V(4));
        });
      });
      if (blocks.length === 0 && !p.mvp) {
        doc.setFont("helvetica", "normal");
        FS(7);
        setText(C.muted);
        doc.text("Sin estadísticas individuales cargadas.", M + 4, top);
      }
      y += h + V(4);
    }

    // ─────────────── Ataque y recepción por jugador ───────────────
    {
      /** Tabla compacta genérica. */
      const table = (
        x: number,
        ty: number,
        w: number,
        title: string,
        accent: RGB,
        head: string[],
        body: (string | number)[][],
        widths: number[],
      ) => {
        const rowH = V(3.8);
        const h = V(16) + Math.max(1, body.length) * rowH;
        card(x, ty, w, h, null);
        doc.setFont("helvetica", "bold");
        FS(6.6);
        setText(accent);
        doc.text(title.toUpperCase(), x + 3.5, ty + V(4.6), { maxWidth: w - 7 });
        const total = widths.reduce((s, v) => s + v, 0);
        const colX: number[] = [];
        let acc = x + 3.5;
        for (const cw of widths) {
          colX.push(acc + ((w - 7) * cw) / total / 2);
          acc += ((w - 7) * cw) / total;
        }
        colX[0] = x + 3.5;
        colX[1] = x + 3.5 + ((w - 7) * widths[0]) / total;
        FS(5.4);
        setText(C.muted);
        head.forEach((hd, i) => doc.text(hd, colX[i], ty + V(9.6), { align: i <= 1 ? "left" : "center" }));
        setStroke(C.border);
        doc.setLineWidth(0.15);
        doc.line(x + 3, ty + V(11), x + w - 3, ty + V(11));
        let ry = ty + V(14.4);

        if (body.length === 0) {
          doc.setFont("helvetica", "normal");
          FS(6);
          doc.text("Sin registros", colX[0], ry);
        }
        for (const row of body) {
          doc.setFont("helvetica", "normal");
          FS(6);
          row.forEach((cell, i) => {
            const isLast = i === row.length - 1;
            setText(i === 1 ? C.text : isLast ? accent : C.muted);
            if (isLast) doc.setFont("helvetica", "bold");
            const txt = String(cell);
            doc.text(
              i === 1 ? doc.splitTextToSize(txt, ((w - 7) * widths[1]) / total - 1)[0] : txt,
              colX[i],
              ry,
              { align: i <= 1 ? "left" : "center" },
            );
            if (isLast) doc.setFont("helvetica", "normal");
          });
          ry += rowH;
        }
        return h;
      };

      const teams: { team: Team; side: "A" | "B"; accent: RGB }[] = [
        { team: teamA, side: "A", accent: C.home },
        { team: teamB, side: "B", accent: C.away },
      ];

      const colW = (W - 4) / 2;

      // Fila 1: jugadores (ataque / puntos)
      let maxH = 0;
      teams.forEach((t, i) => {
        const rows = enrichTeam(t.team).map((p) => [
          p.number,
          p.name,
          p.attack,
          p.rotationAttack,
          p.counterAttack,
          p.block,
          p.ace,
          p.serveError,
          p.attackError,
          p.unforcedError,
          p.total,
        ]);
        const h = table(
          M + i * (colW + 4),
          y,
          colW,
          `${t.team.name} · Jugadores`,
          t.accent,
          ["#", "Jugador", "ATA", "A.R", "C.A", "BLO", "S", "E.S", "E.A", "ENF", "TOT"],
          rows,
          [4, 20, 5, 5, 5, 5, 4, 5, 5, 5, 5],
        );
        maxH = Math.max(maxH, h);
      });
      y += maxH + V(4);

      // Fila 2: recepción
      maxH = 0;
      teams.forEach((t, i) => {
        const rows = recRows(t.team, t.side).map((x) => [
          x.number,
          x.name,
          x.doublePositive,
          x.positive,
          x.neutral,
          x.negative,
          x.doubleNegative + x.overpass,
          x.total,
          `${Math.round(x.positivity)}%`,
          `${Math.round(x.efficiency)}%`,
        ]);
        const h = table(
          M + i * (colW + 4),
          y,
          colW,
          `${t.team.name} · Recepción`,
          t.accent,
          ["#", "Receptor", "#", "+", "0", "-", "=", "Tot", "Efect%", "Efic%"],
          rows,
          [4, 20, 4, 4, 4, 4, 4, 5, 7, 7],
        );
        maxH = Math.max(maxH, h);
      });
      y += maxH;
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

    return y;
  };

  // Pasada 1: medir la altura natural del contenido.
  const probe = new jsPDF({ unit: "mm", format: "a4" });
  const pageH = probe.internal.pageSize.getHeight();
  const HEAD = 30;
  const available = pageH - 8 - HEAD; // margen inferior para el pie
  const naturalBottom = render(probe, 1);
  const natural = Math.max(1, naturalBottom - HEAD);

  // Factor de compresión: nunca amplía, comprime lo justo para entrar.
  const K = natural <= available ? 1 : Math.max(0.45, available / natural);

  const doc = K === 1 ? probe : new jsPDF({ unit: "mm", format: "a4" });
  if (K !== 1) render(doc, K);

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
