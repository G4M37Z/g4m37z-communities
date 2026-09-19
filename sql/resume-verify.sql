-- ============================================================================
-- sql/resume-verify.sql — resume the 045 launch-hardening acceptance session.
-- Read-only in effect: the impersonation test is transaction-scoped and
-- ROLLS BACK. No persistent state changes.
-- ============================================================================
\echo === 1. 045 RPC objects: security definer + owner ===
SELECT proname,
       prosecdef AS is_security_definer,
       pg_get_userbyid(proowner) AS owner
FROM pg_proc
WHERE proname IN ('join_community', 'leave_community', 'block_user',
                  'create_direct_conversation')
ORDER BY proname;

\echo === 2. autotest2 auth user exists and is confirmed ===
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed,
       created_at
FROM auth.users
WHERE email = 'g4m37z.autotest2@gmail.com';

\echo === 3. autotest2 profile exists ===
SELECT id, username, display_name, role
FROM public.profiles
WHERE username = 'autotest2';

\echo === 4. baseline membership of autotest2 in release-verification-squad ===
SELECT cm.user_id, cm.role, cm.joined_at, cm.left_at
FROM community_members cm
JOIN communities c ON c.id = cm.community_id
JOIN profiles p ON p.id = cm.user_id
WHERE c.slug = 'release-verification-squad'
  AND p.username IN ('autotest', 'autotest2')
ORDER BY cm.joined_at;

\echo === 5. two-user direct conversation state (autotest <-> autotest2) ===
SELECT c.id, c.type,
       (SELECT count(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) AS members,
       (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id) AS messages
FROM conversations c
WHERE c.type = 'direct'
  AND c.id IN (
    SELECT conversation_id FROM conversation_members
    WHERE user_id IN ('d1eeb9c0-0000-4000-8000-000000000007',
                      'd1eeb9c0-0000-4000-8000-000000000008')
    GROUP BY conversation_id
    HAVING count(DISTINCT user_id) = 2
  );

\echo === 6. LIVE impersonation: autotest2 joins release-verification-squad (ROLLBACK) ===
BEGIN;
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'd1eeb9c0-0000-4000-8000-000000000008',
                    'role', 'authenticated')::text, true);
SELECT join_community(
  (SELECT id FROM communities WHERE slug = 'release-verification-squad')
) AS join_result;
SELECT cm.user_id, cm.role, cm.left_at
FROM community_members cm
WHERE cm.user_id = 'd1eeb9c0-0000-4000-8000-000000000008'
  AND cm.community_id = (SELECT id FROM communities WHERE slug = 'release-verification-squad');
ROLLBACK;
\echo === done (rolled back; no persistent changes) ===
