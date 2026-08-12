# Plan: Implementación de Sistema de Administración Financiera Personal (SaaS)

Transformar la aplicación actual de estadísticas de vóley en un sistema integral de administración financiera personal multi-usuario, manteniendo la arquitectura SaaS jerárquica.

## Cambios Principales

### Backend (Supabase)
- **Nuevas Tablas**:
  - `accounts`: Cuentas financieras (Efectivo, Banco, etc.) con `workspace_id`.
  - `transactions`: Movimientos (Ingresos/Gastos) con categorías y recurrencia.
  - `income_categories` / `expense_categories`: Catálogos de categorías.
  - `recurring_rules`: Lógica para quincenas y gastos fijos mensuales.
  - `funds`: Sistema de sobres virtuales (Fondos).
  - `financial_goals`: Objetivos de ahorro con seguimiento de progreso.
  - `budgets`: Presupuestos por categoría y mes.
- **RLS**: Políticas estrictas para asegurar que cada usuario/workspace solo vea sus finanzas.

### Frontend (TanStack Start)
- **Refactorización de Rutas**:
  - `src/routes/index.tsx`: Rediseñar la landing page para el nuevo propósito.
  - `src/routes/_authenticated/dashboard.tsx`: Nuevo dashboard financiero con los KPIs solicitados.
  - `src/routes/_authenticated/finances/`: Grupo de rutas para Ingresos, Gastos, Presupuesto, Fondos, etc.
- **Componentes**:
  - `FinancialCard`: Tarjetas de KPI para el dashboard.
  - `TransactionForm`: Formulario unificado para ingresos/gastos.
  - `GoalProgress`: Visualización de objetivos.
  - `BudgetManager`: Herramienta de planificación mensual.
  - `FortnightlyWizard`: Asistente para distribución de quincenas.

## Detalles Técnicos
- **Multi-tenant**: Se reutilizará la lógica de `workspaces` para que cada usuario tenga su propio entorno financiero.
- **Seguridad**: RLS habilitado en todas las tablas nuevas con GRANTs para `authenticated`.
- **UI/UX**: Tailwind CSS v4 para un diseño moderno, mobile-first y responsive. Gráficos con Recharts.
- **Inteligencia Financiera**: Lógica en el frontend (y server functions si es pesado) para recomendaciones automáticas basadas en datos.

## Paso 1: Configuración de Base de Datos
Crear las tablas fundamentales y sus políticas de seguridad.

```sql
-- Ejemplo de tabla transactions
CREATE TABLE public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    amount decimal NOT NULL,
    description text,
    category_id uuid,
    transaction_date date DEFAULT CURRENT_DATE,
    type text CHECK (type IN ('income', 'expense', 'transfer')),
    is_recurring boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
```
