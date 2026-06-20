
-- ============ Helper: can_manage_teams ============
CREATE OR REPLACE FUNCTION public.can_manage_teams(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
     OR COALESCE((SELECT can_manage_teams FROM public.user_permissions WHERE user_id = _user_id), false)
$$;

-- ============ teams ============
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  logo_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX teams_league_id_idx ON public.teams(league_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select" ON public.teams FOR SELECT TO authenticated
  USING (public.has_league_access(auth.uid(), league_id));
CREATE POLICY "teams_insert" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (public.has_league_access(auth.uid(), league_id) AND public.can_manage_teams(auth.uid()));
CREATE POLICY "teams_update" ON public.teams FOR UPDATE TO authenticated
  USING (public.has_league_access(auth.uid(), league_id) AND public.can_manage_teams(auth.uid()))
  WITH CHECK (public.has_league_access(auth.uid(), league_id) AND public.can_manage_teams(auth.uid()));
CREATE POLICY "teams_delete" ON public.teams FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER teams_touch_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ players ============
CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  number int NOT NULL,
  position text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX players_team_id_idx ON public.players(team_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_select" ON public.players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.has_league_access(auth.uid(), t.league_id)));
CREATE POLICY "players_insert" ON public.players FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.has_league_access(auth.uid(), t.league_id)) AND public.can_manage_teams(auth.uid()));
CREATE POLICY "players_update" ON public.players FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.has_league_access(auth.uid(), t.league_id)) AND public.can_manage_teams(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.has_league_access(auth.uid(), t.league_id)) AND public.can_manage_teams(auth.uid()));
CREATE POLICY "players_delete" ON public.players FOR DELETE TO authenticated
  USING (public.can_manage_teams(auth.uid()) AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id AND public.has_league_access(auth.uid(), t.league_id)));
CREATE TRIGGER players_touch_updated_at BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ matches ============
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  team_a_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  team_b_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finished')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sets_to_win int NOT NULL DEFAULT 3,
  points_per_set int NOT NULL DEFAULT 25,
  initial_serving_side text NOT NULL DEFAULT 'A' CHECK (initial_serving_side IN ('A','B')),
  captain_a_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  captain_b_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  libero_a1_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  libero_a2_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  libero_b1_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  libero_b2_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  sides_flipped boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matches_league_id_idx ON public.matches(league_id);
CREATE INDEX matches_scheduled_at_idx ON public.matches(scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_select" ON public.matches FOR SELECT TO authenticated
  USING (public.has_league_access(auth.uid(), league_id));
CREATE POLICY "matches_insert" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (public.has_league_access(auth.uid(), league_id) AND public.can_create_matches(auth.uid()));
CREATE POLICY "matches_update" ON public.matches FOR UPDATE TO authenticated
  USING (public.has_league_access(auth.uid(), league_id) AND public.can_create_matches(auth.uid()))
  WITH CHECK (public.has_league_access(auth.uid(), league_id) AND public.can_create_matches(auth.uid()));
CREATE POLICY "matches_delete" ON public.matches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER matches_touch_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ match_sets ============
CREATE TABLE public.match_sets (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  number int NOT NULL,
  score_a int NOT NULL DEFAULT 0,
  score_b int NOT NULL DEFAULT 0,
  finished boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_sets TO authenticated;
GRANT ALL ON public.match_sets TO service_role;
ALTER TABLE public.match_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_sets_select" ON public.match_sets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id)));
CREATE POLICY "match_sets_write" ON public.match_sets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id) AND public.can_create_matches(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id) AND public.can_create_matches(auth.uid())));
CREATE TRIGGER match_sets_touch_updated_at BEFORE UPDATE ON public.match_sets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ match_events ============
CREATE TABLE public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX match_events_match_idx ON public.match_events(match_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_events_select" ON public.match_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id)));
CREATE POLICY "match_events_insert" ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id) AND public.can_create_matches(auth.uid())));
CREATE POLICY "match_events_delete" ON public.match_events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id) AND public.can_create_matches(auth.uid())));

-- ============ match_lineups ============
CREATE TABLE public.match_lineups (
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  set_number int NOT NULL,
  side text NOT NULL CHECK (side IN ('A','B')),
  lineup uuid[] NOT NULL DEFAULT '{}',
  confirmed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, set_number, side)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_lineups TO authenticated;
GRANT ALL ON public.match_lineups TO service_role;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_lineups_select" ON public.match_lineups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id)));
CREATE POLICY "match_lineups_write" ON public.match_lineups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id) AND public.can_create_matches(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.has_league_access(auth.uid(), m.league_id) AND public.can_create_matches(auth.uid())));
CREATE TRIGGER match_lineups_touch_updated_at BEFORE UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
