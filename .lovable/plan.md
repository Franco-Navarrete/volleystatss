# Coach Mode v2 — Motor de Estados Guiado

Rediseñamos Coach Mode: dejar de ser "atajos + panel de ataque suelto" para convertirse en un **motor de estados** que guía el rally completo dentro de **un único panel flotante**, con selección automática de jugador desde la formación efectiva y valoración universal.

## 1. Motor de estados (nuevo)

Archivo: `src/lib/coach/rally-machine.ts`

Máquina de estados desacoplada del `volley-store` (todavía comitea vía sus acciones existentes al confirmar cada fundamento):

```text
IDLE → SAQUE → RECEPCION → ARMADO → ATAQUE
              ↑ (según valoración)   ↓
              └── BLOQUEO ← DEFENSA ← CONTRAATAQUE
                       ↓
                     FIN_RALLY
```

Elementos:

- `RallyState = 'idle' | 'saque' | 'recepcion' | 'armado' | 'ataque' | 'bloqueo' | 'defensa' | 'contraataque' | 'fin'`
- `RallyStep = { state, side: 'A'|'B', playerId?, zone?, origin?, target?, rating? }`
- Store zustand `useCoachRally`:
  - `history: RallyStep[]`, `redo: RallyStep[]`, `current: PartialStep | null`
  - `start(state, side)`, `setPlayer(id)`, `setZone(z)`, `setOrigin/Target(z)`, `setRating(r)`, `commit()`, `back()`, `cancel()`, `undo()`, `redo()`
- `nextState(step)`: función pura que decide el próximo fundamento según la valoración universal (`# + 0 - = ≠`). Ej: recepción `=`/`≠` → `fin` (punto rival); saque `#` → `fin`; ataque `#` → `fin`; ataque `-` → `defensa` del otro lado; etc.
- `commit()` mapea la step a llamadas del `volley-store` (recycleando `recordPoint`, `recordPass`, `recordSet`, `recordAttack`, `recordBlock`, `recordDig`) sin duplicar reglas.

Universal rating: `# + 0 - = ≠`. Cada fundamento tiene su propio `meaningOfRating` (recibido / punto / continúa / etc.), pero UI y teclas son idénticas.

## 2. Selección automática (fuente de verdad: formación efectiva)

Archivo: `src/lib/coach/effective-lineup.ts`

- `getEffectiveOnCourt(match, side)` — usa `match.onCourtA/B` (ya refleja rotaciones, líbero, sustituciones) + `buildEffective` compartido con `CourtView`.
- `playerAtZone(match, side, zone)` — mapea Z1..Z6 al índice correcto del array efectivo.
- Reglas:
  - Saque → jugador en Z1 del equipo que saca.
  - Recepción → si se conoce `target` del saque, receptor = jugador en esa zona del lado receptor.
  - Armado → armadora si está en cancha; si no, jugador en Z2/Z3 más cercano.
  - Ataque → jugador en zona origen elegida (Z4/Z3/Z2/Pipe(Z6)/Z1).
  - Bloqueo/Defensa → jugador en la zona destino del ataque previo.
- Nunca preguntar al usuario un dato deducible: sólo pedir manual si `playerAtZone` devuelve `null` o ambiguo.

## 3. Panel único (state machine UI)

Componente: `src/components/coach/CoachRallyPanel.tsx`

Un solo `<div>` flotante (fixed, centro-inferior, ~420px). NO usar Radix `Dialog` (romperá con tablet forzado + evita focus trap que corrompe hotkeys). Estructura:

```text
┌────────────────────────────────────────┐
│ ⌨ Coach Mode · Equipo A · ATAQUE  [×] │  ← Cabecera
├────────────────────────────────────────┤
│ SAQUE › REC › ARM › ATA · BLQ · DEF ·  │  ← Progress bar
├─────────────────────────┬──────────────┤
│ Paso actual (contenido) │ Resumen del  │
│ dinámico por estado)    │ rally lateral│
│                         │              │
│ [Esc] cancelar          │              │
│ [⌫] volver              │              │
└─────────────────────────┴──────────────┘
```

Sub-componentes reutilizables por estado (renderizan sólo su input y consumen la machine):

