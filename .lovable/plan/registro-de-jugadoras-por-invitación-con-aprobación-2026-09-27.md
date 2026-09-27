# Registro de jugadoras por invitación con aprobación

## Idea central
Reutilizar lo que ya existe: cada **equipo** actual (que ya tiene club, género y categoría) pasa a mostrarse como **Categoría** (ej. "Sub 16 Femenino"). No se crean tablas duplicadas.

## Experiencia de la jugadora (celular primero)
1. Abre `/join/código` desde WhatsApp: ve "Te invitaron a unirte", club y categoría.
2. Crea su cuenta o inicia sesión.
3. Completa: Nombre*, Apellido*, número, posición y foto opcional ("Tomar foto" / "Elegir de galería" en celular, "Subir foto" en computadora; JPG/PNG/WEBP con vista previa).
4. Envía la solicitud y ve "Solicitud enviada, esperando aprobación".
- Mensajes: "Esta invitación ya no es válida." (revocada), "Esta invitación ha expirado.", "Ya pertenecés a este equipo."
- Una sola cuenta aunque esté en varias categorías; su perfil (nombre, apellido, foto) se reutiliza y no se vuelve a pedir.

## Panel de la entrenadora (página "Mi club")
- Encabezado con su club y tarjetas "Mis categorías": nombre, cantidad de jugadoras, contador de solicitudes pendientes, botones **Administrar** e **Invitar**.
- **+ Nueva categoría**: nombre (Sub 12…Primera), género; el club se asigna solo.
- Dentro de una categoría:
  - **Solicitudes pendientes (N)** con foto, nombre, número, posición y botones Aceptar / Rechazar.
  - **Jugadoras** con foto, #número · posición y menú para editar o quitar (quitar no borra la cuenta).
  - Invitaciones: crear, copiar, regenerar, revocar (vencen a los 7 días; las de categoría sirven para varias jugadoras hasta revocarse).
- Al aceptar, la jugadora aparece en el plantel y queda disponible para partidos y estadísticas.

## Permisos
- Administrador general: acceso total (sin cambios).
- Entrenador/a: solo su club, sus categorías, sus solicitudes y jugadoras.
- Jugador/a: ve y edita solo su perfil y sus membresías; no administra a nadie.

## Detalles técnicos
- `player_profiles` (nueva): user_id único, first_name, last_name, photo_url; RLS: dueña lee/edita, gestores de sus equipos leen.
- `team_members`: agregar `club_id`, `number`, `position`; usar `status` pending/active/rejected; `role` player/coach.
- `team_invitations`: agregar `club_id`, `multi_use` (default true para nuevas) y estado revocado vs. vencido en `get_team_invitation`.
- RPC `request_team_membership(token, datos)` crea/actualiza perfil y membresía `pending` (valida dorsal libre).
- RPC `review_team_membership(member_id, approve)` solo para `can_manage_assigned_team`; al aprobar crea/vincula fila en `players` (con `user_id`, foto y nombre completo) para mantener partidos y estadísticas sin duplicar; al rechazar marca `rejected`.
- Quitar membresía: desvincula del plantel sin tocar la cuenta.
- Bucket público `player-photos` con carpeta por usuario (subida solo propia).
- `/join/$code` reescrito como asistente de 3 pasos; `input capture="user"` para cámara.
- `my-club.tsx` reorganizado con tarjetas de categoría y vista de detalle.
- Reemplaza el alta directa actual (`join_team_as_player`), que queda sin uso.

## Verificación
- Crear categoría, generar enlace, registrarse como jugadora nueva en 390px con y sin foto, aprobar y rechazar, sumar la misma jugadora a una segunda categoría, y confirmar que otro entrenador no ve nada ajeno.
