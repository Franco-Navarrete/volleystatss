# Rediseño del perfil de jugadora

Objetivo: convertir `/jugadora/$id` en un panel de análisis individual, eliminar los filtros de búsqueda y organizar la información en bloques temáticos.

## 1. Eliminar de la página

- Barra horizontal de ligas y todos los chips con `overflow-x-auto`.
- Estado `leagueFilter` y el filtrado de `matches` por liga.
- Toda referencia a filtros heredados de la pantalla anterior.

Los filtros seguirán existiendo solo en Equipos, Jugadores y Partidos.

## 2. Nuevo layout — dashboard por bloques

Debajo del encabezado, un dashboard con estas secciones:

**Resumen (tarjetas)** — Partidos jugados, Sets jugados*, Puntos, Aces, Ataques, Bloqueos, Errores totales, Eficiencia general.
Más una tarjeta "Rendimiento" (score MVP promedio).

**Gráficos**
- Evolución por partido (barras de puntos, ya existe — se mejora visualmente).
- Rendimiento por rival (top 5 rivales por puntos).
- Rendimiento por liga (agrupado según liga del rival — usa la liga del equipo local para partidos ya jugados).

**Ataque** — totales, puntos, errores, eficiencia; desglose Ataque/Contraataque/Rotación (los tres tipos que sí trackea la app).

**Recepción** — Total, Positivas, Neutras, Negativas, % perfecta y % eficiencia (fórmulas ya definidas en el store).

**Saque** — Aces, Errores, Saques efectivos (aces + puntos ganados en el rally posterior no está trackeado; se muestra "Aces / Errores / Ratio").

**Bloqueo** — Bloqueos punto, Errores de bloqueo (`blockError`), Ratio.

**Defensa** — sección informativa: "Sin trackeo por jugadora todavía" con un badge tenue (freeballs/defensas/continuidades no se registran por jugadora en el modelo actual). Se deja el bloque preparado para cuando existan datos.

**Historial** — tabla completa: Fecha, Rival, Liga, Resultado, Puntos, Ataques, Recepción%, Saque (aces/err), Bloqueo. Filas clicables al partido.

**Comparación** — tarjetas con delta vs:
- Promedio del equipo (jugadoras del mismo equipo, mismo periodo).
- Promedio de la liga (jugadoras cuyo equipo comparte liga con el de la jugadora).
- Jugadoras del mismo puesto (misma `position`).

*Sets jugados: derivar del recuento de sets de los partidos donde participó (no hay minutaje por set en el modelo; se usa `sets.length` del match como aproximación).

## 3. Estado vacío

Reemplazar el mensaje simple por una tarjeta grande centrada:

- Icono grande (BarChart3).
- Título: "Sin estadísticas disponibles".
- Descripción: "Esta jugadora todavía no tiene partidos registrados. Cuando participe en un partido usando Rally, aquí aparecerán sus estadísticas, gráficos y evolución."
- Botón primario: "Ver partidos del equipo" → `/equipos/$id`.

## 4. Detalles técnicos

- Se modifica únicamente `src/routes/jugadora.$id.tsx`.
- Se añaden funciones locales `computeTeamAverages`, `computeLeagueAverages`, `computePositionAverages` que reutilizan `computeHistoricalStats(matches, teams)` filtrando el arreglo de agregados resultante. Sin cambios en el store ni en `historical-stats.ts`.
- Todas las agregaciones se memoizan.
- Sin librería de charts nueva: barras simples con divs (ya se usa así hoy). Mantiene bundle pequeño y estética consistente.
- Estilo oscuro actual, `border-border/60`, `bg-card/40`, acentos en `text-primary`, `tabular-nums` para números.

## 5. Fuera de alcance

Los siguientes requieren nueva agregación de eventos por jugadora que hoy no existe:

- Mapa de calor y ataques por zona/tipo (los eventos guardan zona/tipo, pero `PlayerAggregate` no los desglosa).
- Rendimiento por set y por rotación por jugadora.
- Distribución de saque por zona.
- Defensa/freeballs/continuidades por jugadora.

Se dejan como bloques con placeholder "Próximamente" para no romper el layout ni la promesa visual, y se puede abordar en un turno posterior extendiendo `PlayerAggregate`.

## Confirmación

¿Avanzo con este alcance (secciones con datos reales + placeholders para las métricas que aún no se agregan por jugadora), o preferís que primero extienda `historical-stats.ts` para calcular zonas/rotaciones/set/defensa antes de rediseñar la UI?
