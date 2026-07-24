
CREATE TABLE public.live_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','finalized','error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  chunk_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  storage_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_recordings TO authenticated;
GRANT ALL ON public.live_recordings TO service_role;

ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own live recordings"
  ON public.live_recordings FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner can insert own live recordings"
  ON public.live_recordings FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update own live recordings"
  ON public.live_recordings FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner can delete own live recordings"
  ON public.live_recordings FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX live_recordings_match_id_idx ON public.live_recordings(match_id);
CREATE INDEX live_recordings_owner_id_idx ON public.live_recordings(owner_id);

CREATE TRIGGER live_recordings_touch_updated_at
  BEFORE UPDATE ON public.live_recordings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
