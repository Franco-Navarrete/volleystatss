# Rally Intelligence — módulo analítico

Convertir Rally en asistente técnico: motor de stats propio → motor de insights por reglas → IA que solo interpreta. Sin recalcular estadísticas en la IA, sin inventar datos.

## Arquitectura (4 capas, todas independientes)

```text
Etapa 1: Registro                (ya existe — volley-store, eventos)
   ↓
Etapa 2: Motor de Estadísticas   (src/lib/intelligence/stats/)
   ↓
Etapa 3: Motor de Insights        (src/lib/intelligence/insights/)  ← reglas puras, sin IA
   ↓
Etapa 4: Rally Intelligence (IA)  (src/lib/intelligence/ai/ + server fn)
                                    interpreta insights → informes en lenguaje natural
```

Cada capa expone tipos serializables. La IA solo recibe insights, nunca eventos ni porcentajes crudos que deba recalcular.

## Estructura de archivos

```text
src/lib/intelligence/
  types.ts                    ← Insight, InsightLevel, EngineResult, Report
  stats/
    index.ts                  ← computeIntelligenceStats(match|matches, teamId)
    attack.ts recepcion.ts saque.ts armado.ts bloqueo.ts
    defensa.ts rotaciones.ts k1.ts k2.ts distribucion.ts
    (reutilizan volley-store, historical-stats, rotation-stats, attack-heatmap)
  insights/
    index.ts                  ← runInsightEngines(stats, context) → Insight[]
    engines/
      attack.ts recepcion.ts saque.ts armado.ts bloqueo.ts
      defensa.ts rotaciones.ts k1.ts k2.ts
      tendencias.ts comparaciones.ts evolucion.ts rival.ts entrenamiento.ts
    rules.ts                  ← umbrales configurables (55% ATK, 30% recep#, etc.)
  ai/
    prompts.ts                ← templates por tipo de informe
    generate-report.functions.ts ← createServerFn (Lovable AI Gateway)
  training/
    catalog.ts                ← ejercicios por debilidad detectada
    planner.ts                ← insights → plan de entrenamiento
  scouting/
    rival.ts                  ← agrega historial del rival → insights previos
  storage/
    reports.functions.ts      ← CRUD de informes en tabla `intelligence_reports`
```

## Tipos clave (types.ts)

```ts
type InsightKind = "fortaleza"|"debilidad"|"alerta"|"patron"|"observacion"|"problema";
type InsightLevel = "info"|"medio"|"alto"|"critico";
interface Insight {
  id: string; engine: string; kind: InsightKind; level: InsightLevel;
  title: string; description: string; confidence: number; // 0-1
  metric?: { key: string; value: number; threshold: number };
  scope: { matchId?: string; teamId?: string; playerId?: string; rotation?: number };
  recommendation?: string; suggestedDrills?: string[];
}
interface EngineResult { engine: string; insights: Insight[]; }
```

## Motor de Insights — reglas iniciales (ejemplos)

- ATK: `eff > 55% → fortaleza`; `eff < 25% → debilidad`; errores > 20% intentos → alerta.
- Recepción: `#% < 30% → debilidad "recepción inestable"`.
- Armado: >60% balones a Z4 → patrón "dependencia del punta receptor".
- Saque: errores > media histórica del equipo → alerta.
- Central: <10% de armados recibidos → observación.
- Rotaciones: efectividad < 35% → problema táctico.
- K1/K2: eficacia por debajo de umbral → debilidad correspondiente.

Umbrales en `rules.ts`, tipados, ajustables por liga/categoría.

## Etapa 4 — IA

Un único server fn `generateIntelligenceReport({ reportType, insights, context })` en TanStack (`createServerFn` + `requireSupabaseAuth`), usando Lovable AI Gateway (`google/gemini-3.5-flash` por defecto). El prompt del sistema declara: "No calcules, no inventes cifras, solo interpreta los insights recibidos". Se envían insights + metadata mínima (equipos, marcadores finales, jugadoras nombradas). Nunca se envía el arreglo de eventos.

Tipos de informe (todos consumen los mismos insights):
- Informe completo · Táctico · Ofensivo · Defensivo · Armador · Líbero · Por jugador
- Comparación entre partidos · vs temporada · entre jugadoras
- Scouting del rival · Informe para jugadoras · Cuerpo técnico · Plan de entrenamiento

## Centro de Análisis (UI)

Nueva ruta `src/routes/_authenticated/intelligence.tsx` (index) + `intelligence.$reportId.tsx` (detalle):
- Selector de contexto: partido / rango / rival / jugadora.
- Grid de tipos de informe → botón "Generar".
- Panel derecho: streaming del informe + lista de insights que lo respaldan (transparencia).
- Historial: lista de informes previos con filtros.

Acceso: entrenadores + admin (`useCoachAccess`).

## Persistencia

Nueva tabla `intelligence_reports` (Supabase):
- `id uuid pk`, `owner_id uuid`, `club_id uuid null`, `team_id uuid null`, `match_id uuid null`, `player_id uuid null`, `report_type text`, `title text`, `insights jsonb`, `content text` (markdown IA), `model text`, `created_at timestamptz default now()`.
- RLS: owner (`auth.uid() = owner_id`) + admin. GRANTs a `authenticated`/`service_role`.
- Índices por `owner_id, team_id, player_id, match_id`.

Todos los informes generados se guardan automáticamente → historial por equipo y por jugadora.

## Planificador de entrenamientos

`training/catalog.ts` mapea cada `Insight.id/engine+metric` a ejercicios:
```ts
"recepcion.zona5.baja" → ["Recepción con desplazamiento","Saque flotado","Bajo presión","Transición K1"]
"k2.baja" → ["K2","Defensa + contraataque","Transición defensa-ataque","Juego reducido"]
```
`training/planner.ts` toma los insights de nivel `alto|critico` y arma un plan (bloques semanales). Se expone como un tipo de informe más.

## Scouting del rival

`scouting/rival.ts`: dado `opponentTeamId`, corre stats+insights sobre sus últimos N partidos y produce insight bundle "pre-partido". La IA lo redacta como scouting.

## Fases de entrega

1. **F1 — cimientos**: `types.ts`, `stats/index.ts` (reusando código existente), `insights/` con 6 motores base (ATK, REC, SAQ, ARM, BLK, ROT), tabla + RLS + `reports.functions.ts`, ruta `intelligence.tsx` con "Informe completo del partido" end-to-end (stats→insights→IA→guardar→mostrar).
2. **F2 — motores restantes**: defensa, K1, K2, tendencias, comparaciones, evolución.
3. **F3 — scouting rival + planificador de entrenamientos** + tipos de informe faltantes.
4. **F4 — historial inteligente**: vistas por equipo/jugadora, comparador de informes.

Cada fase es independiente y no rompe funcionalidad existente.

## Detalles técnicos

- IA vía AI SDK + `createLovableAiGatewayProvider` (helper ya documentado). Streaming con `streamText` → `toUIMessageStreamResponse` en `src/routes/api/intelligence.chat.ts` para redacción en vivo; una versión no-stream (`generateText`) para guardado.
- Insights se calculan **antes** de llamar la IA y se persisten junto al informe → reproducibilidad y auditoría.
- Sin cambios en `volley-store` ni en el flujo de registro.
- Compatibilidad móvil/tablet: Centro de Análisis usa el shell estándar `_authenticated`.

## Fuera de alcance de esta primera implementación

- Entrenamiento fine-tuned propio (usamos gateway).
- Video/analítica de video.
- Notificaciones push de insights.

¿Confirmás la arquitectura y arranco por **F1** (cimientos + Informe completo del partido end-to-end)?
