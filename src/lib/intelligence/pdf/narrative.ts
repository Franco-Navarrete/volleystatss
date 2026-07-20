// Rally Intelligence — generador de micro-narrativa para el PDF.
// A partir del MatchAnalysis ya calculado produce textos cortos en español
// que responden las 4 preguntas rectoras de cada bloque narrativo:
//   ¿Qué pasó?  ¿Por qué?  ¿Qué consecuencia tuvo?  ¿Qué entrenar?

import type {
  MatchAnalysis, RallyIndexItem, StrengthCard, WeaknessCard,
} from "../analysis";

export interface StoryBeat {
  what: string;
  why: string;
  consequence: string;
  train: string;
}

const NA = "—";
const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const round = (n: number, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };
const fmtDelta = (n: unknown) => (isNum(n) ? `${n > 0 ? "+" : ""}${round(n, 1)}` : NA);

// --------- Preguntas rectoras por capítulo ---------
export const CHAPTER_QUESTION: Record<string, string> = {
  cover: "¿Qué partido estamos analizando?",
  exec: "¿Qué pasó en 30 segundos?",
  dashboard: "¿Cuáles son los indicadores clave?",
  rally: "¿Qué tan bien jugó el equipo en conjunto?",
  story: "¿Cómo se ganó (o perdió) este partido?",
  fund: "¿Qué fundamentos definieron el resultado?",
  rot: "¿Qué rotaciones marcaron la diferencia?",
  player: "¿Quién hizo la diferencia y quién sufrió?",
  trend: "¿Cómo venimos rindiendo en los últimos partidos?",
  court: "¿Desde dónde y hacia dónde se juega?",
  season: "¿Cómo se compara este partido con la temporada?",
  risk: "¿Qué riesgos hay que mitigar?",
  plan: "¿Qué debería entrenarse esta semana?",
  coach: "¿Qué decisiones sostener y cuáles revisar?",
  final: "¿Qué me llevo del partido en una página?",
};

// --------- Narrativa por fundamento ---------
export function beatFundamental(item: RallyIndexItem, a: MatchAnalysis): StoryBeat {
  const label = item.label || "Fundamento";
  const score = isNum(item.score) ? Math.round(item.score) : null;
  const dSea = item.seasonDelta;
  const rivalRow = a.radarCompare?.find((r) => r.axis.toLowerCase().startsWith(label.toLowerCase().slice(0, 4)));
  const rivalDelta = rivalRow ? (rivalRow.equipo - rivalRow.rival) : null;

  const what = score == null
    ? `${label}: sin datos suficientes para evaluar.`
    : score >= 70
      ? `${label} funcionó a nivel alto (${score}/100).`
      : score >= 50
        ? `${label} tuvo un rendimiento aceptable (${score}/100) con margen de mejora.`
        : `${label} fue una zona débil del partido (${score}/100).`;

  const why = item.detail && item.detail.trim()
    ? `El detalle: ${item.detail.trim()}.`
    : "El desempeño se explica por el volumen y la calidad de las acciones registradas.";

  let consequence = "";
  if (rivalDelta != null) {
    consequence = rivalDelta >= 5
      ? `Aportó ventaja sobre el rival (Δ ${fmtDelta(rivalDelta)}), condicionando el marcador.`
      : rivalDelta <= -5
        ? `Cedió terreno frente al rival (Δ ${fmtDelta(rivalDelta)}), permitiéndole sostener el juego.`
        : "El rendimiento fue parejo al del rival, sin diferencias marcadas en este fundamento.";
  } else {
    consequence = score != null && score < 50
      ? "Facilitó puntos gratis al rival y comprometió el ritmo del equipo."
      : "Mantuvo el equilibrio del rally sin definir el partido.";
  }
  if (isNum(dSea)) {
    consequence += dSea >= 3
      ? ` Mejora clara respecto al promedio de temporada (${fmtDelta(dSea)}).`
      : dSea <= -3
        ? ` Rendimiento por debajo del promedio de temporada (${fmtDelta(dSea)}).`
        : "";
  }

  const train = trainSuggest(label, score ?? 50);
  return { what, why, consequence, train };
}

