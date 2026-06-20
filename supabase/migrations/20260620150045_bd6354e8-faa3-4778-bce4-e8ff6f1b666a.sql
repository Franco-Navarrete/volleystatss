
-- Allow teams to exist without belonging to a league
ALTER TABLE public.teams ALTER COLUMN league_id DROP NOT NULL;

-- Update RLS policies to handle NULL league_id
DROP POLICY IF EXISTS teams_select ON public.teams;
DROP POLICY IF EXISTS teams_insert ON public.teams;
DROP POLICY IF EXISTS teams_update ON public.teams;

CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (
    league_id IS NULL
    OR public.has_league_access(auth.uid(), league_id)
  );

CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_teams(auth.uid())
    AND (league_id IS NULL OR public.has_league_access(auth.uid(), league_id))
  );

CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_teams(auth.uid())
    AND (league_id IS NULL OR public.has_league_access(auth.uid(), league_id))
  )
  WITH CHECK (
    public.can_manage_teams(auth.uid())
    AND (league_id IS NULL OR public.has_league_access(auth.uid(), league_id))
  );
