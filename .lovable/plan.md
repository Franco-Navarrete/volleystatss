
# Rediseño narrativo del PDF Rally Intelligence

Voy a reescribir por completo el motor de exportación para transformar el PDF en un informe de scouting profesional que "cuente la historia" del partido. Cada página tendrá una pregunta concreta y responderá qué pasó, por qué, qué consecuencia tuvo y qué entrenar.

## Alcance

- **Reescribo**: `src/lib/intelligence/intelligence-pdf.ts` (motor completo, ~2.000 líneas nuevas organizadas por módulos internos).
- **Nuevo**: `src/lib/intelligence/pdf/` con submódulos internos (`design.ts`, `layout.ts`, `charts.ts`, `chapters/*.ts`, `preflight.ts`, `narrative.ts`) para mantener el archivo mantenible.
- **No toco**: la UI (`/intelligence`, botón exportar), motor analítico, server functions, ni tipos públicos. La firma `generateIntelligencePdf(report, match, ...)` se mantiene.
- **Sin dependencias nuevas**: sigo con `jspdf` + `jspdf-autotable`. Todos los gráficos son primitivas vectoriales.

## Motor editorial

- **Sistema de diseño**: paleta Navy/Charcoal + semánticos, escala tipográfica Display/H1/H2/H3/Body/Caption, grilla de 12 columnas, márgenes 18mm, radios y sombras consistentes. Espacios en blanco generosos.
- **Motor de layout atómico**: cada bloque calcula altura antes de dibujar; `ensureSpace(h)` mueve el bloque completo a la siguiente página si no cabe. Nada de tarjetas partidas.
- **Chrome**: header sutil (marca + partido), footer con "Página X de Y" inyectado al final. Portada, TOC y Resumen Final sin chrome.
- **TOC diferido**: se registran anclas durante el render y al final se escribe el índice con paginación real.
- **Cada capítulo empieza en página nueva** con título grande + pregunta rectora + kicker narrativo.

## Narrativa automática

Nuevo `narrative.ts` que, a partir del `MatchAnalysis` ya calculado, genera micro-textos ES ("¿Qué pasó?", "¿Por qué?", "¿Consecuencia?", "¿Qué entrenar?") por fundamento, rotación, jugador y momento crítico. Combina el resumen IA existente (`report.summaryMd`) con reglas deterministas para no depender de la IA para textos estructurales.

## Componentes gráficos vectoriales

- `drawGauge` XL (velocímetro Índice Rally con percentil y aguja).
- `drawRadar` (radar de fundamentos, 8 ejes, con overlay temporada).
- `drawDonut` (impacto por fundamento).
- `drawBullet` (comparativas score vs objetivo vs temporada).
- `drawSparkline` (últimos 5 partidos).
- `drawHeatCourt(mode)` (cancha 9m×18m con zonas 1-6 coloreadas por intensidad Y eficacia; modos: ataque, recepción, saque, bloqueo, defensa).
- `drawTimelineVis` (línea temporal con rachas, timeouts, cambios de liderazgo, marcador de momentum).
- `drawRiskMatrix` (matriz Impacto × Probabilidad × Urgencia).
- `drawRotationCompare` (6 mini bullets alineados P1-P6).
- `drawPlayerCard` (foto/número/pos + mini radar + KPIs + delta vs promedio + comentario IA).
- `drawWeekPlan` (cronograma L/M/J/V con bloques proporcionales, sin tablas).

## Estructura del informe (15 capítulos)

Cada capítulo abre en página nueva con título + pregunta rectora:

