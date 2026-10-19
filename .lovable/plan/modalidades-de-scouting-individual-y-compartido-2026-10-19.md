# Modalidades de scouting: individual y compartido

## Objetivo
Un mismo motor de scouting con dos modalidades elegidas al iniciar el partido:
- **Individual:** el entrenador carga acciones y consulta el análisis desde el mismo dispositivo.
- **Compartido:** un estadista carga y uno o varios entrenadores consultan en vivo (ya existe la base: `live_match_sessions`, vista del entrenador, sincronización idempotente).

## 1. Modalidad y permisos por sesión (backend)
- Migración: agregar `scouting_mode text not null default 'individual'` (`check in ('individual','shared')`) a `live_match_sessions` y tabla `live_match_participants` (match_id, user_id, permisos: `can_record_events`, `can_edit_events`, `can_view_live_stats`, `can_create_observations`, `can_manage_match`) con RLS: lectura para quien puede leer la sesión; escritura solo admin/scorer con `can_manage_match`.
- `readLiveSession` devuelve `mode` y el conjunto de permisos efectivos del usuario para esa sesión (scorer activado ⇒ record/edit/manage; entrenador asignado ⇒ view/observations; admin ⇒ todo). Los permisos se calculan y verifican **en el servidor** en `commitLiveSession`, `setLiveNoteStatus` y `activateLiveSession`, no solo en la interfaz.
- `activateLiveSession` acepta `mode` y participantes (estadista + entrenadores) al habilitar la consulta compartida.
- La modalidad persiste en la sesión: al volver a ingresar no se vuelve a preguntar.

## 2. Selección de modalidad al iniciar
- En `PreparationView` (nueva sesión) y en el diálogo "Habilitar consulta compartida", mostrar la pantalla simple:
  - **¿Cómo vas a realizar el scouting?**
  - **Individual:** cargo las estadísticas y analizo el partido.
  - **Compartido:** un estadista registra y el entrenador analiza desde otra pantalla.
- Individual ⇒ abre el scouting actual con panel de análisis disponible (sin exigir segundo usuario).
- Compartido ⇒ permite asignar estadista y entrenadores autorizados y abre la vista correspondiente a cada uno.
- Cabecera del partido: indicador discreto de modalidad activa + estado de conexión (sin confirmaciones repetitivas).

## 3. Modo individual — análisis sin abandonar el partido
- En la pantalla del partido (`matches.$id.index.tsx`), agregar alternancia **Scouting / Análisis**:
  - Botón en la barra superior (junto a "Vista del entrenador").
  - Panel compacto de estadísticas que se abre sin perder el rally en curso ni el estado de carga (el estado vive en el store, no en la vista).
  - Reutiliza `live-analytics` (resumen táctico, alertas con evidencia, observaciones) y el dashboard del entrenador, en modo lectura.
  - Pantallas grandes: panel lateral/dividido; pantallas chicas: vistas alternables. Los gráficos nunca bloquean la carga.

## 4. Modo compartido — interfaces separadas
- Estadista: cancha interactiva, correcciones, estado de sincronización visible, observaciones (ya existe; se mantiene).
- Entrenador: vista de solo lectura con marcador, estadísticas en tiempo real, resumen táctico, alertas y observaciones (ya existe en `matches.$id.coach`); sin controles de carga salvo permiso explícito `can_record_events` en la sesión.
- Ambos comparten la misma sesión y datos confirmados por el servidor (ya implementado con versiones e idempotencia).

## 5. Sincronización y consistencia
- Reutilizar el transporte existente: IDs únicos por operación, commits idempotentes, reintentos sin duplicar, cola offline en localStorage y reenvío al recuperar conexión.
- Estados visibles: pendiente / confirmado / conflicto (ya existen; se muestran también en el indicador de cabecera).

## 6. Pruebas
- Tests unitarios (vitest): cálculo de permisos por sesión (scorer, entrenador, admin, no autorizado), persistencia de modalidad, mismas fórmulas en ambos modos.
- Playwright: (1) entrenador completa un partido individual sin invitar a nadie y alterna Scouting/Análisis sin perder el rally; (2) modo compartido con estadista + entrenador simultáneos, corrección/anulación reflejada en ambos; (3) usuario no autorizado no accede por URL; (4) corte de conexión y reconexión sin duplicados.

## Limitaciones conocidas (se informan al cierre)
- El scouting local sin sesión activada sigue guardando en el dispositivo; la modalidad compartida requiere activar la sesión en vivo.
- El acceso al video y jugadas vinculadas en la vista del entrenador depende de que exista video cargado para el partido.
