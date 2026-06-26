
DROP POLICY IF EXISTS "players_select" ON public.players;
DROP POLICY IF EXISTS "players_insert" ON public.players;
DROP POLICY IF EXISTS "players_update" ON public.players;
DROP POLICY IF EXISTS "players_delete" ON public.players;

CREATE POLICY "players_select" ON public.players FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = players.team_id
    AND (t.league_id IS NULL OR public.has_league_access(auth.uid(), t.league_id))
));

CREATE POLICY "players_insert" ON public.players FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_teams(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = players.team_id
      AND (t.league_id IS NULL OR public.has_league_access(auth.uid(), t.league_id))
  )
);

CREATE POLICY "players_update" ON public.players FOR UPDATE TO authenticated
USING (
  public.can_manage_teams(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = players.team_id
      AND (t.league_id IS NULL OR public.has_league_access(auth.uid(), t.league_id))
  )
)
WITH CHECK (
  public.can_manage_teams(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = players.team_id
      AND (t.league_id IS NULL OR public.has_league_access(auth.uid(), t.league_id))
  )
);

CREATE POLICY "players_delete" ON public.players FOR DELETE TO authenticated
USING (
  public.can_manage_teams(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = players.team_id
      AND (t.league_id IS NULL OR public.has_league_access(auth.uid(), t.league_id))
  )
);
