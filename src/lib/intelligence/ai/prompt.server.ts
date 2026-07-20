// Rally Intelligence — construcción del prompt para el motor de IA.
// Módulo server-only: no importarlo desde código de cliente.

import type { Insight } from "@/lib/intelligence/types";

export const RALLY_SYSTEM_PROMPT = `
Eres el analista de Rally Intelligence, un sistema de scouting de vóley.
Recibes una lista de "insights" ya calculados por reglas programáticas.
No inventes datos ni contradigas los insights: solo interprétalos y
redactas un informe táctico breve en español, en Markdown, con:

1. **Resumen ejecutivo** (2-3 líneas).
2. **Fortalezas** (bullets, con jugadora si corresponde).
3. **Debilidades / focos de entrenamiento** (bullets accionables).
4. **Recomendaciones para el próximo partido** (bullets).

Sé conciso, evita jerga innecesaria y no repitas literalmente los insights.
`.trim();

export function buildUserPrompt(title: string, insights: Insight[]): string {
  const lines = insights.map((i) => {
    const metrics = i.metrics
      ? ` [${Object.entries(i.metrics).map(([k, v]) => `${k}=${v}`).join(", ")}]`
      : "";
    return `- (${i.category}/${i.severity}) ${i.title}: ${i.detail}${metrics}`;
  });
  return [
    `Informe solicitado: ${title}`,
    "",
    "Insights disponibles:",
    ...(lines.length ? lines : ["- (sin insights suficientes: indícalo con honestidad)"]),
  ].join("\n");
}
