
# Video Analysis — plan de construcción

Este es un módulo enorme (16 secciones). Lo entrego en **3 tandas** dentro del mismo proyecto para que veas cada capa funcionando antes de que crezca la deuda técnica. Todo va bajo `/_authenticated/video`, reutilizando el scout, jugadoras, rotaciones y eventos que Rally ya tiene.

## Tanda 1 — Núcleo interactivo (esta iteración)

Lo diferencial del pedido: **una estadística → un click → el video se reproduce en el instante exacto**.

1. **Backend (Cloud)**
   - Tabla `match_videos` (uno-a-uno con `matches`): `source` (`upload` | `url`), `url`, `duration_sec`, `sync_offset_ms`, `fps`, `status` (`unsynced` | `synced`), `favorite`, `tags[]`, `created_at`, `updated_at`, RLS por owner del partido.
   - Tabla `event_video_marks` (opcional por evento): `event_id`, `match_id`, `t_ms` (timestamp calculado o manual override), `kind` (saque/ataque/bloqueo/recepción/error/punto), `color`. Se puede derivar en vivo desde `match_events.timestamp + sync_offset`, pero la tabla permite override manual.
   - Bucket privado `match-videos` (Cloud Storage) con política de lectura por owner + signed URLs. Para URLs externas solo guardamos el link.
   - Server fns: `upsertMatchVideo`, `setSyncOffset`, `setEventMark`, `listMatchVideos`, `getSignedVideoUrl`.

2. **Ruta `/_authenticated/video`** — Biblioteca
   - Grid de tarjetas por partido con: competencia, fecha, equipo, rival, resultado, duración, estado (Sin sync / Sincronizado), estrella favorito, chips de etiquetas.
   - Buscador + filtros (liga, estado, favoritos, etiquetas, fecha) y orden.

3. **Ruta `/_authenticated/video/$matchId`** — Workspace
   - Layout 3 zonas (responsive):
     - **Player** (React Player, HTML5 video, keyboard shortcuts, frame-step con `requestVideoFrameCallback`).
     - **Timeline de rallies** debajo del player: cada rally = un bloque proporcional a su duración, click salta.
     - **Panel de acciones** lateral (tabla virtualizada con `@tanstack/react-virtual`): Tiempo · Jugadora · Fundamento · Zona · Resultado · Rotación · Set · Marcador · Equipo. Click en fila → salta al t_ms.
   - Barra de marcadores encima del timeline nativo con puntos coloreados por tipo (saque/ataque/etc.) y tooltip con jugadora/acción/resultado/tiempo.
   - **Sincronización**: botón "Marcar primer saque" (captura `currentTime` y lo iguala al timestamp del primer evento) + slider de ajuste fino ±5s en pasos de 10ms. Todos los marks se recalculan en vivo.

4. **Filtros inteligentes** (compuestos)
   - Set, rotación, jugadora, fundamento, zona, resultado, calidad de recepción previa. Se aplican al panel de acciones, a los marcadores del timeline y a los "clips virtuales" (Tanda 2 los exporta).

5. **Estadística clickeable**
   - Los paneles existentes de stats en `/matches/$id/stats` reciben un botón "Ver en video" por celda/fila que abre `/video/$matchId?filter=...&autoplay=1`. Esto ya cumple el punto 14 (función diferencial) sin reescribir stats.

6. **UX**
   - Atajos: Space (play/pause), ← → (±5s), , . (frame-step), J/L (velocidad), F (fullscreen), 1..6 (velocidades), C (clip), M (marcador).
   - Estado del workspace (layout, filtros activos, panel abierto) se guarda en `localStorage` por usuario.

## Tanda 2 — Clips, dashboard interactivo, editor básico

7. **Clips automáticos**: crear listas guardadas ("Todos los aces", "Errores de #12") desde los filtros. Reproducción en secuencia dentro del player (playlist virtual sin cortar el archivo).
8. **Exportar MP4** con `ffmpeg.wasm` en el browser cuando el video vive en Storage/URL directa (no funciona con YouTube). Cola visible, progreso, descarga.
9. **Dashboard interactivo**: Recharts + heatmap (reusamos `AttackHeatmap`). Cada barra/celda → aplica filtro al workspace, no abre otra pantalla.
10. **Editor overlay** (canvas encima del video, no re-encode): flechas, texto, freeze, zoom, líneas, resaltar jugadora, logo, marcador. Se guarda como "anotaciones" por t_ms. Exportar con overlay = ffmpeg.wasm (Tanda 3 si es muy costoso).

## Tanda 3 — Rendimiento, IA-ready, pulido

11. Streaming HLS opcional (transcoding fuera de Lovable — solo dejamos hooks).
12. Virtualización de listas grandes, precarga del siguiente clip, cache de URLs firmadas.
13. Arquitectura IA-ready: interfaz `VideoAIDetector` con métodos `detectRallyBoundaries`, `detectAction`, `detectPlayers`; provider stub local + slot para llamar a un endpoint externo (OpenCV/YOLO/MediaPipe cuando lo integres). Nada de IA real en esta fase, solo los contratos y el UI para revisar/aceptar detecciones.
14. Editor avanzado, plantillas de reportes en video, comparativa de dos rallies lado a lado.

## Detalles técnicos

- **Storage**: bucket privado `match-videos` en Cloud. Uploads con `supabase.storage.upload` desde el browser (chunked, hasta 5 GB por el límite práctico de Cloud). Para archivos más grandes, el entrenador pega una URL (HTTPS directa, Bunny, Cloudflare Stream, YouTube — YouTube reproduce vía iframe embed y pierde frame-step preciso; lo marcamos en el UI).
- **Sincronización**: `t_ms(event) = event.timestamp - match.startTs + sync_offset_ms`. El offset vive en `match_videos`; cualquier cambio invalida el memo de marcadores (React Query key incluye el offset).
- **Marcadores de timeline**: canvas sobre el `<video>` para pintar hasta ~5000 puntos sin costo de DOM.
- **RLS**: `match_videos` y `event_video_marks` heredan permisos del partido (owner, admin, planillero según `match-permissions.functions.ts` existente).
- **Rutas nuevas**: `src/routes/_authenticated/video.index.tsx`, `src/routes/_authenticated/video.$matchId.tsx`.
- **Nada de edge functions nuevas**: todo va con `createServerFn` y consultas cliente (Storage signed URLs).

## Fuera de alcance explícito de la Tanda 1

Editor de video, exportación MP4, clips en cola, dashboard clickeable global, IA. Todo eso viene en Tanda 2/3 con la base ya funcionando.

## Confirmación

¿Arranco con la Tanda 1 tal cual está descrita? Si querés priorizar algo distinto dentro de las 16 secciones (por ejemplo, saltar editor y empezar por clips automáticos), decime antes de que abra la migración.
