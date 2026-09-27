ALTER TABLE public.player_registration_links
ADD COLUMN short_code text;

UPDATE public.player_registration_links
SET short_code = lower(substr(replace(token::text, '-', ''), 1, 8))
WHERE short_code IS NULL;

ALTER TABLE public.player_registration_links
ALTER COLUMN short_code SET DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

ALTER TABLE public.player_registration_links
ALTER COLUMN short_code SET NOT NULL;

CREATE UNIQUE INDEX player_registration_links_short_code_key
ON public.player_registration_links (short_code);

CREATE OR REPLACE FUNCTION public.get_player_registration_team(_code text)
RETURNS TABLE(team_id uuid, team_name text, team_short_name text, team_logo_url text, team_color text, club_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.short_name, t.logo_url, t.color, t.club
  FROM public.player_registration_links l
  JOIN public.teams t ON t.id = l.team_id
  WHERE (l.short_code = lower(trim(_code)) OR l.token::text = trim(_code))
    AND l.active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.submit_player_registration(
  _code text,
  _name text,
  _number integer,
  _position text,
  _birth_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_team uuid;
  new_player uuid;
BEGIN
  SELECT team_id INTO target_team
  FROM public.player_registration_links
  WHERE (short_code = lower(trim(_code)) OR token::text = trim(_code))
    AND active = true;

  IF target_team IS NULL THEN
    RAISE EXCEPTION 'El enlace no es válido o fue desactivado.';
  END IF;
  IF length(trim(_name)) < 2 OR length(trim(_name)) > 80 THEN
    RAISE EXCEPTION 'Ingresá un nombre válido.';
  END IF;
  IF _number < 0 OR _number > 99 THEN
    RAISE EXCEPTION 'El número debe estar entre 0 y 99.';
  END IF;
  IF _position NOT IN ('punta', 'central', 'opuesto', 'armador', 'libero', 'universal') THEN
    RAISE EXCEPTION 'Seleccioná una posición válida.';
  END IF;
  IF _birth_date > current_date OR _birth_date < current_date - interval '100 years' THEN
    RAISE EXCEPTION 'Ingresá una fecha de nacimiento válida.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.players WHERE team_id = target_team AND number = _number) THEN
    RAISE EXCEPTION 'Ese número de camiseta ya está ocupado en el equipo.';
  END IF;

  INSERT INTO public.players (team_id, name, number, position, birth_date)
  VALUES (target_team, trim(_name), _number, _position, _birth_date)
  RETURNING id INTO new_player;

  RETURN new_player;
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_registration_team(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_player_registration(text, text, integer, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_registration_team(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_player_registration(text, text, integer, text, date) TO anon, authenticated, service_role;