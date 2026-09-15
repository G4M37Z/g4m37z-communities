-- v5-sprint-baseline.sql — READ-ONLY
-- 1. Messaging schema: columns + constraints
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('conversations','conversation_members','messages')
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE connamespace='public'::regnamespace
  AND conrelid IN ('public.conversations'::regclass,'public.conversation_members'::regclass,
                   'public.messages'::regclass)
ORDER BY 1,2;

-- 2. Messaging RLS + policies (expected: enabled, zero policies)
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('conversations','conversation_members','messages');

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('conversations','conversation_members','messages')
ORDER BY tablename, policyname;

-- 3. posts: existing columns (repost support check)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='posts'
ORDER BY ordinal_position;

-- 4. Analytics infrastructure already present?
SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE '%analytic%' OR tablename LIKE '%impression%' OR tablename LIKE '%view%');
