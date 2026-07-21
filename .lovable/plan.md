# Coach Mode — Atajos de teclado para entrenadores

Modo opcional para escritorio (desactivado por default) que permite registrar acciones del rally por teclado sin quitar la interfaz gráfica. Convive con mouse; nunca es obligatorio.

## 1. Store de configuración (nuevo)

Archivo: `src/lib/coach-mode-store.ts` (zustand + persist en `localStorage`, key `rally.coachMode.v1`).

```ts
type ActionKey =
  | 'saque' | 'recepcion' | 'armado' | 'ataque'
  | 'bloqueo' | 'defensa' | 'contraataque'
  | 'timeout' | 'cambio' | 'libero' | 'sancion'
  | 'undo' | 'redo' | 'confirm' | 'cancel' | 'back' | 'help';

type Binding = { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean };
type Macro = { id: string; label: string; binding: Binding; steps: MacroStep[] };
// MacroStep: { kind:'action', action:'saque' } | { kind:'player', number:number }
//          | { kind:'zone', zone:1..6 } | { kind:'rating', code:'#|+|0|-|=|≠' }
//          | { kind:'confirm' }

interface CoachModeState {
  enabled: boolean;
  bindings: Record<ActionKey, Binding>;
  macros: Macro[];
  setEnabled(v: boolean): void;
  setBinding(a: ActionKey, b: Binding): void;
  resetDefaults(): void;
  addMacro(m: Macro): void; updateMacro(id, patch): void; removeMacro(id): void;
}
```

Defaults según especificación (A ataque, R recepción, S saque, B bloqueo, D defensa, L armado, C contraataque, T timeout, M cambio, F1 ayuda, Enter confirmar, Esc cancelar, Backspace atrás, Ctrl+Z/Y deshacer/rehacer).

## 2. Hook global de teclado

Archivo: `src/hooks/use-coach-shortcuts.ts`.

- Se registra en `matches.$id.index.tsx` (sólo dentro del partido en vivo).
- `useEffect` con `window.addEventListener('keydown', ...)`.
- Guardas: si `document.activeElement` es `INPUT|TEXTAREA|SELECT` o `[contenteditable]`, o si `document.body.dataset.coachInput === 'lock'`, ignorar.
- Estado interno `sequence: { action?, playerNumber?, zone?, rating? }` con timeout 3s.
- Al matchear una tecla:
  - Si es un binding de acción → abre `IntegratedRallyDialog` con `initialAction` y setea el paso inicial.
  - Si es dígito y hay acción activa y jugador no elegido → asigna `playerNumber` (permite 2 dígitos: buffer + timer 400ms).
  - Si es Q/W/E/A/S/D o dígito zona configurada → asigna `zone`.
  - `+ - 0 = # ≠` → valoración.
  - `Enter` → confirma (llama a la acción `commit` del diálogo).
- Macros (`Ctrl+1..9`) ejecutan `steps` secuencialmente vía la misma máquina.
- Emite eventos vía un pequeño bus (`window.dispatchEvent(new CustomEvent('coach:seq', {detail}))`) para el HUD.

## 3. Puente con `IntegratedRallyDialog`

- Añadir prop opcional `controller?: RallyController` que expone `openWith({action, playerId?, zone?, rating?})`, `confirm()`, `cancel()`, `back()`.
- El controller se construye con `useImperativeHandle` y se registra en el store del coach mode. El hook de teclado dispara métodos del controller cuando existe.
- El diálogo sigue funcionando idéntico con mouse; sólo agrega un input path.
- Además, si Coach Mode está OFF, no se instala el listener global.

## 4. HUD flotante (asistente visual)

Componente: `src/components/coach/CoachHUD.tsx`.

- Fixed bottom-right, oculto por default. Se muestra 3s tras cada tecla y persiste mientras hay `sequence` activa.
- Muestra los pasos con el mismo formato del ejemplo:
  ```
  S  →  Selecciona jugador
  5  →  Selecciona zona
  Q  →  Resultado
  +  →  Enter para confirmar
  ```
- Al confirmar, toast pequeño + reset.

## 5. Indicador y panel de ayuda

- Chip fijo `⌨ Coach Mode` en el `TopBar` del partido cuando está activo.
- `F1` abre `CoachHelpDialog.tsx` con tabla de todos los atajos y macros actuales.

## 6. Configuración en Ajustes

En `src/routes/_authenticated/settings.tsx` añadir sección **Coach Mode** (visible sólo si `useCoachAccess().hasAccess`):

- Switch ON/OFF.
- Grilla de bindings: cada fila tiene label + botón "Cambiar" que captura la próxima combinación (excluyendo modificadores solos).
- Detección de conflicto (misma combinación asignada a dos acciones).
- Botón "Restaurar valores por defecto".
- Sub-sección **Macros**: lista con crear/editar/eliminar; editor simple (label + binding + secuencia de pasos elegidos por dropdown).
- Todo persistido automáticamente por el store (sin botón guardar).

## 7. Restricciones y compatibilidad

- Sólo se activa en layout de escritorio (`useIsMobileLayout() === false` y no tablet forzado). En mobile/tablet, la sección de Ajustes muestra "Disponible sólo en escritorio".
- No modifica lógica del rally: sólo dispara los mismos handlers que los botones existentes.
- Nunca captura teclas cuando hay un input activo, un `<Dialog>` de nombre/búsqueda abierto (`[data-coach-input=lock]`) o el usuario está tipeando.
- Ctrl+Z/Ctrl+Y llaman a `undo()`/`redo()` del `volley-store` que ya existen.

## 8. Archivos

**Nuevos**
- `src/lib/coach-mode-store.ts`
- `src/hooks/use-coach-shortcuts.ts`
- `src/components/coach/CoachHUD.tsx`
- `src/components/coach/CoachHelpDialog.tsx`
- `src/components/coach/CoachModeSettings.tsx`
- `src/components/coach/CoachModeBadge.tsx`

**Modificados**
- `src/routes/_authenticated/settings.tsx` — añade sección Coach Mode.
- `src/routes/_authenticated/matches.$id.index.tsx` — monta hook, HUD, badge y controller del rally dialog.
- `src/components/scorer/IntegratedRallyDialog.tsx` — expone `RallyController` vía `ref` para pasos remotos y confirmación.

## 9. Nota técnica

No requiere cambios en Supabase ni en el backend. Todo vive en el cliente (localStorage por usuario). El hook usa `KeyboardEvent.code` para las letras (evita problemas con layouts non-QWERTY cuando el usuario elige "KeyA") y `event.key` para dígitos/símbolos.