function trainSuggest(label: string, score: number): string {
  const key = label.toLowerCase();
  const intensity = score >= 65 ? "mantenimiento" : score >= 50 ? "consolidación" : "prioridad alta";
  if (key.includes("saque"))
    return `[${intensity}] Serie de 30 saques con targets a Z5/Z6 y control de zona segura al 3er intento.`;
  if (key.includes("recep"))
    return `[${intensity}] Circuito 3v3 de recepción a target del armador, alternando saque flotado y potente.`;
  if (key.includes("arma"))
    return `[${intensity}] Sombra + K1 con lectura de bloqueo; 20 armados a punta, 15 a central, 10 a zaguero.`;
  if (key.includes("ataque"))
    return `[${intensity}] Ataque contra bloqueo doble, alternando líneas, diagonales y toques por bloqueo.`;
  if (key.includes("bloq"))
    return `[${intensity}] Lectura + doble bloqueo con salto en cadena, 6 series de 3 minutos.`;
  if (key.includes("defensa"))
    return `[${intensity}] Base + defensa low con transición inmediata a contraataque, 4 rondas.`;
  if (key.includes("k1"))
    return `[${intensity}] Complejo K1 completo: recepción → armado → ataque, 20 repeticiones por rotación.`;
  if (key.includes("k2"))
    return `[${intensity}] Complejo K2 (defensa → contraataque), énfasis en 1er tiempo tras bloqueo.`;
  if (key.includes("regular"))
    return `[${intensity}] Circuitos de decisión bajo fatiga; medir varianza de eficacia por rotación.`;
  if (key.includes("disciplina"))
    return `[${intensity}] Bloque de errores cero: 10 rallies sin error propio para acumular punto.`;
  return `[${intensity}] Trabajo específico dirigido según el diagnóstico técnico.`;
}

// --------- Narrativa por rotación ---------
export function beatRotation(card: StrengthCard | WeaknessCard, isWeak: boolean): StoryBeat {
  const conc = card.conclusion || "";
  const cons = (card as WeaknessCard).consequence || "";
  return {
    what: card.title,
    why: card.evidence?.metrics?.map((m) => `${m.label}: ${m.value}`).join(" · ") || "Sin métricas disponibles.",
    consequence: cons || (isWeak
      ? "Cedió puntos y ritmo del set durante esta rotación."
      : "Aportó una ventana positiva del marcador."),
    train: conc || (isWeak
      ? "Revisar posicionamiento defensivo y responsabilidades de recepción en esta rotación."
      : "Consolidar la dinámica que la vuelve dominante."),
  };
}

// --------- Narrativa por jugadora ---------
export function beatPlayer(p: MatchAnalysis["playerRadar"][number]): StoryBeat {
  const scores = [p.attack, p.reception, p.block, p.ace, p.discipline].filter(isNum);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const top = ["ATQ", "REC", "BLK", "ACE", "DIS"][[p.attack, p.reception, p.block, p.ace, p.discipline]
    .map((v, i) => [v, i] as const)
    .sort((x, y) => (isNum(y[0]) ? y[0] : 0) - (isNum(x[0]) ? x[0] : 0))[0][1]] ?? "—";
  return {
    what: `${p.name}: rendimiento global ${Math.round(avg)}/100, destaca en ${top}.`,
    why: `ATQ ${round(p.attack || 0)} · REC ${round(p.reception || 0)} · BLK ${round(p.block || 0)} · ACE ${round(p.ace || 0)} · DIS ${round(p.discipline || 0)}.`,
    consequence: avg >= 65
      ? "Sostuvo el nivel del equipo en sus zonas de responsabilidad."
      : avg >= 45
        ? "Aportó en tramos, con margen para incrementar su impacto ofensivo o defensivo."
        : "Necesita apoyo táctico y trabajo específico para recuperar volumen de juego.",
    train: avg >= 65
      ? "Mantener carga y rotación; sumar variantes tácticas para no volverse predecible."
      : "Bloque individual focalizado en su fundamento débil, 2 sesiones por semana.",
  };
}