1. **Portada editorial** — sin tablas: escudos grandes, resultado XL, gauge Rally, franja MVP, meta (competencia, fecha, categoría, entrenador, duración, racha).
2. **Resumen Ejecutivo** — leer el partido en <30s. Tarjetas grandes: qué ocurrió · por qué · qué cambió el partido · qué entrenar · jugador diferencial · rotación decisiva · fundamento ganador.
3. **Dashboard** — solo KPIs en tarjetas modernas: Rally · Resultado · Prob. victoria · Confianza · MVP · Revelación · Fund. decisivo · Rot. decisiva · Racha máx · Errores no forzados · Eficacia ofensiva.
4. **Índice Rally** — página completa: velocímetro XL, percentil, comparación temporada, Δ vs último partido, ranking histórico, interpretación IA.
5. **Cómo se ganó/perdió** — narrativa visual del set-a-set + timeline reducido + momento bisagra destacado.
6. **Fundamentos** — 6 tarjetas premium (Saque/Recepción/Armado/Ataque/Bloqueo/Defensa) con: score, nivel, vs temporada, vs rival, impacto, confianza, evolución (sparkline), explicación IA, consecuencia táctica, recomendación, ejercicio, tiempo.
7. **Rotaciones** — 6 tarjetas (PF, PC, Δ, prob. side-out, prob. perder, riesgo, confianza, comentario IA, consecuencia, qué modificar, ejercicio) + gráfico comparativo P1-P6.
8. **Jugadores** — tarjetas por jugador (2 col): foto/número/pos, Rally individual, radar, fundamentos, participación ofensiva/defensiva, errores, Δ vs su promedio, Δ vs equipo, comentario IA.
9. **Tendencias** — gráficos de evolución últimos 5 partidos con promedio/máx/mín/mejor/peor/tendencia.
10. **Mapas de cancha** — 5 heatmaps (ataque, recepción, saque, defensa, bloqueo) mostrando intensidad, eficacia, frecuencia y éxito con leyenda semántica.
11. **Comparación con temporada** — bullets y sparklines: vs promedio, vs mejor, vs peor, vs rival, vs liga.
12. **Riesgos** — matriz + tarjetas (probabilidad, impacto, urgencia, prioridad, consecuencia, mitigación).
13. **Plan de entrenamiento** — cronograma semanal L/M/J/V (sin tablas) con objetivo, duración, ejercicios, reps, carga, prioridad por bloque.
14. **Coach Insights** — Q&A IA: por qué ganó/perdió, qué cambió el partido, decisiones correctas/incorrectas, qué haría un pro, qué entrenar mañana, qué mantener, qué cambiar, qué observar del próximo rival.
15. **Resumen final** — Executive Summary en 1 página muy visual: resultado, Rally, 3 fortalezas, 3 debilidades, jugador destacado, rotación crítica, fundamento decisivo, objetivo próximo entrenamiento, 3 ejercicios, conclusión IA.

## Fortalezas y debilidades (dentro de cap. 6/2/15)

No sólo listar. Cada ítem responde: por qué es fortaleza/debilidad · qué impacto tuvo · qué pasó gracias/por eso · qué pasaría si se pierde/persiste.

## Preflight de calidad

Antes de `doc.save()`:

- Recalcula `totalPages` y reescribe footer + numeración.
- Verifica anclas del TOC (todas resuelven) y corrige.
- Sanitiza `NaN|Infinity|null|undefined|>300min|%>100` → "—".
- Recorre bounding boxes registrados: si algún texto/tarjeta se sale del área útil o se solapa, mueve el bloque y re-renderiza esa página.
- Detecta páginas con >60% de whitespace: intenta rebalancear con el siguiente bloque; si no, marca ok.
- Loggea `console.warn('[pdf-preflight]', ...)` con correcciones aplicadas.

## Detalles técnicos

- Todos los gráficos vectoriales para nitidez a cualquier zoom.
- `HeatCourt` usa `aggregateAttacks` existente (para ataque) + adapters nuevos que leen `PointEvent`/`SettingEvent` para recepción, saque, bloqueo y defensa. Sin cambios de tipos.
- Motor de páginas expone `ensureSpace(h, { keepWithNext? })` para agrupar título+contenido.
- Numeración final: recorro `doc.getNumberOfPages()` e inyecto `Página i de N` + repongo header/footer.
- Uso `autoTable` sólo donde una tabla realmente aporta (2-3 lugares); el resto son gráficos y tarjetas.

## Riesgos

- Cambio grande (~2.000 líneas). Lo dejo dividido en submódulos internos bajo `src/lib/intelligence/pdf/` para que sea mantenible; `intelligence-pdf.ts` queda como orquestador delgado.
- No puedo verificar visualmente desde el sandbox. Confío en preflight + layout atómico; probás la exportación desde `/intelligence` cuando termine.
