-- Verify 033 part 3: grants on new tables + pinned column privileges
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('reposts', 'bookmarks', 'polls', 'poll_options', 'poll_votes')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- conversation_members: authenticated must have ONLY last_read_at UPDATE
SELECT grantee, privilege_type, column_name
FROM information_schema.role_column_grants
WHERE table_schema = 'public'
  AND table_name = 'conversation_members'
  AND privilege_type = 'UPDATE'
ORDER BY grantee, column_name;

-- Self-follow constraint live
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.follows'::regclass
  AND conname = 'follows_no_self_follow';

-- Trigger functions now on 006 order (spot-check the two repaired)
SELECT p.proname,
       pg_get_functiondef(p.oid) LIKE '%create_notification(%''follow''%' OR
       pg_get_functiondef(p.oid) LIKE '%create_notification(%''mention''%' AS type_before_actor
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND p.proname IN ('notify_follow', 'notify_mentions', 'notify_on_repost');
