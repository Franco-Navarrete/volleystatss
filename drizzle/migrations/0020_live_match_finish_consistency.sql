CREATE FUNCTION public.finish_confirmed_live_match(_match text,_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.live_match_sessions; next_snapshot jsonb;
BEGIN
 IF NOT (public.has_role(_actor,'admin') OR public.has_role(_actor,'planillero')) THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO s FROM public.live_match_sessions WHERE match_id=_match FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.match_deletions WHERE match_id=_match) THEN RAISE EXCEPTION 'match_deleted'; END IF;
 IF s.snapshot->'match'->>'status'='finished' THEN RETURN; END IF;
 next_snapshot=jsonb_set(s.snapshot,'{match,status}','"finished"'::jsonb);
 INSERT INTO public.live_match_operations(match_id,operation_id,actor_id,version,before_snapshot,after_snapshot) VALUES(_match,gen_random_uuid(),_actor,s.version+1,s.snapshot,next_snapshot);
 UPDATE public.live_match_sessions SET snapshot=next_snapshot,version=s.version+1,updated_at=now() WHERE match_id=_match;
END $$;
REVOKE ALL ON FUNCTION public.finish_confirmed_live_match(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_confirmed_live_match(text,uuid) TO service_role;
COMMENT ON FUNCTION public.live_session_terminal_sync() IS 'DEPRECATED: unused; canonical finalization uses finish_confirmed_live_match.';