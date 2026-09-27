ALTER TABLE public.players ADD COLUMN IF NOT EXISTS birth_date date;

CREATE TABLE public.team_coaches (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_coaches TO authenticated;
GRANT ALL ON public.team_coaches TO service_role;
ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches read own assignments"
ON public.team_coaches FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.can_manage_team(auth.uid(), team_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins manage coach assignments"
ON public.team_coaches FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.player_registration_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_registration_links TO authenticated;
GRANT ALL ON public.player_registration_links TO service_role;
ALTER TABLE public.player_registration_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_assigned_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.team_coaches WHERE team_id = _team_id AND user_id = _user_id)
$$;

REVOKE ALL ON FUNCTION public.can_manage_assigned_team(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_assigned_team(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Team managers read registration links"
ON public.player_registration_links FOR SELECT TO authenticated
USING (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE POLICY "Team managers create registration links"
ON public.player_registration_links FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_assigned_team(auth.uid(), team_id)
  AND created_by = auth.uid()
);

CREATE POLICY "Team managers update registration links"
ON public.player_registration_links FOR UPDATE TO authenticated
USING (public.can_manage_assigned_team(auth.uid(), team_id))
WITH CHECK (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE POLICY "Team managers delete registration links"
ON public.player_registration_links FOR DELETE TO authenticated
USING (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE POLICY "Assigned coaches read teams"
ON public.teams FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.team_coaches tc
  WHERE tc.team_id = teams.id AND tc.user_id = auth.uid()
));

CREATE POLICY "Assigned coaches update teams"
ON public.teams FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.team_coaches tc
  WHERE tc.team_id = teams.id AND tc.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.team_coaches tc
  WHERE tc.team_id = teams.id AND tc.user_id = auth.uid()
));

CREATE POLICY "Assigned coaches read players"
ON public.players FOR SELECT TO authenticated
USING (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE POLICY "Assigned coaches create players"
ON public.players FOR INSERT TO authenticated
WITH CHECK (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE POLICY "Assigned coaches update players"
ON public.players FOR UPDATE TO authenticated
USING (public.can_manage_assigned_team(auth.uid(), team_id))
WITH CHECK (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE POLICY "Assigned coaches delete players"
ON public.players FOR DELETE TO authenticated
USING (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE OR REPLACE FUNCTION public.get_player_registration_team(_token uuid)
RETURNS TABLE(team_id uuid, team_name text, team_short_name text, team_logo_url text, team_color text, club_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.short_name, t.logo_url, t.color, t.club
  FROM public.player_registration_links l
  JOIN public.teams t ON t.id = l.team_id
  WHERE l.token = _token AND l.active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.submit_player_registration(
  _token uuid,
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
  WHERE token = _token AND active = true;

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

REVOKE ALL ON FUNCTION public.get_player_registration_team(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_player_registration(uuid, text, integer, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_registration_team(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_player_registration(uuid, text, integer, text, date) TO anon, authenticated, service_role;

CREATE TRIGGER player_registration_links_touch_updated_at
BEFORE UPDATE ON public.player_registration_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();