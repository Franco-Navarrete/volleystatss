# Vista de entrenador en vivo de RALLY

## Resultado
El estadista conserva la cancha y el flujo de carga actuales. El entrenador abre una pantalla independiente, en otro dispositivo, y recibe el marcador, estadísticas y observaciones del partido autorizado sin controles de carga.

## Diagnóstico confirmado
- La carga actual guarda primero en el dispositivo y luego envía una copia completa por usuario. No confirma el guardado de cada acción ni recupera automáticamente todos los errores.
- El tiempo real existente actualiza la consulta global del administrador, no la del entrenador asignado.
- Los cálculos de recepción, ataque, distribución, rotaciones y tendencias ya tienen piezas reutilizables.
- Dar acceso a la copia completa de otro usuario expondría información ajena: la nueva consulta debe limitarse al partido autorizado.

## Implementación

### 1. Registro confirmado y acceso por partido
- Incorporar una representación compartida y versionada del partido activo, sin migrar ni modificar los históricos.
- Mantener el motor y las fórmulas actuales; conectar sus cambios al guardado confirmado sin reemplazar los modales ni la cancha.
- Separar permisos de lectura y carga. Administradores conservan acceso global; entrenadores acceden por equipos propios/asignados. Ser entrenador no otorga edición del registro oficial.
- Validar cada lectura y escritura en el servidor; no confiar en identificadores, roles o equipos enviados por el dispositivo.
- Mostrar pendiente, confirmado o fallido; reintentar sin repetir puntos. Evitar que una copia antigua sobrescriba una versión reciente.
- Auditar autor, fecha, versión anterior y nueva en correcciones y anulaciones.

### 2. Pantalla independiente del entrenador
- Acceso desde el partido a «Vista del entrenador», sin acciones de saque, carga, rotación, edición o finalización.
- Cabecera con equipos, marcador, set, saque, estado, conexión y última actualización confirmada.
- Resumen con ataque, recepción, rotaciones, distribución rival, tendencias, alertas y observaciones.
- Vista ampliada con filtros por set, equipo, jugadora, fundamento, rotación, zona y fase; estadísticas individuales/colectivas, K1/K2, armado, ataque, bloqueo y defensa.
- Reutilizar los cálculos existentes después de verificar sus definiciones y cobertura. Cuando falten datos, mostrar ausencia de muestra, no cifras o conclusiones inventadas.
- Acceso al video de una acción únicamente cuando exista una fuente compatible ya vinculada; no reintroducir Video en el menú general.

### 3. Actualización y observaciones
- Publicar únicamente cambios de partidos autorizados; al recibirlos, volver a leer la versión confirmada y recalcular con los mismos datos.
- Recuperar la última versión al reconectar o volver a la pantalla; distinguir conectado, reconectando, sin conexión y datos desactualizados.
- Permitir observaciones del estadista asociadas a set, rotación, jugadora, rally o video.
- El entrenador cambia el estado de una observación, conservando texto original y trazabilidad.

### 4. Alertas transparentes
- Reglas configurables para rotaciones vulnerables, concentración ofensiva, cambios de rendimiento, K1/K2 y bloqueo/defensa, solo donde los registros permitan calcularlas.
- Cada alerta muestra regla, evidencia, tamaño de muestra, período y contexto; agrupar repeticiones.
- Revisar las recomendaciones actuales antes de reutilizarlas; omitir cualquier conclusión que no tenga respaldo suficiente.

## Detalles técnicos
- Usar funciones autenticadas de TanStack y Lovable Cloud; conservar la autenticación existente.
- Guardar los partidos activos en tablas de alcance por partido, con políticas estrictas, permisos explícitos y operaciones transaccionales. No ampliar la lectura de `app_state` a entrenadores.
- Los identificadores actuales pueden ser texto, no UUID: conservarlos y no forzarlos contra las tablas relacionales incompatibles.
- Usar el tiempo real disponible en Lovable Cloud, con suscripciones desmontables, lectura de recuperación y respaldo ante interrupciones; no crear un servicio WebSocket externo.
- Registrar operaciones únicas y versiones en el servidor; reintentos de la misma operación devuelven el resultado previo. Rechazar conflictos de versión para evitar pérdida silenciosa.
- La nueva representación confirmada sirve de transporte y fuente compartida para partidos activos, no de segundo motor estadístico. Evitar que la sincronización antigua sobrescriba ese registro.
- Antes de activar un partido existente, comprobar en servidor su origen y equipos; nunca autorizar a alguien porque tenga una copia del partido en su dispositivo.

## Pruebas y entrega
- Pruebas pequeñas para permisos, operaciones repetidas, conflictos, filtros y reglas de alerta con valores concretos.
- Dos dispositivos: cargar desde la cancha, confirmar lectura del entrenador y verificar marcador e indicadores.
- Corregir y anular; probar doble envío, desconexión y recuperación sin duplicados ni estadísticas obsoletas.
- Verificar administrador, estadista autorizado, entrenador asignado y usuario ajeno, incluyendo intentos directos de lectura/escritura.
- Comprobar escritorio y tablet, filtros K1/K2, posición efectiva del armador y evidencia de alertas.
- Entregar archivos y migraciones modificados, pruebas ejecutadas, resultados y cualquier limitación pendiente. No declarar completa la sincronización hasta superar la prueba entre dispositivos.

## Fuera de alcance
Rediseño general de navegación, creación de partidos para entrenadores, cambios de roles y reestructuración de todos los registros históricos.