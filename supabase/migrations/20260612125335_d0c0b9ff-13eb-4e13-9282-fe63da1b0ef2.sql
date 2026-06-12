
-- ============================================================
-- Fase 1: Ligas compartidas + permisos de usuario
-- ============================================================

-- 1) LEAGUES (compartidas)
CREATE TABLE public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  season text,
  color text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT ALL ON public.leagues TO service_role;

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- 2) USER_LEAGUE_ACCESS
CREATE TABLE public.user_league_access (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, league_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_league_access TO authenticated;
GRANT ALL ON public.user_league_access TO service_role;

ALTER TABLE public.user_league_access ENABLE ROW LEVEL SECURITY;

-- 3) USER_PERMISSIONS
CREATE TABLE public.user_permissions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_create_matches boolean NOT NULL DEFAULT false,
  can_manage_teams boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funciones helper (SECURITY DEFINER para evitar recursión en RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_league_access(_user_id uuid, _league_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_league_access
    WHERE user_id = _user_id AND league_id = _league_id
  ) OR public.has_role(_user_id, 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.can_create_matches(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
     OR COALESCE((SELECT can_create_matches FROM public.user_permissions WHERE user_id = _user_id), false)
$$;

-- ============================================================
-- RLS Policies
-- ============================================================

-- leagues: lectura para admin o usuarios con acceso; escritura solo admin
CREATE POLICY "leagues_select_for_admin_or_member"
  ON public.leagues FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.user_league_access ula
               WHERE ula.user_id = auth.uid() AND ula.league_id = leagues.id)
  );

CREATE POLICY "leagues_admin_insert" ON public.leagues
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "leagues_admin_update" ON public.leagues
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "leagues_admin_delete" ON public.leagues
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- user_league_access: usuarios ven su acceso propio; admin ve y modifica todo
CREATE POLICY "ula_select_own_or_admin" ON public.user_league_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ula_admin_insert" ON public.user_league_access
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ula_admin_update" ON public.user_league_access
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "ula_admin_delete" ON public.user_league_access
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- user_permissions: usuarios ven los propios; admin ve y modifica todo
CREATE POLICY "perms_select_own_or_admin" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "perms_admin_insert" ON public.user_permissions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "perms_admin_update" ON public.user_permissions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "perms_admin_delete" ON public.user_permissions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Trigger para updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER leagues_touch_updated_at BEFORE UPDATE ON public.leagues
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER perms_touch_updated_at BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
