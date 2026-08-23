import type { Match, Player, Team } from "@/lib/volley-store";
import {
  computeReceptionStats,
  formatDurationMs,
  getSetDuration,
} from "@/lib/volley-store";
import { buildSimplifiedReport, type SimplifiedReport } from "@/lib/simplified-report";

/**
 * "Reporte simplificado" = planilla técnica estilo Data Volley.
 *
 * Una sola hoja A4 vertical, fondo blanco, cajas con borde fino y cabeceras
 * agrupadas (Puntos / Saque / Recepción / Ataque / BL), tabla por equipo con
 * totales, parciales por set y caja de referencias al pie.
 *
 * No inventa datos: todo sale de los eventos registrados en el partido.
 */

type RGB = [number, number, number];

const C = {
  ink: [17, 24, 39] as RGB,
  soft: [90, 100, 118] as RGB,
  line: [110, 120, 135] as RGB,
  hair: [175, 183, 195] as RGB,
  head: [226, 232, 240] as RGB,
  zebra: [243, 246, 250] as RGB,
  home: [190, 30, 45] as RGB,
  away: [23, 64, 139] as RGB,
  white: [255, 255, 255] as RGB,
};

export type SimplifiedPdfResult = {
  method: "share" | "download" | "cancelled";
  fileName: string;
  sizeKb: number;
  url?: string;
};

const safe = (s: string) => s.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "_");

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
  pos: string;
  sets: number[];
  ptsTot: number;
  bp: number;
  gp: number;
  srvTot: number;
  srvErr: number;
  srvPts: number;
  recTot: number;
  recErr: number;
  recPos: number | null;
  recPerf: number | null;
  atkTot: number;
  atkErr: number;
  atkBl: number;
  atkPts: number;
  atkPct: number | null;
  blPts: number;
}

type SideKey = "A" | "B";