- `StepPickPlayer` — grilla con onCourt efectivo, resalta autopickeado; teclas 0-9 (buffer 350ms).
- `StepPickZone` — grilla 3×3 QWE/ASD (Z5 Z6 Z1 / Z4 Z3 Z2) reutilizando teclas actuales.
- `StepPickOriginZone` — 1..5 (Z4/Z3/Z2/Pipe/Zag) para ataque.
- `StepPickRating` — 6 botones con teclas `# + 0 - = ≠`. Confirm automático (sin Enter).
- `StepSummary` — al FIN, muestra resultado + [Enter] nuevo rally.

Transiciones con `data-[state]` y `animate-in fade-in-0 slide-in-from-bottom-1 duration-200`.

**Resumen del rally lateral**: componente `CoachRallySummary.tsx` recorre `history` y renderiza tarjetas por fundamento con `{estado, #jugador, zona/dest, rating}`.

## 4. Cabecera con equipo activo

- Se calcula desde la máquina: equipo que saca en `saque`, receptor en `recepcion`, etc.
- Botón `[×]` (Esc) descarta la rally-in-progress sin comitear al store.

## 5. Hook integrador de teclado

Ampliar `src/hooks/use-coach-shortcuts.ts` para que:

- Cuando la máquina está `idle`, teclas `S R L A B D C` → `start(state, sideAutodetectado)`.
- Cuando NO está idle: teclas dispatch al step actual (número→jugador, QWE/ASD→zona, `# + 0 - = ≠`→rating).
- `Esc` → `cancel()`, `Backspace` → `back()`, `Ctrl+Z/Y` → volley-store `undo/redo`.
- `T` timeout, `M` cambio, `I` líbero (llaman handlers existentes; no entran a la máquina).
- Se ignora si `document.activeElement` es INPUT/TEXTAREA/SELECT/contentEditable o `body[data-coach-input=lock]`.

## 6. Barra de progreso + secuencia visible

Extraer del panel: `CoachStateProgress.tsx` — chips SAQUE › REC › ARM › ATA › BLQ › DEF › FIN. El fundamento activo se resalta (`bg-primary`), los completados marcados con check (`bg-primary/20`), los pendientes en gris.

## 7. Extensibilidad

- Añadir un fundamento nuevo (`FreeBall`, `Challenge`) = registrar entry en el enum + step component + regla en `nextState`. Nada más se toca.
- Hook `registerRallyExtension({state, keyBinding, stepComponent, transitions})` opcional para features futuras.

## 8. Compatibilidad con Coach Mode actual

- Conservamos `CoachHelpDialog`, `CoachHelpBar`, `CoachModeBadge`, toggle inferior en `matches.$id.index.tsx` y settings.
- Reemplazamos el flujo suelto de `CoachAttackPanel.tsx` (queda deprecado; borrar tras verificar).
- El HUD viejo (`CoachHUD.tsx`) se retira porque el nuevo panel único cubre su función.

## 9. Archivos

**Nuevos**
- `src/lib/coach/rally-machine.ts` — store + `nextState` + commit al volley-store.
- `src/lib/coach/effective-lineup.ts` — helpers `playerAtZone`, `getEffectiveOnCourt`.
- `src/components/coach/CoachRallyPanel.tsx` — panel único.
- `src/components/coach/CoachRallySummary.tsx` — tarjeta lateral.
- `src/components/coach/CoachStateProgress.tsx` — progress bar de estados.
- `src/components/coach/steps/StepPickPlayer.tsx`
- `src/components/coach/steps/StepPickZone.tsx`
- `src/components/coach/steps/StepPickOriginZone.tsx`
- `src/components/coach/steps/StepPickRating.tsx`
- `src/components/coach/steps/StepSummary.tsx`

**Modificados**
- `src/hooks/use-coach-shortcuts.ts` — dispatch a la máquina en vez de emitir eventos sueltos.
- `src/routes/_authenticated/matches.$id.index.tsx` — monta `<CoachRallyPanel/>`, retira `CoachAttackPanel` y `CoachHUD`.
- `src/components/coach/CoachHelpDialog.tsx` — actualiza tabla con nuevos comandos y flujo.

**Deprecados** (borrar al final)
- `src/components/coach/CoachAttackPanel.tsx`
- `src/components/coach/CoachHUD.tsx`

## 10. No cambia

- No se toca el `volley-store` (sólo se consumen sus acciones existentes).
- No hay cambios en Supabase ni RLS.
- Solo escritorio (mismo gate actual con `useCoachAccess` + no mobile/tablet).
