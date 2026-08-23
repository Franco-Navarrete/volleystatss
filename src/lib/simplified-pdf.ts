import type { Match, Player, Team } from "@/lib/volley-store";
import { computeMatchStats, computeReceptionStats, formatDurationMs } from "@/lib/volley-store";
import { buildSimplifiedReport, type SimplifiedReport } from "@/lib/simplified-report";

/**
 * "Reporte simplificado" = planilla técnica completa de UNA sola hoja A4
 * horizontal, inspirada en la estructura de Data Volley pero con el lenguaje
 * visual de RALLY (fondo oscuro, naranja local / azul visitante, tablas densas).
 *
 * Se dibuja en dos pasadas: la primera mide la altura natural y la segunda
 * aplica un factor de compresión K para garantizar una única página sin perder
 * información. Todos los datos provienen de los eventos ya registrados.
 */

type RGB = [number, number, number];

const C = {
  bg: [15, 20, 32] as RGB,
  card: [23, 30, 46] as RGB,
  cardAlt: [30, 39, 58] as RGB,
  row: [28, 36, 54] as RGB,
  border: [51, 65, 85] as RGB,
  dim: [90, 105, 130] as RGB,
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

const POS_ABBR: Record<string, string> = {
  punta: "P",
  central: "C",
  opuesto: "O",
  armador: "A",
  libero: "L",
  universal: "U",
};

interface PlayerRow {
  number: number;
  name: string;
  sets: string;
  pos: string;
  ata: number;
  ar: number;
  ca: number;
  ea: number;
  ace: number;
  es: number;
  blo: number;
  rec: number;
  posPct: number | null;
  perPct: number | null;
  err: number;
  pts: number;
}

export async function downloadSimplifiedMatchPdf(
  match: Match,
  teamA: Team,
  teamB: Team,
  opts: { competition?: string | null; ownSide?: "A" | "B" } = {},
): Promise<SimplifiedPdfResult> {
  const { jsPDF } = await import("jspdf");
  const r = buildSimplifiedReport(match, teamA, teamB, opts);

  const stats = computeMatchStats(match);

  /** Sets en los que el jugador registró alguna acción (dato real). */
  const setsOf = (playerId: string) => {
    const set = new Set<number>();
    for (const ev of match.events) {
      if ("kind" in ev) continue;
      if (ev.playerId === playerId) set.add(ev.setNumber);
    }
    return [...set].sort((a, b) => a - b).join(" ");
  };

  const buildRows = (team: Team, side: "A" | "B"): PlayerRow[] => {
    const rec = computeReceptionStats(match.events, side);
    const rows = team.players.map((p: Player) => {
      const s = stats.players.get(p.id);
      const rc = rec.get(p.id);
      return {
        number: p.number,
        name: p.name,
        sets: setsOf(p.id),
        pos: p.position ? (POS_ABBR[p.position] ?? "-") : "-",
        ata: s?.attack ?? 0,
        ar: s?.rotationAttack ?? 0,
        ca: s?.counterAttack ?? 0,
        ea: s?.attackError ?? 0,
        ace: s?.ace ?? 0,
        es: s?.serveError ?? 0,
        blo: s?.block ?? 0,
        rec: rc?.total ?? 0,
        posPct: rc && rc.total > 0 ? rc.positivity : null,
        perPct:
          rc && rc.total > 0 ? (rc.doublePositive / rc.total) * 100 : null,
        err: (s?.unforcedError ?? 0) + (s?.blockError ?? 0),
        pts: s?.total ?? 0,
      } satisfies PlayerRow;
    });
    const active = rows.filter(
      (x) =>
        x.pts > 0 || x.rec > 0 || x.err > 0 || x.ea > 0 || x.es > 0 || x.sets.length > 0,
    );
    return (active.length > 0 ? active : rows).sort((a, b) => a.number - b.number);
  };

  const rowsA = buildRows(teamA, "A");
  const rowsB = buildRows(teamB, "B");

  const totalsOf = (rows: PlayerRow[]) =>
    rows.reduce(
      (acc, x) => ({
        ata: acc.ata + x.ata,
        ar: acc.ar + x.ar,
        ca: acc.ca + x.ca,
        ea: acc.ea + x.ea,
        ace: acc.ace + x.ace,
        es: acc.es + x.es,
        blo: acc.blo + x.blo,
        rec: acc.rec + x.rec,
        err: acc.err + x.err,
        pts: acc.pts + x.pts,
      }),
      { ata: 0, ar: 0, ca: 0, ea: 0, ace: 0, es: 0, blo: 0, rec: 0, err: 0, pts: 0 },
    );

  const render = (doc: any, K: number): number => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 7;
    const W = pageW - M * 2;
    const HEAD = 26;

    const fk = Math.max(0.55, Math.min(1.18, K));
    const V = (v: number) => v * K;
    const FS = (v: number) => doc.setFontSize(Math.max(3.4, v * fk));

    const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
    const setStroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

    setFill(C.bg);
    doc.rect(0, 0, pageW, pageH, "F");

    const card = (x: number, y: number, w: number, h: number, title: string | null, accent?: RGB) => {
      setFill(C.card);
      setStroke(C.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, w, h, 1.6, 1.6, "FD");
      if (!title) return y + V(4);
      doc.setFont("helvetica", "bold");
      FS(6.2);
      setText(accent ?? C.muted);
      doc.text(title.toUpperCase(), x + 2.6, y + V(4), { maxWidth: w - 5 });
      return y + V(8);
    };

    // ─────────────── Encabezado ───────────────
    setFill(C.cardAlt);
    doc.rect(0, 0, pageW, 22, "F");
    setFill(C.home);
    doc.rect(0, 0, pageW, 1.2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setText(C.home);
    doc.text("RALLY", M, 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    setText(C.muted);
    doc.text("REPORTE SIMPLIFICADO — INFORME TÉCNICO", M + 18, 8.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(C.text);
    doc.text(`${r.meta.teamAName}  vs  ${r.meta.teamBName}`, M, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    setText(C.muted);
    const metaBits = [
      r.meta.dateLabel,
      r.meta.timeLabel ? `${r.meta.timeLabel} hs` : null,
      r.meta.competition,
      r.meta.category ? `Cat. ${r.meta.category}` : null,
      r.meta.venue,
      r.duration ? `Duración ${formatDurationMs(r.duration.totalMs)}` : null,
      r.meta.statusLabel,
    ].filter(Boolean) as string[];
    doc.text(metaBits.join("  ·  "), M, 19.5, { maxWidth: pageW * 0.62 });

    // Resultado + parciales (derecha)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    setText(C.home);
    doc.text(String(r.score.a), pageW - M - 12, 12, { align: "right" });
    setText(C.muted);
    doc.setFontSize(10);
    doc.text("-", pageW - M - 8, 11.6, { align: "center" });
    doc.setFontSize(17);
    setText(C.away);
    doc.text(String(r.score.b), pageW - M, 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    setText(C.muted);
    doc.text(
      r.sets.map((s) => `${s.scoreA}-${s.scoreB}`).join("  |  ") || "Sin parciales",
      pageW - M,
      18,
      { align: "right" },
    );

    let y = HEAD;

    // ─────────────── Tabla de sets ───────────────
    {
      const h = V(9.5);
      card(M, y, W, h, null);
      const cols = Math.max(1, r.sets.length);
      const cw = (W - 6) / (cols + 1);
      doc.setFont("helvetica", "bold");
      FS(5.6);
      setText(C.muted);
      const ty = y + V(3.6);
      doc.text("SET", M + 3, ty);
      doc.text("DURACIÓN", M + 3, y + V(7.2));
      r.sets.forEach((s, i) => {
        const x = M + 3 + cw * (i + 1);
        setText(C.muted);
        doc.setFont("helvetica", "bold");
        FS(5.6);
        doc.text(`SET ${s.number}`, x, ty);
        doc.setFont("helvetica", "bold");
        FS(7.4);
        setText(s.winner === "A" ? C.home : C.muted);
        doc.text(String(s.scoreA), x + cw * 0.42, ty);
        setText(C.muted);
        doc.text("-", x + cw * 0.55, ty);
        setText(s.winner === "B" ? C.away : C.muted);
        doc.text(String(s.scoreB), x + cw * 0.62, ty);
        doc.setFont("helvetica", "normal");
        FS(5.6);
        setText(C.muted);
        doc.text(s.durationMs ? formatDurationMs(s.durationMs) : "-", x, y + V(7.2));
        setText(s.winner ? (s.winner === "A" ? C.home : C.away) : C.warn);
        doc.text(
          s.winner ? (s.winner === "A" ? r.meta.teamAName : r.meta.teamBName) : "En juego",
          x + cw * 0.42,
          y + V(7.2),
          { maxWidth: cw * 0.55 },
        );
      });
      y += h + V(2.5);
    }

    // ─────────────── Tablas de jugadores ───────────────
    const HEADS = ["#", "JUGADOR", "SETS", "POS", "ATA", "A.R", "C.A", "E.A", "ACE", "E.S", "BLO", "REC", "POS%", "PER%", "ERR", "PTS"];
    const WGT = [4, 24, 8, 5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 7, 7, 5.5, 6];

    const playerTable = (
      x: number,
      ty: number,
      w: number,
      team: Team,
      rows: PlayerRow[],
      accent: RGB,
      tag: string,
    ) => {
      const rowH = V(3.5);
      const h = V(13.5) + Math.max(1, rows.length) * rowH + V(5);
      card(x, ty, w, h, null);
      doc.setFont("helvetica", "bold");
      FS(6.6);
      setText(accent);
      doc.text(`${tag} · ${team.name}`.toUpperCase(), x + 2.6, ty + V(4.2), { maxWidth: w - 5 });

      const totalW = WGT.reduce((s, v) => s + v, 0);
      const inner = w - 5;
      const colStart: number[] = [];
      let acc = x + 2.6;
      for (const g of WGT) {
        colStart.push(acc);
        acc += (inner * g) / totalW;
      }
      const colCenter = (i: number) => colStart[i] + (inner * WGT[i]) / totalW / 2;

      FS(4.9);
      doc.setFont("helvetica", "bold");
      setText(C.muted);
      HEADS.forEach((hd, i) =>
        doc.text(hd, i <= 1 ? colStart[i] : colCenter(i), ty + V(8.4), {
          align: i <= 1 ? "left" : "center",
        }),
      );
      setStroke(C.border);
      doc.setLineWidth(0.15);
      doc.line(x + 2.4, ty + V(9.8), x + w - 2.4, ty + V(9.8));

      let ry = ty + V(13);
      rows.forEach((row, idx) => {
        if (idx % 2 === 1) {
          setFill(C.row);
          doc.rect(x + 2.2, ry - rowH + V(1), w - 4.4, rowH, "F");
        }
        const cells: (string | number)[] = [
          row.number,
          row.name,
          row.sets || "-",
          row.pos,
          row.ata,
          row.ar,
          row.ca,
          row.ea,
          row.ace,
          row.es,
          row.blo,
          row.rec,
          row.posPct === null ? "-" : `${Math.round(row.posPct)}`,
          row.perPct === null ? "-" : `${Math.round(row.perPct)}`,
          row.err,
          row.pts,
        ];
        FS(5.4);
        cells.forEach((cell, i) => {
          const isName = i === 1;
          const isPts = i === cells.length - 1;
          doc.setFont("helvetica", isPts || isName ? "bold" : "normal");
          setText(isPts ? accent : isName ? C.text : cell === 0 || cell === "-" ? C.dim : C.text);
          const txt = String(cell);
          doc.text(
            isName ? doc.splitTextToSize(txt, (inner * WGT[1]) / totalW - 1)[0] : txt,
            i <= 1 ? colStart[i] : colCenter(i),
            ry,
            { align: i <= 1 ? "left" : "center" },
          );
        });
        ry += rowH;
      });
      if (rows.length === 0) {
        doc.setFont("helvetica", "normal");
        FS(5.6);
        setText(C.muted);
        doc.text("Sin jugadores registrados", colStart[0], ry);
        ry += rowH;
      }

      // Totales del equipo
      const t = totalsOf(rows);
      setFill(C.cardAlt);
      doc.rect(x + 2.2, ry - rowH + V(1), w - 4.4, rowH + V(0.6), "F");
      const tot: (string | number)[] = [
        "",
        "TOTALES EQUIPO",
        "",
        "",
        t.ata,
        t.ar,
        t.ca,
        t.ea,
        t.ace,
        t.es,
        t.blo,
        t.rec,
        "",
        "",
        t.err,
        t.pts,
      ];
      FS(5.4);
      doc.setFont("helvetica", "bold");
      tot.forEach((cell, i) => {
        if (cell === "") return;
        setText(i === 1 ? C.muted : i === tot.length - 1 ? accent : C.text);
        doc.text(String(cell), i <= 1 ? colStart[i] : colCenter(i), ry + V(0.4), {
          align: i <= 1 ? "left" : "center",
        });
      });
      return h;
    };

    {
      const colW = (W - 3) / 2;
      const hA = playerTable(M, y, colW, teamA, rowsA, C.home, "Local");
      const hB = playerTable(M + colW + 3, y, colW, teamB, rowsB, C.away, "Visitante");
      y += Math.max(hA, hB) + V(2.5);
    }

    // ─────────────── Bloques de equipo (puntos por set / saque / recepción / ataque / bloqueo) ───
    {
      const miniTable = (
        x: number,
        ty: number,
        w: number,
        h: number,
        title: string,
        head: string[],
        rowsData: { label: string; accent: RGB; cells: string[] }[],
      ) => {
        const inner = card(x, ty, w, h, title);
        const cols = head.length + 1;
        const cw = (w - 5) / cols;
        doc.setFont("helvetica", "bold");
        FS(4.8);
        setText(C.muted);
        head.forEach((hd, i) => doc.text(hd, x + 2.6 + cw * (i + 1) + cw / 2, inner, { align: "center", maxWidth: cw }));
        let ry = inner + V(4);
        for (const row of rowsData) {
          doc.setFont("helvetica", "bold");
          FS(5.2);
          setText(row.accent);
          doc.text(doc.splitTextToSize(row.label, cw * 1.05)[0], x + 2.6, ry);
          doc.setFont("helvetica", "normal");
          setText(C.text);
          row.cells.forEach((cell, i) =>
            doc.text(cell, x + 2.6 + cw * (i + 1) + cw / 2, ry, { align: "center" }),
          );
          ry += V(4);
        }
      };

      const shortA = teamA.shortName || teamA.name;
      const shortB = teamB.shortName || teamB.name;
      const blockH = V(17);
      const gaps = 3;
      const bw = (W - gaps * 3) / 4;
      const xs = [M, M + bw + 3, M + (bw + 3) * 2, M + (bw + 3) * 3];

      // Puntos por set
      miniTable(
        xs[0],
        y,
        bw,
        blockH,
        "Puntos por set",
        r.sets.map((s) => `S${s.number}`),
        [
          { label: shortA, accent: C.home, cells: r.sets.map((s) => String(s.scoreA)) },
          { label: shortB, accent: C.away, cells: r.sets.map((s) => String(s.scoreB)) },
        ],
      );

      // Saque
      miniTable(
        xs[1],
        y,
        bw,
        blockH,
        "Saque",
        ["SAQ", "ACE", "ERR", "EFIC%"],
        [
          {
            label: shortA,
            accent: C.home,
            cells: r.serve
              ? [String(r.serve.A.serves), String(r.serve.A.aces), String(r.serve.A.errors), n0(r.serve.A.efficiency)]
              : ["-", "-", "-", "-"],
          },
          {
            label: shortB,
            accent: C.away,
            cells: r.serve
              ? [String(r.serve.B.serves), String(r.serve.B.aces), String(r.serve.B.errors), n0(r.serve.B.efficiency)]
              : ["-", "-", "-", "-"],
          },
        ],
      );

      // Recepción
      miniTable(
        xs[2],
        y,
        bw,
        blockH,
        "Recepción",
        ["TOT", "POS%", "PER%", "ERR"],
        [
          {
            label: shortA,
            accent: C.home,
            cells: r.reception?.A
              ? [String(r.reception.A.total), n0(r.reception.A.positivePct), n0(r.reception.A.perfectPct), String(r.reception.A.errors)]
              : ["-", "-", "-", "-"],
          },
          {
            label: shortB,
            accent: C.away,
            cells: r.reception?.B
              ? [String(r.reception.B.total), n0(r.reception.B.positivePct), n0(r.reception.B.perfectPct), String(r.reception.B.errors)]
              : ["-", "-", "-", "-"],
          },
        ],
      );

      // Ataque + bloqueo
      miniTable(
        xs[3],
        y,
        bw,
        blockH,
        "Ataque y bloqueo",
        ["INT", "PTS", "ERR", "BLQ.R", "EFIC%", "BLO"],
        [
          {
            label: shortA,
            accent: C.home,
            cells: [
              n0(r.attack?.A?.attempts),
              n0(r.attack?.A?.points),
              n0(r.attack?.A?.errors),
              n0(r.attack?.A?.blocked),
              n0(r.attack?.A?.efficiency),
              String(r.block?.A.points ?? 0),
            ],
          },
          {
            label: shortB,
            accent: C.away,
            cells: [
              n0(r.attack?.B?.attempts),
              n0(r.attack?.B?.points),
              n0(r.attack?.B?.errors),
              n0(r.attack?.B?.blocked),
              n0(r.attack?.B?.efficiency),
              String(r.block?.B.points ?? 0),
            ],
          },
        ],
      );

      y += blockH + V(2.5);
    }

    // ─────────────── Rotaciones | Armadores ───────────────
    {
      const h = V(20);
      const leftW = W * 0.44;
      const rightX = M + leftW + 3;
      const rightW = W - leftW - 3;

      // Rotaciones
      const inner = card(M, y, leftW, h, "Eficiencia por rotación (dif. puntos)");
      const cw = (leftW - 5) / 7;
      doc.setFont("helvetica", "bold");
      FS(5);
      setText(C.muted);
      [1, 2, 3, 4, 5, 6].forEach((n, i) =>
        doc.text(`R${n}`, M + 2.6 + cw * (i + 1) + cw / 2, inner, { align: "center" }),
      );
      const rotRow = (label: string, accent: RGB, rows: { rotation: number; diff: number }[] | null, ry: number) => {
        doc.setFont("helvetica", "bold");
        FS(5.2);
        setText(accent);
        doc.text(doc.splitTextToSize(label, cw * 1.05)[0], M + 2.6, ry);
        if (!rows) {
          doc.setFont("helvetica", "normal");
          setText(C.muted);
          doc.text("Sin datos", M + 2.6 + cw * 1.5, ry);
          return;
        }
        rows.forEach((row, i) => {
          setText(row.diff > 0 ? C.good : row.diff < 0 ? C.bad : C.muted);
          doc.text(`${row.diff > 0 ? "+" : ""}${row.diff}`, M + 2.6 + cw * (i + 1) + cw / 2, ry, {
            align: "center",
          });
        });
      };
      rotRow(teamA.shortName || teamA.name, C.home, r.rotations?.A ?? null, inner + V(4.4));
      rotRow(teamB.shortName || teamB.name, C.away, r.rotations?.B ?? null, inner + V(8.4));

      const bestWorst = (rows: { rotation: number; diff: number; pf: number; pc: number }[] | undefined) => {
        const played = (rows ?? []).filter((x) => x.pf + x.pc > 0);
        if (played.length === 0) return null;
        const best = [...played].sort((a, b) => b.diff - a.diff)[0];
        const worst = [...played].sort((a, b) => a.diff - b.diff)[0];
        return `Mejor R${best.rotation} · Peor R${worst.rotation}`;
      };
      doc.setFont("helvetica", "normal");
      FS(5);
      setText(C.muted);
      const bwA = bestWorst(r.rotations?.A);
      const bwB = bestWorst(r.rotations?.B);
      doc.text(
        [bwA ? `${teamA.shortName || teamA.name}: ${bwA}` : null, bwB ? `${teamB.shortName || teamB.name}: ${bwB}` : null]
          .filter(Boolean)
          .join("   ·   ") || "Sin rallies con rotación registrada",
        M + 2.6,
        inner + V(12.6),
        { maxWidth: leftW - 5 },
      );

      // Armadores
      const inner2 = card(rightX, y, rightW, h, "Armadores");
      const setterLine = (label: string, accent: RGB, s: SimplifiedReport["setter"], ry: number) => {
        doc.setFont("helvetica", "bold");
        FS(5.4);
        setText(accent);
        doc.text(label, rightX + 2.6, ry, { maxWidth: rightW * 0.2 });
        doc.setFont("helvetica", "normal");
        setText(C.text);
        if (!s) {
          setText(C.muted);
          doc.text("Sin datos de armado", rightX + 2.6 + rightW * 0.22, ry);
          return;
        }
        const bits = [
          s.name ?? "Armador sin identificar",
          s.sets > 0 ? `${s.sets} armados` : null,
          s.efficiencyPct !== null ? `Efic. ${Math.round(s.efficiencyPct)}%` : null,
          s.positivePct !== null ? `Pos. ${Math.round(s.positivePct)}%` : null,
          s.best ? `Mejor ${s.best.label}` : null,
          s.worst ? `Peor ${s.worst.label}` : null,
        ].filter(Boolean) as string[];
        doc.text(bits.join("  ·  "), rightX + 2.6 + rightW * 0.22, ry, { maxWidth: rightW * 0.76 });
      };
      setterLine(teamA.shortName || teamA.name, C.home, r.setters?.A ?? null, inner2 + V(4.4));
      setterLine(teamB.shortName || teamB.name, C.away, r.setters?.B ?? null, inner2 + V(9.4));

      y += h + V(2.5);
    }

    // ─────────────── Momentum + Análisis RALLY ───────────────
    {
      const h = V(20);
      const hasMomentum = !!(r.momentum && r.momentum.points.length > 1);
      const leftW = hasMomentum ? W * 0.32 : 0;
      const rightX = hasMomentum ? M + leftW + 3 : M;
      const rightW = W - (hasMomentum ? leftW + 3 : 0);

      if (hasMomentum && r.momentum) {
        const inner = card(M, y, leftW, h, "Momentum");
        const chartX = M + 4;
        const chartW = leftW - 8;
        const chartH = h - (inner - y) - V(3);
        const midY = inner + chartH / 2;
        setStroke(C.border);
        doc.setLineWidth(0.15);
        doc.line(chartX, midY, chartX + chartW, midY);
        const pts = r.momentum.points;
        const maxAbs = Math.max(3, ...pts.map((p) => Math.abs(p.delta)));
        const stepX = chartW / Math.max(1, pts.length - 1);
        doc.setLineWidth(0.4);
        for (let i = 1; i < pts.length; i++) {
          const x1 = chartX + (i - 1) * stepX;
          const x2 = chartX + i * stepX;
          const y1 = midY - (pts[i - 1].delta / maxAbs) * (chartH / 2);
          const y2 = midY - (pts[i].delta / maxAbs) * (chartH / 2);
          setStroke(pts[i].delta >= 0 ? C.home : C.away);
          doc.line(x1, y1, x2, y2);
        }
        doc.setFont("helvetica", "normal");
        FS(4.6);
        setText(C.home);
        doc.text(`+ ${teamA.shortName || teamA.name}`, chartX, inner - V(0.6));
        setText(C.away);
        doc.text(`+ ${teamB.shortName || teamB.name}`, chartX + chartW, inner - V(0.6), { align: "right" });
      }

      const inner2 = card(rightX, y, rightW, h, "Análisis RALLY");
      const strength = r.summary.find((s) => s.tone === "good")?.text ?? null;
      const weakness = r.summary.find((s) => s.tone === "bad" || s.tone === "warn")?.text ?? null;
      const rec = r.tactical.recommendations[0] ?? r.tactical.situation[0] ?? null;
      const lines: { label: string; text: string; color: RGB }[] = [];
      if (strength) lines.push({ label: "Fortaleza", text: strength, color: C.good });
      if (weakness) lines.push({ label: "Debilidad", text: weakness, color: C.bad });
      if (rec) lines.push({ label: "Recomendación", text: rec, color: C.warn });
      let ry = inner2 + V(3.4);
      if (lines.length === 0) {
        doc.setFont("helvetica", "normal");
        FS(5.4);
        setText(C.muted);
        doc.text("Sin datos suficientes para el análisis.", rightX + 2.6, ry);
      }
      for (const l of lines) {
        doc.setFont("helvetica", "bold");
        FS(5.2);
        setText(l.color);
        doc.text(l.label.toUpperCase(), rightX + 2.6, ry);
        doc.setFont("helvetica", "normal");
        setText(C.text);
        doc.text(doc.splitTextToSize(l.text, rightW - 36)[0], rightX + 30, ry);
        ry += V(4.4);
      }

      y += h;
    }

    // ─────────────── Pie ───────────────
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.6);
    setText(C.muted);
    doc.text(
      "ATA puntos de ataque · A.R ataque de rotación · C.A contraataque · E.A error de ataque · ACE ace · E.S error de saque · BLO bloqueo punto · REC recepciones · POS% positiva · PER% perfecta · ERR errores · PTS puntos",
      M,
      pageH - 3.2,
      { maxWidth: W * 0.72 },
    );
    doc.text(
      `RALLY · Reporte simplificado · ${r.meta.dateLabel}`,
      pageW - M,
      pageH - 3.2,
      { align: "right" },
    );

    return y;
  };

  // Pasada 1: medir la altura natural del contenido.
  const probe = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageH = probe.internal.pageSize.getHeight();
  const HEAD = 26;
  const available = pageH - 7 - HEAD;
  const naturalBottom = render(probe, 1);
  const natural = Math.max(1, naturalBottom - HEAD);

  // Comprime si sobra contenido y expande (con tope) si sobra espacio, para
  // aprovechar toda la hoja sin pasar a una segunda página.
  const raw = available / natural;
  const K = raw >= 1 ? Math.min(1.3, raw) : Math.max(0.4, raw);

  const doc = K === 1 ? probe : new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
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
