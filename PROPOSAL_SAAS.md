# Propuesta Técnica Enterprise: RALLY SaaS Jerárquico

Esta propuesta detalla la transformación de VolleyStatss en una plataforma SaaS de clase mundial, diseñada para gestionar la complejidad de organizaciones deportivas desde el nivel internacional hasta el jugador individual, utilizando una arquitectura multi-tenant jerárquica.

## 1. Arquitectura General
El sistema evolucionará de un modelo centrado en el usuario a uno de **Ecosistema Digital Jerárquico**. Toda la lógica de negocio, datos y permisos se articulará en torno a la entidad **Workspace**, que representará a cualquier organización en la cadena de valor del voleibol.

## 2. Modelo de Datos
Se introducirá una estructura de tablas Core:
- `workspaces`: El nodo central de datos.
- `workspace_members`: La relación entre identidades de usuario y organizaciones.
- `workspace_roles_permissions`: Definición granular de capacidades.
- `subscriptions`: Control de acceso a módulos basado en el plan del Workspace.

## 3. Modelo Jerárquico
Implementación de un sistema de **Parent-Child** mediante la columna `parent_id` en `workspaces`.
- **Niveles Definidos**: Federación Internacional > Nacional > Provincial > Asociación > Liga > Club > Categoría > Equipo.
- **Validación de Jerarquía**: Un disparador (trigger) en la DB impedirá ciclos circulares y asegurará que un Club no pueda ser padre de una Federación.

## 4. Modelo Multi-tenant
Aislamiento físico y lógico de datos:
- Todas las tablas operativas (partidos, equipos, scouts) incluirán `workspace_id`.
- **Row Level Security (RLS)**: Las políticas de base de datos garantizarán que un usuario solo acceda a datos de Workspaces donde sea miembro o que pertenezcan a su jerarquía descendente (si tiene permisos de supervisión).

## 5. Modelo de Permisos
**Permission Service Centralizado**:
- Los permisos no son booleanos simples; se evalúan en contexto: `can(user, action, workspace)`.
- Soporte para **Herencia de Permisos**: Los administradores de una Federación pueden recibir permisos automáticos en las Ligas dependientes.

## 6. Modelo de Suscripciones
- **Planes**: `Public`, `Coach`, `Club`, `League`, `Federation`.
- **Módulos**: El plan habilita módulos específicos (ej: el módulo 'Video Analysis' solo está en Plan Club o superior).
- **Control de Acceso**: Si un módulo no está en el plan del Workspace, la UI lo oculta y la API rechaza las peticiones relacionadas.

## 7. Modelo de Workspaces
Cada Workspace es una "instancia" lógica con su propio:
- **Branding**: Colores, logos y tipografías personalizadas.
- **Configuración**: Reglas de juego, zonas horarias, reglamentos específicos.
- **Usuarios y Roles**: Gestión interna e independiente de personal.

## 8. Modelo de Navegación
- Layout dinámico basado en el Workspace activo.
- URLs estructuradas: `/w/:slug/dashboard`, `/w/:slug/scout`.
- Menú lateral que se adapta a los módulos habilitados por el plan del Workspace.

## 9. Flujo de Cambio de Workspace
- **Selector Global**: Un componente persistente en el Sidebar.
- **Acción**: Al cambiar, se limpia el cache de la aplicación y se rehidrata el contexto con los datos de la nueva organización sin necesidad de logout.

## 10. Relaciones entre Organizaciones
- **Consolidación de Datos**: Los niveles superiores pueden ver estadísticas agregadas de sus hijos.
- **Comunicación**: Sistema de notificaciones y directivas que fluyen de padres a hijos.

## 11. Estrategia de Migración
- **Fase de Compatibilidad**: Se creará un "Default Workspace" para cada usuario actual.
- **Asignación Masiva**: Los datos existentes se asociarán a este workspace inicial.
- **Dual-Mode**: Durante la transición, el sistema soportará la lógica antigua y la nueva simultáneamente para evitar roturas.

## 12. Riesgos Técnicos
- **Performance de Consultas Jerárquicas**: Solución mediante vistas materializadas o índices recursivos.
- **Complejidad de RLS**: Auditoría estricta de políticas para evitar fugas de datos entre competidores (ej: Club A no debe ver scouts privados del Club B).

## 13. Roadmap de Implementación
1. **Fase 1 (Cimientos)**: Migraciones de DB, Modelos de Tipos y Auth Middleware.
2. **Fase 2 (Contexto)**: Integración en el Frontend del WorkspaceProvider y Selector.
3. **Fase 3 (Permisos y Módulos)**: Implementación del Permission Service y gates de suscripción.
4. **Fase 4 (Jerarquía Avanzada)**: Dashboards consolidados para Federaciones y Ligas.

---
**Objetivo Final**: Construir una plataforma comparable a **GitHub Enterprise** o **Notion**, donde la misma infraestructura soporta desde un club barrial hasta la federación más grande del mundo.
