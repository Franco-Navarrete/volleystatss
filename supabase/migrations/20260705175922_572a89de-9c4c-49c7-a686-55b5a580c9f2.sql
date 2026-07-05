DROP POLICY IF EXISTS "Admins can read all shared matches" ON public.public_matches;
CREATE POLICY "Admins can read all shared matches"
  ON public.public_matches FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all shared matches" ON public.public_matches;
CREATE POLICY "Admins can update all shared matches"
  ON public.public_matches FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete all shared matches" ON public.public_matches;
CREATE POLICY "Admins can delete all shared matches"
  ON public.public_matches FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));