// --------- Storyline del partido ---------
export function buildMatchStory(a: MatchAnalysis): {
  headline: string;
  narrative: string;
  turningPoint: string;
  keyFundamental: string;
  keyPlayer: string;
  keyRotation: string;
} {
  const d = a.dashboard;
  const wonLost = d.result === "victoria" ? "ganó" : d.result === "derrota" ? "perdió" : "empató";
  const best = [...a.rallyIndex.breakdown].sort((x, y) => (y.score || 0) - (x.score || 0))[0];
  const worst = [...a.rallyIndex.breakdown].sort((x, y) => (x.score || 0) - (y.score || 0))[0];
  const critRot = a.weaknesses.find((w) => w.category === "Rotación")
    ?? a.strengths.find((s) => s.category === "Rotación");
  const mvp = d.awards.mvp;

  const headline = `${a.teamName} ${wonLost} ${d.scoreline || ""} vs ${a.opponentName}.`;
  const narrative = d.result === "victoria"
    ? `El equipo se apoyó en ${best?.label?.toLowerCase() ?? "su mejor fundamento"} y contuvo al rival en los momentos calientes. ${a.strengths[0]?.title ? a.strengths[0].title + " fue determinante." : ""}`
    : d.result === "derrota"
      ? `El partido se fue de las manos por ${worst?.label?.toLowerCase() ?? "el fundamento más débil"}${a.weaknesses[0]?.title ? `, expresado en ${a.weaknesses[0].title.toLowerCase()}` : ""}. La ventana de recuperación existió pero no se sostuvo.`
      : "Partido parejo sin diferencias tácticas claras entre los equipos.";

  const turningPoint = a.timeline?.find((t) => t.kind === "run" || t.kind === "opp_run")
    ? `Set ${a.timeline[0].setNumber}: ${a.timeline[0].title}.`
    : "El momento bisagra se ubicó en los tramos finales del set decisivo.";

  return {
    headline,
    narrative,
    turningPoint,
    keyFundamental: best?.label ?? NA,
    keyPlayer: mvp?.name ? `${mvp.name}${mvp.number ? ` (#${mvp.number})` : ""}` : NA,
    keyRotation: critRot?.title ?? "Sin rotación crítica destacada.",
  };
}

// --------- Distribución del plan a la semana L/M/J/V ---------
export function mapBlocksToWeek(blocks: MatchAnalysis["trainingPlan"]["blocks"]) {
  const days = ["Lunes", "Martes", "Jueves", "Viernes"] as const;
  const out: Array<{ day: string; focus: string; drills: string[]; reason: string; minutes: number }> = [];
  for (let i = 0; i < 4; i++) {
    const b = blocks[i % Math.max(blocks.length, 1)];
    if (!b) {
      out.push({ day: days[i], focus: "Descanso activo / video", drills: ["Análisis táctico"], reason: "Sin bloque asignado.", minutes: 45 });
      continue;
    }
    out.push({
      day: days[i],
      focus: b.focus || "Trabajo mixto",
      drills: b.drills?.slice(0, 3) ?? [],
      reason: b.reason || "",
      minutes: isNum(b.minutes) ? b.minutes : 60,
    });
  }
  return out;
}

// --------- Interpretación IA (breve) del Índice Rally ---------
export function interpretRally(overall: number): { level: string; text: string; percentile: number } {
  const o = clamp(overall);
  const percentile = Math.round(clamp(50 + (o - 55) * 1.5));
  const level = o >= 85 ? "Excelente" : o >= 70 ? "Bueno" : o >= 55 ? "Regular" : o >= 40 ? "Bajo" : "Crítico";
  const text = o >= 85
    ? "Rendimiento de élite. Todos los fundamentos operan por encima del estándar competitivo."
    : o >= 70
      ? "Rendimiento sólido con al menos un fundamento a nivel de referencia."
      : o >= 55
        ? "Rendimiento aceptable pero irregular: hay margen claro para escalar el índice."
        : o >= 40
          ? "Rendimiento por debajo del estándar: se requieren correcciones tácticas y técnicas."
          : "Rendimiento crítico: prioridad absoluta a recuperar fundamentos base antes del próximo partido.";
  return { level, text, percentile };
}
