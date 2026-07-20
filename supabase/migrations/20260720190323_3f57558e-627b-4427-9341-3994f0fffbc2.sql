-- Fase 1: Propietario de equipos + rol Entrenador

-- 1. Nuevas columnas en teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS club text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

-- Backfill owner_id = created_by
UPDATE public.teams SET owner_id = created_by WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Extender categoría con 'libre'
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_category_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_category_check
  CHECK (category IS NULL OR category = ANY (ARRAY['12','14','16','18','21','primera','libre']));

-- Mixto en gender
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_gender_check;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_gender_check
  CHECK (gender IS NULL OR gender = ANY (ARRAY['M','F','X']));

CREATE INDEX IF NOT EXISTS teams_owner_id_idx ON public.teams(owner_id);

-- 2. Helpers de autorización
CREATE OR REPLACE FUNCTION public.can_create_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'entrenador'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = _team_id AND t.owner_id = _user_id
      )
$$;

-- 3. RLS de teams: reemplazar
DROP POLICY IF EXISTS teams_select ON public.teams;
DROP POLICY IF EXISTS teams_insert ON public.teams;
DROP POLICY IF EXISTS teams_update ON public.teams;
DROP POLICY IF EXISTS teams_delete ON public.teams;

CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR owner_id = auth.uid()
    OR league_id IS NOT NULL
  );

CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_create_team(auth.uid())
    AND owner_id = auth.uid()
  );

CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (public.can_manage_team(auth.uid(), id))
  WITH CHECK (public.can_manage_team(auth.uid(), id));

CREATE POLICY teams_delete ON public.teams
  FOR DELETE TO authenticated
  USING (public.can_manage_team(auth.uid(), id));

-- 4. RLS de players: reemplazar por autorización basada en team owner
DROP POLICY IF EXISTS players_select ON public.players;
DROP POLICY IF EXISTS players_insert ON public.players;
DROP POLICY IF EXISTS players_update ON public.players;
DROP POLICY IF EXISTS players_delete ON public.players;

CREATE POLICY players_select ON public.players
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = players.team_id
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR t.owner_id = auth.uid()
          OR t.league_id IS NOT NULL
        )
    )
  );

CREATE POLICY players_insert ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_team(auth.uid(), team_id));

CREATE POLICY players_update ON public.players
  FOR UPDATE TO authenticated
  USING (public.can_manage_team(auth.uid(), team_id))
  WITH CHECK (public.can_manage_team(auth.uid(), team_id));

CREATE POLICY players_delete ON public.players
  FOR DELETE TO authenticated
  USING (public.can_manage_team(auth.uid(), team_id));

-- 5. Grants (idempotentes)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;