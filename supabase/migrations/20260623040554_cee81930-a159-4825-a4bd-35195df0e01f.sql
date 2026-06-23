
-- Allow public (anonymous) read of app_state rows owned by admins.
-- This enables visitor-facing pages to render leagues / matches / teams
-- without authentication. Admins remain the only writers.

CREATE POLICY "Public can view admin state"
  ON public.app_state
  FOR SELECT
  TO anon
  USING (public.has_role(user_id, 'admin'::app_role));

-- Grant the row-level read to anon (RLS still filters which rows).
GRANT SELECT ON public.app_state TO anon;
