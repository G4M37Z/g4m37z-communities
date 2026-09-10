-- ============================================================================
-- 014_p0_security_containment.sql
-- V3 P0 Security Containment — closes three vulnerabilities identified by
-- the V3 Security Foundation Audit.
--
-- 1. P0.1: Profiles.role self-update escalation chain
--    Fix: BEFORE UPDATE trigger that raises an exception if the actor
--    attempts to change the `role` column without going through the
--    service_role path. SECURITY DEFINER functions run as their owner
--    (postgres), which is the only path trusted to mutate role.
--    Existing UPDATE RLS policy stays in place; this is a defense-in-depth
--    table-level trigger.
--
-- 2. P0.2: create_notification exposed to anon + authenticated
--    Fix: REVOKE EXECUTE FROM anon, authenticated. Trusted callers
--    (notify_comment_on_post etc.) are SECURITY DEFINER and run as
--    function owner, unaffected by grant changes.
--
-- 3. P1.3: admin_set_user_role exposed to anon + authenticated
--    Fix: REVOKE EXECUTE FROM anon, authenticated. Service-role paths
--    remain intact.
--
-- All operations are idempotent and non-destructive.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- P0.1 — trigger preventing self role mutation
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  -- Only guard changes to the role column.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Service-role path: auth.uid() returns NULL when the session is not
    -- an authenticated user (service_role uses BYPASSRLS, not auth.uid()).
    -- anon cannot reach an UPDATE due to RLS. Therefore auth.uid() IS NULL
    -- identifies the trusted administrative path.
    IF v_actor IS NULL THEN
      RETURN NEW;
    END IF;
    -- Authenticated user trying to mutate own role → reject.
    IF v_actor = OLD.id THEN
      RAISE EXCEPTION 'profiles.role cannot be modified by the row owner';
    END IF;
    -- Any other authenticated path trying to mutate role → reject.
    RAISE EXCEPTION 'profiles.role can only be modified through trusted administrative paths';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- P0.2 — revoke create_notification from untrusted roles
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- P1.3 — revoke admin_set_user_role from untrusted roles
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text)
  FROM PUBLIC, anon, authenticated;
