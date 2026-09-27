# RallyStats Player: carrera deportiva de la jugadora

Una capa nueva sobre la app actual. No reemplaza nada: se apoya en jugadoras, equipos, partidos y estadísticas que ya existen. El registro por invitación, el rol de jugadora automático y el panel de jugadora ya funcionan, así que no se rehacen.

Decisiones tomadas:
- La entrenadora elige qué jugadora del plantel corresponde a cada cuenta.
- El perfil es privado por defecto. La jugadora decide si lo hace público.

## Fase 1: Identidad permanente y vínculo con partidos
- Un perfil deportivo único por jugadora, que se mantiene aunque cambie de club, categoría o temporada.
- Al aprobar una solicitud, la entrenadora puede elegir "Vincular con una jugadora existente del plantel" (así se conservan sus partidos anteriores) o crear una nueva.
- En Administrar categoría, un botón para vincular o desvincular la cuenta de las jugadoras ya cargadas.
- El admin puede unir perfiles duplicados.

## Fase 2: Estadísticas automáticas en su panel
- Totales: partidos, sets, puntos, ataques, bloqueos, aces, recepción y MVP, calculados solos a partir de los partidos finalizados.
- Promedios por partido y récords personales.
- Últimos partidos, con el detalle de cada uno.
- Filtros por temporada, club, categoría y rival.
- Solo se cuentan los partidos de equipos donde la jugadora estuvo vinculada.

## Fase 3: Evolución e historial
- Gráficos de evolución por partido y por temporada (puntos, eficiencia de ataque y de recepción).
- Línea de tiempo de su carrera: clubes, categorías, temporadas y fechas.

## Fase 4: Perfil público, tarjeta, QR y privacidad
- Página pública `/player/<alias>`, que solo se ve si la jugadora la activa.
- Opciones de privacidad: qué se muestra (estadísticas, fecha de nacimiento, club, foto).
- Menores de 18: nunca se muestra la edad exacta y el perfil público se desactiva por defecto.
- Los partidos privados nunca aparecen en el perfil público.
- Tarjeta de jugadora para compartir, con QR y botón de WhatsApp.

## Fase 5: Videos, highlights, mediciones y logros
- Clips de sus acciones, tomados de los videos que ya tienen los partidos.
- Mediciones físicas cargadas por la entrenadora (altura, alcance, salto), con su historial.
- Logros automáticos (por ejemplo, primer MVP o 100 puntos), marcados como verificados cuando salen de partidos registrados.
- Perfil verificado cuando la jugadora está vinculada y aprobada por su club.

## Fase 6: Integraciones y cierre
- El Ocampense: primero reviso qué existe hoy. Si no hay nada, lo dejo preparado y te consulto.
- Actualización en vivo de las estadísticas cuando termina un partido.
- Registro de cambios en perfiles y vínculos.
- Revisión completa de que todo lo actual sigue funcionando: planillero, scouting, partidos y videos.

Al terminar cada fase la pruebo en el navegador y te aviso antes de pasar a la siguiente.

## Detalles técnicos
- La identidad sale de `player_profiles` (1 por usuario), que ya existe. Se agregan: alias único, `visibility` (default 'private'), bio, altura y mano hábil.
- Las filas `players` de cada equipo se vinculan con `players.user_id`. Las estadísticas se agregan sobre todos los `players.id` con ese `user_id`, reusando `computeHistoricalStats`.
- Nueva RPC `review_team_membership_link(_member_id, _player_id)` para vincular con una jugadora existente, validada con `can_manage_assigned_team`.
- La lectura pública pasa por una función del servidor que usa la clave pública y revisa `visibility` y la edad. Nada de lecturas anónimas amplias.
- Tablas nuevas, con GRANT y RLS: `player_measurements`, `player_achievements`, `player_profile_audit`.
- Hoy los partidos viven en `app_state` (JSON). Para el cálculo entre clubes se usa una función del servidor privilegiada que filtra por el `user_id` de la jugadora. No expone datos ajenos.
