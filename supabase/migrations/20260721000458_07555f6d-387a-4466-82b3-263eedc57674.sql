CREATE TABLE public.match_deletion_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  role text NOT NULL,
  match_id text NOT NULL,
  result text NOT NULL CHECK (result IN ('authorized','denied')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.match_deletion_audit TO authenticated;
GRANT ALL ON public.match_deletion_audit TO service_role;

ALTER TABLE public.match_deletion_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own deletion audit"
  ON public.match_deletion_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deletion audit"
  ON public.match_deletion_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX match_deletion_audit_created_idx
  ON public.match_deletion_audit (created_at DESC);