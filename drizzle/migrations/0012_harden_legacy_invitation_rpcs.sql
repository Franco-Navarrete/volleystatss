-- Las versiones anteriores de la app llamaban a estas funciones: ahora también asignan el rol de jugadora
-- y crean la membresía pendiente de aprobación, igual que request_team_membership.
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv public.team_invitations%ROWTYPE; existing text; club uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para aceptar la invitación.'; END IF;
  SELECT * INTO inv FROM public.team_invitations WHERE token = lower(trim(_token)) FOR UPDATE;
  IF inv.id IS NULL OR inv.status = 'revoked' OR inv.expires_at <= now()
     OR (inv.status = 'used' AND NOT inv.multi_use AND inv.used_by IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Esta invitación ya no es válida.';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'player'::app_role) ON CONFLICT (user_id, role) DO NOTHING;
  SELECT status INTO existing FROM public.team_members WHERE team_id = inv.team_id AND user_id = auth.uid();
  IF existing = 'active' THEN RETURN 'already_member'; END IF;
  SELECT club_id INTO club FROM public.teams WHERE id = inv.team_id;
  INSERT INTO public.team_members (user_id, team_id, club_id, role, status)
    VALUES (auth.uid(), inv.team_id, club, 'player', 'pending')
    ON CONFLICT (user_id, team_id) DO UPDATE SET status = 'pending', club_id = EXCLUDED.club_id;
  IF NOT inv.multi_use THEN
    UPDATE public.team_invitations SET status = 'used', used_at = COALESCE(used_at, now()), used_by = auth.uid() WHERE id = inv.id;
  END IF;
  RETURN 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.join_team_as_player(_token text, _name text, _number integer, _position text, _birth_date date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE first text; last text; r text;
BEGIN
  first := split_part(trim(_name), ' ', 1);
  last := nullif(trim(substr(trim(_name), length(first) + 1)), '');
  r := public.request_team_membership(_token, first, coalesce(last, '-'), _number, _position, NULL);
  UPDATE public.player_profiles SET birth_date = COALESCE(birth_date, _birth_date) WHERE user_id = auth.uid();
  RETURN r;
END $$;