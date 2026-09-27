ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS alias text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS dominant_hand text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS show_stats boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_club boolean NOT NULL DEFAULT true;
ALTER TABLE public.player_profiles ADD CONSTRAINT player_profiles_visibility_chk CHECK (visibility IN ('private','public'));
ALTER TABLE public.player_profiles ADD CONSTRAINT player_profiles_alias_chk CHECK (alias IS NULL OR alias ~ '^[a-z0-9-]{3,40}$');
ALTER TABLE public.player_profiles ADD CONSTRAINT player_profiles_hand_chk CHECK (dominant_hand IS NULL OR dominant_hand IN ('derecha','izquierda','ambas'));
ALTER TABLE public.player_profiles ADD CONSTRAINT player_profiles_height_chk CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 250);
CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_alias_key ON public.player_profiles (alias);

CREATE OR REPLACE FUNCTION public.review_team_membership_link(_member_id uuid, _player_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m public.team_members%ROWTYPE; p public.players%ROWTYPE;
BEGIN
  SELECT * INTO m FROM public.team_members WHERE id = _member_id FOR UPDATE;
  IF m.id IS NULL OR NOT public.can_manage_assigned_team(auth.uid(), m.team_id) THEN RAISE EXCEPTION 'No tenés permiso para esta solicitud.'; END IF;
  SELECT * INTO p FROM public.players WHERE id = _player_id FOR UPDATE;
  IF p.id IS NULL OR p.team_id <> m.team_id THEN RAISE EXCEPTION 'La jugadora no pertenece a esta categoría.'; END IF;
  IF p.user_id IS NOT NULL AND p.user_id <> m.user_id THEN RAISE EXCEPTION 'Esa jugadora ya está vinculada a otra cuenta.'; END IF;
  UPDATE public.players SET user_id = m.user_id WHERE id = p.id;
  UPDATE public.team_members SET status = 'active', player_id = p.id, joined_at = now(), number = p.number, position = p.position WHERE id = m.id;
  RETURN 'active';
END $$;

CREATE OR REPLACE FUNCTION public.unlink_player_account(_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.players%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.players WHERE id = _player_id FOR UPDATE;
  IF p.id IS NULL OR NOT public.can_manage_assigned_team(auth.uid(), p.team_id) THEN RAISE EXCEPTION 'No tenés permiso.'; END IF;
  UPDATE public.team_members SET player_id = NULL, status = 'pending' WHERE player_id = p.id;
  UPDATE public.players SET user_id = NULL WHERE id = p.id;
END $$;

REVOKE ALL ON FUNCTION public.review_team_membership_link(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unlink_player_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_team_membership_link(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlink_player_account(uuid) TO authenticated, service_role;