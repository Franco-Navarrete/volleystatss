## Módulo: Mapa de Calor de Saque (Rally Live Stats)

Nuevo módulo táctico en tiempo real dentro de "Estadísticas en Vivo", con visualización dual (Equipo A / Equipo B), múltiples modos, filtros combinables, KPIs, mapa de receptores, patrones IA, predicción y recomendaciones.

---

### 1. Motor de datos (`src/lib/coach/serve-heatmap.ts`)

Función pura que consume los eventos del store (`match_events`) y produce:

```ts
type ServeZoneStats = {
  zone: 1|2|3|4|5|6;
  count: number;
  pct: number;
  aces: number;
  errors: number;
  efficacy: number;      // (aces - errors) / count
  recNeg: number;        // recepciones -, =, ≠ generadas
  recPerfect: number;    // # generados
};

type ServeAnalytics = {
  byTeam: Record<'A'|'B', {
    zones: ServeZoneStats[];
    totals: { serves, aces, errors, efficacy };
    topServer, topTarget, avoidedPlayer;
    receivers: Array<{ playerId, name, pos, count, perfect, pos: '#'|'+'|'0'|'-'|'='|'≠' counts, quality }>;
  }>;
  patterns: Pattern[];    // detectadas por reglas deterministas
  prediction: { zone, zoneConfidence, targetPlayerId, playerConfidence, explanation };
  recommendations: Recommendation[];
};
```

- Reglas de patrones: concentración >40% en una receptora, evasión del líbero, dominancia diagonal (Z1→Z5/Z5→Z1), cambio de objetivo por rotación (χ² simplificado), diferencia de zona en puntos clave (24+, iguales).
- Predicción: markov de orden 1 sobre los últimos N saques del sacador actual + suavizado por frecuencia global. Confianza = max(prob) * (1 - entropía normalizada).

### 2. Componentes UI

- `src/components/serve/ServeHeatmapCourt.tsx` — cancha SVG con 6 zonas (usa el mismo layout que `AttackHeatmap` para consistencia visual). Modo controla el valor de color: frecuencia, eficacia, aces, errores, recNeg, recPerfect. Tooltip por zona.
- `src/components/serve/ServeReceiversMap.tsx` — formación rival con círculos proporcionales; color = calidad de recepción.
- `src/components/serve/ServeKpiCards.tsx` — 7 tarjetas.
- `src/components/serve/ServePatterns.tsx` — lista compacta de patrones + predicción + recomendaciones (mismo estilo que `CoachLiveDashboard`).
- `src/components/serve/ServeFilters.tsx` — set, rotación sacador, rotación receptor, jugador sacador, jugador receptor, tipo de saque, resultado, zona. Combinables (AND).
- `src/components/serve/ServeHeatmapPanel.tsx` — orquesta filtros + memoiza `computeServeAnalytics`, renderiza dos canchas lado a lado + KPIs + receptores + patrones.

### 3. Integración

En `src/routes/_authenticated/matches.$id.stats.tsx`, dentro de "Estadísticas detalladas" (sección colapsable existente), agregar tabs debajo de los Mapas de Calor de Ataque:

```
Tabs: [Ataque] [Saque]
```

En móvil (`MobileMatchShell`), agregar entrada en BottomNav → sección "Saque".

Recalcula automáticamente vía `useMemo` sobre `events` del store — sin polling.

### 4. Detalles técnicos

- Reutilizar paleta y componentes de `AttackHeatmap` para mantener el mismo estilo visual (gradiente por intensidad, badges, HoverCard).
- Zonas se derivan del campo `serveZone` del evento `ServeEvent` (ya existe); si no existe en eventos antiguos, se toma `zone` del saque o se marca "sin zona".
- Receptores: cruzar `ReceiveEvent` inmediato posterior a cada `ServeEvent` para atribuir zona + jugadora receptora.
- Todo en cliente, sin cambios en Supabase.

### Archivos nuevos
- `src/lib/coach/serve-heatmap.ts`
- `src/components/serve/ServeHeatmapPanel.tsx`
- `src/components/serve/ServeHeatmapCourt.tsx`
- `src/components/serve/ServeReceiversMap.tsx`
- `src/components/serve/ServeKpiCards.tsx`
- `src/components/serve/ServePatterns.tsx`
- `src/components/serve/ServeFilters.tsx`

### Archivos modificados
- `src/routes/_authenticated/matches.$id.stats.tsx` (tabs Ataque/Saque)
- `src/components/mobile/MobileMatchShell.tsx` (entrada nav)
