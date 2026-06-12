
# Ligas compartidas + alta de usuarios por admin

Hoy todo (equipos, ligas, partidos) vive en un blob JSON por usuario en `app_state`. Para que las ligas sean compartidas y el admin controle accesos hay que mover el modelo a tablas reales. Es un cambio grande, así que lo divido en **2 fases**. Esta propuesta cubre ambas; podés aprobarlas juntas o pedirme empezar solo por la Fase 1.

## Fase 1 — Backend + panel admin (sin tocar todavía la UI de juego)

### Nuevas tablas

- `leagues` (id, nombre, temporada, color, created_by, created_at)
- `teams` (id, league_id, nombre, short_name, color, logo_url, created_at)
- `players` (id, team_id, nombre, número, posición, photo_url)
- `matches` (id, league_id, team_a_id, team_b_id, status, fecha, sets_to_win, points_per_set, etc.)
- `match_sets` (match_id, número, scoreA, scoreB, finished, started_at)
- `match_events` (id, match_id, set_number, tipo: point/sub/libero, payload jsonb, timestamp)
- `match_state` (match_id, currentSet, onCourtA, onCourtB, libero info — para no reprocesar todo en cada render)
- `user_league_access` (user_id, league_id) — qué ligas ve cada usuario
- `user_permissions` (user_id, can_create_matches bool, can_manage_teams bool)

RLS:
- `leagues/teams/players/matches/...`: SELECT permitido si el usuario tiene acceso a la liga (via `user_league_access`) o es admin. INSERT/UPDATE/DELETE: admin siempre; usuarios comunes solo si tienen permiso y acceso a la liga.
- `user_league_access` y `user_permissions`: SELECT propio + admin total. Solo admin escribe.

### Alta de usuarios (server function)

- `createServerFn` con `requireSupabaseAuth` + chequeo `has_role(admin)`.
- Internamente usa `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`.
- Crea fila en `profiles`, en `user_permissions` (por defecto `can_create_matches=false`) y asigna las `user_league_access` elegidas.

### Panel admin (`/admin` rediseñado)

- Tab “Usuarios”:
  - Botón “+ Nuevo usuario” → modal con email + contraseña inicial + checkboxes de ligas + toggle “Puede crear partidos”.
  - Lista de usuarios existentes con: ligas asignadas (editables), toggle “Puede crear partidos”, badge admin.
- Tab “Ligas”: crear/editar/eliminar ligas (solo admin).

### Migración de datos

Script único que toma el contenido actual de `app_state` del super-admin y lo sube a las tablas nuevas como semilla. Los blobs viejos quedan intactos (no se borran hasta confirmar Fase 2).

## Fase 2 — Migración de la app al nuevo modelo

Reemplazar `volley-store.ts` + `cloud-sync.ts` por queries a las nuevas tablas con TanStack Query:

- `/leagues`, `/teams`, `/matches`: solo muestran lo que el usuario tiene acceso (RLS lo garantiza).
- Botón “Crear partido” oculto / deshabilitado si `can_create_matches=false`.
- Página del scorer (`matches.$id`): cada punto/sustitución/líbero se inserta en `match_events` vía server function; `match_state` se actualiza para que recargar sea instantáneo.
- Zustand pasa a ser solo estado efímero de UI (no fuente de verdad).
- Cloud-sync por usuario se elimina.

## Detalles técnicos

- Server functions en `src/lib/admin.functions.ts` (alta de usuarios, asignar ligas, togglear permisos) y `src/lib/matches.functions.ts` (eventos del scorer).
- `supabaseAdmin` solo se importa dentro del handler (`await import(...)`), nunca a nivel módulo.
- Gating en UI: hook `useUserPermissions()` que lee `user_permissions` del propio usuario; admin siempre `true`.
- `user_league_access` se consulta junto con la lista de ligas para evitar N+1.
- Las RLS de `matches`/`match_events` cuelgan de `league_id` para no duplicar reglas.

## Riesgos / cosas a confirmar

- **Datos actuales**: hoy cada usuario tiene su propio set de equipos/partidos en su blob. Al pasar a ligas compartidas, lo que migramos es **lo del admin** como base. Lo que cada usuario tenga propio se pierde salvo que lo importemos a mano. ¿Está bien?
- **Partidos en vivo**: si hay alguno “live” en este momento, conviene terminarlo antes de la Fase 2 para no migrar estado a mitad de partido.
- Fase 2 toca **todas** las páginas (scorer, stats, listados). Es la parte cara — si querés podemos posponerla y dejar la Fase 1 funcionando primero.

## ¿Empezamos por Fase 1?

Si aprobás, arranco con la migración SQL + el panel admin nuevo. La app sigue funcionando exactamente como hoy mientras tanto, y en cuanto valides el panel pasamos a Fase 2.
