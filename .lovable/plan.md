# Equipos y partidos compartidos en el servidor

Hoy todo vive en un blob JSON por usuario (`app_state`). Para que los equipos y **cada partido** queden guardados en el servidor y sean visibles para los usuarios autorizados de la liga, los movemos a tablas reales con RLS por liga.

Es un cambio grande; lo divido en **2 fases** que podemos hacer seguidas. La app sigue funcionando entre medio.

## Fase 1 — Backend (migración SQL)

Nuevas tablas en el servidor, todas con RLS basada en `user_league_access`:

- `teams` (league_id, name, short_name, color, logo_url)
- `players` (team_id, name, number, position, photo_url)
- `matches` (league_id, team_a_id, team_b_id, status, scheduled_at, sets_to_win, points_per_set, initial_serving_side, captains, líberos, sides_flipped)
- `match_sets` (match_id, number, score_a, score_b, finished, started_at)
- `match_events` (match_id, set_number, kind, payload jsonb, created_at) — **una fila por punto, sustitución, líbero, timeout, sanción, lineup override**
- `match_lineups` (match_id, set_number, side, lineup uuid[], confirmed)

Reglas de acceso (RLS):
- **Ver**: cualquier usuario con acceso a la liga (o admin) ve equipos, jugadores, partidos y eventos de esa liga.
- **Crear/editar equipos y jugadores**: usuarios con acceso a la liga + permiso `can_manage_teams` (nuevo flag en `user_permissions`), o admin.
- **Crear partido**: usuarios con `can_create_matches` + acceso a la liga, o admin.
- **Registrar eventos del partido** (puntos, etc.): mismos permisos que crear partido.

## Fase 2 — Migrar la app al nuevo modelo

Reemplazar `volley-store.ts` (zustand persistido) + `cloud-sync.ts` por:

- **TanStack Query** para leer equipos, jugadores, partidos y eventos desde las tablas.
- **Server functions** (`createServerFn` con `requireSupabaseAuth`) para todas las escrituras: crear/editar equipo, agregar jugador, crear partido, registrar punto/sub/líbero/timeout/sanción, deshacer último evento, terminar partido, eliminar partido.
- Cada acción del scorer hace un insert inmediato en `match_events` → **el partido nunca depende del navegador para persistir**.
- Zustand queda solo para estado efímero de UI (no fuente de verdad).
- `cloud-sync.ts` y la tabla `app_state` quedan obsoletos (los dejo un tiempo por compatibilidad, sin escribir).

UI:
- Selector de liga en la barra superior cuando el usuario tiene acceso a más de una.
- Equipos y partidos filtrados por la liga seleccionada.
- Indicador "Guardado ✓ / Guardando… / Error" en el scorer.
- Botones de crear/editar ocultos si el usuario no tiene permiso.

## Migración de datos existentes

Script único (server function admin) que toma el `app_state` del super-admin, lo asocia a una liga elegida y crea las filas en las tablas nuevas. Los blobs de los demás usuarios no se migran automáticamente — si querés conservar algo específico me decís y lo importo a mano.

## Riesgos / a confirmar

- **Partidos en vivo**: si hay alguno "live" al hacer Fase 2, conviene terminarlo antes para no migrar a mitad de partido.
- **Permiso `can_manage_teams`**: hoy no existe. Por defecto lo dejo en `false` para todos menos admin; vos decís a quién dárselo desde el panel admin.
- **Performance del scorer**: cada acción será un round-trip al servidor (≈100–300 ms). Uso updates optimistas para que la UI responda al toque y la confirmación llegue después.
- Fase 2 toca **todas** las páginas (scorer, stats, listados, PDF). Es la parte cara.

## Detalles técnicos

- Server fns en `src/lib/teams.functions.ts`, `src/lib/matches.functions.ts`, `src/lib/match-events.functions.ts`.
- RLS de tablas hijas se basa en `has_league_access(auth.uid(), league_id)` (función ya existe).
- `match_events` con índice `(match_id, created_at)` para reconstruir el partido en orden.
- Generación del PDF lee de las tablas, no del store local.

## ¿Empezamos por Fase 1?

Si aprobás, arranco con la migración SQL. La app sigue funcionando con el sistema actual hasta que enganchemos Fase 2.