export async function downloadSimplifiedMatchPdf(
  match: Match,
  teamA: Team,
  teamB: Team,
  opts: { competition?: string | null; ownSide?: SideKey } = {},
): Promise<SimplifiedPdfResult> {
  const { jsPDF } = await import("jspdf");
  const r = buildSimplifiedReport(match, teamA, teamB, opts);

  // ── Secuencia de saque (para break points) ───────────────
  const pointEvents = match.events.filter(
    (e): e is Extract<Match["events"][number], { scoringSide: SideKey }> => !("kind" in e),
  );
  const servingOf = new Map<string, SideKey>();
  {
    const bySet = new Map<number, typeof pointEvents>();
    for (const p of pointEvents) {
      const arr = bySet.get(p.setNumber) ?? [];
      arr.push(p);
      bySet.set(p.setNumber, arr);
    }
    for (const [setNum, evs] of [...bySet.entries()].sort((a, b) => a[0] - b[0])) {
      const sorted = [...evs].sort((a, b) => a.timestamp - b.timestamp);
      let serving: SideKey =
        setNum % 2 === 1
          ? match.initialServingSide
          : match.initialServingSide === "A"
            ? "B"
            : "A";
      for (const ev of sorted) {
        servingOf.set(ev.id, serving);
        if (ev.scoringSide !== serving) serving = ev.scoringSide;
      }
    }
  }

  const buildRows = (team: Team, side: SideKey): PlayerRow[] => {
    const rec = computeReceptionStats(match.events, side);
    const base = new Map<string, PlayerRow>();
    const ensure = (p: Player): PlayerRow => {
      let row = base.get(p.id);
      if (!row) {
        row = {
          number: p.number,
          name: p.name,
          pos: p.position ? (POS_ABBR[p.position] ?? "-") : "-",
          sets: [],
          ptsTot: 0,
          bp: 0,
          gp: 0,
          srvTot: 0,
          srvErr: 0,
          srvPts: 0,
          recTot: 0,
          recErr: 0,
          recPos: null,
          recPerf: null,
          atkTot: 0,
          atkErr: 0,
          atkBl: 0,
          atkPts: 0,
          atkPct: null,
          blPts: 0,
        };
        base.set(p.id, row);
      }
      return row;
    };
    for (const p of team.players) ensure(p);

    const byId = new Map(team.players.map((p) => [p.id, p]));
    const touch = (id: string | null | undefined, setNumber: number) => {
      if (!id) return null;
      const p = byId.get(id);
      if (!p) return null;
      const row = ensure(p);
      if (!row.sets.includes(setNumber)) row.sets.push(setNumber);
      return row;
    };

    const errors = new Map<string, number>();
    for (const ev of match.events) {
      if ("kind" in ev) {
        if (ev.kind === "attackAttempt" && ev.side === side) {
          const row = touch(ev.playerId, ev.setNumber);
          if (row) row.atkTot++;
        }
        if (ev.kind === "reception" && ev.side === side) touch(ev.playerId, ev.setNumber);
        continue;
      }
      // Ataque bloqueado por el rival: se le cuenta al atacante si se registró.
      if (ev.type === "block" && ev.scoringSide !== side && ev.playerSide === side) {
        const row = touch(ev.playerId, ev.setNumber);
        if (row) {
          row.atkTot++;
          row.atkBl++;
        }
      }
      if (ev.scoringSide === side && ev.playerSide === side) {
        const row = touch(ev.playerId, ev.setNumber);
        if (row) {
          row.ptsTot++;
          if (servingOf.get(ev.id) !== side) row.bp++;
          if (ev.type === "ace") {
            row.srvPts++;
            row.srvTot++;
          }
          if (ev.type === "block") row.blPts++;
          if (ev.type === "attack" || ev.type === "counter_attack" || ev.type === "rotation_attack") {
            row.atkPts++;
            row.atkTot++;
          }
        }
      }
      if (ev.playerSide === side && ev.scoringSide !== side) {
        const row = touch(ev.playerId, ev.setNumber);
        if (row) {
          errors.set(ev.playerId!, (errors.get(ev.playerId!) ?? 0) + 1);
          if (ev.type === "serve_error") {
            row.srvErr++;
            row.srvTot++;
          }
          if (ev.type === "attack_error") {
            row.atkErr++;
            row.atkTot++;
          }
        }
      }
    }

    for (const [id, row] of base) {
      const rc = rec.get(id);
      if (rc) {
        row.recTot = rc.total;
        row.recErr = rc.doubleNegative + rc.overpass;
        row.recPos = rc.total > 0 ? rc.positivity : null;
        row.recPerf = rc.total > 0 ? (rc.doublePositive / rc.total) * 100 : null;
      }
      row.gp = row.ptsTot - (errors.get(id) ?? 0);
      row.atkPct = row.atkTot > 0 ? (row.atkPts / row.atkTot) * 100 : null;
      row.sets.sort((a, b) => a - b);
    }

    const rows = [...base.values()];
    const active = rows.filter(
      (x) => x.sets.length > 0 || x.ptsTot > 0 || x.recTot > 0 || x.atkTot > 0,
    );
    return (active.length > 0 ? active : rows).sort((a, b) => a.number - b.number);
  };

  const rowsA = buildRows(teamA, "A");
  const rowsB = buildRows(teamB, "B");

  /** Puntos ganados por set desglosados por origen (Saq / Ata / Bl / Er.Ad). */
  const setBreakdown = (side: SideKey) =>
    r.sets.map((s) => {
      let saq = 0;
      let ata = 0;
      let bl = 0;
      let erAd = 0;
      for (const ev of pointEvents) {
        if (ev.setNumber !== s.number || ev.scoringSide !== side) continue;
        if (ev.type === "ace") saq++;
        else if (ev.type === "attack" || ev.type === "counter_attack" || ev.type === "rotation_attack") ata++;
        else if (ev.type === "block") bl++;
        else erAd++;
      }
      return { set: s.number, saq, ata, bl, erAd, tot: saq + ata + bl + erAd };
    });

  const brkA = setBreakdown("A");
  const brkB = setBreakdown("B");

  /** Parciales 8 / 16 / 21 por set (como Data Volley). */
  const partials = r.sets.map((s) => {
    const evs = pointEvents
      .filter((e) => e.setNumber === s.number)
      .sort((a, b) => a.timestamp - b.timestamp);
    let a = 0;
    let b = 0;
    const marks: Record<number, string> = {};
    for (const ev of evs) {
      if (ev.scoringSide === "A") a++;
      else b++;
      for (const t of [8, 16, 21]) {
        if (!marks[t] && (a === t || b === t)) marks[t] = `${a}-${b}`;
      }
    }
    return {
      set: s.number,
      duration: s.durationMs ?? getSetDuration(match, s.number),
      p8: marks[8] ?? "-",
      p16: marks[16] ?? "-",
      p21: marks[21] ?? "-",
      result: `${s.scoreA}-${s.scoreB}`,
      winner: s.winner,
    };
  });

  const totalsOf = (rows: PlayerRow[]) =>
    rows.reduce(
      (t, x) => ({
        ptsTot: t.ptsTot + x.ptsTot,
        bp: t.bp + x.bp,
        gp: t.gp + x.gp,
        srvTot: t.srvTot + x.srvTot,
        srvErr: t.srvErr + x.srvErr,
        srvPts: t.srvPts + x.srvPts,
        recTot: t.recTot + x.recTot,
        recErr: t.recErr + x.recErr,
        recPos: t.recPos + (x.recPos ?? 0) * x.recTot,
        recPerf: t.recPerf + (x.recPerf ?? 0) * x.recTot,
        atkTot: t.atkTot + x.atkTot,
        atkErr: t.atkErr + x.atkErr,
        atkBl: t.atkBl + x.atkBl,
        atkPts: t.atkPts + x.atkPts,
        blPts: t.blPts + x.blPts,
      }),
      {
        ptsTot: 0, bp: 0, gp: 0, srvTot: 0, srvErr: 0, srvPts: 0,
        recTot: 0, recErr: 0, recPos: 0, recPerf: 0,
        atkTot: 0, atkErr: 0, atkBl: 0, atkPts: 0, blPts: 0,
      },
    );

  // ─────────────────────────────────────────────────────────
  const render = (doc: any, K: number): number => {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 6;
    const W = pageW - M * 2;

    const fk = Math.max(0.62, Math.min(1.1, K));
    const V = (v: number) => v * K;
    const FS = (v: number) => doc.setFontSize(Math.max(3.6, v * fk));

    const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const ink = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
    const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

    fill(C.white);
    doc.rect(0, 0, pageW, pageH, "F");

    const box = (x: number, y: number, w: number, h: number, bg?: RGB) => {
      if (bg) {
        fill(bg);
        doc.rect(x, y, w, h, "F");
      }
      stroke(C.line);
      doc.setLineWidth(0.35);
      doc.rect(x, y, w, h, "S");
    };

    const label = (txt: string, x: number, y: number, size = 5.6, bold = false, col: RGB = C.soft) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      FS(size);
      ink(col);
      doc.text(txt, x, y);
    };

    // ═══════════ Cabecera ═══════════
    const headH = V(20);
    // Logo / marca
    box(M, M, V(26), headH, C.head);
    doc.setFont("helvetica", "bold");
    FS(11);
    ink(C.home);
    doc.text("RALLY", M + V(13), M + headH / 2 - V(1), { align: "center" });
    doc.setFont("helvetica", "normal");
    FS(4.4);
    ink(C.soft);
    doc.text("VOLLEY STATS", M + V(13), M + headH / 2 + V(3.2), { align: "center" });

    // Título competición
    const titleX = M + V(26);
    const titleW = W * 0.42;
    box(titleX, M, titleW, headH);
    doc.setFont("helvetica", "bold");
    FS(9.4);
    ink(C.ink);
    doc.text(
      doc.splitTextToSize(r.meta.competition || "Partido oficial", titleW - 6)[0],
      titleX + titleW / 2,
      M + V(6.4),
      { align: "center" },
    );
    doc.setFont("helvetica", "italic");
    FS(6.4);
    ink(C.soft);
    doc.text(
      [r.meta.category ? `Categoría ${r.meta.category}` : null, r.meta.statusLabel]
        .filter(Boolean)
        .join(" · "),
      titleX + titleW / 2,
      M + V(10.6),
      { align: "center" },
    );
    doc.setFont("helvetica", "bold");
    FS(7.6);
    ink(C.ink);
    doc.text("Tabla", titleX + titleW / 2, M + V(16.4), { align: "center" });

    // Marcador
    const scoreX = titleX + titleW;
    const scoreW = pageW - M - scoreX;
    box(scoreX, M, scoreW, headH);
    doc.setLineWidth(0.2);
    stroke(C.hair);
    doc.line(scoreX, M + headH / 2, scoreX + scoreW, M + headH / 2);
    const scoreRow = (name: string, val: number, cy: number, col: RGB) => {
      doc.setFont("helvetica", "bold");
      FS(8);
      ink(col);
      doc.text(doc.splitTextToSize(name, scoreW - V(14))[0], scoreX + 2.5, cy);
      doc.text(String(val), scoreX + scoreW - 3, cy, { align: "right" });
    };
    scoreRow(r.meta.teamAName, r.score.a, M + headH / 2 - V(2.4), C.ink);
    scoreRow(r.meta.teamBName, r.score.b, M + headH / 2 + V(5.6), C.ink);

    let y = M + headH + V(1.6);

    // ═══════════ Datos del partido + parciales ═══════════
    const infoH = V(24);
    const infoW = W * 0.44;
    box(M, y, infoW, infoH);
    const infoRows: [string, string][] = [
      ["Fecha", r.meta.dateLabel],
      ["Hora", r.meta.timeLabel ? `${r.meta.timeLabel} hs` : "-"],
      ["Ciudad", r.meta.venue ?? "-"],
      ["Duración", r.duration ? formatDurationMs(r.duration.totalMs) : "-"],
      ["Sets", `${r.score.a} - ${r.score.b}`],
    ];
    infoRows.forEach(([k, v], i) => {
      const ry = y + V(4.6) + i * V(4);
      label(k, M + 2.5, ry, 5.8, true, C.ink);
      label(v, M + V(20), ry, 5.8, false, C.soft);
    });

    // Tabla de parciales
    const stX = M + infoW + V(1.6);
    const stW = pageW - M - stX;
    box(stX, y, stW, infoH);
    const stCols = [0.12, 0.2, 0.14, 0.14, 0.14, 0.26];
    const stX0: number[] = [];
    {
      let acc = stX;
      for (const c of stCols) {
        stX0.push(acc);
        acc += stW * c;
      }
    }
    fill(C.head);
    doc.rect(stX + 0.2, y + 0.2, stW - 0.4, V(4.6), "F");
    stroke(C.hair);
    doc.setLineWidth(0.2);
    doc.line(stX, y + V(4.8), stX + stW, y + V(4.8));
    const stHead = ["Set", "Duración", "8", "16", "21", "Resultado"];
    stHead.forEach((h, i) => {
      doc.setFont("helvetica", "bold");
      FS(5.4);
      ink(C.ink);
      doc.text(h, stX0[i] + (stW * stCols[i]) / 2, y + V(3.4), { align: "center" });
    });
    partials.forEach((p, i) => {
      const ry = y + V(8) + i * V(3.5);
      const cells = [
        String(p.set),
        p.duration ? formatDurationMs(p.duration) : "-",
        p.p8,
        p.p16,
        p.p21,
        p.result,
      ];
      cells.forEach((cell, ci) => {
        doc.setFont("helvetica", ci === 5 ? "bold" : "normal");
        FS(5.4);
        ink(ci === 5 ? (p.winner === "A" ? C.home : p.winner === "B" ? C.away : C.ink) : C.soft);
        doc.text(cell, stX0[ci] + (stW * stCols[ci]) / 2, ry, { align: "center" });
      });
    });
    if (partials.length === 0) label("Sin sets registrados", stX + 3, y + V(9), 5.6);

    y += infoH + V(1.6);

    // ═══════════ Tablas por equipo ═══════════
    const GROUPS: { title: string; cols: { key: string; w: number }[] }[] = [
      {
        title: "",
        cols: [
          { key: "#", w: 5 },
          { key: "Jugador", w: 38 },
          { key: "P", w: 5 },
          { key: "Sets", w: 14 },
        ],
      },
      {
        title: "Puntos",
        cols: [
          { key: "Tot", w: 8 },
          { key: "BP", w: 7 },
          { key: "G-P", w: 8 },
        ],
      },
      {
        title: "Saque",
        cols: [
          { key: "Tot", w: 7 },
          { key: "Err", w: 7 },
          { key: "Pts", w: 7 },
        ],
      },
      {
        title: "Recepción",
        cols: [
          { key: "Tot", w: 7 },
          { key: "Err", w: 7 },
          { key: "Pos%", w: 10 },
          { key: "Perf%", w: 10 },
        ],
      },
      {
        title: "Ataque",
        cols: [
          { key: "Tot", w: 7 },
          { key: "Err", w: 7 },
          { key: "Bl", w: 6 },
          { key: "Pts", w: 7 },
          { key: "Pts%", w: 10 },
        ],
      },
      { title: "BL", cols: [{ key: "Pts", w: 7 }] },
    ];
    const flatCols = GROUPS.flatMap((g) => g.cols);
    const totalW = flatCols.reduce((s, c) => s + c.w, 0);

    const teamBlock = (
      x: number,
      ty: number,
      w: number,
      team: Team,
      rows: PlayerRow[],
      brk: { set: number; saq: number; ata: number; bl: number; erAd: number; tot: number }[],
      accent: RGB,
      tag: string,
    ): number => {
      const rowH = V(3.5);
      const titleH = V(5.2);
      const headH2 = V(7.4);
      const setsH = V(4.6) + Math.max(1, brk.length) * V(3.4) + V(1.5);
      const h = titleH + headH2 + Math.max(1, rows.length) * rowH + V(4.4) + setsH;
      box(x, ty, w, h);

      // Barra de título del equipo
      fill(C.head);
      doc.rect(x + 0.2, ty + 0.2, w - 0.4, titleH, "F");
      fill(accent);
      doc.rect(x + 0.2, ty + 0.2, V(1.4), titleH, "F");
      doc.setFont("helvetica", "bold");
      FS(7.4);
      ink(accent);
      doc.text(team.name.toUpperCase(), x + V(3.4), ty + titleH - V(1.4), { maxWidth: w * 0.6 });
      doc.setFont("helvetica", "normal");
      FS(5.4);
      ink(C.soft);
      doc.text(tag, x + w - 2.5, ty + titleH - V(1.4), { align: "right" });

      // Posiciones de columnas
      const inner = w - 4;
      const xs: number[] = [];
      let acc = x + 2;
      for (const c of flatCols) {
        xs.push(acc);
        acc += (inner * c.w) / totalW;
      }
      const cw = (i: number) => (inner * flatCols[i].w) / totalW;
      const cx = (i: number) => xs[i] + cw(i) / 2;

      // Cabeceras agrupadas
      const gTop = ty + titleH;
      fill(C.head);
      doc.rect(x + 0.2, gTop, w - 0.4, headH2, "F");
      let gi = 0;
      stroke(C.hair);
      doc.setLineWidth(0.2);
      for (const g of GROUPS) {
        const start = gi;
        const end = gi + g.cols.length - 1;
        if (g.title) {
          const gx = xs[start];
          const gw = xs[end] + cw(end) - xs[start];
          doc.setFont("helvetica", "bold");
          FS(5.4);
          ink(C.ink);
          doc.text(g.title, gx + gw / 2, gTop + V(2.9), { align: "center" });
          doc.line(gx, gTop + V(3.6), gx + gw, gTop + V(3.6));
          doc.line(gx - 0.6, gTop, gx - 0.6, gTop + headH2);
        }
        gi = end + 1;
      }
      flatCols.forEach((c, i) => {
        doc.setFont("helvetica", "bold");
        FS(5);
        ink(C.ink);
        const isLeft = i === 1;
        doc.text(c.key, isLeft ? xs[i] : cx(i), gTop + headH2 - V(1.6), {
          align: isLeft ? "left" : "center",
        });
      });
      stroke(C.line);
      doc.setLineWidth(0.3);
      doc.line(x, gTop + headH2, x + w, gTop + headH2);

      // Filas
      let ry = gTop + headH2 + rowH - V(1);
      rows.forEach((row, idx) => {
        if (idx % 2 === 1) {
          fill(C.zebra);
          doc.rect(x + 0.4, ry - rowH + V(1), w - 0.8, rowH, "F");
        }
        const setsTxt = row.sets.length > 0 ? row.sets.join(" ") : "·";
        const cells: string[] = [
          String(row.number),
          row.name,
          row.pos,
          setsTxt,
          row.ptsTot ? String(row.ptsTot) : "·",
          row.bp ? String(row.bp) : "·",
          row.gp ? `${row.gp > 0 ? "+" : ""}${row.gp}` : "·",
          row.srvTot ? String(row.srvTot) : "·",
          row.srvErr ? String(row.srvErr) : "·",
          row.srvPts ? String(row.srvPts) : "·",
          row.recTot ? String(row.recTot) : "·",
          row.recErr ? String(row.recErr) : "·",
          row.recPos === null ? "·" : `${Math.round(row.recPos)}%`,
          row.recPerf === null ? "·" : `${Math.round(row.recPerf)}%`,
          row.atkTot ? String(row.atkTot) : "·",
          row.atkErr ? String(row.atkErr) : "·",
          row.atkBl ? String(row.atkBl) : "·",
          row.atkPts ? String(row.atkPts) : "·",
          row.atkPct === null ? "·" : `${Math.round(row.atkPct)}%`,
          row.blPts ? String(row.blPts) : "·",
        ];
        cells.forEach((cell, i) => {
          const isName = i === 1;
          doc.setFont("helvetica", isName || i === 4 ? "bold" : "normal");
          FS(5.2);
          ink(cell === "·" ? C.hair : isName ? C.ink : C.soft);
          doc.text(
            isName ? doc.splitTextToSize(cell, cw(1) - 1)[0] : cell,
            isName ? xs[i] : cx(i),
            ry,
            { align: isName ? "left" : "center" },
          );
        });
        ry += rowH;
      });
      if (rows.length === 0) {
        label("Sin jugadores con acciones registradas", xs[0], ry, 5.4);
        ry += rowH;
      }

      // Totales
      const t = totalsOf(rows);
      fill(C.head);
      doc.rect(x + 0.4, ry - rowH + V(1), w - 0.8, rowH + V(0.6), "F");
      const totCells: (string | null)[] = [
        null,
        "Totales equipo",
        null,
        null,
        String(t.ptsTot),
        String(t.bp),
        `${t.gp > 0 ? "+" : ""}${t.gp}`,
        String(t.srvTot),
        String(t.srvErr),
        String(t.srvPts),
        String(t.recTot),
        String(t.recErr),
        t.recTot > 0 ? `${Math.round(t.recPos / t.recTot)}%` : "·",
        t.recTot > 0 ? `${Math.round(t.recPerf / t.recTot)}%` : "·",
        String(t.atkTot),
        String(t.atkErr),
        String(t.atkBl),
        String(t.atkPts),
        t.atkTot > 0 ? `${Math.round((t.atkPts / t.atkTot) * 100)}%` : "·",
        String(t.blPts),
      ];
      totCells.forEach((cell, i) => {
        if (cell === null) return;
        doc.setFont("helvetica", "bold");
        FS(5.2);
        ink(i === 1 ? accent : C.ink);
        doc.text(cell, i === 1 ? xs[i] : cx(i), ry + V(0.4), {
          align: i === 1 ? "left" : "center",
        });
      });
      ry += V(3.8);

      // Puntos ganados por set
      stroke(C.hair);
      doc.setLineWidth(0.2);
      doc.line(x + 1.5, ry - V(1.4), x + w - 1.5, ry - V(1.4));
      const bx = x + inner * 0.42;
      const bw = w - (bx - x) - 2.5;
      const bcols = ["Set", "Saq", "Ata", "Bl", "Er.Ad", "Tot"];
      const bcw = bw / bcols.length;
      doc.setFont("helvetica", "bold");
      FS(5);
      ink(C.ink);
      doc.text("Pts. ganados por set", bx - V(1), ry + V(2.4), { align: "right" });
      bcols.forEach((c, i) =>
        doc.text(c, bx + bcw * i + bcw / 2, ry + V(2.4), { align: "center" }),
      );
      brk.forEach((b, i) => {
        const by = ry + V(5.8) + i * V(3.4);
        const cells = [`${b.set}`, `${b.saq}`, `${b.ata}`, `${b.bl}`, `${b.erAd}`, `${b.tot}`];
        cells.forEach((cell, ci) => {
          doc.setFont("helvetica", ci === 0 || ci === 5 ? "bold" : "normal");
          FS(5);
          ink(ci === 0 ? C.ink : cell === "0" ? C.hair : C.soft);
          doc.text(cell, bx + bcw * ci + bcw / 2, by, { align: "center" });
        });
      });

      // Bloque izquierdo: armador / mejor rotación
      const sideInfo = tag === "Local" ? r.setters?.A : r.setters?.B;
      const rot = tag === "Local" ? r.rotations?.A : r.rotations?.B;
      const infoLines: string[] = [];
      if (sideInfo?.name) infoLines.push(`Armadora: ${sideInfo.name}`);
      if (sideInfo?.best) infoLines.push(`Mejor zona armado: ${sideInfo.best.label} (${sideInfo.best.diff > 0 ? "+" : ""}${sideInfo.best.diff})`);
      if (rot) {
        const played = rot.filter((z) => z.pf + z.pc > 0);
        if (played.length > 0) {
          const best = [...played].sort((a, b) => b.diff - a.diff)[0];
          const worst = [...played].sort((a, b) => a.diff - b.diff)[0];
          infoLines.push(`Rotación: mejor R${best.rotation} (${best.diff > 0 ? "+" : ""}${best.diff}) · peor R${worst.rotation} (${worst.diff})`);
        }
      }
      infoLines.forEach((line, i) =>
        label(doc.splitTextToSize(line, bx - x - 5)[0], x + 2.5, ry + V(5.8) + i * V(3.6), 5.2, false, C.soft),
      );

      return h;
    };

    const hA = teamBlock(M, y, W, teamA, rowsA, brkA, C.home, "Local");
    y += hA + V(1.6);
    const hB = teamBlock(M, y, W, teamB, rowsB, brkB, C.away, "Visitante");
    y += hB + V(1.6);

    // ═══════════ Referencias ═══════════
    {
      const h = V(14);
      box(M, y, W, h, C.zebra);
      doc.setFont("helvetica", "bold");
      FS(5.4);
      ink(C.ink);
      doc.text("REFERENCIAS", M + 2.5, y + V(3.6));
      doc.setFont("helvetica", "normal");
      FS(4.8);
      ink(C.soft);
      const legend = [
        "Tot: total · BP: break points (punto con saque rival) · G-P: puntos ganados menos errores propios",
        "Saque — Tot: saques registrados · Err: errores · Pts: aces",
        "Recepción — Pos%: recepciones positivas (# y +) · Perf%: recepciones perfectas (#)",
        "Ataque — Tot: intentos · Bl: ataques bloqueados · Pts%: efectividad · BL Pts: puntos de bloqueo",
      ];
      legend.forEach((l, i) => doc.text(l, M + 2.5, y + V(6.8) + i * V(2.4), { maxWidth: W - 5 }));
      y += h;
    }

    // Pie
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    ink(C.hair);
    doc.text(`RALLY · Reporte simplificado · ${r.meta.dateLabel}`, M, pageH - 3);
    doc.text(`${r.meta.teamAName} vs ${r.meta.teamBName}`, pageW - M, pageH - 3, { align: "right" });

    return y;
  };

  // Pasada 1: medir, pasada 2: escalar para entrar en una sola hoja A4.
  const probe = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageH = probe.internal.pageSize.getHeight();
  const top = 6;
  const available = pageH - 10 - top;
  const natural = Math.max(1, render(probe, 1) - top);
  const raw = available / natural;
  const K = raw >= 1 ? Math.min(1.15, raw) : Math.max(0.45, raw);

  const doc = K === 1 ? probe : new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
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
