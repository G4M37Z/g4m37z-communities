-- ============================================================================
-- 004_comments_and_votes.sql — split into two parts for Supabase compatibility
--
-- This file is a pointer. Run the two parts in order:
--   1. 004_comments_and_votes_part1.sql  — tables, indexes, column, trigger
--   2. 004_comments_and_votes_part2.sql  — RLS, policies
--
-- Why split: Supabase's SQL Editor wraps everything in a transaction and
-- parses the script up-front. Some Supabase configurations raise 42P01
-- ("relation does not exist") on bare DROP POLICY IF EXISTS statements
-- even though standard PostgreSQL treats them as no-ops. Splitting the
-- script guarantees the tables exist before any DROP POLICY runs.
--
-- After both parts succeed, you can delete this pointer file.
-- ============================================================================

\i 004_comments_and_votes_part1.sql
\i 004_comments_and_votes_part2.sql