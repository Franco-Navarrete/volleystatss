
CREATE TABLE public.intelligence_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  scope_ref TEXT,
  title TEXT NOT NULL,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_md TEXT NOT NULL DEFAULT '',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX intelligence_reports_user_created_idx ON public.intelligence_reports (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intelligence_reports TO authenticated;
GRANT ALL ON public.intelligence_reports TO service_role;
ALTER TABLE public.intelligence_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own intelligence reports"
  ON public.intelligence_reports FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_intelligence_reports
  BEFORE UPDATE ON public.intelligence_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
