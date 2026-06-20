REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_league_access(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_create_matches(uuid) FROM anon, public;