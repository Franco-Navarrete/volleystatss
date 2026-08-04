-- 1. Eliminar la tabla admin_user_passwords (EXPOSED_SENSITIVE_DATA)
DROP TABLE IF EXISTS public.admin_user_passwords;

-- 2. Eliminar la política insegura de app_state (PUBLIC_USER_DATA)
DROP POLICY IF EXISTS "Public can view admin state" ON public.app_state;
REVOKE SELECT ON public.app_state FROM anon;

-- 3. Corregir política de match_deletion_audit (MISSING_OWNERSHIP_CHECK)
DROP POLICY IF EXISTS "Users can insert their own deletion audit" ON public.match_deletion_audit;

-- 4. Restringir ejecución de has_role (SUPA_anon_security_definer_function_executable)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
