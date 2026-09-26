CREATE TABLE public.match_deletions (
  match_id text PRIMARY KEY,
  deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.match_deletions TO authenticated;
GRANT ALL ON public.match_deletions TO service_role;

ALTER TABLE public.match_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read match deletions"
  ON public.match_deletions
  FOR SELECT
  TO authenticated
  USING (true);