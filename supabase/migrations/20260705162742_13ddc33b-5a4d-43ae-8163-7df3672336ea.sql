CREATE OR REPLACE FUNCTION public.can_manage_teams(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id, 'admin'::app_role)
     OR public.has_role(_user_id, 'planillero'::app_role)
     OR COALESCE((SELECT can_manage_teams FROM public.user_permissions WHERE user_id = _user_id), false)
$function$;