-- ============================================================================
-- 002_diagnostic_and_fix.sql
--
-- Run this in Supabase SQL Editor to diagnose what's actually in the
-- database and fix any issues found. Idempotent — safe to re-run.
--
-- Sections:
--   1. Inspect current profiles table state
--   2. Inspect triggers on auth.users (look for a stuck profile trigger)
--   3. Inspect RLS policies on profiles
--   4. Verify FK to auth.users
--   5. Apply fixes if any are missing or wrong
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Inspect: does the profiles table exist and is it well-formed?
-- ──────────────────────────────────────────────────────────────────────────
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Inspect: are there any triggers on auth.users that auto-create
--    profiles? If so, they may conflict with our manual insert in the
--    /signup server action (a duplicate insert = unique constraint fail).
-- ──────────────────────────────────────────────────────────────────────────
SELECT
  trigger_schema,
  trigger_name,
  event_object_schema,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Inspect: RLS policies currently on public.profiles
-- ──────────────────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Inspect: does the FK to auth.users actually exist?
-- ──────────────────────────────────────────────────────────────────────────
SELECT
  tc.constraint_name,
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'profiles';

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Apply fixes if anything is missing
-- ──────────────────────────────────────────────────────────────────────────

-- 5a. Make sure RLS is enabled (no-op if already on).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5b. Recreate the four RLS policies. DROP first so this is idempotent.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- 5c. Indexes (idempotent).
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);

-- 5d. If there is a stray trigger on auth.users that auto-inserts a
--     profile row, remove it. Our /signup server action creates the
--     profile explicitly, and the auth/callback route also has a
--     fallback. A trigger would cause a unique-username collision
--     every time.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 5e. Verify the FK exists. If section 4 returned no rows, recreate it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
