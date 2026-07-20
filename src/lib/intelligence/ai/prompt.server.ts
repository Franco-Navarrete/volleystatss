// Rally Intelligence — prompt para la IA: interpreta el análisis ya calculado.
// La IA NO recalcula estadísticas. Solo redacta una síntesis táctica ejecutiva
// que complementa el informe visual.

import type { MatchAnalysis } from "@/lib/intelligence/analysis";

export const RALLY_SYSTEM_PROMPT = `
Eres un analista profesional de vóley de alto rendimiento redactando para el
cuerpo técnico. Recibís un análisis estructurado ya calculado (índice Rally,
fortalezas, debilidades, riesgos, plan). Tu tarea NO es repetir cifras: es
interpretar y complementar en español, con tono profesional, humano y breve.

Formato Markdown, máximo ~180 palabras, con estas secciones exactas:

**Por qué el equipo ${'{ganó/perdió}'}**
2-3 líneas explicando el desenlace basado en la evidencia.

**Claves tácticas**
- 3 bullets accionables que complementen (no repitan) las debilidades.

**Mensaje para el vestuario**
1 párrafo motivacional en 2ª persona plural, breve.

Reglas:
- Nunca inventes datos ni contradigas el análisis.
- No listes números que ya aparecen en las tarjetas: interpretalos.
- Evita clichés y jerga innecesaria.
`.trim();

export function buildUserPrompt(analysis: MatchAnalysis): string {
  const d = analysis.dashboard;
  const strengths = analysis.strengths.slice(0, 4).map((s) => `- ${s.title} (${s.category}) — ${s.conclusion}`).join("\n");
  const weaknesses = analysis.weaknesses.slice(0, 4).map((w) => `- ${w.title} (${w.category}) — impacto ${w.impact}. Consecuencia: ${w.consequence}`).join("\n");
  const risks = analysis.risks.slice(0, 3).map((r) => `- ${r.title}: ${r.detail}`).join("\n");
  const indexLines = analysis.rallyIndex.breakdown.map((b) => `  · ${b.label}: ${b.score}/100`).join("\n");

  return [
    `Equipo analizado: ${analysis.teamName}`,
    `Rival: ${analysis.opponentName}`,
    `Resultado: ${d.result} (${d.scoreline})`,
    `Índice Rally global: ${d.rallyIndex}/100`,
    `Desglose:\n${indexLines}`,
    "",
    `Fortalezas destacadas:\n${strengths || "- (sin fortalezas destacadas)"}`,
    "",
    `Debilidades / focos:\n${weaknesses || "- (sin debilidades relevantes)"}`,
    "",
    `Riesgos:\n${risks || "- (ninguno)"}`,
    "",
    "Redactá el informe siguiendo el formato indicado en el sistema.",
  ].join("\n");
}
