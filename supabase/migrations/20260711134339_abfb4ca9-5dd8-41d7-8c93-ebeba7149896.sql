CREATE UNIQUE INDEX IF NOT EXISTS leagues_unique_name_gender_creator
  ON public.leagues (created_by, lower(name), COALESCE(gender, ''));