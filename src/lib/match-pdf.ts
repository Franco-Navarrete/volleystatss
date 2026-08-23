import {
  computeMatchStats,
  computeSetStats,
  computeReceptionStats,
  setsWon,
  type Match,
  type PlayerStat,
  type Team,
  type SubstitutionEvent,
  type PointEvent,
  type ReceptionStat,
} from "@/lib/volley-store";

const MVP_WEIGHTS = { attack: 1, block: 1.2, ace: 1.5, unforcedError: -0.5 };
const mvpScore = (p: PlayerStat) =>
  p.attack * MVP_WEIGHTS.attack +
  p.block * MVP_WEIGHTS.block +
  p.ace * MVP_WEIGHTS.ace +
  p.unforcedError * MVP_WEIGHTS.unforcedError;

type PdfDownloadOptions = {
  targetWindow?: Window | null;
};

function enrich(team: Team, playerMap: Map<string, PlayerStat>): PlayerStat[] {
  return [...playerMap.values()]
    .filter((p) => team.players.some((tp) => tp.id === p.playerId))
    .map((p) => {
      const tp = team.players.find((x) => x.id === p.playerId)!;
      return { ...p, name: tp.name, number: tp.number };
    })
    .sort((a, b) => b.total - a.total);
}

export async function downloadMatchPdf(match: Match, teamA: Team, teamB: Team, options: PdfDownloadOptions = {}) {
  if (options.targetWindow) writePdfLoadingWindow(options.targetWindow);

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const stats = computeMatchStats(match);
  const w = setsWon(match);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: `${teamA.name} vs ${teamB.name}` });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 13;
  const innerW = pageW - margin * 2;
  let y = 16;

  // Paleta
  const primary: [number, number, number] = [37, 99, 235];
  const accentA: [number, number, number] = [37, 99, 235];
  const accentB: [number, number, number] = [190, 40, 45];
  const dark: [number, number, number] = [22, 24, 33];
  const slate: [number, number, number] = [98, 104, 120];
  const line: [number, number, number] = [222, 226, 234];
  const zebra: [number, number, number] = [246, 247, 250];

  const ensure = (needed: number) => {
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = 18;
    }
  };

  // Título de sección con barra de acento
  const section = (title: string, color: [number, number, number] = dark, size = 9.5) => {
    ensure(14);
    doc.setFillColor(...color);
    doc.roundedRect(margin, y - 3.4, 1.6, 4.6, 0.8, 0.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(...dark);
    doc.text(title.toUpperCase(), margin + 4, y);
    y += 3.2;
  };

  const tableBase = (fill: [number, number, number]) => ({
    theme: "grid" as const,
    headStyles: {
      fillColor: fill,
      textColor: [255, 255, 255] as [number, number, number],
      fontSize: 7,
      halign: "center" as const,
      cellPadding: 1.4,
      lineWidth: 0,
    },
    bodyStyles: {
      fontSize: 7.2,
      halign: "center" as const,
      cellPadding: 1.4,
      textColor: [45, 48, 60] as [number, number, number],
      lineColor: line,
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: zebra },
    margin: { left: margin, right: margin },
  });

  // ---------- Cabecera ----------
  doc.setFillColor(...dark);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setFillColor(...primary);
  doc.rect(0, 36, pageW, 1.4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(140, 150, 175);
  doc.text("RALLY  ·  ESTADÍSTICAS DE VÓLEY", margin, 9);
  const dateStr = match.scheduledAt ? new Date(match.scheduledAt).toLocaleDateString("es-AR") : "";
  const statusStr = match.status === "finished" ? "Resultado final" : "Partido en progreso";
  doc.text([dateStr, statusStr].filter(Boolean).join("  ·  ").toUpperCase(), pageW - margin, 9, {
    align: "right",
  });

  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(teamA.name, margin, 21, { maxWidth: innerW * 0.36 });
  doc.text(teamB.name, pageW - margin, 21, { align: "right", maxWidth: innerW * 0.36 });
  doc.setFontSize(20);
  doc.text(`${w.a} - ${w.b}`, pageW / 2, 21, { align: "center" });

  // Chips de parciales
  const chips = match.sets.map((s) => `S${s.number}  ${s.scoreA}-${s.scoreB}`);
  if (chips.length) {
    doc.setFontSize(7.5);
    const widths = chips.map((c) => doc.getTextWidth(c) + 6);
    const totalW = widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 2;
    let cx = (pageW - totalW) / 2;
    chips.forEach((c, i) => {
      doc.setFillColor(48, 52, 68);
      doc.roundedRect(cx, 26, widths[i], 6, 1.6, 1.6, "F");
      doc.setTextColor(225, 230, 242);
      doc.text(c, cx + widths[i] / 2, 30.1, { align: "center" });
      cx += widths[i] + 2;
    });
  }
  y = 48;
  doc.setTextColor(0, 0, 0);

  // ---------- MVP ----------
  const playersA = enrich(teamA, stats.players);
  const playersB = enrich(teamB, stats.players);
  const all = [
    ...playersA.map((p) => ({ ...p, teamName: teamA.name })),
    ...playersB.map((p) => ({ ...p, teamName: teamB.name })),
  ];
  const mvp = [...all].sort((a, b) => mvpScore(b) - mvpScore(a))[0];
  if (mvp) {
    doc.setFillColor(240, 244, 253);
    doc.roundedRect(margin, y - 6, innerW, 14, 2, 2, "F");
    doc.setFillColor(...primary);
    doc.roundedRect(margin, y - 6, 1.8, 14, 0.9, 0.9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primary);
    doc.text(`MVP · #${mvp.number} ${mvp.name}`, margin + 5, y - 0.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...slate);
    doc.text(
      `${mvp.teamName}  ·  Índice ${mvpScore(mvp).toFixed(1)}  ·  ${mvp.attack} ATA  ·  ${mvp.block} BLO  ·  ${mvp.ace} S  ·  ${mvp.unforcedError} ENF`,
      margin + 5,
      y + 4,
    );
    y += 15;
  }

  // ---------- Totales de equipo ----------
  const tA = stats.teams.get(teamA.id);
  const tB = stats.teams.get(teamB.id);
  section("Resumen por equipo", primary);
  autoTable(doc, {
    startY: y,
    head: [["Equipo", "PTS", "ATA", "A.R", "C.A", "BLO", "S", "E.R", "E.S", "E.A", "ENF"]],
    body: [
      [teamA.name, tA?.total ?? 0, tA?.attack ?? 0, tA?.rotationAttack ?? 0, tA?.counterAttack ?? 0, tA?.block ?? 0, tA?.ace ?? 0, tA?.opponentErrors ?? 0, tA?.serveErrors ?? 0, tA?.attackErrors ?? 0, tA?.unforcedErrors ?? 0],
      [teamB.name, tB?.total ?? 0, tB?.attack ?? 0, tB?.rotationAttack ?? 0, tB?.counterAttack ?? 0, tB?.block ?? 0, tB?.ace ?? 0, tB?.opponentErrors ?? 0, tB?.serveErrors ?? 0, tB?.attackErrors ?? 0, tB?.unforcedErrors ?? 0],
    ],
    ...tableBase(primary),
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 52 }, 1: { fontStyle: "bold" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  const playerTable = (title: string, rows: PlayerStat[], color: [number, number, number]) => {
    ensure(30);
    section(title, color);
    autoTable(doc, {
      startY: y,
      head: [["#", "Jugador", "ATA", "A.R", "C.A", "BLO", "S", "E.S", "E.A", "ENF", "TOT"]],
      body: rows.length
        ? rows.map((p) => [p.number, p.name, p.attack, p.rotationAttack, p.counterAttack, p.block, p.ace, p.serveError, p.attackError, p.unforcedError, p.total])
        : [["-", "Sin puntos registrados", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
      ...tableBase(dark),
      columnStyles: {
        0: { cellWidth: 9, fontStyle: "bold" },
        1: { halign: "left", cellWidth: 46 },
        10: { fontStyle: "bold", textColor: color },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  };

  playerTable(`${teamA.name} · Jugadores`, playersA, accentA);
  playerTable(`${teamB.name} · Jugadores`, playersB, accentB);

  // ---------- Recepción ----------
  const receptionTable = (
    title: string,
    team: Team,
    recMap: Map<string, ReceptionStat>,
    color: [number, number, number],
  ) => {
    const rows = [...recMap.values()]
      .filter((r) => team.players.some((p) => p.id === r.playerId))
      .map((r) => {
        const tp = team.players.find((p) => p.id === r.playerId)!;
        return { ...r, name: tp.name, number: tp.number };
      })
      .sort((a, b) => b.total - a.total);
    ensure(30);
    section(title, color);
    autoTable(doc, {
      startY: y,
      head: [["#", "Receptor", "++", "+", "0", "-", "--", "/", "Tot", "Efect%", "Efic%"]],
      body: rows.length
        ? rows.map((r) => [r.number, r.name, r.doublePositive, r.positive, r.neutral, r.negative, r.doubleNegative, r.overpass, r.total, `${r.positivity.toFixed(0)}%`, `${r.efficiency.toFixed(0)}%`])
        : [["-", "Sin recepciones registradas", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
      ...tableBase(dark),
      columnStyles: {
        0: { cellWidth: 9, fontStyle: "bold" },
        1: { halign: "left", cellWidth: 46 },
        8: { fontStyle: "bold" },
        9: { fontStyle: "bold", textColor: color },
        10: { fontStyle: "bold", textColor: color },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 7;
  };

  const recMatchA = computeReceptionStats(match.events, "A");
  const recMatchB = computeReceptionStats(match.events, "B");
  receptionTable(`${teamA.name} · Recepción`, teamA, recMatchA, accentA);
  receptionTable(`${teamB.name} · Recepción`, teamB, recMatchB, accentB);

  const playerName = (team: Team, id: string | null | undefined) => {
    if (!id) return "—";
    const p = team.players.find((x) => x.id === id);
    return p ? `#${p.number} ${p.name}` : id;
  };

  for (const s of match.sets) {
    const setStats = computeSetStats(match, s.number);
    const spA = enrich(teamA, setStats.players);
    const spB = enrich(teamB, setStats.players);
    ensure(48);

    // Banda de set
    doc.setFillColor(...dark);
    doc.roundedRect(margin, y - 4.5, innerW, 8.5, 1.6, 1.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`SET ${s.number}`, margin + 4, y + 1.2);
    doc.setTextColor(190, 200, 220);
    doc.setFontSize(9);
    doc.text(`${s.scoreA} - ${s.scoreB}`, pageW - margin - 4, y + 1.2, { align: "right" });
    y += 10;
    doc.setTextColor(0, 0, 0);

    // Alineación inicial del set
    const lineupA = match.lineupsBySet?.[s.number]?.A ?? match.startingLineupA;
    const lineupB = match.lineupsBySet?.[s.number]?.B ?? match.startingLineupB;
    const fmtLineup = (team: Team, ids: string[]) =>
      ids.length
        ? ids.map((id, i) => `P${i + 1}: ${playerName(team, id)}`).join("  ·  ")
        : "Sin alineación registrada";
    section(`Alineación inicial · Set ${s.number}`, slate, 8.5);
    autoTable(doc, {
      startY: y,
      head: [["Equipo", "Formación (P1 = saca)"]],
      body: [
        [teamA.shortName || teamA.name, fmtLineup(teamA, lineupA)],
        [teamB.shortName || teamB.name, fmtLineup(teamB, lineupB)],
      ],
      ...tableBase(slate),
      columnStyles: { 0: { cellWidth: 24, fontStyle: "bold", halign: "left" }, 1: { halign: "left" } },
    });
    y = (doc as any).lastAutoTable.finalY + 7;

    playerTable(`${teamA.name} · Estadísticas Set ${s.number}`, spA, accentA);
    playerTable(`${teamB.name} · Estadísticas Set ${s.number}`, spB, accentB);

    // Recepción del set
    const setEvents = match.events.filter((e) => "setNumber" in e && e.setNumber === s.number);
    const recSetA = computeReceptionStats(setEvents, "A");
    const recSetB = computeReceptionStats(setEvents, "B");
    if (recSetA.size > 0) receptionTable(`${teamA.name} · Recepción Set ${s.number}`, teamA, recSetA, accentA);
    if (recSetB.size > 0) receptionTable(`${teamB.name} · Recepción Set ${s.number}`, teamB, recSetB, accentB);

    // Punto a punto del set
    const points = match.events.filter(
      (e): e is PointEvent => !("kind" in e) && (e as PointEvent).setNumber === s.number,
    );
    if (points.length) {
      ensure(26);
      section(`Punto a punto · Set ${s.number}`, slate, 8.5);
      y += 2;

      const chipW = 6.4;
      const chipH = 5;
      const gapX = 1.2;
      const gapY = 1.8;
      const maxX = pageW - margin;
      let cx = margin;
      let cy = y;
      let runA = 0;
      let runB = 0;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.6);
      for (const ev of points) {
        if (ev.scoringSide === "A") runA++;
        else runB++;
        if (cx + chipW > maxX) {
          cx = margin;
          cy += chipH + gapY;
          if (cy + chipH > pageH - 16) {
            doc.addPage();
            cy = 18;
          }
        }
        const fill = ev.scoringSide === "A" ? accentA : accentB;
        doc.setFillColor(...fill);
        doc.roundedRect(cx, cy, chipW, chipH, 1.4, 1.4, "F");
        doc.setTextColor(255, 255, 255);
        doc.text(String(ev.scoringSide === "A" ? runA : runB), cx + chipW / 2, cy + chipH / 2 + 1.1, {
          align: "center",
        });
        cx += chipW + gapX;
      }
      y = cy + chipH + 7;
      doc.setTextColor(0, 0, 0);
    }

    // Cambios del set
    const changes = match.events.filter(
      (e): e is SubstitutionEvent => "kind" in e && e.kind === "sub" && e.setNumber === s.number,
    );
    if (changes.length) {
      ensure(26);
      section(`Cambios · Set ${s.number}`, slate, 8.5);
      autoTable(doc, {
        startY: y,
        head: [["Equipo", "Tipo", "Entra", "Sale"]],
        body: changes.map((e) => {
          const team = e.side === "A" ? teamA : teamB;
          return [team.shortName || team.name, "Cambio", playerName(team, e.playerInId), playerName(team, e.playerOutId)];
        }),
        ...tableBase(slate),
        columnStyles: {
          0: { cellWidth: 26, fontStyle: "bold", halign: "left" },
          1: { cellWidth: 24, halign: "left" },
          2: { halign: "left" },
          3: { halign: "left" },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ---------- Referencias ----------
  ensure(34);
  section("Referencias", slate, 8.5);
  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...slate);
  const notes = [
    "PTS: puntos totales",
    "ATA: ataque",
    "A.R: ataque de rotación",
    "C.A: contraataque",
    "BLO: bloqueo",
    "S: saque (ace)",
    "E.R: error rival",
    "E.S: error de saque",
    "E.A: error de ataque",
    "ENF: error no forzado",
    "Recepción ++/+ : perfecta y positiva",
    "Recepción 0/-/-- : neutra y negativa",
    "/ : overpass (pasada)",
    "Efect%: positividad · Efic%: eficiencia",
  ];
  const colW = innerW / 2;
  notes.forEach((n, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    doc.text(n, margin + col * colW, y + row * 4);
  });
  y += Math.ceil(notes.length / 2) * 4 + 4;

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...line);
    doc.setLineWidth(0.2);
    doc.line(margin, pageH - 11, pageW - margin, pageH - 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(150, 155, 168);
    doc.text("RALLY · ESTADÍSTICAS DE VÓLEY", margin, pageH - 7);
    doc.text(`${teamA.name} vs ${teamB.name}`, pageW / 2, pageH - 7, { align: "center" });
    doc.text(`${i}/${pages}`, pageW - margin, pageH - 7, { align: "right" });
  }

  const fileName = `${teamA.name} vs ${teamB.name} - estadisticas.pdf`.replace(/[/\\:*?"<>|]/g, "-");

  // Genera el PDF como Blob (mucho más compatible en móviles que data URI).
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const sizeKb = Math.round(blob.size / 1024);

  if (options.targetWindow) {
    try {
      const dataUrl = await blobToDataUrl(blob);
      openPdfDataUrlInWindow(options.targetWindow, dataUrl, fileName, sizeKb);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
      return { method: "opened" as const, fileName, sizeKb, url: dataUrl };
    } catch {
      // Si la pestaña se cerró o el navegador bloqueó la escritura, seguimos con
      // el fallback de descarga normal.
    }
  }

  const file = new File([blob], fileName, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      URL.revokeObjectURL(blobUrl);
      return { method: "share" as const, fileName, sizeKb };
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === "AbortError") {
        URL.revokeObjectURL(blobUrl);
        return { method: "cancelled" as const, fileName, sizeKb };
      }
    }
  }

  // Fallback: descarga con <a download> usando blob URL.
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  const dataUrl = await blobToDataUrl(blob);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
  return { method: "download" as const, fileName, sizeKb, url: dataUrl };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el PDF"));
    reader.readAsDataURL(blob);
  });
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[char] ?? char);
}

function scriptJson(value: string) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function writePdfLoadingWindow(targetWindow: Window) {
  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html><html><head><title>Generando PDF</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center;padding:24px}p{margin:8px 0;color:#94a3b8}</style></head><body><main><h1>Generando PDF…</h1><p>Dejá esta pestaña abierta.</p></main></body></html>`);
  targetWindow.document.close();
}

function openPdfDataUrlInWindow(targetWindow: Window, dataUrl: string, fileName: string, sizeKb: number) {
  const safeFileName = htmlEscape(fileName);
  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${safeFileName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{box-sizing:border-box}body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.bar{position:sticky;top:0;z-index:2;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px;background:#111827;border-bottom:1px solid rgba(148,163,184,.25)}.title{min-width:0;font-size:13px;font-weight:700}.title span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title small{display:block;color:#94a3b8;font-size:11px;font-weight:500}.actions{display:flex;gap:8px;flex-shrink:0}.btn{border:1px solid rgba(148,163,184,.35);background:#2563eb;color:white;border-radius:8px;padding:9px 11px;font-size:13px;font-weight:700;text-decoration:none}.btn.secondary{background:#1f2937}.viewer{width:100%;height:calc(100vh - 58px);border:0;background:#111827}.fallback{display:none;padding:20px;color:#cbd5e1}.fallback p{margin:0 0 12px;color:#94a3b8}@media (max-width:520px){.bar{align-items:stretch;flex-direction:column}.actions{width:100%}.btn{flex:1;text-align:center}.viewer{height:calc(100vh - 110px)}}
  </style>
</head>
<body>
  <header class="bar">
    <div class="title"><span>${safeFileName}</span><small>${sizeKb} KB · RALLY</small></div>
    <div class="actions">
      <a id="openPdf" class="btn secondary" href="#">Abrir</a>
      <a id="sharePdf" class="btn" href="#" style="display:none">Compartir</a>
      <a id="downloadPdf" class="btn secondary" href="#" download="${safeFileName}">Descargar</a>
    </div>
  </header>
  <iframe id="viewer" class="viewer" title="PDF ${safeFileName}"></iframe>
  <main id="fallback" class="fallback"><p>Si el visor queda en blanco, usá Abrir o Descargar.</p></main>
  <script>
    const pdfDataUrl = ${scriptJson(dataUrl)};
    const fileName = ${scriptJson(fileName)};
    const base64 = pdfDataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const pdfUrl = URL.createObjectURL(blob);
    const file = new File([blob], fileName, { type: 'application/pdf' });
    const viewer = document.getElementById('viewer');
    const openPdf = document.getElementById('openPdf');
    const sharePdf = document.getElementById('sharePdf');
    const downloadPdf = document.getElementById('downloadPdf');
    viewer.src = pdfUrl;
    openPdf.href = pdfUrl;
    downloadPdf.href = pdfUrl;
    downloadPdf.download = fileName;
    openPdf.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = pdfUrl;
    });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      sharePdf.style.display = '';
      sharePdf.addEventListener('click', (event) => {
        event.preventDefault();
        navigator.share({ files: [file], title: fileName });
      });
    }
  </script>
</body>
</html>`);
  targetWindow.document.close();
}

export function openPdfDataUrlInNewTab(dataUrl: string, fileName: string, sizeKb: number) {
  const targetWindow = window.open("", "_blank");
  if (!targetWindow) return false;
  openPdfDataUrlInWindow(targetWindow, dataUrl, fileName, sizeKb);
  return true;
}

export type PdfDownloadResult = {
  method: "share" | "download" | "cancelled" | "opened";
  fileName: string;
  sizeKb: number;
  url?: string;
};
