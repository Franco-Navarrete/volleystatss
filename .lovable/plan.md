## Objetivo
Unificar la carga en un flujo secuencial de un solo diálogo:
**Recepción → Zona de armado → (atacante auto) → Calidad armado → Acción → Dirección (3×3)** con un evento único que guarde todo.

Ya existen las piezas base (`ReceptionEvent`, `SettingEvent`, `PointEvent`, `useFormation`, `SettingDialog`, `AttackTypeDialog`). Faltan: el enganche desde recepción, la auto-selección del atacante por rotación, la grilla 3×3 de dirección y el almacenamiento de la dirección.

## 1. Modelo de datos (mínimo)

En `src/lib/volley-store.ts`:
- Nuevo tipo `AttackDirection = 1..9` (index del sector 3×3 en cancha rival, izq→der / fondo→red visto desde el atacante).
- Extender `PointEvent` con `attackDirection?: AttackDirection` (sólo para `attack | rotation_attack | counter_attack | attack_error | unforced_error` cuando aplique).
- Extender `SettingEvent` con `attackDirection?: AttackDirection`.
- Extender `recordPoint(..., opts?)` con `{ attackDirection? }` (además de los ya existentes `attackZone`, `attackType`).

Cambios retrocompatibles: los eventos viejos siguen sin dirección.

## 2. Componente nuevo: `IntegratedRallyDialog`

`src/components/scorer/IntegratedRallyDialog.tsx` — un único diálogo con pasos, botón "Atrás" y "Sin dato" para poder saltar.

Pasos:

```text
1. Recepción      → 3 botones: + / neutro / -   (o "Saltar")
2. Zona armado    → cancha con Z4 / Z3 / Z2 / Pipe / Z1 / Z5
3. Atacante       → auto-preselección por rotación, editable (grilla de cancha)
4. Calidad armado → + / / / -
5. Acción         → Ataque rot · Contra · Bloqueo · Err. ataque · Err. no forzado
6. Dirección      → grilla 3×3 sobre cancha rival (sólo si acción = ataque/contra)
```

Todo con targets grandes (≥64px) y auto-avance al tocar.

### Auto-selección del atacante (paso 3)
Usa `useFormation(match, team, side, "5-1", "attack")` para obtener `ResolvedFormation.slots`. Cada slot tiene rol + coordenada. Al elegir zona:
- `z4` → slot con rol `outside_front`
- `z3` → `middle_front`
- `z2` → `opposite`
- `pipe` → `outside_back`
- `back1` → slot delantero-derecho zaguero / opposite_back si existe
- `back5` → outside_back opuesto lateral

Se resuelve con un helper `pickAttackerByZone(formation, zone)` en `src/lib/formations/pick-attacker.ts`. Fallback: primer jugador delantero/zaguero on-court.

El paso 3 muestra la cancha del propio equipo con el atacante sugerido resaltado y permite tocar otro para override.

### Grilla 3×3 (paso 6)
`src/components/court/AttackDirectionGrid.tsx`: SVG/CSS grid 3×3 sobre la cancha rival. Numeración estable:
```text
7 8 9   (fondo rival)
4 5 6   (centro)
1 2 3   (cerca de la red)
```
Persistimos `1..9`. Etiquetas visibles opcionales.

## 3. Persistencia

Al confirmar (submit):
1. `recordReception(matchId, side, receptorId?, rating)` — si se cargó (opcional; hoy `recordReception` exige `playerId`, ajustar a opcional o saltar el paso completo).
2. `recordSetting(matchId, side, { setterId (auto = armador on court), quality, attackZone, attackerId, attackResult, receptionQuality })` con `attackDirection` añadido.
3. `recordPoint(matchId, playerSide, mappedType, attackerId, { attackZone: zonaMapeada, attackType?, attackDirection })` — sólo si la acción produce punto/error real que afecta marcador.

Mapeo acción → `PointType`:
- Ataque rotación → `rotation_attack`
- Contraataque → `counter_attack`
- Bloqueo (rival tapó) → `attack_error` a favor del rival (armador del rival no aplica; usamos `attack_error` del atacante propio)
- Error ataque → `attack_error`
- Error no forzado → `unforced_error`

## 4. Enganche desde el marcador

En `src/routes/_authenticated/matches.$id.index.tsx` (modo Entrenador):
- Reemplazar el disparador actual del `SettingDialog` por `IntegratedRallyDialog`.
- Mantener `SettingDialog` viejo detrás de una prop `legacy` por si se quiere revertir.
- El botón "Rally" ya existente pasa a abrir el nuevo diálogo.

## 5. Estadísticas (siguiente iteración — no en este PR)

Añadir sólo la persistencia y visualización básica ("Dir X" en la fila de eventos). El heatmap 3×3 por jugadora / equipo queda como paso 2 y se agrega en `matches.$id.stats.tsx` en una tanda posterior.

## 6. Archivos

Nuevos:
- `src/components/scorer/IntegratedRallyDialog.tsx`
- `src/components/court/AttackDirectionGrid.tsx`
- `src/lib/formations/pick-attacker.ts`

Editados:
- `src/lib/volley-store.ts` — `AttackDirection`, extender `PointEvent`/`SettingEvent`, `recordPoint` opts, `recordReception` con `playerId` opcional.
- `src/routes/_authenticated/matches.$id.index.tsx` — abrir el nuevo diálogo.

## 7. Fuera de alcance

- Cambios de esquema en DB (todo viaja en `events[]` jsonb).
- Nuevas pestañas de stats (se hará después).
- Cambio del flujo del modo Liga (sigue tal cual).

¿Avanzo con esta implementación tal cual, o querés ajustar el mapeo de zonas → atacante o la numeración de los 9 sectores antes de codear?
