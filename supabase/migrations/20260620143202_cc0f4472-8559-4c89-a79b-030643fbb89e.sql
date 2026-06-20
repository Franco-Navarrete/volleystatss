
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_league_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_matches(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_teams(uuid) TO authenticated;
