CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'jugador',
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);
GRANT SELECT, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see own memberships" ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_assigned_team(auth.uid(), team_id));
CREATE POLICY "Managers remove members" ON public.team_members FOR DELETE TO authenticated
  USING (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at timestamptz,
  used_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_invitations_team_idx ON public.team_invitations(team_id);
GRANT SELECT, INSERT, UPDATE ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read invitations" ON public.team_invitations FOR SELECT TO authenticated
  USING (public.can_manage_assigned_team(auth.uid(), team_id));
CREATE POLICY "Managers create invitations" ON public.team_invitations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.can_manage_assigned_team(auth.uid(), team_id));
CREATE POLICY "Managers update invitations" ON public.team_invitations FOR UPDATE TO authenticated
  USING (public.can_manage_assigned_team(auth.uid(), team_id));

CREATE OR REPLACE FUNCTION public.get_team_invitation(_token text)
RETURNS TABLE(team_name text, team_gender text, team_category text, team_logo_url text, team_color text, valid boolean, already_member boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.name, t.gender, t.category, t.logo_url, t.color,
    (i.status = 'pending' AND i.expires_at > now()),
    (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = t.id AND m.user_id = auth.uid()))
  FROM public.team_invitations i JOIN public.teams t ON t.id = i.team_id
  WHERE i.token = lower(trim(_token)) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.team_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para aceptar la invitación.'; END IF;
  SELECT * INTO inv FROM public.team_invitations WHERE token = lower(trim(_token)) FOR UPDATE;
  IF inv.id IS NULL OR inv.status <> 'pending' OR inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Esta invitación ya no es válida.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = inv.team_id AND user_id = auth.uid()) THEN
    RETURN 'already_member';
  END IF;
  INSERT INTO public.team_members (user_id, team_id) VALUES (auth.uid(), inv.team_id);
  UPDATE public.team_invitations SET status = 'used', used_at = now(), used_by = auth.uid() WHERE id = inv.id;
  RETURN 'joined';
END $$;

REVOKE ALL ON FUNCTION public.get_team_invitation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_team_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_invitation(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated, service_role;