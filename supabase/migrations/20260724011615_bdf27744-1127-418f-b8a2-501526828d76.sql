
CREATE TABLE public.match_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('upload','url')),
  storage_path TEXT,
  external_url TEXT,
  duration_sec NUMERIC,
  sync_offset_ms INTEGER NOT NULL DEFAULT 0,
  fps NUMERIC,
  favorite BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX match_videos_match_id_idx ON public.match_videos(match_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_videos TO authenticated;
GRANT ALL ON public.match_videos TO service_role;

ALTER TABLE public.match_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_videos_select" ON public.match_videos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_videos.match_id
      AND public.has_league_access(auth.uid(), m.league_id)
  ));

CREATE POLICY "match_videos_insert" ON public.match_videos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_create_matches(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_videos.match_id
        AND public.has_league_access(auth.uid(), m.league_id)
    )
  );

CREATE POLICY "match_videos_update" ON public.match_videos
  FOR UPDATE TO authenticated
  USING (
    public.can_create_matches(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_videos.match_id
        AND public.has_league_access(auth.uid(), m.league_id)
    )
  );

CREATE POLICY "match_videos_delete" ON public.match_videos
  FOR DELETE TO authenticated
  USING (
    public.can_create_matches(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_videos.match_id
        AND public.has_league_access(auth.uid(), m.league_id)
    )
  );

CREATE TRIGGER match_videos_touch_updated_at
  BEFORE UPDATE ON public.match_videos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
