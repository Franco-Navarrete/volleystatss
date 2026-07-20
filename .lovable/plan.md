
# Perfil de Jugador — Centro de análisis

Mantener el diseño oscuro y moderno actual. No rediseñar, sino ampliar `/jugadora/$id` con nuevas secciones y agregaciones. Todo el trabajo respeta la identidad visual: `bg-card/40`, `border-border/60`, `text-primary`, `tabular-nums`.

## Alcance por sección

1. **Contexto comparativo por métrica** — cada KPI muestra valor + promedio del equipo + promedio de la liga + delta (%). Reutiliza `computeHistoricalStats` filtrado.
2. **Evolución** — gráficos de líneas (recharts, ya en el proyecto) para Puntos / Ataques / Eficiencia / Recepción / Saque / Bloqueo. Selector: Últimos 5 / 10 / Toda la temporada.
3. **Radar de habilidades** — `RadarChart` de recharts. Ejes: Ataque, Recepción, Saque, Bloqueo, Defensa, Eficiencia. 3 series: jugadora, equipo, liga (normalizados 0–100).
4. **Mapas de calor** — grilla 3×3 de zonas de cancha:
   - Ataque: frecuencia y % éxito por zona destino (de `AttackAttemptEvent.direction`).
   - Recepción: eficiencia por zona (de `ReceptionEvent.zone`).
   - Saque: aces/errores por zona objetivo (de `ServeEvent.targetZone` si existe, si no placeholder).
   - Bloqueo: sectores con más puntos (por posición en cancha al momento del bloqueo).
   Componente nuevo `PlayerHeatmap` reutilizando estilo de `AttackHeatmap`.
5. **Filtros temporales globales** — Toda la carrera / Temporada actual / Últimos 10 / Últimos 5 / Último. Un solo estado, aplica a todas las secciones.
6. **Ficha del jugador ampliada** — mostrar Edad, Altura, Peso, Mano hábil, Categoría, Posición, Fecha de nacimiento, Nacionalidad, Equipo. Extender `Player` en el store con los campos opcionales que falten (`birthDate`, `height`, `weight`, `dominantHand`, `nationality`); "No disponible" si vacío. Editor rápido en la ficha para completar datos.
7. **Indicadores visuales** — badge de color (🟢🟡🟠🔴) según percentil vs liga. Helper `perfBadge(value, leagueAvg)`.
8. **Insights automáticos** — nueva sección "Análisis automático" con reglas:
   - Máximo anotador del equipo, ataque > promedio liga, % contraataque alto, baja participación en bloqueo, gran % recepción positiva, jugadora más eficiente del equipo, MVP recurrente, etc.
9. **Historial mejorado** — tabla con Fecha, Rival, Liga, Resultado, Puntos, Ataques, Recepción, Saque (aces/err), Bloqueo, Defensa, Eficiencia + botón "Ver detalle" → `/partidos/$id`.
10. **Comparaciones visuales** — barras horizontales normalizadas contra Equipo / Liga / Mismo puesto. Estado claro: por encima / igual / por debajo.
11. **Estadísticas por rotación (P1–P6)** — reusar `computeRotationStats` filtrando eventos por jugadora en cancha. Extender: contar puntos/ataques/eficiencia/recepción/bloqueo por rotación de la jugadora.
12. **Rendimiento por armador** — reusar `computeSetterDistribution` filtrado por `attackerId = playerId`. Muestra top armadores con ataques / puntos / eficiencia.
13. **Tendencias** — comparar promedio últimos 5 vs promedio histórico. Deltas por métrica con flechas ▲▼.
14. **Timeline del último partido** — listado cronológico de eventos de la jugadora en el último partido finalizado. Cada fila: set, marcador, tipo, resultado. Colapsable por set.
15. **Exportación** — botones Exportar PDF (reutilizar `match-pdf` extendido), Exportar Excel (nuevo `player-xlsx.ts` con SheetJS o export CSV nativo), Compartir enlace (Web Share / copia URL), Imprimir (`window.print()` con `@media print` CSS).
16. **Patrones de juego** — nueva sección "Patrones de juego". Reglas automáticas sobre eventos filtrados por la jugadora:
   - % de ataques por zona origen (de `AttackAttemptEvent`).
   - Tipo de ataque más frecuente y efectivo.
   - % conversión post-recepción positiva.
   - Zona destino más usada.
   - Contraataque vs rotación (ratio).
   - Rendimiento vs bloqueo doble (si `blockers` en evento).
   - Rotaciones con mayor puntería.
   - Éxito con armado rápido (cuando `SettingEvent.quality === "++"`).
   - Zona de mejor recepción.
   - Zona de saque más problemática para el rival.

## Detalles técnicos

- **Archivo nuevo `src/lib/player-analytics.ts`** — agrega funciones puras que reciben `(matches, teams, playerId, timeframe)` y devuelven:
  - `computePlayerContext` — totales + promedios equipo/liga/puesto.
  - `computePlayerEvolution` — series temporales por partido.
  - `computePlayerHeatmaps` — matrices 3×3 para ataque/recepción/saque/bloqueo.
  - `computePlayerRotations` — buckets P1–P6 por métrica.
  - `computePlayerBySetter` — desglose por armador.
  - `computePlayerTrends` — deltas recientes vs histórico.
  - `computePlayerPatterns` — reglas heurísticas para patrones.
  - `computePlayerTimeline` — eventos del último partido.
- **Filtrado temporal** — `applyTimeframe(matches, tf)` a nivel de partidos finalizados.
- **Extensión de `Player`** — agregar campos opcionales sin migración de datos (viven en el store persistido en `app_state`). El editor de equipo ya guarda todo el player como JSON.
- **Componente `src/routes/jugadora.$id.tsx`** — reorganizar en secciones y consumir los helpers. Todos los cálculos memoizados por `[matches, teams, playerId, timeframe]`.
- **Charts** — usar recharts (ya está). `LineChart`, `RadarChart`, `BarChart`, `PieChart` si aplica.
- **Heatmap** — componente `PlayerHeatmap` con grilla 3×3, color por intensidad (verde→rojo según % éxito o frecuencia).
- **Exportación PDF** — reutilizar patrón de `match-pdf.ts`, nuevo `player-pdf.ts` con secciones del dashboard.
- **Exportación Excel** — `bun add xlsx` para libro con hojas: Resumen / Historial / Rotaciones / Patrones.

## Fuera de este turno

- Persistir los nuevos campos de `Player` en columnas dedicadas (viven como JSON en `app_state`).
- Editor completo de biografía en la vista del equipo (se agrega solo el botón "Editar datos" en la ficha del jugador).

## Estimación

Archivos nuevos: `src/lib/player-analytics.ts`, `src/lib/player-pdf.ts`, `src/lib/player-xlsx.ts`, `src/components/PlayerHeatmap.tsx`, `src/components/PlayerRadar.tsx`, `src/components/PlayerBioEditor.tsx`.
Archivos modificados: `src/routes/jugadora.$id.tsx`, `src/lib/volley-store.ts` (campos opcionales en `Player`), `src/styles.css` (reglas `@media print`).

¿Avanzo con este alcance completo, o preferís que lo entregue en fases (fase 1: contexto + evolución + radar + insights + tendencias; fase 2: heatmaps + rotaciones + patrones + armador; fase 3: exportaciones + timeline + bio)?
