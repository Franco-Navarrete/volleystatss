import {
  computeMatchStats,
  computeSetStats,
  setsWon,
  type Match,
  type PlayerStat,
  type Team,
  type SubstitutionEvent,
  type LiberoEvent,
} from "@/lib/volley-store";

const MVP_WEIGHTS = { attack: 1, block: 1.2, ace: 1.5, unforcedError: -0.5 };
const mvpScore = (p: PlayerStat) =>
  p.attack * MVP_WEIGHTS.attack +
  p.block * MVP_WEIGHTS.block +
  p.ace * MVP_WEIGHTS.ace +
  p.unforcedError * MVP_WEIGHTS.unforcedError;

function enrich(team: Team, playerMap: Map<string, PlayerStat>): PlayerStat[] {
  return [...playerMap.values()]
    .filter((p) => team.players.some((tp) => tp.id === p.playerId))
    .map((p) => {
      const tp = team.players.find((x) => x.id === p.playerId)!;
      return { ...p, name: tp.name, number: tp.number };
    })
    .sort((a, b) => b.total - a.total);
}

export async function downloadMatchPdf(match: Match, teamA: Team, teamB: Team) {
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
    head: [["Equipo", "Puntos", "Ataque", "Ataque rot.", "Contraataque", "Bloqueo", "Ace", "Err. rival", "Err. propios"]],
    body: [
      [teamA.name, tA?.total ?? 0, tA?.attack ?? 0, tA?.rotationAttack ?? 0, tA?.counterAttack ?? 0, tA?.block ?? 0, tA?.ace ?? 0, tA?.opponentErrors ?? 0, tA?.unforcedErrors ?? 0],
      [teamB.name, tB?.total ?? 0, tB?.attack ?? 0, tB?.rotationAttack ?? 0, tB?.counterAttack ?? 0, tB?.block ?? 0, tB?.ace ?? 0, tB?.opponentErrors ?? 0, tB?.unforcedErrors ?? 0],
    ],
    headStyles: { fillColor: primary, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
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
      head: [["#", "Jugador", "ATK", "Rot.", "Contra", "BLK", "ACE", "Err.", "TOT"]],
      body: rows.length
        ? rows.map((p) => [p.number, p.name, p.attack, p.rotationAttack, p.counterAttack, p.block, p.ace, p.unforcedError, p.total])
        : [["-", "Sin puntos registrados", "-", "-", "-", "-", "-", "-", "-"]],
      headStyles: { fillColor: dark, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 10 }, 8: { fontStyle: "bold" } },
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
    playerTable(`${teamA.name}`, spA);
    playerTable(`${teamB.name}`, spB);

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
  doc.save(fileName);
}
