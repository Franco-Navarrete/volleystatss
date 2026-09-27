# Inscripción de jugadores por enlace

## Objetivo
Permitir que un administrador asigne un profesor a uno o varios equipos. Cada profesor podrá generar un enlace público por equipo para enviarlo a sus jugadores; al completarlo, el jugador se incorporará automáticamente al plantel.

## Experiencia
- En **Administración**, asignar usuarios con rol Entrenador a uno o varios equipos.
- En **Equipos**, cada profesor verá solo sus equipos y tendrá una acción **Inscripción de jugadores**.
- Desde esa acción podrá crear, copiar, desactivar o renovar el enlace del equipo.
- El formulario público mostrará el nombre y logo del equipo y pedirá:
  - Nombre y apellido
  - Número de camiseta
  - Posición
  - Fecha de nacimiento
- Al enviar, se agregará automáticamente al plantel y se mostrará una confirmación clara.
- Si el número ya está ocupado en ese equipo, el formulario no lo aceptará y explicará el conflicto.

## Seguridad y permisos
- Los enlaces usarán un código aleatorio revocable; no expondrán identificadores internos del equipo.
- Solo el dueño del equipo, un profesor asignado o el super administrador podrá administrar el enlace.
- El formulario público podrá crear únicamente jugadores en el equipo asociado al código vigente.
- La información privada del profesor y del resto del plantel no será pública.
- Las asignaciones y enlaces quedarán protegidos por permisos en la base de datos.

## Cambios técnicos
- Crear relaciones de profesores por equipo y enlaces de inscripción con permisos estrictos.
- Añadir fecha de nacimiento al registro del jugador.
- Añadir funciones protegidas para asignaciones y gestión de enlaces.
- Añadir una función pública validada para consultar el equipo y registrar al jugador.
- Añadir la página pública de inscripción y los controles en Administración y Equipos.
- Mantener compatible la creación manual de jugadores existente.

## Verificación
- Asignar un entrenador a dos equipos y confirmar que solo gestione esos equipos.
- Generar y copiar un enlace por equipo.
- Enviar el formulario sin iniciar sesión y comprobar la incorporación automática.
- Probar número repetido, código inválido, enlace desactivado y renovación del enlace.
- Revisar el resultado en escritorio y celular, además del estado general de la aplicación.
