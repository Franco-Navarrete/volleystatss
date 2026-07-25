# Plan: Match Session unificada

## Objetivo
Envolver todo el ciclo de vida de un partido en una única entidad `MatchSession` con 5 estados. El usuario crea la sesión, presiona "Iniciar Partido" y todo (video, scouting, clips, análisis) sucede dentro del mismo flujo, reutilizando los componentes ya existentes (`VideoPlayer`, `AnalysisPanel`, `AnalysisTimeline`, `VideoSource`, `ClipsPanel`, `useAnalysisStore`, `video-scout-store`, `volley-store`, `live-recording`, etc.).

## Alcance (qué se agrega, qué NO se toca)
- **No** se elimina ni reemplaza `VideoPlayer`, `AnalysisPanel`, `ClipsPanel`, stores existentes, rutas `matches.*`, `video.$matchId.*`, coach mode, intelligence, etc.
- Se agrega una **capa orquestadora** encima que referencia al match existente por `matchId` y agrega el resto por composición.
- Rutas nuevas conviven con las viejas; las viejas siguen accesibles como "modo avanzado".

## Cambios

### 1. Store nuevo: `src/lib/match-session/store.ts`
Zustand store persistente que representa la sesión y su estado. No duplica datos: guarda **referencias**.

```ts
type SessionStatus = "preparation" | "live" | "processing" | "analysis" | "finished";

interface MatchSession {
  id: string;              // = matchId del volley-store
  status: SessionStatus;
  createdAt: number; startedAt?: number; endedAt?: number;
  competition?: string; category?: string;
  teamAId: string; teamBId: string;
  videoSourceHint?: { kind: "file"|"camera"|"window"|"screen"|"youtube"; label?: string };
  recordingPath?: string;      // handle name del FS API
  processingSteps?: Record<string, "pending"|"done">;
}
```
Acciones: `create`, `setStatus`, `advance`, `attachVideo`, `finish`. Selectores derivan datos vivos desde los stores existentes (`useVolleyStore`, `useAnalysisStore`, `useVideoScoutStore`) por `matchId` — nada se duplica.

### 2. Servicios (`src/lib/match-session/services/`)
Módulos delgados que envuelven lo que ya existe:
- `match-session-service.ts` — CRUD de sesiones + transiciones de estado.
- `recording-service.ts` — wrapper de `LiveRecorder` (ya existe en `src/lib/live-recording.ts`).
- `video-service.ts` — wrapper de `useVideoSource` + `providers.ts`.
- `clip-service.ts`, `analysis-service.ts`, `statistics-service.ts`, `playlist-service.ts` — re-exports desde `src/lib/analysis/*` y `src/lib/clips.ts` para dar un punto de entrada único.
- `processing-service.ts` — orquesta la fase Procesando (build de marks, índices de rally, precálculo de stats — todo ya existe en `video-marks.ts`, `analysis/statistics-service.ts`).

### 3. Rutas nuevas bajo `/_authenticated/session/`
- `session.new.tsx` — Preparación: elige equipos/roster (`use-cloud-teams`), competencia, categoría, fuente de video (`VideoSourcePicker`), atajos (reutiliza panel existente), botón "Iniciar Partido" → crea el `Match` en volley-store + `MatchSession` y navega a `/session/$id/live`.
- `session.$id.tsx` — layout que lee `status` y renderiza:
  - `live` → `<LiveView>` (video + marcador + registro rápido + timeline compacto; reusa `MobileMatchShell`/`LiveCameraPanel`/`ScoutTimeline`).
  - `processing` → `<ProcessingView>` con checklist animado.
  - `analysis` / `finished` → `<AnalysisView>` (reusa `VideoPlayer` + `AnalysisPanel` + `ClipsPanel` + dashboard existente).
- El **mismo** `VideoPlayer` se pasa por `ref` a las 3 vistas.

### 4. Transiciones
- Botón "Terminar partido" en Live → `status = processing` → corre `processing-service.run()` (async, muestra pasos: sincronizar → índices → stats → clips → análisis) → `status = analysis`.
- Botón "Finalizar" en Análisis → `status = finished` (read-only).

### 5. Persistencia
El store se sincroniza a `app_state` vía `cloud-sync.ts` (agregar campo `matchSessions` al blob JSON existente — no requiere migración SQL).

### 6. Navegación sincronizada
Ya existe: click en timeline/tabla/rally/clip → `useAnalysisStore.setSelectedMarkId` → `VideoPlayer.seek`. Nada que cambiar; sólo verificar que las 3 vistas usen el mismo `playerRef` provisto por `session.$id.tsx`.

### 7. Entrada al flujo
- Añadir en `matches.index.tsx` un botón "Nueva sesión" que va a `/session/new` (además del botón viejo de "Nuevo partido", que sigue funcionando).
- Un match existente puede "adoptarse" como sesión: botón "Abrir en Session" en `matches.$id.index.tsx` que crea una `MatchSession` con `status = analysis` apuntando al mismo id.

## Compatibilidad
- `matches.*`, `video.$matchId.*`, `coach mode`, `intelligence`, scouting actual → intactos.
- El nuevo flujo es opcional y aditivo. Todo lo que hoy funciona sigue funcionando por su propia ruta.

## Archivos que se crean
```
src/lib/match-session/
  store.ts
  types.ts
  services/{match-session,recording,video,clip,analysis,statistics,playlist,processing}-service.ts
src/routes/_authenticated/
  session.new.tsx
  session.$id.tsx
src/components/session/
  PreparationView.tsx
  LiveView.tsx
  ProcessingView.tsx
  AnalysisView.tsx
  SessionStatusBadge.tsx
```

## Archivos que se editan (mínimo)
- `src/lib/cloud-sync.ts` — agregar `matchSessions` al blob.
- `src/routes/_authenticated/matches.index.tsx` — botón "Nueva sesión".
- `src/routes/_authenticated/matches.$id.index.tsx` — botón "Abrir en Session".

## Fuera de alcance (para esta iteración)
- IA de video (bboxes/tracking) — la estructura `VideoMarkAI` ya está lista.
- Colaboración multiusuario en vivo.
- Grabación en la nube (se mantiene File System Access API tal cual).

## Nota técnica
Los servicios son **wrappers finos** sobre código existente; el objetivo es dar un punto de entrada único (`MatchSessionService`), no reescribir la lógica. Esto minimiza riesgo de regresión y mantiene la promesa de "no romper nada".
