## Rediseño del módulo Video → Match Center

Transformo el módulo Video en un centro operativo de partido reutilizando toda la lógica actual (VideoPlayer, AnalysisStore, ScoutStore, MatchSession store/services, clips, playlists, dashboard). Solo cambian rutas de presentación y organización visual.

### 1. Nueva grilla `/video` (Match Sessions)

Reescribo `src/routes/_authenticated/video.index.tsx`:

- Cada card = Match Session (no un archivo). Fusiono `useVolley().matches` con `useMatchSessionStore` — si no hay sesión, se muestra "sin iniciar" (la card sigue sirviendo).
- Muestra: competencia, categoría, equipos + escudos, fecha/hora, resultado, duración video, cantidad de acciones (de `videoMarks`) y rallies (de scout store).
- Tres chips de estado independientes: **Estado sesión** (preparación/live/procesando/análisis/finalizado), **Video** (sin video / grabando / sincronizado), **Scout** (sin iniciar / en progreso / finalizado).
- Menú de acciones por card: Continuar · Abrir análisis · Administrar · Duplicar · Eliminar.
- Barra de filtros modernos: competencia, categoría, equipo, fecha, estado, video, scouting, favoritos. Orden: más recientes / más acciones / últimos analizados.

### 2. Match Center `/video/$matchId`

Reescribo `video.$matchId.index.tsx` como **Dashboard del partido** (el input de URL/archivo pasa a un panel secundario colapsable):

```text
┌── HEADER ──────────────────────────────────────────┐
│ ClubA  VS  ClubB · Competencia · Categoría · Fecha │
│ Chips: estado · cronómetro · #acciones · #rallies  │
└────────────────────────────────────────────────────┘

┌── ESTADO (card grande visual, cambia por fase) ────┐
│  ▶ INICIAR PARTIDO   (cuando no hay sesión)        │
└────────────────────────────────────────────────────┘

┌ VIDEO ────────┐ ┌ SCOUT ────────┐ ┌ GRABACIÓN ───┐
│ Archivo │ Cam │ │ Estado, últim │ │ REC, tiempo, │
│ Pantalla│ URL │ │ acción, jugad │ │ ubicación,   │
│ Ventana       │ │ Abrir Scout   │ │ start/stop   │
└───────────────┘ └───────────────┘ └──────────────┘

┌── ANÁLISIS ────────────────────────────────────────┐
│ Sin video → "No hay análisis disponible"           │
│ Con video → Análisis · Dashboard · Timeline ·      │
│             Clips · Estadísticas                   │
└────────────────────────────────────────────────────┘
```

Selector de origen de video con Cards grandes (icono + label). Al elegir uno se expande el config actual (input URL, botones de source, etc.) — reutilizo `VideoSourcePicker` y la lógica ya existente en `video.$matchId.index.tsx`.

### 3. Estados y transiciones

Uso el `useMatchSessionStore` existente. La sección Estado renderiza componentes según fase:
- **preparación**: botón grande `▶ INICIAR PARTIDO` → crea session, marca match started, redirige a `/live`.
- **live**: chip pulsante + botón "Continuar en vivo".
- **procesando**: reutilizo `ProcessingView`.
- **análisis / finalizado**: CTAs a análisis/dashboard/timeline/clips.

Las secciones VIDEO/SCOUT/GRABACIÓN se muestran u ocultan según fase (en vivo solo lo esencial; en análisis todo el panel de herramientas).

### 4. Componentes nuevos (modulares en `src/components/match-center/`)

- `MatchSessionCard.tsx` — card de la grilla.
- `MatchCenterHeader.tsx` — header con equipos, chips, cronómetro.
- `PhaseCard.tsx` — tarjeta grande de estado con CTA principal.
- `VideoSourceCards.tsx` — 5 cards (Archivo/Ventana/Pantalla/Cámara/URL) que expanden config.
- `ScoutStatusCard.tsx`, `RecordingStatusCard.tsx`, `AnalysisShortcutsCard.tsx`.
- `MatchSessionFilters.tsx` — barra de filtros/orden.

Todos son wrappers de UI que llaman a stores/servicios ya existentes.

### 5. Navegación sincronizada

Los CTAs de Análisis siguen navegando a `/video/$matchId/analysis` y `/scout`, que ya comparten `AnalysisStore` (VideoPlayer único, timeline/tabla/clips ya sincronizados). No toco esas rutas.

### 6. Compatibilidad

- No borro rutas ni servicios. `/scout`, `/analysis`, `/live` intactas.
- Toda vinculación de video (`upsertMatchVideoUpload`, YouTube, HLS) sigue viva dentro del panel expandible de VideoSourceCards.
- `MatchSession` store/services sin cambios de firma; solo se consumen desde la nueva UI.

### Detalles técnicos

- Rutas modificadas: `video.index.tsx`, `video.$matchId.index.tsx` (+ head metadata actualizada).
- Nuevos archivos bajo `src/components/match-center/`.
- Tokens semánticos existentes (`bg-card`, `text-muted-foreground`, `border`, `primary`). Sin colores hardcoded.
- Responsive grid con `grid-cols-[minmax(0,1fr)_auto]` en headers para tablet/móvil.
- Reutiliza `SessionStatusBadge`, `PreparationView`, `ProcessingView`, `AnalysisView` donde aplique.
