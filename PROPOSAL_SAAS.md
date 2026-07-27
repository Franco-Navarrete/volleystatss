# Propuesta Técnica Evolutiva: RALLY Enterprise SaaS & Ecosistema Jerárquico

Esta propuesta detalla la transformación de VolleyStatss en una plataforma SaaS de clase mundial, diseñada para gestionar la complejidad de organizaciones deportivas desde el nivel internacional hasta el jugador individual, utilizando una arquitectura multi-tenant jerárquica.

## 1. Arquitectura General: "The Tree of Volleyball"
La arquitectura se basa en un **Grafo Acíclico Dirigido (DAG)** de organizaciones, donde cada nodo es un **Workspace**.
- **Multi-tenancy Jerárquico**: A diferencia de un SaaS plano (como Slack), RALLY permite que un Workspace sea "hijo" de otro.
- **Aislamiento de Datos**: Cada entidad (partido, video, estadística) pertenece a un Workspace específico.
- **Herencia Ascendente**: Los padres tienen visibilidad (read-only o gestionada) sobre los datos de sus hijos.

## 2. Modelo de Datos Extendido
```sql
-- Definición de Niveles y Tipos
CREATE TYPE public.organization_level AS ENUM (
    'international_federation', 
    'national_federation', 
    'regional_federation', 
    'association', 
    'league', 
    'club', 
    'academy', 
    'team'
);

-- Tabla de Workspaces con Jerarquía
CREATE TABLE public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid REFERENCES public.workspaces(id), -- Referencia al padre
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    level organization_level NOT NULL,
    settings jsonb DEFAULT '{
        "branding": {"primary_color": "#3B82F6", "logo_url": null},
        "localization": {"timezone": "UTC", "language": "es"}
    }',
    subscription_plan text DEFAULT 'public', -- 'public', 'coach', 'club', 'league', 'federation'
    modules_enabled text[] DEFAULT '{"public_portal"}',
    owner_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Membresía y Roles Contextuales
CREATE TABLE public.workspace_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id uuid REFERENCES public.workspace_roles(id),
    status text DEFAULT 'active',
    UNIQUE(workspace_id, user_id)
);
```

## 3. Sistema de Permisos y Roles (Enterprise Grade)
- **Roles por Nivel**: Los roles disponibles en una 'Federación' son distintos a los de un 'Club'.
- **Permission Service Centralizado**: 
  - `check(userId, workspaceId, permission)`
  - Evalúa permisos locales + permisos heredados (si aplica).
- **Herencia de Permisos**: Configurable por el administrador del Workspace superior (ej: "Permitir a la Federación Nacional editar calendarios de la Liga Regional").

## 4. Arquitectura de Módulos (Modular SaaS)
Los módulos se activan dinámicamente:
- **VolleyStatss Live**: Gestión de partidos en tiempo real.
- **VolleyStatss Scout/Video**: Análisis técnico avanzado.
- **VolleyStatss AI**: Generación de insights automáticos.
- **Implementación**: Un middleware de rutas en TanStack Router bloquea el acceso a módulos no contratados por el Workspace actual.

## 5. Flujo de Usuario y Selector de Workspace
- **Single Sign-On (SSO)**: Una cuenta, múltiples identidades organizacionales.
- **Selector Contextual**: Inspirado en Linear/Slack. Al cambiar de Workspace:
  1. Se actualiza el `currentWorkspace` en el store global.
  2. Se aplica el `branding` (colores/logos) del nuevo workspace.
  3. Se filtran las queries de datos automáticamente por el nuevo `workspace_id`.

## 6. Estrategia de Migración (Fases)
### Fase 1: Cimientos (Current Turn)
- Creación de tablas de `workspaces` y `organization_levels`.
- Script de migración inicial: Cada usuario actual recibe un Workspace tipo 'Club' (o 'Coach') por defecto.
- Asignación de `workspace_id` a todas las filas de `teams`, `matches`, `players`.

### Fase 2: Contextualización UI
- Implementación del `WorkspaceProvider` en React.
- Rediseño del Sidebar para incluir el selector.
- Aplicación de RLS estricto en la base de datos.

### Fase 3: Jerarquía y Consolidación
- Implementación de la lógica `parent_id`.
- Desarrollo de dashboards consolidados para niveles superiores (Federaciones).

## 7. Riesgos Técnicos
- **Complejidad de RLS**: Las políticas que comprueban herencia jerárquica pueden ser pesadas; se usarán funciones `SECURITY DEFINER` optimizadas.
- **Consistencia**: Asegurar que al mover un Club de una Liga a otra, los datos se mantengan coherentes.

---
**Design Principle Check**: ¿Permitiría esto administrar una federación nacional con miles de jugadores?
**Respuesta**: SÍ. La estructura jerárquica indexada permite consultas recursivas eficientes y aislamiento total de datos entre ramas del árbol.
