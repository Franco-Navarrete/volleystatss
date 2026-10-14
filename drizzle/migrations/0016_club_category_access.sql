CREATE OR REPLACE FUNCTION public.user_authorized_club_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id FROM public.clubs WHERE owner_id = _user_id
  UNION
  SELECT club_id FROM public.teams WHERE owner_id = _user_id AND club_id IS NOT NULL
    AND public.has_role(_user_id, 'entrenador'::public.app_role)
  UNION
  SELECT t.club_id FROM public.team_coaches tc JOIN public.teams t ON t.id = tc.team_id
    WHERE tc.user_id = _user_id AND t.club_id IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.user_authorized_club_ids(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_authorized_club_ids(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_manage_assigned_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.team_coaches WHERE team_id = _team_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = _team_id AND t.club_id IS NOT NULL
        AND t.club_id IN (SELECT public.user_authorized_club_ids(_user_id))
    )
$$;

CREATE POLICY "Club coaches read teams" ON public.teams FOR SELECT TO authenticated
  USING (public.can_manage_assigned_team(auth.uid(), id));
CREATE POLICY "Club coaches update teams" ON public.teams FOR UPDATE TO authenticated
  USING (public.can_manage_assigned_team(auth.uid(), id))
  WITH CHECK (public.can_manage_assigned_team(auth.uid(), id));

DROP POLICY IF EXISTS teams_insert ON public.teams;
CREATE POLICY teams_insert ON public.teams FOR INSERT TO authenticated
  WITH CHECK (
    public.can_create_team(auth.uid()) AND owner_id = auth.uid()
    AND (club_id IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role)
         OR club_id IN (SELECT public.user_authorized_club_ids(auth.uid())))
  );