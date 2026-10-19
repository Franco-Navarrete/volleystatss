CREATE TABLE public.live_match_sessions (
 match_id text PRIMARY KEY, scorer_id uuid NOT NULL, team_a_id text NOT NULL, team_b_id text NOT NULL,
 snapshot jsonb NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_match_sessions TO authenticated;
GRANT ALL ON public.live_match_sessions TO service_role;
ALTER TABLE public.live_match_sessions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.can_read_live_match(_match text, _user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user IS NOT NULL AND (_user = auth.uid() OR auth.role() = 'service_role') AND EXISTS (
 SELECT 1 FROM public.live_match_sessions s WHERE s.match_id=_match AND (
 s.scorer_id=_user OR public.has_role(_user,'admin') OR EXISTS (
 SELECT 1 FROM public.teams t WHERE t.id::text IN (s.team_a_id,s.team_b_id) AND
 (t.owner_id=_user OR EXISTS (SELECT 1 FROM public.team_coaches c WHERE c.team_id=t.id AND c.user_id=_user)))))
$$;
REVOKE ALL ON FUNCTION public.can_read_live_match(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_live_match(text,uuid) TO authenticated,service_role;
CREATE POLICY live_match_read ON public.live_match_sessions FOR SELECT TO authenticated USING (public.can_read_live_match(match_id,auth.uid()));
CREATE TABLE public.live_match_operations (
 match_id text NOT NULL REFERENCES public.live_match_sessions(match_id), operation_id uuid NOT NULL,
 actor_id uuid NOT NULL, version bigint NOT NULL, before_snapshot jsonb NOT NULL, after_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(match_id,operation_id), UNIQUE(match_id,version)
);
GRANT SELECT ON public.live_match_operations TO authenticated;
GRANT ALL ON public.live_match_operations TO service_role;
ALTER TABLE public.live_match_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_operation_admin_read ON public.live_match_operations FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.live_match_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), match_id text NOT NULL REFERENCES public.live_match_sessions(match_id),
 author_id uuid NOT NULL, body text NOT NULL, context jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'new', status_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_match_notes TO authenticated;
GRANT ALL ON public.live_match_notes TO service_role;
ALTER TABLE public.live_match_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_note_read ON public.live_match_notes FOR SELECT TO authenticated USING (public.can_read_live_match(match_id,auth.uid()));
CREATE TABLE public.live_note_status_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), note_id uuid NOT NULL REFERENCES public.live_match_notes(id),
 actor_id uuid NOT NULL, previous_status text NOT NULL, next_status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_note_status_audit TO authenticated;
GRANT ALL ON public.live_note_status_audit TO service_role;
ALTER TABLE public.live_note_status_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY live_note_audit_admin_read ON public.live_note_status_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.commit_live_match(_match text,_actor uuid,_operation uuid,_expected bigint,_snapshot jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.live_match_sessions; prior public.live_match_operations;
BEGIN
 SELECT * INTO s FROM public.live_match_sessions WHERE match_id=_match FOR UPDATE;
 IF NOT FOUND OR s.scorer_id<>_actor THEN RAISE EXCEPTION 'live_write_forbidden'; END IF;
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
CREATE FUNCTION public.set_live_note_status(_note uuid,_actor uuid,_status text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n public.live_match_notes;
BEGIN
 IF _status NOT IN ('new','read','resolved') THEN RAISE EXCEPTION 'invalid_status'; END IF;
 SELECT * INTO n FROM public.live_match_notes WHERE id=_note FOR UPDATE;
 IF NOT FOUND OR NOT public.can_read_live_match(n.match_id,_actor) THEN RAISE EXCEPTION 'forbidden'; END IF;
 INSERT INTO public.live_note_status_audit(note_id,actor_id,previous_status,next_status) VALUES(_note,_actor,n.status,_status);
 UPDATE public.live_match_notes SET status=_status,status_by=_actor,updated_at=now() WHERE id=_note;
END $$;
REVOKE ALL ON FUNCTION public.set_live_note_status(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_live_note_status(uuid,uuid,text) TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_match_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_match_notes;