# Rally Coach — Rediseño de Estadísticas en Vivo

Convertir la pantalla `matches.$id.stats` de una tabla exhaustiva a un **cockpit táctico** priorizado en 4 niveles, con IA que resalta patrones y recomienda acciones en tiempo real.

## Alcance

Rediseño de UI + nuevo motor de "coach insights" reutilizando los datos ya registrados. Sin cambios en el flujo de registro de rally, ni en Rally Intelligence (PDF/informes históricos).

## Estructura de la nueva pantalla

```
┌─────────────────────────────────────────────────────────┐
│  HEADER TÁCTICO (siempre visible, sin scroll)          │
│  Marcador · Set · Saque · Rot A/B · Momentum · Racha   │
│  Últimos 10 rallies · % victoria estimado              │
├─────────────────────────────────────────────────────────┤
│  IA — SITUACIÓN ACTUAL   │   ¿QUÉ HARÍA RALLY?          │
│  (máx 3 alertas)         │   (máx 3 recomendaciones)   │
├─────────────────────────────────────────────────────────┤
│  TOP 3 PRIORIDADES · corregir ahora (impacto)          │
├─────────────────────────────────────────────────────────┤
│  MOMENTUM (gráfico 15 rallies + timeouts/cambios)      │
├─────────────────────────────────────────────────────────┤
│  ROTACIONES (panel visual con riesgo por color)        │
│  Cancha saques · Cancha ataques · Mapa receptores      │
├─────────────────────────────────────────────────────────┤
│  TIMELINE del partido                                   │
├─────────────────────────────────────────────────────────┤
│  ▸ Estadísticas detalladas de jugadoras (colapsado)    │
└─────────────────────────────────────────────────────────┘
```

## Componentes y archivos

### Motor táctico nuevo
- `src/lib/coach/insights.ts` — reglas deterministas: detecta rachas, rotaciones críticas, patrones de saque/recepción/ataque en ventana reciente (últimos N rallies). Devuelve `Alert[]` y `Recommendation[]` con `impact: high|med|low`.
- `src/lib/coach/momentum.ts` — serie de rally-wins, deltas y marcas (timeouts/cambios).
- `src/lib/coach/priorities.ts` — combina motores y ordena por impacto → top 3.
- `src/lib/coach/serve-heatmap.ts` — agregación de saques por zona destino (frecuencia, aces, errores, presión, recepción -/+).
- `src/lib/coach/receiver-map.ts` — por receptora: saques recibidos, %+, %#, errores.

### Componentes UI
- `src/components/live/LiveCoachDashboard.tsx` — orquesta las secciones.
- `src/components/live/TacticalHeader.tsx`
- `src/components/live/AiAlertsPanel.tsx`
- `src/components/live/RecommendationsPanel.tsx`
- `src/components/live/TopPrioritiesCard.tsx`
- `src/components/live/MomentumChart.tsx`
- `src/components/live/RotationRiskBoard.tsx` (reemplaza tabla)
- `src/components/live/ServeHeatmap.tsx`
- `src/components/live/ReceiverMap.tsx`
- `src/components/live/MatchTimeline.tsx`
- `src/components/live/PlayerStatsCollapsible.tsx` — reusa `LiveStatsTable`, oculta jugadoras sin acción, con toggle "Mostrar todos".

### Ruta
- `src/routes/_authenticated/matches.$id.stats.tsx` — reemplaza el contenido actual por `<LiveCoachDashboard>`. La versión "tabla completa" queda accesible dentro del bloque colapsado.

## Reglas de IA (deterministas, sin llamadas a LLM)

Ventana táctica = últimos 10-15 rallies del set actual. Ejemplos:
- **Saque dirigido**: 3+ saques rivales a misma receptora → alerta.
- **Recepción cayendo**: %+ de una receptora en set actual < 70% de su media histórica del partido.
- **Rotación crítica**: parcial ≤ -3 en la rotación actual → prioridad alta.
- **Zona de ataque saturada**: 3+ ataques consecutivos por misma zona origen.
- **Bloqueo cerrando línea/diagonal**: >50% ataques bloqueados en misma dirección.
- **Racha rival**: 3+ puntos consecutivos → alerta momentum.

Cada regla genera texto en español, `impact`, y (cuando aplica) `recommendation` asociada.

## Detalles técnicos

- Todo el cálculo corre en el cliente sobre `match.events` ya en memoria (Zustand). Sin nuevos endpoints.
- `useMemo` por sección + dependencia en `match.events.length` para no recalcular más de lo necesario.
- Animación sutil `animate-fade-in` cuando entra una nueva alerta o llega un nuevo rally al momentum/heatmaps.
- Mobile-first + tablet horizontal: grid `lg:grid-cols-2` para heatmaps, header sticky.
- Alertas visuales inline (badge/toast discreto), nunca modal.
- Se reusan `AttackHeatmap`, `computeRotationStats`, `buildEnrichedAttacks`.

## Fuera de alcance (para no romper otras cosas)
- No se toca el flujo de registro (`IntegratedRallyDialog`), Rally Intelligence, PDF, ni permisos.
- No se agregan llamadas a IA gateway en esta iteración (todo determinista para respuesta instantánea).
- La "probabilidad de victoria" será una estimación simple basada en diferencial y momentum; no un modelo entrenado.

## Entrega en una sola tanda
Se crea el motor + componentes + se reemplaza la ruta stats. El resto de la app queda intacta.
