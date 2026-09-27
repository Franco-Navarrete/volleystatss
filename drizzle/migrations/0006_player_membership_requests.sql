CREATE TABLE public.player_profiles (
  user_id uuid PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.player_profiles TO authenticated;
GRANT ALL ON public.player_profiles TO service_role;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS number integer;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE SET NULL;
ALTER TABLE public.team_invitations ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL;
ALTER TABLE public.team_invitations ADD COLUMN IF NOT EXISTS multi_use boolean NOT NULL DEFAULT true;

CREATE POLICY "Own profile read" ON public.player_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.team_members m WHERE m.user_id = player_profiles.user_id AND public.can_manage_assigned_team(auth.uid(), m.team_id)));
CREATE POLICY "Own profile insert" ON public.player_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own profile update" ON public.player_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER player_profiles_touch BEFORE UPDATE ON public.player_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.get_team_invitation_v2(_token text)
RETURNS TABLE(team_id uuid, team_name text, team_gender text, team_category text, team_logo_url text, club_name text,
  invite_state text, member_status text, has_profile boolean, first_name text, last_name text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.gender, t.category, t.logo_url, COALESCE(c.name, t.club),
    CASE WHEN i.status = 'revoked' THEN 'revoked'
         WHEN i.expires_at <= now() THEN 'expired'
         WHEN i.status = 'used' AND NOT i.multi_use AND i.used_by IS DISTINCT FROM auth.uid() THEN 'revoked'
         ELSE 'valid' END,
    (SELECT m.status FROM public.team_members m WHERE m.team_id = t.id AND m.user_id = auth.uid()),
    (p.user_id IS NOT NULL), p.first_name, p.last_name, p.photo_url
  FROM public.team_invitations i
  JOIN public.teams t ON t.id = i.team_id
  LEFT JOIN public.clubs c ON c.id = t.club_id
  LEFT JOIN public.player_profiles p ON p.user_id = auth.uid()
  WHERE i.token = lower(trim(_token)) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.request_team_membership(_token text, _first text, _last text, _number integer, _position text, _photo text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.team_invitations%ROWTYPE; existing text; club uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para continuar.'; END IF;
  SELECT * INTO inv FROM public.team_invitations WHERE token = lower(trim(_token)) FOR UPDATE;
  IF inv.id IS NULL OR inv.status = 'revoked' THEN RAISE EXCEPTION 'Esta invitación ya no es válida.'; END IF;
  IF inv.expires_at <= now() THEN RAISE EXCEPTION 'Esta invitación ha expirado.'; END IF;
  IF inv.status = 'used' AND NOT inv.multi_use AND inv.used_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Esta invitación ya no es válida.'; END IF;
  IF length(trim(_first)) < 1 OR length(trim(_first)) > 60 OR length(trim(_last)) < 1 OR length(trim(_last)) > 60 THEN RAISE EXCEPTION 'Completá nombre y apellido.'; END IF;
  IF _number IS NOT NULL AND (_number < 0 OR _number > 99) THEN RAISE EXCEPTION 'El número debe estar entre 0 y 99.'; END IF;
  IF _position IS NOT NULL AND _position NOT IN ('punta','central','opuesto','armador','libero','universal') THEN RAISE EXCEPTION 'Seleccioná una posición válida.'; END IF;
  IF _photo IS NOT NULL AND (length(_photo) > 300000 OR _photo NOT LIKE 'data:image/%') THEN RAISE EXCEPTION 'Foto inválida.'; END IF;
  SELECT status INTO existing FROM public.team_members WHERE team_id = inv.team_id AND user_id = auth.uid();
  IF existing = 'active' THEN RETURN 'already_member'; END IF;
  IF existing = 'pending' THEN RETURN 'pending'; END IF;
  IF _number IS NOT NULL AND EXISTS (SELECT 1 FROM public.players WHERE team_id = inv.team_id AND number = _number) THEN
    RAISE EXCEPTION 'Ese número de camiseta ya está ocupado en el equipo.';
  END IF;
  INSERT INTO public.player_profiles (user_id, first_name, last_name, photo_url)
    VALUES (auth.uid(), trim(_first), trim(_last), NULLIF(_photo,''))
    ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
      photo_url = COALESCE(EXCLUDED.photo_url, public.player_profiles.photo_url);
  SELECT club_id INTO club FROM public.teams WHERE id = inv.team_id;
  INSERT INTO public.team_members (user_id, team_id, club_id, role, status, number, position)
    VALUES (auth.uid(), inv.team_id, club, 'player', 'pending', _number, _position)
    ON CONFLICT (user_id, team_id) DO UPDATE SET status = 'pending', number = EXCLUDED.number, position = EXCLUDED.position;
  IF NOT inv.multi_use THEN
    UPDATE public.team_invitations SET status = 'used', used_at = COALESCE(used_at, now()), used_by = auth.uid() WHERE id = inv.id;
  END IF;
  RETURN 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.review_team_membership(_member_id uuid, _approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.team_members%ROWTYPE; pr public.player_profiles%ROWTYPE; pid uuid;
BEGIN
  SELECT * INTO m FROM public.team_members WHERE id = _member_id FOR UPDATE;
  IF m.id IS NULL OR NOT public.can_manage_assigned_team(auth.uid(), m.team_id) THEN RAISE EXCEPTION 'No tenés permiso para esta solicitud.'; END IF;
  IF NOT _approve THEN
    UPDATE public.team_members SET status = 'rejected' WHERE id = m.id;
    RETURN 'rejected';
  END IF;
  SELECT * INTO pr FROM public.player_profiles WHERE user_id = m.user_id;
  SELECT id INTO pid FROM public.players WHERE team_id = m.team_id AND user_id = m.user_id LIMIT 1;
  IF pid IS NULL THEN
    IF m.number IS NOT NULL AND EXISTS (SELECT 1 FROM public.players WHERE team_id = m.team_id AND number = m.number) THEN
      RAISE EXCEPTION 'Ese número de camiseta ya está ocupado en el equipo.';
    END IF;
    INSERT INTO public.players (team_id, name, number, position, photo_url, user_id)
      VALUES (m.team_id, trim(COALESCE(pr.first_name,'') || ' ' || COALESCE(pr.last_name,'')),
        COALESCE(m.number, (SELECT COALESCE(max(number),0)+1 FROM public.players WHERE team_id = m.team_id AND number < 99)),
        m.position, pr.photo_url, m.user_id)
      RETURNING id INTO pid;
  END IF;
  UPDATE public.team_members SET status = 'active', player_id = pid, joined_at = now() WHERE id = m.id;
  RETURN 'active';
END $$;

CREATE OR REPLACE FUNCTION public.remove_team_membership(_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.team_members%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.team_members WHERE id = _member_id;
  IF m.id IS NULL OR NOT public.can_manage_assigned_team(auth.uid(), m.team_id) THEN RAISE EXCEPTION 'No tenés permiso.'; END IF;
  IF m.player_id IS NOT NULL THEN DELETE FROM public.players WHERE id = m.player_id; END IF;
  DELETE FROM public.team_members WHERE id = m.id;
END $$;

REVOKE EXECUTE ON FUNCTION public.request_team_membership(text,text,text,integer,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.review_team_membership(uuid,boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_team_membership(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_team_invitation_v2(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_team_membership(text,text,text,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_team_membership(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_membership(uuid) TO authenticated;