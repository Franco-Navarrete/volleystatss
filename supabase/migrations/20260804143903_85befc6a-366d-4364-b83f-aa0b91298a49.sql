
-- Re-verificamos y forzamos la restricción de ejecución para anon en has_role
-- Aunque ya se hizo en la migración previa, el linter de seguridad puede persistir
-- si la base de datos no ha aplicado los cambios o si hay sobrecargas de tipos.

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Adicionalmente, buscamos si existe alguna otra versión de has_role con firmas similares (public.app_role vs app_role)
DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
