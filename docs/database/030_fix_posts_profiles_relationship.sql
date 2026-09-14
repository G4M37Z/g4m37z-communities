-- ============================================================================
-- 030_fix_posts_profiles_relationship.sql
-- PostgREST embedded-resource fix.
--
-- Several queries embed related rows through a foreign-key hint, e.g.
--
--     author:profiles!posts_author_id_fkey ( username, display_name, ... )
--
-- PostgREST resolves the embedded table ONLY if a foreign key with exactly
-- that name links the two tables. The v1 schema declared these user columns
-- with a bare `REFERENCES auth.users(id)`, so PostgREST auto-named the
-- constraint after the column (`posts_author_id_fkey`) but it points at
-- auth.users — NOT public.profiles. Every query embedding `profiles` through
-- that hint then fails with PGRST200:
--
--     Could not find a relationship between 'posts' and 'profiles'
--     ... hint 'posts_author_id_fkey' ... no matches were found
--
-- Affected embeds (all target public.profiles, but constrain to auth.users):
--   * posts.author_id                    -> author:profiles!posts_author_id_fkey
--   * comments.author_id                 -> author:profiles!comments_author_id_fkey
--   * reports.reporter_id                -> reporter:profiles!reports_reporter_id_fkey
--   * voice_room_participants.user_id    -> profile:profiles!voice_room_participants_user_id_fkey
--
-- With the app live this surfaced as empty feeds ("No posts yet"), 404s on
-- post pages, and "Something went wrong" with a shared Next.js error digest
-- (PGRST200) on voice/community flows.
--
-- Fix per table: rename the original auth.users FK out of the way, then create
-- the table -> profiles FK under the name the app hints. profiles.id already
-- references auth.users(id) ON DELETE CASCADE, so integrity is preserved and
-- deleting a user still cascades to their rows (via the profiles cascade).
--
-- Idempotent: safe to run on partially-applied or re-created environments.
-- ============================================================================

-- posts.author_id -> profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_author_id_fkey'
      AND conrelid = 'public.posts'::regclass
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.posts
      RENAME CONSTRAINT posts_author_id_fkey TO posts_author_id_auth_users_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_author_id_fkey'
      AND conrelid = 'public.posts'::regclass
      AND confrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- comments.author_id -> profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comments_author_id_fkey'
      AND conrelid = 'public.comments'::regclass
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.comments
      RENAME CONSTRAINT comments_author_id_fkey TO comments_author_id_auth_users_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comments_author_id_fkey'
      AND conrelid = 'public.comments'::regclass
      AND confrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- reports.reporter_id -> profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_reporter_id_fkey'
      AND conrelid = 'public.reports'::regclass
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.reports
      RENAME CONSTRAINT reports_reporter_id_fkey TO reports_reporter_id_auth_users_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_reporter_id_fkey'
      AND conrelid = 'public.reports'::regclass
      AND confrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_reporter_id_fkey
      FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- voice_room_participants.user_id -> profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'voice_room_participants_user_id_fkey'
      AND conrelid = 'public.voice_room_participants'::regclass
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.voice_room_participants
      RENAME CONSTRAINT voice_room_participants_user_id_fkey
      TO voice_room_participants_user_id_auth_users_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'voice_room_participants_user_id_fkey'
      AND conrelid = 'public.voice_room_participants'::regclass
      AND confrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.voice_room_participants
      ADD CONSTRAINT voice_room_participants_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;