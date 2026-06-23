CREATE TABLE public.public_matches (
  id text PRIMARY KEY,
  match_id text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, match_id)
);

GRANT SELECT ON public.public_matches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_matches TO authenticated;
GRANT ALL ON public.public_matches TO service_role;

ALTER TABLE public.public_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared matches"
  ON public.public_matches FOR SELECT TO anon
  USING (is_public = true);

CREATE POLICY "Authenticated can read own shared matches"
  ON public.public_matches FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_public = true);

CREATE POLICY "Owner can insert own shares"
  ON public.public_matches FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update own shares"
  ON public.public_matches FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can delete own shares"
  ON public.public_matches FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER public_matches_touch_updated_at
  BEFORE UPDATE ON public.public_matches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX public_matches_owner_match_idx ON public.public_matches (owner_id, match_id);