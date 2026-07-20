# Interfaz móvil dedicada para toma de estadísticas

Voy a construir una **experiencia móvil separada** para `/matches/$id`, dejando intacto el layout desktop/tablet actual. Se activa cuando `device-mobile` está resuelto (o `innerWidth < 768`).

## Alcance

Solo cambia la UX de la pantalla de toma de estadísticas en móvil. La lógica del store, el motor de rally, las acciones, los diálogos (Integrated Rally, Attack, Setting, etc.) y el flujo se reutilizan **sin cambios**.

## Arquitectura

Nuevo componente contenedor `MobileMatchLayout` en `src/components/scorer/mobile/`:

```text
src/components/scorer/mobile/
  MobileMatchLayout.tsx    ← orquesta todo
  MobileTopBar.tsx         ← marcador + set + reloj + saque
  MobilePhaseCapsule.tsx   ← cápsula "Esperando recepción…" etc.
  MobileLastActionChip.tsx ← tarjeta flotante última acción
  MobileBottomNav.tsx      ← Deshacer / Armado / Cancha / Stats / Menú
  MobileMoreMenu.tsx       ← Sheet inferior con Cambio, Líbero, Tiempo, Sanción, Formato, Config
  MobileStatsSheet.tsx     ← Sheet con LiveStatsTable
```

En `matches.$id.index.tsx`, en el render principal:

```tsx
const isMobile = useIsMobileMatchLayout(); // device-mobile o <768
if (isMobile) return <MobileMatchLayout {...sharedProps} />;
// … layout desktop/tablet existente sin cambios
```

`sharedProps` expone las mismas funciones ya definidas (`onCambio`, `onLibero`, `onTiempo`, `onSancion`, `undo`, handlers de jugadores, diálogos, etc.) para no duplicar lógica.

## Estructura de pantalla (mobile)

```text
┌────────────────────────────────┐
│ TopBar  A 15 · 12 B   S2 21:04 │  ← 40-44px
│              ● Saque A          │
├────────────────────────────────┤
│  ┌──────────────────────┐       │
│  │ Esperando recepción  │  ←cápsula 24px
│  └──────────────────────┘       │
│                                 │
│         🏐 CANCHA               │
│      (80–90% alto útil)         │
│   jugadores grandes tap-first   │
│                                 │
│         [Última: #7 ATK+]  ←chip flotante bottom-left
│                                 │
├────────────────────────────────┤
│ ↶  Armado  Cancha  Stats  ⋮   │  ← BottomNav fija 56px + safe-area
└────────────────────────────────┘
```

### Detalles

- **Cancha**: `flex-1` dentro de un `flex-col h-[100dvh]`, wrapper con `aspect-ratio` desactivado en móvil, escala para llenar. Jugadores `CourtPlayerBadge` en tamaño `size-14` (~56px) para tap cómodo.
- **Long-press** (500ms) sobre jugador abre `PlayerHistoryDialog`. Tap corto conserva su comportamiento actual (registrar acción / abrir picker).
- **Swipe-left** global sobre la cancha ejecuta `undo()` (umbral 80px). Feedback háptico si está disponible.
- **Cápsula de fase** usa `currentActionText` del rally-phase existente y colorea según posesión.
- **Chip última acción**: absolute bottom-24 left-3, tap abre PlayerHistoryDialog del jugador.
- **BottomNav**:
  - Deshacer → `undo()`
  - Armado → abre selector de zona (mismo del actual)
  - Cancha → cierra sheets
  - Stats → abre `MobileStatsSheet` (LiveStatsTable en Sheet fullscreen)
  - Menú (⋮) → abre `MobileMoreMenu` con Cambio, Líbero, Tiempo, Sanción, Formato, Configuración
- Todos los botones ≥ `min-w-11 min-h-11` (44px).
- Animaciones Punto/Ace/Error: reducir a `duration-200` y escala `0.9→1`.

## Cambios puntuales

1. **Nuevo**: los 6 archivos en `src/components/scorer/mobile/`.
2. **`src/hooks/use-is-mobile-layout.ts`** — combina `device-mobile` class con media query, SSR-safe.
3. **`src/routes/_authenticated/matches.$id.index.tsx`** — extrae `sharedProps` y hace `if (isMobile) return <MobileMatchLayout …/>`. Cero cambios en la rama desktop.
4. **`src/styles.css`** — utilidades `.mobile-only`, `.safe-bottom` (padding con `env(safe-area-inset-bottom)`), animaciones reducidas para `.device-mobile`.

## Detalles técnicos

- **Long-press + swipe** con `pointerdown/move/up` nativos (sin dependencias nuevas). Evita conflicto con clic tocando `preventDefault` sólo tras superar umbral.
- **BottomNav** en `position: fixed; bottom: 0; z-index: 40; padding-bottom: env(safe-area-inset-bottom)`.
- **Sheets** con `@/components/ui/sheet` (Radix) posición `bottom`, `snap` altura 90%.
- Reutilizo `IntegratedRallyDialog` tal cual (ya funciona en móvil como diálogo). No se toca su lógica.
- La orientación no se fuerza (a diferencia de tablet); móvil funciona en portrait.

## Fuera de alcance

- No cambia el layout desktop/tablet actual.
- No cambia la lógica de estadísticas, reglas de rally, formaciones ni sincronización.
- No cambia rutas ni URLs.
