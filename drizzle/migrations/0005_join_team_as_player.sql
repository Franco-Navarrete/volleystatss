ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS players_team_user_key ON public.players(team_id, user_id) WHERE user_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_team_invitation(text);
CREATE FUNCTION public.get_team_invitation(_token text)
RETURNS TABLE(team_name text, team_gender text, team_category text, team_logo_url text, team_color text, valid boolean, already_member boolean, has_player boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT t.name, t.gender, t.category, t.logo_url, t.color,
    ((i.status = 'pending' AND i.expires_at > now()) OR (auth.uid() IS NOT NULL AND i.used_by = auth.uid())),
    (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = t.id AND m.user_id = auth.uid())),
    (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.players p WHERE p.team_id = t.id AND p.user_id = auth.uid()))
  FROM public.team_invitations i JOIN public.teams t ON t.id = i.team_id
  WHERE i.token = lower(trim(_token)) LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_team_invitation(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.join_team_as_player(_token text, _name text, _number integer, _position text, _birth_date date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE inv public.team_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para aceptar la invitación.'; END IF;
  SELECT * INTO inv FROM public.team_invitations WHERE token = lower(trim(_token)) FOR UPDATE;
  IF inv.id IS NULL OR NOT ((inv.status = 'pending' AND inv.expires_at > now()) OR inv.used_by = auth.uid()) THEN
    RAISE EXCEPTION 'Esta invitación ya no es válida.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE team_id = inv.team_id AND user_id = auth.uid()) THEN
    RETURN 'already_member';
  END IF;
  IF length(trim(_name)) < 2 OR length(trim(_name)) > 80 THEN RAISE EXCEPTION 'Ingresá un nombre válido.'; END IF;
  IF _number < 0 OR _number > 99 THEN RAISE EXCEPTION 'El número debe estar entre 0 y 99.'; END IF;
  IF _position NOT IN ('punta','central','opuesto','armador','libero','universal') THEN RAISE EXCEPTION 'Seleccioná una posición válida.'; END IF;
  IF _birth_date IS NULL OR _birth_date > current_date OR _birth_date < current_date - interval '100 years' THEN RAISE EXCEPTION 'Ingresá una fecha de nacimiento válida.'; END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE team_id = inv.team_id AND number = _number) THEN
    RAISE EXCEPTION 'Ese número de camiseta ya está ocupado en el equipo.';
  END IF;
  INSERT INTO public.team_members (user_id, team_id) VALUES (auth.uid(), inv.team_id) ON CONFLICT (user_id, team_id) DO NOTHING;
  INSERT INTO public.players (team_id, name, number, position, birth_date, user_id)
    VALUES (inv.team_id, trim(_name), _number, _position, _birth_date, auth.uid());
  UPDATE public.team_invitations SET status = 'used', used_at = COALESCE(used_at, now()), used_by = auth.uid() WHERE id = inv.id;
  RETURN 'joined';
END $$;
REVOKE EXECUTE ON FUNCTION public.join_team_as_player(text,text,integer,text,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_team_as_player(text,text,integer,text,date) TO authenticated, service_role;