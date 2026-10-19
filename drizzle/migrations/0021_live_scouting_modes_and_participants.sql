ALTER TABLE public.live_match_sessions ADD COLUMN scouting_mode text NOT NULL DEFAULT 'individual';
ALTER TABLE public.live_match_sessions ADD CONSTRAINT live_match_sessions_mode_check CHECK (scouting_mode IN ('individual','shared'));

CREATE TABLE public.live_match_participants (
 match_id text NOT NULL REFERENCES public.live_match_sessions(match_id),
 user_id uuid NOT NULL,
 can_record_events boolean NOT NULL DEFAULT false,
 can_edit_events boolean NOT NULL DEFAULT false,
 can_view_live_stats boolean NOT NULL DEFAULT true,
 can_create_observations boolean NOT NULL DEFAULT true,
 can_manage_match boolean NOT NULL DEFAULT false,
 assigned_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (match_id, user_id)
);
GRANT SELECT ON public.live_match_participants TO authenticated;
GRANT ALL ON public.live_match_participants TO service_role;
ALTER TABLE public.live_match_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_participant_read ON public.live_match_participants FOR SELECT TO authenticated USING (public.can_read_live_match(match_id, auth.uid()));

CREATE FUNCTION public.live_match_permissions(_match text, _user uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.live_match_sessions; p public.live_match_participants;
BEGIN
 IF _user IS NULL THEN RETURN jsonb_build_object('can_record_events',false,'can_edit_events',false,'can_view_live_stats',false,'can_create_observations',false,'can_manage_match',false); END IF;
 SELECT * INTO s FROM public.live_match_sessions WHERE match_id=_match;
 IF NOT FOUND THEN RETURN jsonb_build_object('can_record_events',false,'can_edit_events',false,'can_view_live_stats',false,'can_create_observations',false,'can_manage_match',false); END IF;
 IF public.has_role(_user,'admin') THEN RETURN jsonb_build_object('can_record_events',true,'can_edit_events',true,'can_view_live_stats',true,'can_create_observations',true,'can_manage_match',true); END IF;
 IF s.scorer_id=_user THEN RETURN jsonb_build_object('can_record_events',true,'can_edit_events',true,'can_view_live_stats',true,'can_create_observations',true,'can_manage_match',true); END IF;
 SELECT * INTO p FROM public.live_match_participants WHERE match_id=_match AND user_id=_user;
 IF FOUND THEN RETURN jsonb_build_object('can_record_events',p.can_record_events,'can_edit_events',p.can_edit_events,'can_view_live_stats',p.can_view_live_stats,'can_create_observations',p.can_create_observations,'can_manage_match',p.can_manage_match); END IF;
 IF public.can_read_live_match(_match,_user) THEN RETURN jsonb_build_object('can_record_events',false,'can_edit_events',false,'can_view_live_stats',true,'can_create_observations',true,'can_manage_match',false); END IF;
 RETURN jsonb_build_object('can_record_events',false,'can_edit_events',false,'can_view_live_stats',false,'can_create_observations',false,'can_manage_match',false);
END $$;
REVOKE ALL ON FUNCTION public.live_match_permissions(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.live_match_permissions(text,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.commit_live_match(_match text,_actor uuid,_operation uuid,_expected bigint,_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.live_match_sessions; prior public.live_match_operations;
BEGIN
 SELECT * INTO s FROM public.live_match_sessions WHERE match_id=_match FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'live_write_forbidden'; END IF;
 IF s.scorer_id<>_actor AND NOT COALESCE((public.live_match_permissions(_match,_actor)->>'can_record_events')::boolean,false) THEN RAISE EXCEPTION 'live_write_forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM public.match_deletions WHERE match_id=_match) THEN RAISE EXCEPTION 'match_deleted'; END IF;
 SELECT * INTO prior FROM public.live_match_operations WHERE match_id=_match AND operation_id=_operation;
 IF FOUND THEN RETURN jsonb_build_object('version',prior.version,'updatedAt',prior.created_at,'duplicate',true); END IF;
 IF s.version<>_expected THEN RAISE EXCEPTION 'live_version_conflict'; END IF;
 IF _snapshot->'match'->>'id'<>_match OR _snapshot->'match'->>'teamAId'<>s.team_a_id OR _snapshot->'match'->>'teamBId'<>s.team_b_id THEN RAISE EXCEPTION 'invalid_match'; END IF;
 IF _snapshot->'teamA' IS DISTINCT FROM s.snapshot->'teamA' OR _snapshot->'teamB' IS DISTINCT FROM s.snapshot->'teamB' THEN RAISE EXCEPTION 'invalid_teams'; END IF;
 IF jsonb_typeof(_snapshot->'match'->'events')<>'array' THEN RAISE EXCEPTION 'invalid_events'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(_snapshot->'match'->'events') e GROUP BY e->>'id' HAVING count(*)>1 OR e->>'id' IS NULL) THEN RAISE EXCEPTION 'duplicate_event'; END IF;
 IF s.snapshot->'match'->>'status'='finished' AND _snapshot->'match'->>'status'<>'finished' THEN RAISE EXCEPTION 'finished_is_terminal'; END IF;
 INSERT INTO public.live_match_operations(match_id,operation_id,actor_id,version,before_snapshot,after_snapshot) VALUES(_match,_operation,_actor,s.version+1,s.snapshot,_snapshot);
 UPDATE public.live_match_sessions SET snapshot=_snapshot,version=s.version+1,updated_at=now() WHERE match_id=_match;
 RETURN jsonb_build_object('version',s.version+1,'updatedAt',now(),'duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.commit_live_match(text,uuid,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_live_match(text,uuid,uuid,bigint,jsonb) TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_match_participants;