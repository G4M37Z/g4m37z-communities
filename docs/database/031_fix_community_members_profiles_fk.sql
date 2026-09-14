-- ============================================================================
-- 031_fix_community_members_profiles_fk.sql
-- PostgREST embedded-resource fix (latent).
--
-- Same class of bug as 030: community_members.user_id was declared with a bare
-- `REFERENCES auth.users(id)` (constraint auto-named community_members_user_id_fkey).
-- The app does NOT currently embed profiles through this FK, so this is a LATENT
-- risk — but exactly the kind of FK that breaks with
--
--     PGRST200: Could not find a relationship between 'community_members' and 'profiles'
--               ... hint 'community_members_user_id_fkey' ... no matches were found
--
-- the moment any query adds a `profiles:user_id ( username, ... )` embed.
--
-- Fix: rename the original auth.users FK out of the way, then create the
-- community_members -> profiles FK under the same name. profiles.id already
-- references auth.users(id) ON DELETE CASCADE, so integrity is preserved and
-- deleting a user still cascades via the profiles cascade.
--
-- Idempotent: safe to run on partially-applied or re-created environments.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_members_user_id_fkey'
      AND conrelid = 'public.community_members'::regclass
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.community_members
      RENAME CONSTRAINT community_members_user_id_fkey
      TO community_members_user_id_auth_users_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_members_user_id_fkey'
      AND conrelid = 'public.community_members'::regclass
      AND confrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.community_members
      ADD CONSTRAINT community_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;