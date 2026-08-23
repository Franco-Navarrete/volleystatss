import {
  computeMatchStats,
  computeSetStats,
  computeReceptionStats,
  setsWon,
  POINT_TYPE_LABEL,
  type Match,
  type PlayerStat,
  type Team,
  type SubstitutionEvent,
  
  type PointEvent,
  type PointType,
  type ReceptionStat,
} from "@/lib/volley-store";

const PDF_ABBR: Record<PointType, string> = {
  attack: "ATA",
  block: "BLO",
  ace: "S",
  counter_attack: "C.A",
  rotation_attack: "A.R",
  opponent_error: "E.R",
  opponent_rotation_error: "E.Rot",
  serve_error: "E.S",
  unforced_error: "ENF",
  rotation_error: "E.Rot",
  attack_error: "E.A",
  block_error: "E.B",
};

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
  const margin = 10;
  const innerW = pageW - margin * 2;
  let y = 10;

  const primary: [number, number, number] = [37, 99, 235];
  const dark: [number, number, number] = [30, 30, 40];
  const grey: [number, number, number] = [120, 120, 130];

  // ---------- Cabecera compacta ----------
  doc.setFillColor(...dark);
  doc.rect(margin, y, innerW, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${teamA.name}  vs  ${teamB.name}`, margin + 3, y + 6);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 210);
  const dateStr = match.date ? new Date(match.date).toLocaleDateString("es-AR") : "";
  doc.text(
    [dateStr, match.status === "finished" ? "Resultado final" : "En progreso"]
      .filter(Boolean)
      .join("  ·  "),
    margin + 3,
    y + 11,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(`${w.a} - ${w.b}`, pageW - margin - 4, y + 9, { align: "right" });
  y += 17;

  // ---------- Parciales por set ----------
  const partialsFor = (setNumber: number) => {
    const pts = match.events.filter(
      (e): e is PointEvent => !("kind" in e) && (e as PointEvent).setNumber === setNumber,
    );
    const marks: string[] = [];
    let a = 0;
    let b = 0;
    const targets = [8, 16, 21];
    let ti = 0;
    for (const ev of pts) {
      if (ev.scoringSide === "A") a++;
      else b++;
      while (ti < targets.length && Math.max(a, b) >= targets[ti]) {
        marks.push(`${a}-${b}`);
        ti++;
      }
    }
    while (marks.length < 3) marks.push("—");
    return marks;
  };

  autoTable(doc, {
    startY: y,
    head: [["Set", "8", "16", "21", "Resultado"]],
    body: match.sets.map((s) => {
      const p = partialsFor(s.number);
      return [String(s.number), p[0], p[1], p[2], `${s.scoreA}-${s.scoreB}`];
    }),
    headStyles: { fillColor: primary, fontSize: 6, halign: "center", cellPadding: 0.8 },
    bodyStyles: { fontSize: 6, halign: "center", cellPadding: 0.8 },
    columnStyles: { 4: { fontStyle: "bold" } },
    margin: { left: margin, right: margin + innerW * 0.52 },
    theme: "grid",
  });
  const setsTableY = (doc as any).lastAutoTable.finalY;

  // ---------- Totales de equipo (a la derecha de los parciales) ----------
  const tA = stats.teams.get(teamA.id);
  const tB = stats.teams.get(teamB.id);
  autoTable(doc, {
    startY: y,
    head: [["Equipo", "PTS", "ATA", "BLO", "S", "E.R", "E.S", "E.A", "ENF"]],
    body: [
      [teamA.shortName || teamA.name, tA?.total ?? 0, (tA?.attack ?? 0) + (tA?.rotationAttack ?? 0) + (tA?.counterAttack ?? 0), tA?.block ?? 0, tA?.ace ?? 0, tA?.opponentErrors ?? 0, tA?.serveErrors ?? 0, tA?.attackErrors ?? 0, tA?.unforcedErrors ?? 0],
      [teamB.shortName || teamB.name, tB?.total ?? 0, (tB?.attack ?? 0) + (tB?.rotationAttack ?? 0) + (tB?.counterAttack ?? 0), tB?.block ?? 0, tB?.ace ?? 0, tB?.opponentErrors ?? 0, tB?.serveErrors ?? 0, tB?.attackErrors ?? 0, tB?.unforcedErrors ?? 0],
    ],
    headStyles: { fillColor: dark, fontSize: 6, halign: "center", cellPadding: 0.8 },
    bodyStyles: { fontSize: 6, halign: "center", cellPadding: 0.8 },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 26 } },
    margin: { left: margin + innerW * 0.5, right: margin },
    theme: "grid",
  });
  y = Math.max(setsTableY, (doc as any).lastAutoTable.finalY) + 4;

  // ---------- Tabla combinada por jugador (puntos + recepción) ----------
  const recA = computeReceptionStats(match.events, "A");
  const recB = computeReceptionStats(match.events, "B");

  const teamBlock = (team: Team, players: PlayerStat[], recMap: Map<string, ReceptionStat>, teamStat = stats.teams.get(team.id)) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...dark);
    doc.text(team.name, margin, y);
    y += 1.5;

    const rows = players.map((p) => {
      const r = recMap.get(p.playerId);
      return [
        p.number,
        p.name,
        p.attack + p.rotationAttack + p.counterAttack,
        p.block,
        p.ace,
        p.serveError,
        p.attackError,
        p.unforcedError,
        p.total,
        r?.total ?? 0,
        r ? `${r.positivity.toFixed(0)}%` : "—",
        r ? `${r.efficiency.toFixed(0)}%` : "—",
      ];
    });

    const recTotals = [...recMap.values()].filter((r) => team.players.some((p) => p.id === r.playerId));
    const recTot = recTotals.reduce((n, r) => n + r.total, 0);
    const recPos = recTotals.reduce((n, r) => n + (r.positivity / 100) * r.total, 0);

    autoTable(doc, {
      startY: y,
      head: [["#", "Jugador", "ATA", "BLO", "S", "E.S", "E.A", "ENF", "PTS", "Rec", "Pos%", "Efic%"]],
      body: rows.length
        ? rows
        : [["-", "Sin registros", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]],
      foot: [[
        "",
        "TOTALES",
        (teamStat?.attack ?? 0) + (teamStat?.rotationAttack ?? 0) + (teamStat?.counterAttack ?? 0),
        teamStat?.block ?? 0,
        teamStat?.ace ?? 0,
        teamStat?.serveErrors ?? 0,
        teamStat?.attackErrors ?? 0,
        teamStat?.unforcedErrors ?? 0,
        teamStat?.total ?? 0,
        recTot,
        recTot ? `${Math.round((recPos / recTot) * 100)}%` : "—",
        "",
      ]],
      headStyles: { fillColor: dark, fontSize: 6, halign: "center", cellPadding: 0.7 },
      bodyStyles: { fontSize: 6, halign: "center", cellPadding: 0.7 },
      footStyles: { fillColor: [235, 236, 240], textColor: 20, fontSize: 6, halign: "center", cellPadding: 0.7 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { halign: "left", cellWidth: 42 },
        8: { fontStyle: "bold" },
      },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  };

  const playersA = enrich(teamA, stats.players);
  const playersB = enrich(teamB, stats.players);
  teamBlock(teamA, playersA, recA);
  teamBlock(teamB, playersB, recB);

  // ---------- MVP + referencias al pie ----------
  const all = [
    ...playersA.map((p) => ({ ...p, teamName: teamA.shortName || teamA.name })),
    ...playersB.map((p) => ({ ...p, teamName: teamB.shortName || teamB.name })),
  ];
  const mvp = [...all].sort((a, b) => mvpScore(b) - mvpScore(a))[0];

  const footY = Math.min(y, pageH - 22);
  if (mvp) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...primary);
    doc.text(
      `MVP: #${mvp.number} ${mvp.name} (${mvp.teamName}) · índice ${mvpScore(mvp).toFixed(1)}`,
      margin,
      footY,
    );
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...grey);
  doc.text(
    "ATA: ataque (incluye rotación y contraataque) · BLO: bloqueo · S: ace · E.S: error de saque · E.A: error de ataque · ENF: error no forzado · PTS: puntos · Rec: recepciones · Pos%: positividad · Efic%: eficiencia",
    margin,
    footY + 4,
    { maxWidth: innerW },
  );
  y = footY + 10;


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

