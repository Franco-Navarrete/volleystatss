# Propietario de equipos + rol Entrenador

El pedido cubre desde ownership básico hasta asistentes técnicos, convocatorias, dorsales y formaciones. Es demasiado para una sola entrega sin romper lo existente (RLS actual, cloud-sync, UI de teams). Propongo dividirlo en **3 fases** que se aprueban y sueltan de a una. Empiezo por la Fase 1 apenas apruebes.

## Decisiones aplicadas (de tus respuestas)

- Nueva columna `owner_id` en `teams` (separada de `created_by`).
- RLS **reemplazada**: acceso = admin OR owner OR (equipo con liga = "público", solo lectura).
- "Equipo público" = tiene `league_id` NOT NULL.
- Nuevo permiso lógico `team.create`, asignado automáticamente al rol `entrenador`.

## Fase 1 — Ownership + crear/editar/eliminar equipos (base)

**Backend**
- Migración: `ALTER TABLE teams ADD COLUMN owner_id uuid REFERENCES auth.users`. Backfill `owner_id = created_by` para filas existentes.
- Función SQL `public.can_manage_team(_user uuid, _team uuid)` = `admin OR owner`.
- Reemplazar policies de `teams`:
  - SELECT: `owner = auth.uid() OR league_id IS NOT NULL OR has_role(admin)`.
  - INSERT: rol admin o entrenador (nuevo helper `public.can_create_team`), con `owner_id = auth.uid()`.
  - UPDATE/DELETE: `can_manage_team(auth.uid(), id)`.
- Policies de `players`: escritura solo si `can_manage_team` sobre el team; lectura si SELECT del team pasa.
- `createTeam` / `updateTeam` / `deleteTeam` server fns: setean/validan `owner_id`; devuelven error "No tiene permisos para administrar este equipo" cuando corresponde.

**Frontend**
- Nuevo hook `useCanCreateTeam()` (admin o rol entrenador).
- Nuevo hook `useIsTeamOwner(teamId)` para gatear UI.
- Página `/equipos` (privada + pública):
  - Botón **+ Crear equipo** visible si `useCanCreateTeam()`.
  - Formulario nuevo con los campos pedidos (nombre, club, escudo, colores, género, categoría con Sub 12/14/16/18/21/Primera/Libre, liga opcional).
  - Categorías nuevas requieren ampliar el enum: `12,14,16,18,21,primera,libre` (agrega `libre`). Club = campo texto nuevo → migración columna `club text` en `teams`.
  - Acciones editar/eliminar/subir escudo/gestionar jugadores solo visibles si `isOwner || admin`.
  - Estado vacío: "Todavía no creaste ningún equipo" + botón "Crear mi primer equipo" (solo se muestra a usuarios con `team.create` y sin equipos propios).
- Cloud-sync: filtrar equipos que no son propios ni públicos, y no intentar upsert de equipos ajenos.

## Fase 2 — Partidos y estadísticas del entrenador

- `matches` gana `owner_id` (mismo modelo). RLS admin/owner/público (partido de liga).
- Entrenador puede crear partidos solo entre sus equipos (o sus equipos vs. equipos públicos de la misma liga).
- Cargar estadísticas y formaciones: permitido si es owner del partido.
- Ajuste de `useCanCreateMatches` para reconocer al entrenador propietario.

## Fase 3 — Asistentes, convocatorias, dorsales

- Nueva tabla `team_members(team_id, user_id, role: 'owner'|'assistant', invited_by)` con RLS: owner administra, assistant lee + gestiona plantel/convocatorias.
- Nueva tabla `team_call_ups(team_id, match_id, player_id, status)` para convocatorias por partido.
- UI de invitación por email (usa admin API igual que altas de usuario actuales).
- Dorsales: agregar `default_number` por jugador y override por convocatoria.
- Actualizar `can_manage_team` para incluir asistentes en escritura de plantel/convocatorias, pero no en borrar el equipo.

## Detalles técnicos

- Todas las policies usan security-definer helpers (`can_manage_team`, `can_create_team`) para evitar recursión y centralizar autorización.
- `can_create_team(_user)` = `has_role(_user,'admin') OR has_role(_user,'entrenador')`. Reemplaza el chequeo actual basado en `can_manage_teams`.
- `owner_id` NOT NULL a futuro; en la migración se deja nullable durante el backfill y luego `SET NOT NULL` en la misma migración usando `COALESCE(created_by, ...)`.
- GRANT completos para `authenticated` y `service_role` en cada tabla nueva.
- Cloud-sync (`src/lib/cloud-sync.ts` + `use-cloud-teams.ts`) deja de subir equipos ajenos: filtra por `owner_id === userId` antes del upsert.
- `mem://` se actualiza con la nueva regla de ownership.

## Riesgos

- La política SELECT nueva expone lectura de **todos** los equipos con liga a cualquier usuario autenticado. Es lo pedido; lo dejo documentado.
- Reemplazar RLS puede dejar sin acceso a usuarios `planillero`/`can_manage_teams` que hoy editan equipos que no crearon. Se pierde intencionalmente (elegiste "Reemplazar").

## Qué hago al aprobar

Ejecuto Fase 1 completa (migración + server fns + UI + hooks + cloud-sync + estado vacío). Fases 2 y 3 quedan pendientes de tu OK explícito.
