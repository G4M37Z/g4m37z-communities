-- docs/database/059_profiles_verified.sql
-- Account verification badge. Criteria for verified status is not defined
-- yet; until then verification is granted/revoked only through the trusted
-- administrative path (SQL editor / service_role), the same trust model as
-- profiles.role (014). One-off: the platform owner account starts verified.

-- 1. Column — readable by everyone (existing SELECT policy "Profiles are
--    viewable by everyone" covers it), defaulted false so nobody is
--    implicitly verified.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Defense-in-depth: mirror guard_profile_role (014 P0.1). The existing
--    "Users can update own profile" RLS policy lets a row owner write their
--    own columns, so a table-level trigger rejects any authenticated path
--    mutating `verified`. auth.uid() IS NULL identifies the trusted
--    administrative path (service_role uses BYPASSRLS, not auth.uid());
--    anon cannot reach UPDATE due to RLS.
CREATE OR REPLACE FUNCTION public.guard_profile_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    IF v_actor IS NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'profiles.verified can only be modified through trusted administrative paths';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_verified ON public.profiles;
CREATE TRIGGER trg_guard_profile_verified
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_verified();

-- 3. Owner seed — the platform owner account is the only one verified.
--    Criteria for others is pending.
UPDATE public.profiles
SET verified = true
WHERE username = 'linyuluderrick';
