# Modo Scouting en Vivo — Plan de construcción

Es un módulo grande. Lo construyo sobre lo ya hecho en Tanda 1 (`/video/$matchId`, `VideoPlayer`, `use-match-video`, `video-marks`) y lo divido en 3 tandas para poder validar rápido cada bloque.

## Alcance y decisiones clave

- **Fuente de verdad**: cada acción de scouting es un `MatchEvent` del `volley-store` existente, con un campo nuevo `videoTMs` (ms desde el inicio del video). Esto reutiliza todas las estadísticas, heatmaps, rotaciones y Rally Intelligence sin duplicar lógica.
- **Autoguardado**: se guarda en `zustand` + `cloud-sync` (ya operativo). Nada de diálogos de confirmación.
- **Modo Rápido vs Completo**: un toggle global. En Rápido el video nunca se pausa; en Completo se pausa 1.5 s tras cada registro.
- **Atajos**: se reutiliza la infraestructura de Coach Mode (`coach-mode-store` + `bindingMatches`) para que sean configurables desde Ajustes.

## Tanda 1 — Layout de 5 paneles + registro rápido (esta iteración)

Objetivo: entrenador puede mirar el video y registrar acciones en ≤ 2 s por acción, con timestamp automático y timeline clickeable.

1. **Nueva ruta** `/video/$matchId/scout` (deja intacta la actual `video.$matchId` como "análisis"). Layout de 5 zonas con CSS grid:
   ```text
   ┌──────────┬─────────────────────────┬──────────┐
   │ Info     │ Video (60%)             │ Registro │
   │ (equipo, │ Play / velocidad / FPS  │ Rápido   │
   │ titular, │ Tiempo / set / score    │ (equipo→ │
   │ líbero,  │                         │ jugador→ │
   │ rotación)│                         │ fund→res)│
   │          ├─────────────────────────┤          │
   │          │ Timeline con marcas     │          │
   │          ├─────────────────────────┤          │
   │          │ Tabla acciones tiempo real         │
   └──────────┴────────────────────────────────────┘
   ```
2. **`ScoutPanel`** (derecha): flujo Equipo → Jugador → Fundamento → Resultado con botones grandes tocables y atajos (S/R/A/F/B/D + 1..6 jugadora + !/+/0/-/=/≠). Cada confirmación:
   - Toma `player.currentTime * 1000 - syncOffsetMs` como `videoTMs`.
   - Emite el evento correcto en el `volley-store` (recepción/ataque/bloqueo/defensa/punto).
   - Muestra un toast fantasma en la esquina (200 ms) — sin modales.
3. **`ScoutInfoPanel`** (izquierda): titulares, líbero, rotación actual, marcador, set, tiempo del partido, botón "rotar" rápido.
4. **`VideoPlayer` mejorado**: velocidad 0.25×–2×, frame-step con `Ctrl+←/→` (a 30 fps), toggle pantalla completa, atajos J/K/L. Ya existe la base.
5. **`ScoutTimeline`**: marcas por evento, color por fundamento (saque naranja, recepción azul, ataque rojo, bloqueo violeta, defensa verde, error gris), tooltip con jugador/acción/resultado/tiempo, click salta al video.
6. **`ScoutActionsTable`**: virtualizada, columnas Tiempo / Jugador / Fund / Resultado / Zona / Set / Score / Rot / Equipo. Doble click abre popover inline para editar jugador/resultado/zona/observaciones (no el timestamp). Ordenable y filtrable.
7. **Modos Rápido/Completo**: toggle en la topbar. Rápido = nunca pausa. Completo = pausa 1.5 s y reanuda al confirmar.
8. **Persistencia**: reutilizo `startCloudSync` (ya persiste eventos). Al recargar, el usuario continúa exactamente donde estaba: `video.currentTime` se guarda en `match_videos.last_position_sec`.

## Tanda 2 — Detalles finos y edición (siguiente iteración)

- Zona origen/destino con mini-cancha 6 zonas en el `ScoutPanel`.
- Tipos de golpe/saque/ataque, altura del armado, observaciones (todos opcionales).
- Doble click en la tabla → edición inline con undo/redo global (`Ctrl+Z / Ctrl+Y`).
- Configurador visual de atajos en Ajustes (reutiliza UI de Coach Mode).
- Cursor teclado-first: `Tab`/`Shift+Tab` mueve foco entre paneles.

## Tanda 3 — Analítica ligada al video y export

- Cada barra/celda de las stats existentes (`LiveStatsTable`, heatmaps, Rally Intelligence) se vuelve clickeable → salta al video en ese evento.
- Vista "Rallies" filtrable (side-out, break, ganados por rot).
- Export de clips por selección (usa ffmpeg.wasm ya planificado en Tanda 2 del módulo video).

## Detalles técnicos (referencia)

- **Nuevos archivos**
  - `src/routes/_authenticated/video.$matchId.scout.tsx` — ruta principal del modo scouting.
  - `src/components/video/scout/ScoutPanel.tsx` — flujo 4-pasos + atajos.
  - `src/components/video/scout/ScoutInfoPanel.tsx` — sidebar izquierdo.
  - `src/components/video/scout/ScoutTimeline.tsx` — marcas + tooltip + seek.
  - `src/components/video/scout/ScoutActionsTable.tsx` — tabla en vivo + edición inline.
  - `src/lib/video-scout-store.ts` — modo Rápido/Completo, atajos, foco de fundamento.
  - `src/lib/video-scout-events.ts` — helpers que traducen selecciones a `addEvent` del `volley-store` inyectando `videoTMs`.
- **Cambios de tipos** — extender `MatchEvent` con `videoTMs?: number` (opcional, no rompe eventos previos). Persiste automáticamente por `cloud-sync`.
- **Cambios de DB** — añadir columna `last_position_sec numeric` a `match_videos` para reanudar sesión.
- **Video sync** — `t = videoTMs / 1000 + offset` para saltar; el offset ya vive en `match_videos.sync_offset_ms`.
- **Atajos** — nuevo namespace en `coach-mode-store` `bindings.scout.{saque,recepcion,armado,ataque,bloqueo,defensa,confirmar,cancelar,undo,redo,frameNext,framePrev}`.

## Rendimiento y UX

- Animaciones ≤ 200 ms (`transition-all duration-150`).
- Tabla virtualizada con `@tanstack/react-virtual`.
- Marcas del timeline memoizadas por rango visible.
- Toasts fantasma no bloqueantes.
- Modo oscuro heredado del theme actual, sin regresiones.

## Fuera de alcance en Tanda 1 (para no bloquear)

- Editor de clips con ffmpeg.
- Reconocimiento de acciones por IA.
- Multi-usuario en tiempo real (mismo partido, dos scouters).

¿Arranco directo con la Tanda 1 tal cual está o querés priorizar algo puntual (por ejemplo, empezar por atajos y tabla en la ruta actual sin crear `.scout`)?