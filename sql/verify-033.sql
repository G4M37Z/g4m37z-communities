-- verify-033.sql — READ-ONLY verification of migration 033
-- 1. conversation_members UPDATE policy (read-state)
SELECT policyname, cmd, roles, qual::text AS using_expr, with_check::text AS with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='conversation_members' AND cmd='UPDATE';

-- 2. reposts table + constraints
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='reposts'
ORDER BY ordinal_position;

SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid='public.reposts'::regclass
ORDER BY conname;

-- 3. RLS + policies on reposts
SELECT relrowsecurity AS rls_enabled FROM pg_class
WHERE oid='public.reposts'::regclass;

SELECT policyname, cmd, qual::text AS using_expr, with_check::text AS with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='reposts'
ORDER BY policyname;

-- 4. trigger + indexes
SELECT tgname FROM pg_trigger WHERE tgrelid='public.reposts'::regclass AND NOT tgisinternal;

SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND (
  tablename='reposts' OR indexname IN
  ('idx_post_votes_post','idx_reactions_post','idx_comments_post','idx_posts_author_created','idx_follows_followed'))
ORDER BY indexname;

-- 5. realtime publication includes reposts?
SELECT pubname, schemaname, tablename FROM pg_publication_tables
WHERE schemaname='public' AND tablename='reposts';

-- 6. negative test (must FAIL): anon cannot insert reposts
-- (wrapped so ON_ERROR_STOP doesn't kill the file)
DO $$
BEGIN
  BEGIN
    SET LOCAL role = anon;
    INSERT INTO public.reposts (reposter_id, post_id, original_author_id)
    VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
    RAISE EXCEPTION 'NEGATIVE-TEST-FAILED: anon insert into reposts succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN RAISE NOTICE 'NEGATIVE-TEST-1 PASS: anon insert denied (insufficient_privilege)';
    WHEN check_violation THEN RAISE NOTICE 'NEGATIVE-TEST-1 PASS: anon insert denied (check_violation/RLS)';
  END;
END $$;
