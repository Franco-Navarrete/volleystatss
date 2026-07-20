# Refactor a modelo de Clubes + paleta ampliada + permisos jugadores

Cambio grande y con impacto en datos: introduce **Clubes** como entidad de primer nivel, cambia la relación `Equipo → Club` y agrega permisos de jugadores. Lo dejo en 3 fases; empiezo Fase 1 al aprobar.

## Fase 1 — Clubes + paleta + creación guiada

### Backend (migración única)

- **Nueva tabla `public.clubs`**: `id`, `owner_id` (auth.users, NOT NULL, UNIQUE ← "1 entrenador = 1 club"), `name`, `logo_url`, `city`, `province`, `country`, `primary_color`, `secondary_color`, timestamps.
- **GRANTs** para `authenticated` y `service_role`.
- **RLS**:
  - SELECT: cualquier autenticado (para poder mostrar "Club: Quilino" en listados públicos).
  - INSERT: `owner_id = auth.uid()` y `has_role('entrenador'|'admin')`.
  - UPDATE/DELETE: `owner_id = auth.uid() OR has_role('admin')`.
- **`teams`**: agregar `club_id uuid REFERENCES clubs(id)`. Backfill: para cada `owner_id` distinto de equipos con `club` texto, crear un `club` y setear `club_id`. Deprecar (no borrar) columna `club` texto.
- **`players`**: agregar policy INSERT/UPDATE/DELETE = `can_manage_team(auth.uid(), team_id)`.
- Helper SQL `can_create_player(_user) = has_role(admin) OR has_role(entrenador)`.
- Helper SQL `get_user_club(_user)` (security definer) → id del club del entrenador.

### Server functions (`src/lib/*.functions.ts`)

- Nuevo `clubs.functions.ts`: `getMyClub`, `createClub`, `updateClub`.
- `createTeam`:
  - Si el usuario es entrenador y no tiene club → error "Crea tu club primero".
  - Si es entrenador con club → forzar `club_id = miClub.id` (ignora cualquier `club` que venga del cliente).
  - Admin puede pasar `club_id` explícito.
- `updateTeam`: bloquear cambio de `club_id` para entrenadores.
- `listTeams`: devolver `clubId` y join con clubes para exponer `clubName`, `clubLogoUrl`.

### Frontend

- **Paleta de 20 colores** (constante compartida `src/lib/team-colors.ts`) con nombre + HEX. Componente `<ColorSwatchPicker>` que muestra círculos reales y guarda el HEX. Reemplaza el picker actual en formularios de equipo y club. Secundario sigue opcional.
- **Nuevo hook `useMyClub()`** (react-query).
- **Nueva página `/mi-club`** (o modal): formulario club (nombre, escudo, ciudad, provincia, país, color principal/secundario).
- **Flujo guiado en `/teams`** para entrenadores:
  - Si no tiene club → estado vacío grande: "Primero creá tu club" + CTA que abre el formulario de club.
  - Ya con club: header "Club: {nombre}" + botón "+ Crear equipo".
  - Formulario de equipo simplificado: quita "Club" (auto), mantiene nombre, categoría, género, liga, escudo, colores.
- **Permisos UI**: mostrar editar/eliminar/agregar jugadores solo si `useCanManageTeam(team.ownerId)`.
- **Crear/editar jugadores**: habilitar botón para entrenador (nuevo `useCanCreatePlayer()` = admin O entrenador) sobre sus propios equipos.

### Memoria

- Guardar regla core: "1 entrenador = 1 club. Equipos siempre bajo un club. Autorización por `club.owner_id` o admin."

## Fase 2 (después, no en esta entrega)

- Transferencia de jugadores entre equipos del mismo club.
- Compartir jugadora entre categorías (tabla `player_team_assignments` many-to-many).
- Partidos: gating por ownership del club/equipo (Fase 2 previa del plan anterior queda absorbida acá).

## Fase 3 (después)

- Roles adicionales dentro del club: asistente, delegado, preparador físico, kinesiólogo, estadístico (tabla `club_members(club_id, user_id, role)` + permisos granulares).

## Riesgos

- Backfill: si hay equipos del mismo owner con distintos valores de `club` texto, se colapsan en 1 club (el owner queda con 1 solo, tomando el nombre más frecuente). Es intencional por la regla "1 entrenador = 1 club".
- `UNIQUE(owner_id)` en clubs impide que un entrenador tenga 2 clubes — regla explícita del pedido.
- Admins siguen pudiendo crear equipos sin club (los que hoy no tienen).

## Qué hago al aprobar

Ejecuto Fase 1 completa: migración + `clubs.functions.ts` + ajustes en `teams.functions.ts` + paleta 20 colores + página/modal "Mi Club" + refactor UI de `/teams` con flujo guiado + permisos de jugadores. Fases 2 y 3 quedan pendientes.
