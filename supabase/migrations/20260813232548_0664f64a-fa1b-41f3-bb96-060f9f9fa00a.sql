UPDATE auth.users
SET encrypted_password = crypt('VoleyEstadisticas2026', gen_salt('bf')),
    updated_at = now(),
    email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE lower(email) = 'franco.e.navarrete@gmail.com';