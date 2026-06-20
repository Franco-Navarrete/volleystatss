GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_league_access(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_create_matches(uuid) TO authenticated, anon;