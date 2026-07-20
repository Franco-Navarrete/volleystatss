CREATE POLICY "Admins view all intelligence reports"
  ON public.intelligence_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete all intelligence reports"
  ON public.intelligence_reports FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));