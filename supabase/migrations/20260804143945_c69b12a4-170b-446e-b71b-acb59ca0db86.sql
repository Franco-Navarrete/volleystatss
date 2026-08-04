
-- Revocamos ejecución pública y anónima para todas las funciones SECURITY DEFINER críticas identificadas.
-- Esto resuelve las advertencias del linter 0028 y 0029.

-- has_role
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- has_league_access
REVOKE ALL ON FUNCTION public.has_league_access(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_league_access(uuid, uuid) TO authenticated, service_role;

-- can_create_matches
REVOKE ALL ON FUNCTION public.can_create_matches(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_create_matches(uuid) TO authenticated, service_role;

-- can_create_team
REVOKE ALL ON FUNCTION public.can_create_team(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_create_team(uuid) TO authenticated, service_role;

-- can_manage_team
REVOKE ALL ON FUNCTION public.can_manage_team(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_team(uuid, uuid) TO authenticated, service_role;

-- get_user_club
REVOKE ALL ON FUNCTION public.get_user_club(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_club(uuid) TO authenticated, service_role;

-- can_create_player
REVOKE ALL ON FUNCTION public.can_create_player(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_create_player(uuid) TO authenticated, service_role;

-- can_manage_teams
REVOKE ALL ON FUNCTION public.can_manage_teams(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_teams(uuid) TO authenticated, service_role;

-- Nota: Si el linter persiste sobre 'authenticated', es porque estas funciones son usadas en RLS.
-- El linter 0029 sugiere SECURITY INVOKER si es posible, pero para evitar recursión en RLS 
-- SECURITY DEFINER es necesario. La práctica recomendada es restringir a 'authenticated'.
