CREATE POLICY leagues_select_for_assigned_teams ON public.leagues
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.league_id = leagues.id
    AND (t.owner_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.user_id = auth.uid()))
));