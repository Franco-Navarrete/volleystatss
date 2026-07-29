-- Primero, nos aseguramos de que el tipo enum app_role tenga el valor 'analyst'
-- Nota: PostgreSQL no permite eliminar valores de un enum fácilmente, pero sí agregarlos.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'analyst') THEN
        ALTER TYPE public.app_role ADD VALUE 'analyst';
    END IF;
END
$$;

-- Aseguramos que la tabla user_roles y la función has_role estén configuradas correctamente
-- Aunque ya existen, esto refuerza que los grants sean los correctos para el nuevo rol
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
