
-- ============ CLUBS TABLE ============
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  city text,
  province text,
  country text,
  primary_color text,
  secondary_color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clubs_owner_unique ON public.clubs(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs_select_all_auth" ON public.clubs;
CREATE POLICY "clubs_select_all_auth" ON public.clubs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clubs_insert_owner" ON public.clubs;
CREATE POLICY "clubs_insert_owner" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'entrenador'::app_role))
  );

DROP POLICY IF EXISTS "clubs_update_owner" ON public.clubs;
CREATE POLICY "clubs_update_owner" ON public.clubs
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "clubs_delete_owner" ON public.clubs;
CREATE POLICY "clubs_delete_owner" ON public.clubs
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_clubs_touch_updated_at ON public.clubs;
CREATE TRIGGER trg_clubs_touch_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TEAMS.club_id ============
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS teams_club_id_idx ON public.teams(club_id);

-- Backfill: crear un club por cada owner_id que hoy tiene equipos, y setear club_id
DO $$
DECLARE
  r RECORD;
  v_club_id uuid;
  v_club_name text;
BEGIN
  FOR r IN
    SELECT DISTINCT owner_id
    FROM public.teams
    WHERE owner_id IS NOT NULL
      AND club_id IS NULL
  LOOP
    -- Elegir nombre del club: valor más frecuente en teams.club para ese owner, o "Mi Club"
    SELECT COALESCE(NULLIF(mode() WITHIN GROUP (ORDER BY club), ''), 'Mi Club')
      INTO v_club_name
      FROM public.teams
      WHERE owner_id = r.owner_id;

    -- Reusar club existente del owner si ya lo tiene
    SELECT id INTO v_club_id FROM public.clubs WHERE owner_id = r.owner_id LIMIT 1;
    IF v_club_id IS NULL THEN
      INSERT INTO public.clubs (owner_id, name)
      VALUES (r.owner_id, v_club_name)
      RETURNING id INTO v_club_id;
    END IF;

    UPDATE public.teams SET club_id = v_club_id
      WHERE owner_id = r.owner_id AND club_id IS NULL;
  END LOOP;
END $$;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.get_user_club(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clubs WHERE owner_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_create_player(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'entrenador'::app_role)
$$;

-- ============ PLAYERS RLS (owner-scoped writes) ============
DROP POLICY IF EXISTS "players_insert_owner" ON public.players;
CREATE POLICY "players_insert_owner" ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = players.team_id AND t.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "players_update_owner" ON public.players;
CREATE POLICY "players_update_owner" ON public.players
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = players.team_id AND t.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = players.team_id AND t.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "players_delete_owner" ON public.players;
CREATE POLICY "players_delete_owner" ON public.players
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id = players.team_id AND t.owner_id = auth.uid())
  );
