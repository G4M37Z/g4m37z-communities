-- ============================================================================
-- sql/accept-045-leave-rejoin.sql — soft-leave + role preservation contract.
-- autotest2 (member) leaves and rejoins; left_at must flip and the role must
-- never be touched. Transaction-scoped, ROLLS BACK.
-- ============================================================================
BEGIN;

\echo === impersonate autotest2 ===
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'd1eeb9c0-0000-4000-8000-000000000008',
                    'role', 'authenticated')::text, true);

\echo === 1. leave ===
SELECT public.leave_community(
  (SELECT id FROM communities WHERE slug = 'release-verification-squad'));

\echo === 2. row must show left_at set, role unchanged ===
SELECT role, left_at IS NOT NULL AS softly_left
FROM community_members
WHERE community_id = (SELECT id FROM communities WHERE slug = 'release-verification-squad')
  AND user_id = 'd1eeb9c0-0000-4000-8000-000000000008';

\echo === 3. rejoin ===
SELECT public.join_community(
  (SELECT id FROM communities WHERE slug = 'release-verification-squad'));

\echo === 4. row must show left_at cleared, role still member ===
SELECT role, left_at
FROM community_members
WHERE community_id = (SELECT id FROM communities WHERE slug = 'release-verification-squad')
  AND user_id = 'd1eeb9c0-0000-4000-8000-000000000008';

\echo === 5. role-escalation guard: RPC must NOT grant admin ===
-- join_community never touches role; try as autotest2 anyway and confirm role.
SELECT CASE WHEN role = 'member' THEN 'PASS: role untouched by rejoin'
            ELSE 'FAIL: role changed to ' || role END AS role_guard
FROM community_members
WHERE community_id = (SELECT id FROM communities WHERE slug = 'release-verification-squad')
  AND user_id = 'd1eeb9c0-0000-4000-8000-000000000008';

ROLLBACK;
\echo === done (rolled back; autotest2 membership restored to pre-test state) ===
