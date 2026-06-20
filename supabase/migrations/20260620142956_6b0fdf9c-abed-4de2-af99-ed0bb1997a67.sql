
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_league_access(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_create_matches(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_teams(uuid) FROM anon, authenticated, public;
