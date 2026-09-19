-- Audit: RLS policies on community_members that could reject the RPC insert.
\echo === community_members policies ===
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr,
       pg_get_expr(polwithcheck, polrelid) AS with_check_expr
FROM pg_policy WHERE polrelid = 'public.community_members'::regclass;

\echo === is the RPC SECURITY DEFINER? ===
SELECT prosecdef FROM pg_proc WHERE proname = 'join_community';

\echo === does the RPC read auth.uid() or jwt claims? ===
SELECT prosrc FROM pg_proc WHERE proname = 'join_community';
