DROP POLICY IF EXISTS leagues_select_for_admin_or_member ON public.leagues;
CREATE POLICY leagues_select_for_admin_or_member ON public.leagues
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'planillero'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_league_access ula
    WHERE ula.user_id = auth.uid() AND ula.league_id = leagues.id
  )
);