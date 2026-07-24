# Modo Scouting en Vivo (cámara en tiempo real)

Extiende el Modo Scouting actual (`/video/$matchId/scout`) para trabajar sin video pregrabado: el entrenador conecta una cámara (webcam, IP o capturadora HDMI vía WebRTC/`getUserMedia`), registra acciones mientras se juega y al terminar queda un video sincronizado con todos los eventos, listo para reproducir jugada por jugada y generar clips.

Divido en **3 tandas** para poder validar cada bloque.

## Tanda 1 — Captura en vivo + registro sincronizado (esta iteración)

Objetivo: abrir cámara, ver la transmisión, registrar acciones con timestamp real, y al finalizar quedarse con un `.webm` subido a `match-videos` con todos los eventos anclados.

1. **Nueva ruta** `/video/$matchId/live` (paralela a `.scout`). Layout de 3 columnas idéntico al scouting actual, pero el panel central es la cámara en vivo en lugar del `<video>` pregrabado.
2. **`LiveCameraPanel`**:
   - Selector de fuente: webcam integrada, cámara USB, cámara IP (URL RTSP/HLS via `<video src>` cuando el navegador lo soporte) o capturadora HDMI (aparecen como `videoinput` en `enumerateDevices`).
   - `navigator.mediaDevices.getUserMedia({ video: { deviceId }, audio: true })` y `MediaRecorder` a `video/webm;codecs=vp9,opus` en chunks de 5 s.
   - Botones **REC / Pausa / Stop**. Indicador rojo + cronómetro.
   - Al pulsar REC guardo `recordingStartedAt = performance.now()` y `wallClockStart = Date.now()` — es el origen de tiempo del video.
3. **Registro sincronizado**: cada acción del `ScoutPanel` calcula `videoTMs = performance.now() - recordingStartedAt` y se guarda en el evento (`MatchEvent.videoTMs`, ya soportado). Modo Rápido nunca pausa; modo Completo hace un `overlay` de 1.5 s (no se puede pausar la cámara real).
4. **Autoguardado del video** (baja latencia, sin perder nada si se cae el navegador):
   - Cada chunk del `MediaRecorder` se sube en paralelo a `match-videos/live/{matchId}/{index}.webm` usando uploads independientes.
   - Metadata en tabla nueva `live_recordings` con `match_id`, `session_id`, `chunk_count`, `started_at`, `ended_at`, `status`.
   - Al pulsar Stop: server function `finalizeLiveRecording` concatena refs (guarda un manifiesto JSON `chunks[]`) y hace `upsertMatchVideoUpload` apuntando al primer chunk como fuente principal; el `VideoPlayer` reproduce la lista secuencialmente.
5. **Timeline y tabla en vivo**: reutilizo `ScoutTimeline` y `ScoutActionsTable` que ya leen `videoTMs`. Aparecen marcas mientras se registra.
6. **Reanudación**: si el usuario recarga con una grabación activa, el manifiesto en `live_recordings` permite continuar (nuevo `session_id` si prefiere, o append al actual).
7. **UX detalles**:
   - Aviso permisos de cámara/micrófono con fallback claro.
   - Detección de desconexión de dispositivo → toast + pausa automática.
   - Warning si batería < 20% o almacenamiento < 500 MB (via `navigator.storage.estimate`).

## Tanda 2 — Post-partido: clips + reproducción unificada

- `VideoPlayer` acepta lista de chunks y los reproduce como uno solo (Media Source Extensions o `<video>` con `src` rotativo).
- Botón "generar clips" por acción/rally usando `ffmpeg.wasm` (ya planificado) sobre los chunks concatenados.
- Descarga del video completo concatenado en un solo `.mp4` (server function con ffmpeg vía worker externo si excede el runtime de Cloudflare).
- Vista "highlights" filtrable por resultado (puntos, errores, aces, bloqueos).

## Tanda 3 — IA (detección automática)

- Arquitectura preparada: los chunks quedan en storage con timestamps precisos y un manifiesto que un job externo puede consumir.
- Pipeline propuesto: worker externo (Cloud Run / Modal) que corra YOLOv8 para detectar jugadoras/balón y un clasificador (MMAction2 o similar) para acciones. Escribe a `ai_detections(match_id, video_time_ms, kind, payload jsonb)`.
- UI: overlay opcional sobre el reproductor mostrando bounding boxes, y sugerencias de eventos ("¿Registrar ataque de #7?") que el entrenador confirma con un clic.
- Este plan **no ejecuta** la IA todavía; sólo dejamos los ganchos: tabla `ai_detections`, botón "Analizar con IA" deshabilitado y documentación del contrato.

## Detalles técnicos (referencia)

**Nuevos archivos**
- `src/routes/_authenticated/video.$matchId.live.tsx` — ruta principal del modo en vivo.
- `src/components/video/live/LiveCameraPanel.tsx` — captura, `MediaRecorder`, controles REC.
- `src/components/video/live/LiveDeviceSelector.tsx` — selector de fuentes.
- `src/lib/live-recording.ts` — cliente para chunks + manifiesto + `videoTMs`.
- `src/lib/live-recording.functions.ts` — `startLiveRecording`, `appendChunk`, `finalizeLiveRecording` (usan `requireSupabaseAuth` + `supabaseAdmin` sólo para escribir manifiesto).

**Cambios DB (una migración)**
- Tabla `live_recordings(match_id uuid, session_id uuid, started_at, ended_at, status, chunk_manifest jsonb, owner_id uuid)` con RLS por `owner_id` + `can_manage_teams`.
- Bucket `match-videos` ya existe; se reutiliza con prefijo `live/`.
- (Preparación Tanda 3) Tabla `ai_detections` — se crea recién en Tanda 3.

**Rendimiento**
- Chunks de 5 s → subida progresiva, no bloquea UI.
- `MediaRecorder` en Web Worker no es posible, pero el encoding es nativo (GPU-accelerated en Chrome).
- Timeline y tabla ya están memoizadas.

## Preguntas antes de arrancar

1. ¿Empiezo por **Tanda 1 completa** (captura + registro + subida en chunks) o querés primero un MVP más chico (sólo cámara + registro sin subida, para probar UX)?
2. ¿La cámara IP/HDMI es prioridad ahora o alcanza con webcam en esta primera versión?
