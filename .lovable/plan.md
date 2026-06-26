## Objetivo
Sumar el concepto de **Tipo de Ataque** al modo entrenador, registrarlo junto a cada ataque y explotarlo en estadísticas, manteniendo la carga en 1 toque por tablet.

## 1. Catálogo de tipos (por rol y zona)

**Centrales (delanteras)**
- `first_tempo` — 1er tiempo (rápida)
- `slide` — Corrida / fast
- `tense` — Tensa
- `combo` — Combinación

**Extremos delanteros (punta / opuesta)**
- `high_outside` — Bola alta por z4
- `high_opposite` — Bola alta por z2
- `tense_outside` — Tensa z4
- `tense_opposite` — Tensa z2
- `second_tempo` — 2do tiempo
- `combo` — Combinación

**Zagueros (punta zaguera, opuesta zaguera, central zaguera)**
- `pipe` — Pipe (z6)
- `back_right` — Z1 (zaguero derecho)
- `back_left` — Z5 (zaguero izquierdo)
- `back_tense` — Zaguero tenso

El catálogo lo define una función `getAttackTypeOptions({ role, isBackRow })` en `src/lib/formations/attack-types.ts`. Devuelve `{ id, label, shortLabel, zoneHint }[]`.

## 2. Modelo de datos

En `src/lib/volley-store.ts`:
- Nuevo tipo `AttackType` (union de los ids del catálogo).
- Extender `PointEvent` con `attackType?: AttackType` (sólo se setea cuando `type ∈ { attack, rotation_attack, counter_attack, attack_error }`).
- Extender `SettingEvent` con `attackType?: AttackType` (cuando el armado deriva en un ataque registrado).
- `recordPoint(matchId, side, type, playerId, opts?)` acepta `{ attackZone?, attackType? }`.

Cambios retrocompatibles: eventos antiguos sin `attackType` siguen funcionando (las estadísticas los agrupan como "Sin clasificar").

## 3. Flujo de UI (modo entrenador)

Hoy, al confirmar una zona de ataque, se llama `recordPoint`. Se inserta un paso intermedio:

```
Jugadora → Resultado (Punto/Error) → Zona → Tipo de Ataque → guardar
```

- Nuevo diálogo `AttackTypeDialog` (`src/components/scorer/AttackTypeDialog.tsx`).
- Recibe `{ playerRole, isBackRow, zone }`, llama a `getAttackTypeOptions` y pinta una **grilla 2–3 columnas** con botones grandes (≥80px alto, label + ícono).
- Si la jugadora es **zaguera** ⇒ sólo opciones zagueras.
- Si es **central delantera** ⇒ sólo opciones centrales.
- Si es **punta/opuesta delantera** ⇒ opciones de extremos.
- Botón "Sin clasificar" siempre disponible para no frenar el scouting.

El rol y `isBackRow` se obtienen del motor ya resuelto (`ResolvedFormation.slots[i].role` + `isBackRow`).

## 4. Estadísticas

Nuevo módulo `src/lib/attack-type-stats.ts` con selectores puros sobre `match.events`:

- `attackTypeEffectiveness(match, filters?)` — por tipo: intentos, puntos, errores, % efectividad.
- `attackTypeDistribution(match, side)` — % de cada tipo sobre el total de ataques.
- `attackTypeByRotation(match, side)` — matriz tipo × rotación.
- `attackTypeBySetterQuality(match)` — cruza `SettingEvent.quality` (++/+/!/-/--) con tipo y resultado.
- `attackTypeByPlayer(match, playerId)` — tendencia por jugadora.

UI:
- Nueva pestaña **"Tipos de ataque"** en `matches.$id.stats.tsx` con:
  - Tabla efectividad por tipo (equipo A/B).
  - Barras de distribución.
  - Heatmap simple tipo × rotación.
  - Cruce calidad de armado × tipo.
- Tarjeta por jugadora en `PlayerHistoryDialog` con sus 3 tipos más usados y % efectividad.

## 5. Archivos a tocar

Nuevos:
- `src/lib/formations/attack-types.ts` (catálogo + helper).
- `src/components/scorer/AttackTypeDialog.tsx`.
- `src/lib/attack-type-stats.ts`.

Editados:
- `src/lib/volley-store.ts` — tipos + `recordPoint` opts + persistencia.
- `src/routes/_authenticated/matches.$id.index.tsx` — insertar paso `AttackTypeDialog` entre zona y guardado, sólo en modo entrenador.
- `src/components/scorer/QuickSettingBar.tsx` / `SettingDialog.tsx` — pasar `attackType` al `SettingEvent` cuando aplica.
- `src/routes/_authenticated/matches.$id.stats.tsx` — nueva pestaña.
- `src/components/PlayerHistoryDialog.tsx` — bloque de tipos.

## 6. Consideraciones

- Catálogo extensible: agregar tipo = agregar línea en `attack-types.ts`, sin migrar datos.
- Sin cambios de DB: todo viaja en el `events[]` del partido (jsonb en `app_state` y `match_events`).
- Mantengo "Sin clasificar" para no romper el scouting rápido en partidos en vivo.
- El catálogo de tipos lo dejo como **propuesta**; lo confirmamos antes de codear si querés ajustar nombres o agregar/quitar opciones.

¿Avanzo con esta propuesta o querés ajustar el catálogo de tipos primero?
