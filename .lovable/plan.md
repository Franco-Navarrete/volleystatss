
## Objetivo

Al tocar un jugador en cancha, ya sabemos la zona de origen (su posición real). Eliminar la pantalla "¿DESDE QUÉ ZONA?" y reemplazar el catálogo actual de tipos de ataque por uno nuevo, filtrado por rol + fila (delantero/zaguero). Después del tipo, elegir resultado (Punto / Continúa / Error) y, salvo en Error, marcar la zona de destino (opcional).

El diálogo integrado post-recepción (Zona armado → Dirección → Acción → Valoración) no se toca.

## Flujo nuevo (tap jugador → ataque/contra)

```text
Tap jugador
   ↓
Acción (Saque / Ataque rot. / Contra / Bloqueo / Err. ataque / Err. no forz. / Err. saque)
   ↓  (solo si Ataque rot. o Contraataque)
Tipo de ataque  ← filtrado por rol + fila; ya no se pregunta zona origen
   ↓
Resultado: Punto · Continúa · Error
   ↓  (si Punto o Continúa)
Zona destino (grilla 3×3, con botón "Sin zona / saltar")
   ↓
Guardar y volver
```

Si el resultado es Error → se guarda como `attack_error` y no se pide zona destino.
"Continúa" se guarda como `attack_neutral` / `counter_neutral` (ya existen esos PointType).

## Catálogo nuevo de tipos de ataque

Reemplazar `src/lib/formations/attack-types.ts` (mantengo el nombre `AttackType` para no romper el store; los ids viejos dejan de emitirse hacia adelante).

| Rol + fila | Opciones (id → label corto) |
|---|---|
| Punta delantero (Z4) | `jatu` JATU · `alta_z4` Alta · `media_z4` Media · `emergencia` Emergencia |
| Punta zaguero (Z6) | `pipe` Pipe · `emergencia` Emergencia |
| Central delantero (Z3) | `primer_tiempo` 1er tiempo · `corta_atras` Corta atrás · `v` V · `emergencia` Emergencia |
| Opuesto delantero (Z2) | `alta_z2` Alta · `media_z2` Media · `emergencia` Emergencia |
| Opuesto zaguero (Z1) | `zaguero_z1` Zaguero · `emergencia` Emergencia |
| Armador / Líbero / Central zaguero / fallback | `emergencia` Emergencia |

`getAttackTypeOptions({ position, isBackRow })` se reescribe para devolver estas listas. `ATTACK_TYPE_LABEL` / `ATTACK_TYPE_SHORT` se regeneran; ids viejos se dejan en un mapa de "legacy → label" solo para render de eventos históricos en stats (no aparecen en pickers).

## Cambios de código

- **`src/lib/formations/attack-types.ts`** — nuevo union type con los ids de arriba; mapa `LEGACY_ATTACK_TYPE_LABEL` para eventos guardados con ids viejos; `getAttackTypeOptions` filtra por rol/fila. `ALL_ATTACK_TYPES` = union nuevo.
- **`src/components/AttackTypesPanel.tsx`** y **`src/lib/attack-type-stats.ts`** — usar el nuevo catálogo; fallback al label legacy si el id no está en el catálogo nuevo (para partidos ya jugados).
- **`src/components/scorer/AttackTypeDialog.tsx`** — sin cambios estructurales; ya usa `getAttackTypeOptions`. Ajustar copy del subtítulo a "Tipo de ataque · Z4 Punta", etc., derivando la zona/rol desde el jugador y la fila.
- **`src/routes/_authenticated/matches.$id.index.tsx`**
  - `submitAction`: para `rotation_attack` / `counter_attack` en modo entrenador, saltar `pendingZone` y pasar directo a `pendingAttackType` (con `zone` = zona real de la posición del jugador, calculada desde `onCourt.indexOf(playerId)` → 0=Z1, 1=Z2, 2=Z3, 3=Z4, 4=Z5, 5=Z6).
  - Después de `AttackTypeDialog`, abrir un nuevo **`AttackResultDialog`** (Punto / Continúa / Error). Punto → mantiene el `PointType` original (`rotation_attack`/`counter_attack`). Continúa → convierte a `attack_neutral`/`counter_neutral`. Error → `attack_error`.
  - Después del resultado (si no fue Error), abrir **`AttackDirectionDialog`** con la grilla 3×3 existente (`AttackDirectionGrid`) + botón "Sin zona / saltar". Al elegir/saltar, `recordPoint(match.id, side, finalType, playerId, originZone, attackType, direction)`.
  - Eliminar el bloque `pendingZone` (líneas ~600-704) para taps de jugador; el diálogo "¿DESDE QUÉ ZONA?" desaparece. La lógica `pendingZone` puede quedar sin usar; se retira su render y setter.
- **`src/lib/volley-store.ts`** — verificar que `recordPoint` acepte `attackDirection` como parámetro opcional junto con `attackZone` y `attackType`; si no, agregarlo y persistirlo en el evento (mismo campo que ya usa el flujo integrado).

## Componentes nuevos

- `src/components/scorer/AttackResultDialog.tsx` — 3 botones grandes (Punto verde · Continúa gris · Error rojo).
- `src/components/scorer/AttackDirectionDialog.tsx` — envuelve `AttackDirectionGrid` en un `Dialog` con header del jugador y botón "Sin zona / saltar".

## Notas

- La zona de origen ya no se pregunta, se deduce del pin tocado. Se sigue guardando en el evento (`attackZone`) para no romper stats existentes.
- Datos históricos con tipos viejos (`first_tempo`, `slide`, `tense_middle`, `high_outside`…) se siguen mostrando en paneles vía `LEGACY_ATTACK_TYPE_LABEL`; no se re-clasifican.
- El flujo del diálogo integrado post-recepción y los botones de bloqueo / error no forzado / saque no cambian.
