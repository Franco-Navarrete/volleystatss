DROP INDEX IF EXISTS public.clubs_owner_unique;
CREATE INDEX IF NOT EXISTS clubs_owner_idx ON public.clubs (owner_id);

CREATE OR REPLACE FUNCTION public.enforce_one_club_per_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(NEW.owner_id, 'admin'::app_role) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.clubs WHERE owner_id = NEW.owner_id AND id <> NEW.id) THEN
    RAISE EXCEPTION 'Este usuario ya administra un club.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_one_club_per_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_one_club_per_owner ON public.clubs;
CREATE TRIGGER trg_enforce_one_club_per_owner BEFORE INSERT OR UPDATE OF owner_id ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.enforce_one_club_per_owner();