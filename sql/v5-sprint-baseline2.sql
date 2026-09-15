-- v5-sprint-baseline2.sql — READ-ONLY
-- 1. Messaging policy DEFINITIONS (verify correctness)
SELECT tablename, policyname, cmd, roles,
       qual::text AS using_expr,
       with_check::text AS with_check_expr
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('conversations','conversation_members','messages')
ORDER BY tablename, policyname;

-- 2. notification_events shape (for repost notification trigger)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='notification_events'
ORDER BY ordinal_position;

SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='notification_events';

-- 3. votes/reactions tables (creator analytics signals)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('votes','reactions','post_reactions','comments')
ORDER BY table_name, ordinal_position;

-- 4. messaging indexes
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('conversations','conversation_members','messages')
ORDER BY tablename, indexname;
