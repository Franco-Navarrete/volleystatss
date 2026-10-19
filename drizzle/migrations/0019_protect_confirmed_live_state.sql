CREATE FUNCTION public.preserve_confirmed_live_matches() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF jsonb_typeof(NEW.data->'matches')='array' THEN
 NEW.data = jsonb_set(NEW.data,'{matches}',COALESCE((SELECT jsonb_agg(CASE WHEN live.snapshot IS NOT NULL THEN live.snapshot->'match' ELSE item END ORDER BY ord) FROM jsonb_array_elements(NEW.data->'matches') WITH ORDINALITY AS e(item,ord) LEFT JOIN public.live_match_sessions live ON live.match_id=item->>'id'),'[]'::jsonb));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preserve_confirmed_live_matches() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_live_state BEFORE INSERT OR UPDATE OF data ON public.app_state FOR EACH ROW EXECUTE FUNCTION public.preserve_confirmed_live_matches();
CREATE FUNCTION public.live_session_terminal_sync() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.live_match_sessions; op uuid;
BEGIN
 IF TG_TABLE_NAME='match_deletions' THEN
 RETURN NEW;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.live_session_terminal_sync() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.can_read_live_match(_match text, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user IS NOT NULL AND (_user = auth.uid() OR auth.role() = 'service_role') AND NOT EXISTS (SELECT 1 FROM public.match_deletions WHERE match_id=_match) AND EXISTS (
 SELECT 1 FROM public.live_match_sessions s WHERE s.match_id=_match AND (
 s.scorer_id=_user OR public.has_role(_user,'admin') OR EXISTS (
 SELECT 1 FROM public.teams t WHERE t.id::text IN (s.team_a_id,s.team_b_id) AND
 (t.owner_id=_user OR EXISTS (SELECT 1 FROM public.team_coaches c WHERE c.team_id=t.id AND c.user_id=_user)))))
$$;