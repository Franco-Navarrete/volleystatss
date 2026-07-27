# Propuesta Técnica: RALLY SaaS Multi-tenant

Esta propuesta detalla la evolución de VolleyStatss hacia una arquitectura de plataforma SaaS de clase mundial, permitiendo escalabilidad masiva para clubes, ligas y federaciones.

## 1. Arquitectura General
El sistema transiciona de un modelo centrado en el usuario a uno centrado en el **Workspace**. 
- **Estructura jerárquica**: Workspace (Tenant) > Usuarios > Roles > Permisos.
- **Frontend**: El `workspace_id` se convierte en el parámetro de contexto global (vía URL o header).
- **Backend**: Implementación de Row Level Security (RLS) basado en `workspace_id` en todas las tablas transaccionales.

## 2. Modelo de Datos (Nuevas Entidades)
```sql
-- Tabla principal de organización
CREATE TABLE public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL, -- Para URLs personalizadas (ej: club-independiente.rally.app)
    logo_url text,
    type text CHECK (type IN ('club', 'league', 'federation', 'academy')),
    owner_id uuid REFERENCES auth.users(id),
    settings jsonb DEFAULT '{}',
    subscription_id uuid, -- Relación con el plan contratado
    created_at timestamptz DEFAULT now()
);

-- Relación N:N entre Usuarios y Workspaces (un usuario, múltiples contextos)
CREATE TABLE public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES public.workspace_roles(id), -- Rol específico en este workspace
    joined_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

-- Roles personalizados por Workspace
CREATE TABLE public.workspace_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id), -- NULL para roles globales por defecto
    name text NOT NULL,
    permissions text[] DEFAULT '{}', -- Array de keys de permisos (ej: ['manage_teams', 'view_scout'])
    created_at timestamptz DEFAULT now()
);
```

## 3. Arquitectura Multi-tenant
- **Aislamiento**: Cada tabla (teams, matches, players) recibirá una columna `workspace_id`.
- **Seguridad**: Las políticas de RLS de Supabase se actualizarán para permitir acceso solo si `auth.uid()` existe en `workspace_members` para el `workspace_id` de la fila.
- **Contexto dinámico**: El `useWorkspace()` hook proveerá el ID actual en toda la App.

## 4. Arquitectura de Permisos
- **Permission Service**: Un servicio centralizado en `src/lib/permissions.ts` que evalúa:
  `hasPermission(workspaceId, permissionKey)`.
- **Desacoplamiento**: Los componentes solo preguntan por el permiso, no por el rol.

## 5. Arquitectura de Módulos y Suscripciones
- **Activación por Workspace**: Los módulos definidos en `rally-modules.ts` se habilitarán/deshabilitarán según el `plan` del Workspace.
- **Guardas de Módulos**: 
  - Routing: Filtro en los loaders de TanStack Router.
  - UI: Componente `<ModuleGate id="scout_pro">...</ModuleGate>`.

## 6. Flujo de Cambio de Workspace
1. **Selector**: Ubicado en el Sidebar (estilo Slack/Linear).
2. **Acción**: Al cambiar, se actualiza el `current_workspace_id` en el `localStorage` (o URL) y se refresca el cache de TanStack Query.
3. **Persistencia**: La preferencia de último workspace visitado se guarda por usuario.

## 7. Mapa de Navegación
- `/` (Home Pública / Landing)
- `/_authenticated` (Layout común con Sidebar y Selector)
- `/_authenticated/:workspaceSlug/dashboard`
- `/_authenticated/:workspaceSlug/scout`
- `/_authenticated/:workspaceSlug/video`

## 8. Riesgos y Estrategia de Migración (Enfoque Conservador)
- **Fase 1**: Crear tablas `workspaces` y `workspace_members`. 
- **Fase 2**: Crear un "Default Workspace" para todos los usuarios actuales y migrar sus datos existentes (teams, matches) a este workspace.
- **Fase 3**: Habilitar el selector y la creación de nuevos Workspaces.
- **Cero Downtime**: El código actual seguirá funcionando asumiendo el primer workspace disponible si no hay uno seleccionado.

## 9. Roadmap
1. **Semana 1**: Infraestructura Core (Tablas y Contexto).
2. **Semana 2**: Migración de datos existentes a Workspace por defecto.
3. **Semana 3**: Implementación de Permission Service y Gate de Módulos.
4. **Semana 4**: UI del Selector de Workspace y Branding dinámico.
