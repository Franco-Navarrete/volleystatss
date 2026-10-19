# Roadmap

- [x] Add secure coach-to-team assignments.
- [x] Add revocable registration links per team.
- [x] Add public player registration form with automatic roster entry.
- [x] Add coach link controls to Teams.
- [x] Add coach assignment controls to Administration.
- [x] Verify permissions, validation, desktop/mobile rendering, and build.

## RallyStats Player
- [x] Fase 1: vincular cuentas con jugadoras del plantel (aprobar/vincular/desvincular).
- [x] Fase 2: estadísticas automáticas en el panel de jugadora.
- [x] Fase 3: evolución, temporadas e historial deportivo.
- [x] Fase 4: perfil público /player/<alias>, privacidad, QR y WhatsApp.
- [ ] Fase 5: clips, mediciones físicas, logros, perfil verificado.
- [ ] Fase 6: El Ocampense (sin integración existente, esperando definición del usuario), auditoría, revisión general.
- [x] Club owner puede crear categorías (hereda club propio o de equipos asignados)

## Vista de entrenador en vivo
- [x] Revisar scouting, estadísticas, permisos y sincronización existentes.
- [x] Acordar implementación segura sin alterar cancha ni registros históricos.
- [x] Incorporar consulta independiente, filtros, alertas con evidencia y observaciones.
- [x] Confirmar persistencia, idempotencia, auditoría y recuperación de conexión.
- [x] Probar dos pantallas, correcciones, reintentos y observaciones auditadas con administrador.
- [ ] Validar la consulta con sesiones de dos entrenadores (bloqueado: falta autorización para probar esas cuentas).

## Modalidades de scouting
- [x] Corregir y verificar bloqueo de scouting para equipos del club asignado sin cambiar permisos de sesiones compartidas.
- [x] Vista de entrenador disponible desde scouting autorizado sin activar consulta compartida, con elección de vista sin perder el rally.
- [x] Modalidad individual/compartido por sesión (scouting_mode) y tabla de participantes con permisos por sesión.
- [x] RPC live_match_permissions y commit/observaciones gobernados por permisos efectivos.
- [x] Selección de modalidad al habilitar, indicador de modalidad y permisos en la vista del entrenador.
- [x] Probado: permisos por rol (estadista/entrenador/observador), commit permitido solo con permiso de carga, diálogo e indicador en pantalla.
