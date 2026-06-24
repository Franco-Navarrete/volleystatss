
CREATE TABLE public.admin_user_passwords (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT ALL ON public.admin_user_passwords TO service_role;

ALTER TABLE public.admin_user_passwords ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver/modificar; el acceso real ocurre desde server functions con service_role.
CREATE POLICY "Admins can view stored passwords"
ON public.admin_user_passwords FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
