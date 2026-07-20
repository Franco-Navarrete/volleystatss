
# Rediseño editorial del PDF Rally Intelligence

Voy a reescribir por completo `src/lib/intelligence/intelligence-pdf.ts` (~1.100 líneas) reemplazándolo por un motor de informe editorial modular con calidad tipo VolleyMetrics / Wyscout. El objetivo es que cada página tenga un propósito narrativo, con más gráficos y menos tablas.

## Arquitectura del nuevo motor

- **Sistema de diseño único** (`design-system.ts` interno): paleta editorial (Navy, Charcoal, Verde/Amarillo/Rojo semánticos, Azul info, Gris datos), escala tipográfica (Display 32 / H1 22 / H2 16 / H3 12 / Body 10 / Caption 8), grillas de 12 columnas, márgenes 18 mm, radios y sombras consistentes.
- **Motor de layout atómico**: cada bloque calcula su altura antes de dibujar; si no cabe, se mueve a la siguiente página completo. Nada de tarjetas partidas.
- **Sistema de validación** (`sanitize`): `fmtInt`, `fmtPct`, `fmtDuration`, `fmtDelta` que devuelven "—" ante NaN/Infinity/valores absurdos (>300 min, %>100 etc.). Se ejecuta un `preflight()` antes del build que loggea (y corrige) inconsistencias.
- **Chrome**: header con marca + partido, footer con "Página X de Y", numeración real inyectada tras el render.
- **TOC diferido**: se registran anclas mientras se renderiza y al final se escribe el índice en una página reservada.

## Componentes gráficos vectoriales (sin dependencias extra)

Todo dibujado con primitivas jsPDF para mantener nitidez:

- `drawGauge(score)` — velocímetro semicircular para Índice Rally.
- `drawRadar(dims)` — radar de fundamentos.
- `drawHBar(value, target)` — barras horizontales / bullet charts.
- `drawDonut(segments)` — distribución de impacto por fundamento.
- `drawSparkline(series)` — mini evolución.
- `drawCourt(zones, mode)` — cancha de vóley con zonas 1-6 coloreadas por frecuencia/eficacia (ataque, recepción, saque, bloqueo, defensa).
- `drawTimeline(events)` — línea temporal con marcadores de rachas, timeouts, cambios de liderazgo.
- `drawRiskMatrix(items)` — matriz Impacto × Probabilidad.
- `drawRotationCompare(rots)` — grupo de 6 mini bullet charts.
- `drawPlayerCard(p)` — tarjeta jugador con mini radar + KPIs + comentario IA.
- `drawFundamentoCard(f)` — tarjeta grande con score, estado, impacto, IA, fortalezas, errores, objetivo, ejercicio.

## Estructura del informe (secciones)

1. **Portada editorial** — banda hero, marcador validado, metadatos.
2. **Índice (TOC)** — generado al final con paginación real.
3. **Dashboard Ejecutivo** — solo tarjetas grandes con iconografía:
   Índice Rally (gauge grande) · Resultado · MVP · Fortaleza principal · Debilidad principal · Probabilidad de victoria · Confianza del análisis · Indicador general.
4. **Índice Rally en profundidad** — gauge XL, nivel, percentil temporada, evolución, tendencia (sparkline), donut de impacto por fundamento, texto IA explicativo.
5. **Fundamentos** — una tarjeta por fundamento (Saque, Recepción, Armado, Ataque, Bloqueo, Defensa) con: score, estado, comparación, impacto, confianza, resumen IA, fortalezas, errores, objetivo, ejercicio recomendado.
6. **Cancha analítica** — 5 canchas: ataque, recepción, saque, bloqueo, defensa; zonas coloreadas por frecuencia/eficacia.
7. **Rotaciones** — 6 tarjetas + gráfico comparativo (bullet charts): score, PF, PC, diferencia, riesgo, importancia, confianza, descripción IA, consecuencia, prioridad de entrenamiento.
8. **Análisis individual** — tarjetas por jugador (grid 2 col): número, nombre, posición, Rally individual, KPIs (ATQ/REC/BLK/DEF/SAQ/DISC), comparación con su promedio, comentario IA.
9. **Timeline del partido** — línea temporal con rachas, cambios de liderazgo, timeouts, parciales, momentos críticos coloreados.
10. **Fortalezas y debilidades** — tarjetas con impacto, confianza, fundamento, consecuencia, recomendación, tiempo estimado de corrección.
11. **Comparación con temporada** — gráficos de evolución, mejor/peor partido, vs rival, vs liga.
12. **Riesgos y predicciones** — matriz Impacto × Probabilidad + explicación IA.
13. **Plan de entrenamiento** — cronograma visual (bloques por día) con duración, objetivo, ejercicio, intensidad, jugadores, fundamento, resultado esperado.
14. **Coach Insights** — sección hero con Q&A IA: por qué se ganó/perdió, decisiones acertadas/erradas, fundamento decisivo, jugador que cambió el partido, rotación decisiva, qué entrenar mañana, qué mantener, qué cambiar.
15. **Resumen Ejecutivo para el Entrenador** — una sola página densa: resultado, Rally, top 3 fortalezas, top 3 debilidades, 3 prioridades, jugador destacado, rotación crítica, objetivo próximo entrenamiento, 3 ejercicios IA, conclusión.

## Preflight de validación

Antes del `doc.save()`:
- Recalcula `totalPages`, reescribe el footer.
- Verifica que cada ancla del TOC exista.
- Chequea que ningún texto se salga del área útil (guardando bounding boxes durante el render).
- Sustituye cualquier `NaN|Infinity|undefined|null` residual por "—".
- Loggea `console.warn('[pdf-preflight]', ...)` con los problemas corregidos.

## Alcance del cambio

- **Reescribo**: `src/lib/intelligence/intelligence-pdf.ts` completo.
- **No toco**: la UI (`/intelligence`), el motor analítico, ni las server functions. La firma pública (`generateIntelligencePdf(report, match, ...)`) se mantiene para no romper el botón de exportación.
- Sin dependencias nuevas: sigo con `jspdf` + `jspdf-autotable` (usado sólo en 2-3 lugares donde una tabla sí aporta).

## Detalles técnicos

- Todos los gráficos son vectoriales (líneas, rects, paths) para mantener nitidez a cualquier zoom.
- La cancha se dibuja como SVG-like con jsPDF: rectángulo 9×18 escalado, red central, zonas 1-6 con `setFillColor` + alpha simulada por color-mix precalculado.
- Sparklines y bullets comparten helpers `mapRange`, `clamp`.
- El motor de páginas expone `ensureSpace(h)` que hace `addPage()` si el bloque no cabe, así ninguna tarjeta queda partida.
- Numeración final: recorro `doc.getNumberOfPages()` e inyecto `Página i de N` + repongo header/footer.

## Riesgos

- Archivo grande (~1.500 líneas nuevas). Lo escribo en una sola pasada bien estructurada por secciones.
- No podré verificar visualmente el PDF resultante desde el sandbox. Confío en el sistema de layout + preflight; el usuario probará la exportación.
