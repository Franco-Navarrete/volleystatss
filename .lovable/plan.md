## Objetivo

Refactorizar el reproductor de video del módulo Scouting en Vivo para que parezca software profesional tipo Data Volley: una única fuente conmutable en caliente (archivo, ventana, pantalla, cámara), HUD con estado en tiempo real, y recuperación automática si el usuario corta la compartición — sin tocar registro, timeline, marcador ni sincronización.

## 1. Nueva arquitectura de proveedores

Crear `src/lib/video/providers/` con una interfaz común:

```text
VideoSource (interfaz)
  ├─ id: "file" | "window" | "screen" | "camera"
  ├─ label: string        // "Archivo local", "Google Chrome — YouTube", "Cámara Logitech C920"
  ├─ kind: "media" | "stream"
  ├─ src?: string          // object URL para archivo
  ├─ stream?: MediaStream  // para captura
  ├─ meta: { width, height, frameRate, deviceLabel?, displaySurface? }
  ├─ onEnded: (cb) => void // ventana/pantalla cortada
  └─ stop(): void

Providers concretos:
  - LocalFileProvider   → <input type=file> + URL.createObjectURL
  - WindowProvider      → getDisplayMedia({ video:{ displaySurface:"window" }})
  - ScreenProvider      → getDisplayMedia({ video:{ displaySurface:"monitor" }})
  - CameraProvider      → getUserMedia({ video:{ deviceId? }})
```

Cada provider expone `open()` que devuelve un `VideoSource` ya listo, extrae el label real desde `track.getSettings()` / `track.label` (nombre de ventana o modelo de cámara) y engancha `track.onended` para disparar el evento de interrupción.

## 2. Nuevo selector unificado

Reemplazar `VideoSourceSwitcher.tsx` y los botones "Cámara"/"Pantalla" de `LiveCameraPanel.tsx` por un único componente `<VideoSourcePicker />`:

- Botón principal: **📹 Cambiar fuente**.
- Abre un `DropdownMenu` con: **📁 Archivo local**, **🖥 Compartir ventana**, **🖥 Compartir pantalla**, **📷 Cámara** (submenú con dispositivos si hay más de uno).
- Bajo el reproductor, un chip siempre visible: **🟢 Fuente: {label}** (por ejemplo `🟢 Fuente: Google Chrome — Volleyball TV` o `🟢 Fuente: Cámara Logitech C920`).
- Reemplaza "Cambiar (en vivo)" por **🔄 Cambiar fuente** dentro del mismo panel; funciona igual mientras está grabando.

## 3. HUD del reproductor

Ampliar `VideoPlayer.tsx` con una barra superior semitransparente que muestre:

- Fuente activa (icono + label truncado).
- Badge **REC** rojo pulsante cuando la grabación está corriendo (el estado ya lo maneja `LiveRecorder`; se propaga vía prop `recStatus`).
- Estado **Reproduciendo / Pausado**.
- Tiempo transcurrido de reproducción o de grabación.
- Resolución de captura `1280×720` y `fps` leídos de `track.getSettings()`.
- Calidad detectada (si `videoHeight >= 1080` → HD, si no SD).

Nada de esto altera la máquina del scout: el HUD lee del `<video>` y del `VideoSource` activo, no despacha eventos al store.

## 4. Recuperación automática

Cuando el track de una ventana/pantalla dispara `ended` (usuario cerró la compartición desde el chip del navegador):

- **No** se resetea la sesión de scout, ni el cronómetro, ni las acciones registradas.
- El player muestra overlay: **"⚠ Captura interrumpida"** + botón **"Reconectar"** que reabre `getDisplayMedia` con el mismo tipo (window/screen).
- Si la grabación estaba activa, `LiveRecorder` se pausa automáticamente y se reanuda al reconectar el stream (se anexa un nuevo segmento al mismo archivo destino).
- Toast informativo `"Captura interrumpida — reconectá para continuar"`.

## 5. Integración

- `video.$matchId.live.tsx`: reemplaza el bloque cámara/pantalla de `LiveCameraPanel` por el nuevo `VideoSourcePicker` + `VideoPlayer` con `stream`. Mantiene `recordingStartedRef`, `videoTMsNow` y el resto igual — la sincronización de timestamps sigue anclada a `performance.now()` desde el inicio de grabación.
- `video.$matchId.scout.tsx`: sustituye `VideoSourceSwitcher` por `VideoSourcePicker`, pasando `hasLinked` para exponer también el video vinculado.
- `LiveCameraPanel.tsx` queda como envoltorio delgado alrededor de `VideoPlayer` + `VideoSourcePicker` + controles REC.

## 6. Invariantes

Sin cambios en:

- `video-scout-store` / `useVolley` (registro de acciones, marcador, cronómetro).
- `ScoutTimeline`, `ClipsPanel`, `buildVideoMarks`.
- `LiveRecorder` (sólo se le enchufa la reanudación de segmento en el punto 4).
- Sincronización `tMs`: los eventos siguen anclados a `videoTMsNow()` / `player.currentTime`.

## Detalles técnicos

- Los providers viven en `src/lib/video/providers/{local,window,screen,camera}.ts` con una fábrica `openVideoSource(kind, opts)` en `src/lib/video/index.ts`.
- Label de ventana/pantalla: `track.label` en Chromium devuelve `"web-contents-media-stream://…"` como fallback; usamos `track.getSettings().displaySurface` + un heurístico "Ventana compartida" cuando no hay título expuesto (limitación del navegador — se documenta en el chip).
- `VideoPlayer` acepta ahora `source?: VideoSource` (además de `src`/`stream` legacy para no romper la ruta index).
- Detección de interrupción centralizada en el hook `useVideoSource()` que envuelve el provider actual y expone `{ source, status, reconnect, change }`.

## Archivos afectados

- Nuevos: `src/lib/video/index.ts`, `src/lib/video/providers/*.ts`, `src/hooks/use-video-source.ts`, `src/components/video/VideoSourcePicker.tsx`, `src/components/video/VideoHUD.tsx`.
- Modificados: `src/components/video/VideoPlayer.tsx`, `src/components/video/live/LiveCameraPanel.tsx`, `src/routes/_authenticated/video.$matchId.live.tsx`, `src/routes/_authenticated/video.$matchId.scout.tsx`.
- Reemplazado: `src/components/video/VideoSourceSwitcher.tsx` (se conserva como shim que reexporta `VideoSourcePicker` para no romper imports).