CREATE OR REPLACE FUNCTION public.get_my_app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'anon'
    WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('entrenador','planillero','analyst'))
      OR EXISTS (SELECT 1 FROM public.teams WHERE owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.team_coaches WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.clubs WHERE owner_id = auth.uid()) THEN 'coach'
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.player_profiles WHERE user_id = auth.uid()) THEN 'player'
    ELSE 'coach'
  END
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_app_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_app_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_memberships()
RETURNS TABLE(member_id uuid, team_id uuid, team_name text, team_gender text, team_category text, team_logo_url text, club_name text, status text, number integer, "position" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, t.id, t.name, t.gender, t.category, t.logo_url, COALESCE(c.name, t.club), m.status, m.number, m.position
  FROM public.team_members m JOIN public.teams t ON t.id = m.team_id LEFT JOIN public.clubs c ON c.id = t.club_id
  WHERE m.user_id = auth.uid() AND m.status IN ('pending','active')
  ORDER BY m.joined_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_memberships() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_memberships() TO authenticated;