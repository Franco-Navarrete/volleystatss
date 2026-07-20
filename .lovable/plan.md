## Objetivo

Corregir el flujo de registro para que refleje fielmente la estructura del voleibol:
- **K1 (post-saque)**: Saque → Recepción → Armado → Ataque.
- **A partir del 1er ataque**: si el rally continúa, ciclar automáticamente **Defensa → Armado → Contraataque** cuantas veces sea necesario. Nunca volver a Recepción dentro del mismo rally.

## Cambios de datos (store)

Archivo: `src/lib/volley-store.ts`

- Nuevo evento `DefenseEvent`:
  ```ts
  { kind: "defense"; matchId; setNumber; side: "A"|"B"; playerId;
    rating: "excellent" | "positive" | "controlled" | "weak" | "error";
    timestamp }
  ```
- Nueva acción `recordDefense(matchId, side, playerId, rating)`. Si `rating === "error"`, otorga punto al rival (mismo patrón que `overpass` en recepción).
- Añadir `DefenseEvent` a la unión `MatchEvent` y contemplarlo en `undoLastEvent` y en el replay del estado. No tocamos otras estadísticas: el evento existe pero **no altera** los cálculos actuales de recepción/ataque/bloqueo/eficiencia.

## Fase del rally (motor)

Archivo: `src/lib/rally-phase.ts`

Refactor de `computeRallyContext` para representar el ciclo real:
- Fases base: `serve → reception → setting → attack`.
- Tras el 1er `AttackAttemptEvent` (continúa el rally), el ciclo pasa a repetir: `defense → setting → counter_attack`.
- Nuevas fases en la unión: `"counter_attack"` (visualmente "Contraataque"). La `possession` alterna con cada `AttackAttemptEvent` y con cada `DefenseEvent`.
- `currentPhase` post-continuidad se determina así:
  - último evento = `AttackAttempt` del equipo X → `currentPhase = "defense"` para el rival.
  - último evento = `Defense` con rating ≠ error → `currentPhase = "setting"` para el defensor.
  - último evento = `Setting` post-defensa → `currentPhase = "counter_attack"` para ese equipo.
- Se elimina "Esperando recepción" una vez que hubo al menos un ataque en el rally.

Además exportar un `RallyTimeline: Array<{ phase, side, playerId?, detail? }>` para el historial visual del rally en curso.

## Barra de progreso

Archivo: `src/components/scorer/RallyProgressBar.tsx`

- Render dinámico basado en el timeline (no un array fijo). Los primeros 4 pasos siempre son `Saque · Recepción · Armado · Ataque`. Cada continuidad añade `Defensa · Armado · Contraataque` con color naranja (fase de rally largo) y numeración correlativa.
- Marca `done`, `current`, y muestra flechas entre pasos. Con scroll horizontal si crece.

## Chips de contexto

Archivo: `src/components/scorer/RallyContextCards.tsx`

- Cinta superior: `Equipo X atacando · Equipo Y defendiendo` se recalcula con la nueva `possession` en cada continuidad.
- Nueva línea "Contexto del rally": `Rally #N · Saque CCF · Recepción AEC · Ataque CCF · Defensa AEC ← ACTUAL`, construida desde `RallyTimeline`.

## Diálogo integrado

Archivo: `src/components/scorer/IntegratedRallyDialog.tsx`

- Nuevo `Step = "defense"` con 5 botones (Excelente / Positiva / Controlada / Débil / Error). Colores paralelos a los de recepción, hotkeys 1–5.
- Nuevo prop `mode: "reception" | "defense"` (o derivado desde `receptionStep` vs `defenseStep`). Cuando llega en modo defensa:
  - Paso 1: **Defensa** (valoración del defensor recibido por prop).
  - Si rating ≠ error → paso 2: **Armado** (misma grilla actual).
  - Continúa con **Zona destino → Acción → Resultado** (idéntico al flujo existente).
  - Si rating = error → cierra y otorga punto al rival.
- La barra interna del diálogo refleja el subciclo actual (Def → Armado → Contra → Zona → Resultado). Backspace sigue funcionando como "paso anterior".
- Se remueve la posibilidad de volver a "Recepción" durante continuidad.

## Integración en la pantalla del partido

Archivo: `src/routes/_authenticated/matches.$id.index.tsx`

- `onPlayerClick` actual sólo dispara "Recepción" cuando `needsReception`. Añadir la lógica gemela:
  - Si `rallyCtx.currentPhase === "defense"` y el clic es del lado que defiende → abrir `IntegratedRallyDialog` en modo `defense` con el jugador seleccionado como defensor.
- Cuando el resultado del ataque es "Continúa" (ya existente, `recordAttackAttempt`), no cambiar nada: el nuevo `computeRallyContext` se encargará de mover `currentPhase` a `defense` del rival.
- Menú de acciones del planillero (no-coach) sin cambios.

## Historial del rally (opcional visual)

Nuevo componente `RallyTimelineStrip.tsx` colgado bajo la barra de progreso: chips con el resumen del rally vivo (Saque +, Recepción #, Armado Z4, Ataque Alta Z1, Defensa +, Armado Pipe, Contraataque JATU Z5, …). Se alimenta del `RallyTimeline` derivado. Se oculta si el rally está cerrado.

## Validación

- Registro manual de un rally completo: saque, recepción +, armado Z4, ataque continúa → verificar que se ofrece Defensa en el rival, no Recepción.
- Ciclo largo: encadenar 2–3 continuidades y ver la barra crecer con Defensa/Armado/Contraataque.
- Undo: deshacer una defensa restaura la posesión previa; deshacer un attackAttempt vuelve al paso "esperando resultado" del atacante anterior.
- `serve_error` y `ace` siguen cerrando el rally sin abrir recepción/defensa.

## Fuera de alcance (no se toca)

- Cálculo de estadísticas de ataque, recepción, saque, bloqueo y eficiencias.
- Modo planillero simple (sin cambios).
- Sincronización a nube (`cloud-sync`), PDF, dashboards.
