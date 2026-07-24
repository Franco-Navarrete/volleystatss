
-- Permite leer objetos del bucket match-videos si el usuario tiene acceso a la liga del partido.
CREATE POLICY "match_videos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'match-videos'
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id::text = split_part(name, '/', 1)
        AND public.has_league_access(auth.uid(), m.league_id)
    )
  );

CREATE POLICY "match_videos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'match-videos'
    AND public.can_create_matches(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id::text = split_part(name, '/', 1)
        AND public.has_league_access(auth.uid(), m.league_id)
    )
  );

CREATE POLICY "match_videos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'match-videos'
    AND public.can_create_matches(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id::text = split_part(name, '/', 1)
        AND public.has_league_access(auth.uid(), m.league_id)
    )
  );

CREATE POLICY "match_videos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'match-videos'
    AND public.can_create_matches(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id::text = split_part(name, '/', 1)
        AND public.has_league_access(auth.uid(), m.league_id)
    )
  );
