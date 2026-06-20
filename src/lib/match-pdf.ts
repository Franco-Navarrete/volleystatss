import {
  computeMatchStats,
  computeSetStats,
  setsWon,
  POINT_TYPE_LABEL,
  type Match,
  type PlayerStat,
  type Team,
  type SubstitutionEvent,
  type LiberoEvent,
  type PointEvent,
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
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  const primary: [number, number, number] = [37, 99, 235];
  const dark: [number, number, number] = [30, 30, 40];

  // Header
  doc.setFillColor(...dark);
  doc.rect(0, 0, pageW, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${teamA.name}  ${w.a} - ${w.b}  ${teamB.name}`, pageW / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const setLine = match.sets.map((s) => `Set ${s.number}: ${s.scoreA}-${s.scoreB}`).join("   ");
  doc.text(setLine, pageW / 2, 22, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 190);
  doc.text(
    match.status === "finished" ? "Resultado final" : "Partido en progreso",
    pageW / 2,
    28,
    { align: "center" },
  );
  y = 42;

  doc.setTextColor(0, 0, 0);

  // MVP
  const playersA = enrich(teamA, stats.players);
  const playersB = enrich(teamB, stats.players);
  const all = [
    ...playersA.map((p) => ({ ...p, teamName: teamA.name })),
    ...playersB.map((p) => ({ ...p, teamName: teamB.name })),
  ];
  const mvp = [...all].sort((a, b) => mvpScore(b) - mvpScore(a))[0];
  if (mvp) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.text(`MVP: #${mvp.number} ${mvp.name} (${mvp.teamName})`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    y += 5;
    doc.text(
      `Índice ${mvpScore(mvp).toFixed(1)} · ${mvp.attack} ATK · ${mvp.block} BLK · ${mvp.ace} ACE · ${mvp.unforcedError} errores`,
      margin,
      y,
    );
    y += 8;
  }

  // Team totals
  const tA = stats.teams.get(teamA.id);
  const tB = stats.teams.get(teamB.id);
  autoTable(doc, {
    startY: y,
    head: [["Equipo", "Puntos", "Ataque", "Ataque rot.", "Contraataque", "Bloqueo", "Ace", "Err. rival", "Err. saque", "Err. ataque", "Err. no forz."]],
    body: [
      [teamA.name, tA?.total ?? 0, tA?.attack ?? 0, tA?.rotationAttack ?? 0, tA?.counterAttack ?? 0, tA?.block ?? 0, tA?.ace ?? 0, tA?.opponentErrors ?? 0, tA?.serveErrors ?? 0, tA?.attackErrors ?? 0, tA?.unforcedErrors ?? 0],
      [teamB.name, tB?.total ?? 0, tB?.attack ?? 0, tB?.rotationAttack ?? 0, tB?.counterAttack ?? 0, tB?.block ?? 0, tB?.ace ?? 0, tB?.opponentErrors ?? 0, tB?.serveErrors ?? 0, tB?.attackErrors ?? 0, tB?.unforcedErrors ?? 0],
    ],
    headStyles: { fillColor: primary, fontSize: 7 },
    bodyStyles: { fontSize: 7 },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  const playerTable = (title: string, rows: PlayerStat[]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    if (y > 265) {
      doc.addPage();
      y = 16;
    }
    doc.text(title, margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["#", "Jugador", "ATK", "Rot.", "Contra", "BLK", "ACE", "E.Saq", "E.Atk", "E.NF", "TOT"]],
      body: rows.length
        ? rows.map((p) => [p.number, p.name, p.attack, p.rotationAttack, p.counterAttack, p.block, p.ace, p.serveError, p.attackError, p.unforcedError, p.total])
        : [["-", "Sin puntos registrados", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
      headStyles: { fillColor: dark, fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: { 0: { cellWidth: 10 }, 10: { fontStyle: "bold" } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  playerTable(`${teamA.name} · Jugadores`, playersA);
  playerTable(`${teamB.name} · Jugadores`, playersB);

  // Set breakdown
  const playerName = (team: Team, id: string | null | undefined) => {
    if (!id) return "—";
    const p = team.players.find((x) => x.id === id);
    return p ? `#${p.number} ${p.name}` : id;
  };

  for (const s of match.sets) {
    const setStats = computeSetStats(match, s.number);
    const spA = enrich(teamA, setStats.players);
    const spB = enrich(teamB, setStats.players);
    if (y > 240) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...primary);
    doc.text(`Set ${s.number} (${s.scoreA}-${s.scoreB})`, margin, y);
    y += 5;

    // Alineación inicial del set
    const lineupA = match.lineupsBySet?.[s.number]?.A ?? match.startingLineupA;
    const lineupB = match.lineupsBySet?.[s.number]?.B ?? match.startingLineupB;
    const fmtLineup = (team: Team, ids: string[]) =>
      ids.length
        ? ids.map((id, i) => `P${i + 1}: ${playerName(team, id)}`).join("  ·  ")
        : "Sin alineación registrada";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    doc.text(`Alineación inicial · Set ${s.number}`, margin, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Equipo", "Formación (P1 = saca)"]],
      body: [
        [teamA.shortName || teamA.name, fmtLineup(teamA, lineupA)],
        [teamB.shortName || teamB.name, fmtLineup(teamB, lineupB)],
      ],
      headStyles: { fillColor: dark, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 24, fontStyle: "bold" } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    playerTable(`${teamA.name} · Estadísticas Set ${s.number}`, spA);
    playerTable(`${teamB.name} · Estadísticas Set ${s.number}`, spB);

    // Punto a punto del set
    const points = match.events.filter(
      (e): e is PointEvent =>
        !("kind" in e) && (e as PointEvent).setNumber === s.number,
    );
    if (points.length) {
      if (y > 240) { doc.addPage(); y = 16; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...dark);
      doc.text(`Punto a punto · Set ${s.number}`, margin, y);
      y += 3;
      let runA = 0;
      let runB = 0;
      const rows = points.map((ev, idx) => {
        if (ev.scoringSide === "A") runA++; else runB++;
        const team = ev.scoringSide === "A" ? teamA : teamB;
        const playerTeam = ev.playerSide === "A" ? teamA : ev.playerSide === "B" ? teamB : null;
        const who = playerTeam && ev.playerId ? playerName(playerTeam, ev.playerId) : "—";
        return [
          String(idx + 1),
          `${runA}-${runB}`,
          `Punto de ${team.shortName || team.name}`,
          who,
          POINT_TYPE_LABEL[ev.type] ?? ev.type,
        ];
      });
      autoTable(doc, {
        startY: y,
        head: [["#", "Marcador", "Punto", "Jugador", "Acción"]],
        body: rows,
        headStyles: { fillColor: dark, fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 18, fontStyle: "bold" },
        },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Cambios y líberos del set
    const changes = match.events.filter(
      (e): e is SubstitutionEvent | LiberoEvent =>
        "kind" in e &&
        (e.kind === "sub" || e.kind === "libero") &&
        e.setNumber === s.number,
    );
    if (changes.length) {
      if (y > 255) { doc.addPage(); y = 16; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...dark);
      doc.text(`Cambios · Set ${s.number}`, margin, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        head: [["Equipo", "Tipo", "Entra", "Sale"]],
        body: changes.map((e) => {
          const team = e.side === "A" ? teamA : teamB;
          if (e.kind === "sub") {
            return [team.shortName, "Cambio", playerName(team, e.playerInId), playerName(team, e.playerOutId)];
          }
          // libero
          const tipo = e.action === "in" ? "Líbero entra" : e.action === "out" ? "Líbero sale" : "Líbero sale (rotación)";
          const entra = e.action === "in" ? playerName(team, e.liberoId) : playerName(team, e.replacedId);
          const sale = e.action === "in" ? playerName(team, e.replacedId) : playerName(team, e.liberoId);
          return [team.shortName, tipo, entra, sale];
        }),
        headStyles: { fillColor: dark, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `RALLY · Estadísticas de vóley · Página ${i}/${pages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" },
    );
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

  // En móviles modernos, usar la Web Share API para compartir/guardar el PDF
  // nativamente. Esto funciona perfecto en iOS Safari y Android Chrome.
  const file = new File([blob], fileName, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      URL.revokeObjectURL(blobUrl);
      return { method: "share" as const, fileName, sizeKb };
    } catch (e) {
      // Si el usuario canceló, lo informamos para que el flujo de UI no
      // muestre confirmación de descarga.
      const name = (e as { name?: string } | null)?.name;
      if (name === "AbortError") {
        URL.revokeObjectURL(blobUrl);
        return { method: "cancelled" as const, fileName, sizeKb };
      }
      // Otro error: seguimos con el fallback de descarga.
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

  // Para el botón manual "Abrir PDF" devolvemos una data URL en lugar de la
  // blob URL: iOS Safari bloquea la apertura de blob: en una pestaña nueva
  // (queda en blanco), mientras que data:application/pdf se abre sin problemas.
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
      <a id="downloadPdf" class="btn" href="#" download="${safeFileName}">Descargar</a>
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
    const pdfUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const viewer = document.getElementById('viewer');
    const openPdf = document.getElementById('openPdf');
    const downloadPdf = document.getElementById('downloadPdf');
    viewer.src = pdfUrl;
    openPdf.href = pdfUrl;
    downloadPdf.href = pdfUrl;
    downloadPdf.download = fileName;
    openPdf.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = pdfUrl;
    });
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

