-- Policy inventory for 032 tables: confirm anon write paths are policy-blocked
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('bookmarks', 'polls', 'poll_options', 'poll_votes', 'reposts')
ORDER BY tablename, cmd, policyname;
