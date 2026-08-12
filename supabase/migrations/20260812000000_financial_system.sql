-- Enumeraciones para mayor claridad
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE public.account_type AS ENUM ('cash', 'bank', 'digital_wallet', 'savings', 'other');
CREATE TYPE public.recurrence_period AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'yearly');

-- Categorías de Ingresos
CREATE TABLE public.income_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    icon text,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_categories TO authenticated;
GRANT ALL ON public.income_categories TO service_role;
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their income categories" ON public.income_categories
    FOR ALL TO authenticated USING (workspace_id IS NULL OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Categorías de Gastos
CREATE TABLE public.expense_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    icon text,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their expense categories" ON public.expense_categories
    FOR ALL TO authenticated USING (workspace_id IS NULL OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Cuentas
CREATE TABLE public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    type public.account_type DEFAULT 'cash',
    balance decimal DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their accounts" ON public.accounts
    FOR ALL TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Fondos (Sobres virtuales)
CREATE TABLE public.funds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    icon text,
    target_percentage decimal, -- Para distribución de quincenas
    balance decimal DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funds TO authenticated;
GRANT ALL ON public.funds TO service_role;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their funds" ON public.funds
    FOR ALL TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Transacciones
CREATE TABLE public.transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
    fund_id uuid REFERENCES public.funds(id) ON DELETE SET NULL,
    income_category_id uuid REFERENCES public.income_categories(id),
    expense_category_id uuid REFERENCES public.expense_categories(id),
    amount decimal NOT NULL,
    description text,
    transaction_date date DEFAULT CURRENT_DATE,
    type public.transaction_type NOT NULL,
    is_recurring boolean DEFAULT false,
    recurrence_rule_id uuid, -- Enlace a futuras reglas
    created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their transactions" ON public.transactions
    FOR ALL TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Objetivos Financieros
CREATE TABLE public.financial_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    target_amount decimal NOT NULL,
    current_amount decimal DEFAULT 0,
    deadline date,
    priority integer DEFAULT 1,
    created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_goals TO authenticated;
GRANT ALL ON public.financial_goals TO service_role;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their goals" ON public.financial_goals
    FOR ALL TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Presupuestos
CREATE TABLE public.budgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
    month date NOT NULL, -- Primer día del mes
    total_budget decimal NOT NULL,
    savings_goal decimal DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(workspace_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their budgets" ON public.budgets
    FOR ALL TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- Datos de Ejemplo (Seed)
INSERT INTO public.income_categories (name, icon, is_default) VALUES
('Sueldo', 'briefcase'),
('Vóley', 'volleyball'),
('Freelance', 'code'),
('Streaming', 'video'),
('Ventas', 'shopping-cart'),
('Extra', 'plus-circle'),
('Otros', 'more-horizontal');

INSERT INTO public.expense_categories (name, icon, is_default) VALUES
('Fijos', 'lock'),
('Medicamentos', 'pill'),
('Celular', 'smartphone'),
('Internet', 'wifi'),
('Suscripciones', 'repeat'),
('Servicios', 'zap'),
('Comida', 'utensils'),
('Transporte', 'truck'),
('Salidas', 'coffee'),
('Ropa', 'shirt'),
('Entretenimiento', 'film'),
('Compras', 'shopping-bag'),
('Otros', 'more-horizontal');
