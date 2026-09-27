CREATE INDEX IF NOT EXISTS teams_club_id_idx ON public.teams(club_id);
CREATE INDEX IF NOT EXISTS players_team_id_idx ON public.players(team_id);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS team_coaches_user_id_idx ON public.team_coaches(user_id);

CREATE OR REPLACE FUNCTION public.admin_club_staff(_club uuid)
RETURNS TABLE(user_id uuid, team_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.owner_id, NULL::uuid FROM public.clubs c WHERE c.id = _club
  UNION SELECT t.owner_id, t.id FROM public.teams t WHERE t.club_id = _club AND t.owner_id IS NOT NULL
  UNION SELECT tc.user_id, tc.team_id FROM public.team_coaches tc JOIN public.teams t ON t.id = tc.team_id WHERE t.club_id = _club
$$;

CREATE OR REPLACE FUNCTION public.admin_club_directory(_search text, _limit int, _offset int)
RETURNS TABLE(id uuid, name text, logo_url text, city text, province text, primary_color text,
  categories bigint, players bigint, coaches bigint, planilleros bigint, pending bigint, total_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH f AS (
    SELECT c.* FROM public.clubs c
    WHERE coalesce(_search,'') = '' OR c.name ILIKE '%' || _search || '%' OR c.city ILIKE '%' || _search || '%'
  ), page AS (
    SELECT f.*, count(*) OVER () AS total_count FROM f ORDER BY f.name LIMIT least(greatest(_limit,1),100) OFFSET greatest(_offset,0)
  )
  SELECT p.id, p.name, p.logo_url, p.city, p.province, p.primary_color,
    (SELECT count(*) FROM public.teams t WHERE t.club_id = p.id),
    (SELECT count(*) FROM public.players pl JOIN public.teams t ON t.id = pl.team_id WHERE t.club_id = p.id),
    (SELECT count(DISTINCT s.user_id) FROM public.admin_club_staff(p.id) s
       WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = s.user_id AND r.role = 'planillero')),
    (SELECT count(DISTINCT s.user_id) FROM public.admin_club_staff(p.id) s
       WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = s.user_id AND r.role = 'planillero')),
    (SELECT count(*) FROM public.team_members m JOIN public.teams t ON t.id = m.team_id WHERE t.club_id = p.id AND m.status = 'pending'),
    p.total_count
  FROM page p ORDER BY p.name
$$;

CREATE OR REPLACE FUNCTION public.admin_club_users(_club uuid, _kind text, _search text, _limit int, _offset int)
RETURNS TABLE(user_id uuid, email text, full_name text, photo_url text, kind text, categories text[], status text, total_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH staff AS (
    SELECT s.user_id,
      CASE WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = s.user_id AND r.role = 'planillero') THEN 'planillero' ELSE 'coach' END AS kind,
      array_remove(array_agg(DISTINCT t.name), NULL) AS categories, 'active'::text AS status
    FROM public.admin_club_staff(_club) s LEFT JOIN public.teams t ON t.id = s.team_id
    WHERE s.user_id IS NOT NULL GROUP BY s.user_id
  ), pl AS (
    SELECT m.user_id, 'player'::text AS kind, array_agg(DISTINCT t.name) AS categories,
      CASE WHEN bool_or(m.status = 'active') THEN 'active' ELSE min(m.status) END AS status
    FROM public.team_members m JOIN public.teams t ON t.id = m.team_id
    WHERE t.club_id = _club AND m.user_id NOT IN (SELECT user_id FROM staff) GROUP BY m.user_id
  ), allu AS (SELECT * FROM staff UNION ALL SELECT * FROM pl),
  f AS (
    SELECT a.*, pr.email, nullif(trim(coalesce(pp.first_name,'') || ' ' || coalesce(pp.last_name,'')), '') AS full_name, pp.photo_url
    FROM allu a LEFT JOIN public.profiles pr ON pr.id = a.user_id LEFT JOIN public.player_profiles pp ON pp.user_id = a.user_id
    WHERE (coalesce(_kind,'') = '' OR a.kind = _kind)
      AND (coalesce(_search,'') = '' OR pr.email ILIKE '%'||_search||'%' OR pp.first_name ILIKE '%'||_search||'%' OR pp.last_name ILIKE '%'||_search||'%')
  )
  SELECT f.user_id, f.email, f.full_name, f.photo_url, f.kind, f.categories, f.status, count(*) OVER ()
  FROM f ORDER BY f.kind, coalesce(f.full_name, f.email) LIMIT least(greatest(_limit,1),100) OFFSET greatest(_offset,0)
$$;

CREATE OR REPLACE FUNCTION public.admin_user_search(_search text, _role text, _club uuid, _status text, _limit int, _offset int)
RETURNS TABLE(user_id uuid, email text, full_name text, photo_url text, roles text[], memberships jsonb, created_at timestamptz, total_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT pr.id, pr.email, pr.created_at, pp.photo_url,
      nullif(trim(coalesce(pp.first_name,'') || ' ' || coalesce(pp.last_name,'')), '') AS full_name,
      coalesce((SELECT array_agg(r.role::text) FROM public.user_roles r WHERE r.user_id = pr.id), '{}') AS roles
    FROM public.profiles pr LEFT JOIN public.player_profiles pp ON pp.user_id = pr.id
    WHERE (coalesce(_search,'') = '' OR pr.email ILIKE '%'||_search||'%' OR pp.first_name ILIKE '%'||_search||'%' OR pp.last_name ILIKE '%'||_search||'%')
      AND (_club IS NULL OR EXISTS (SELECT 1 FROM public.team_members m JOIN public.teams t ON t.id=m.team_id WHERE m.user_id=pr.id AND t.club_id=_club)
           OR EXISTS (SELECT 1 FROM public.admin_club_staff(_club) s WHERE s.user_id = pr.id))
      AND (coalesce(_status,'') = '' OR EXISTS (SELECT 1 FROM public.team_members m WHERE m.user_id=pr.id AND m.status=_status))
  ), f AS (
    SELECT * FROM base b WHERE coalesce(_role,'') = '' OR _role = ANY(b.roles)
      OR (_role = 'player' AND EXISTS (SELECT 1 FROM public.team_members m WHERE m.user_id = b.id))
  )
  SELECT f.id, f.email, f.full_name, f.photo_url, f.roles,
    coalesce((SELECT jsonb_agg(jsonb_build_object('club', c.name, 'category', t.name, 'status', m.status, 'role', m.role))
      FROM public.team_members m JOIN public.teams t ON t.id=m.team_id LEFT JOIN public.clubs c ON c.id=t.club_id WHERE m.user_id=f.id), '[]'::jsonb),
    f.created_at, count(*) OVER ()
  FROM f ORDER BY f.created_at DESC LIMIT least(greatest(_limit,1),100) OFFSET greatest(_offset,0)
$$;

REVOKE ALL ON FUNCTION public.admin_club_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_club_directory(text,int,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_club_users(uuid,text,text,int,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_user_search(text,text,uuid,text,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_club_staff(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_club_directory(text,int,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_club_users(uuid,text,text,int,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_user_search(text,text,uuid,text,int,int) TO service_role;