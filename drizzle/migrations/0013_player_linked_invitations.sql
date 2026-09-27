ALTER TABLE public.team_invitations ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.players(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS team_invitations_player_id_idx ON public.team_invitations(player_id);

CREATE OR REPLACE FUNCTION public.validate_invitation_player()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.player_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = NEW.player_id AND team_id = NEW.team_id) THEN
      RAISE EXCEPTION 'La jugadora no pertenece a este equipo.';
    END IF;
    NEW.multi_use := false;
    NEW.intended_role := 'player';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_invitation_player ON public.team_invitations;
CREATE TRIGGER trg_validate_invitation_player BEFORE INSERT OR UPDATE ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.validate_invitation_player();

CREATE OR REPLACE FUNCTION public.get_invitation_player(_token text)
RETURNS TABLE(player_name text, player_number integer, player_position text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.name, p.number, p.position FROM public.team_invitations i
  JOIN public.players p ON p.id = i.player_id
  WHERE i.token = lower(trim(_token)) AND i.status <> 'revoked' AND i.expires_at > now() LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_invitation_player(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_team_membership(_token text, _first text, _last text, _number integer, _position text, _photo text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE inv public.team_invitations%ROWTYPE; existing text; club uuid; pl public.players%ROWTYPE;
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
  SELECT club_id INTO club FROM public.teams WHERE id = inv.team_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'player'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.player_profiles (user_id, first_name, last_name, photo_url)
    VALUES (auth.uid(), trim(_first), trim(_last), NULLIF(_photo,''))
    ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
      photo_url = COALESCE(EXCLUDED.photo_url, public.player_profiles.photo_url);

  -- Invitation tied to an existing roster player: claim it (never create a new player).
  IF inv.player_id IS NOT NULL THEN
    SELECT * INTO pl FROM public.players WHERE id = inv.player_id FOR UPDATE;
    IF pl.id IS NULL THEN RAISE EXCEPTION 'Esta invitación ya no es válida.'; END IF;
    IF pl.user_id IS NOT NULL AND pl.user_id <> auth.uid() THEN RAISE EXCEPTION 'Esta jugadora ya tiene una cuenta vinculada.'; END IF;
    UPDATE public.players SET user_id = auth.uid(), photo_url = COALESCE(photo_url, NULLIF(_photo,'')), updated_at = now() WHERE id = pl.id;
    INSERT INTO public.team_members (user_id, team_id, club_id, role, status, number, position, player_id)
      VALUES (auth.uid(), inv.team_id, club, 'player', 'active', pl.number, pl.position, pl.id)
      ON CONFLICT (user_id, team_id) DO UPDATE SET status = 'active', player_id = EXCLUDED.player_id, number = EXCLUDED.number, position = EXCLUDED.position;
    UPDATE public.team_invitations SET status = 'used', used_at = COALESCE(used_at, now()), used_by = auth.uid() WHERE id = inv.id;
    RETURN 'linked';
  END IF;

  SELECT status INTO existing FROM public.team_members WHERE team_id = inv.team_id AND user_id = auth.uid();
  IF existing = 'active' THEN RETURN 'already_member'; END IF;
  IF existing = 'pending' THEN RETURN 'pending'; END IF;
  IF _number IS NOT NULL AND EXISTS (SELECT 1 FROM public.players WHERE team_id = inv.team_id AND number = _number) THEN
    RAISE EXCEPTION 'Ese número de camiseta ya está ocupado en el equipo.';
  END IF;
  INSERT INTO public.team_members (user_id, team_id, club_id, role, status, number, position)
    VALUES (auth.uid(), inv.team_id, club, 'player', 'pending', _number, _position)
    ON CONFLICT (user_id, team_id) DO UPDATE SET status = 'pending', number = EXCLUDED.number, position = EXCLUDED.position;
  IF NOT inv.multi_use THEN
    UPDATE public.team_invitations SET status = 'used', used_at = COALESCE(used_at, now()), used_by = auth.uid() WHERE id = inv.id;
  END IF;
  RETURN 'pending';
END $function$;