-- Permitir que usuarios autenticados registren eventos de auditoría de sus propias acciones
CREATE POLICY "Users can insert own audit rows"
ON public.match_deletion_audit
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());