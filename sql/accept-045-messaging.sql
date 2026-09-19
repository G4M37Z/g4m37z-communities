-- ============================================================================
-- sql/accept-045-messaging.sql — acceptance of 045 create_direct_conversation.
-- Positive paths + block enforcement, ALL transaction-scoped, ROLLS BACK.
-- Users: autotest  = d1eeb9c0-0000-4000-8000-000000000007
--        autotest2 = d1eeb9c0-0000-4000-8000-000000000008
-- ============================================================================
BEGIN;

\echo === A. block enforcement: autotest blocks autotest2 -> attempt must P0002 ===
INSERT INTO public.blocks (blocker_id, blocked_id)
VALUES ('d1eeb9c0-0000-4000-8000-000000000007',
        'd1eeb9c0-0000-4000-8000-000000000008')
ON CONFLICT DO NOTHING;

SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'd1eeb9c0-0000-4000-8000-000000000008',
                    'role', 'authenticated')::text, true);

DO $$
BEGIN
  PERFORM public.create_direct_conversation(
    'd1eeb9c0-0000-4000-8000-000000000007'::uuid,
    'should be rejected by block');
  RAISE EXCEPTION 'FAIL: blocked pair allowed to thread' USING errcode = '99001';
EXCEPTION
  WHEN SQLSTATE 'P0002' THEN
    RAISE NOTICE 'PASS: blocked pair rejected as P0002 (block state not leaked)';
END $$;

\echo === B. clear the block (service role), restore impersonation ===
RESET ROLE;
DELETE FROM public.blocks
WHERE blocker_id = 'd1eeb9c0-0000-4000-8000-000000000007'
  AND blocked_id = 'd1eeb9c0-0000-4000-8000-000000000008';

SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'd1eeb9c0-0000-4000-8000-000000000008',
                    'role', 'authenticated')::text, true);

\echo === C. autotest2 starts a NEW thread with autotest (expect reused=false) ===
SELECT * FROM public.create_direct_conversation(
  'd1eeb9c0-0000-4000-8000-000000000007'::uuid,
  'acceptance: first message from autotest2') AS t(conversation_id, reused);

\echo === D. autotest replies into the SAME thread (expect reused=true) ===
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'd1eeb9c0-0000-4000-8000-000000000007',
                    'role', 'authenticated')::text, true);
SELECT * FROM public.create_direct_conversation(
  'd1eeb9c0-0000-4000-8000-000000000008'::uuid,
  'acceptance: reply from autotest') AS t(conversation_id, reused);

\echo === E. thread shape: exactly 1 thread, 2 members, 2 messages (service role) ===
RESET ROLE;
SELECT c.id, c.type,
       (SELECT count(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) AS members,
       (SELECT count(*) FROM messages m WHERE m.conversation_id = c.id) AS messages
FROM conversations c
WHERE c.id IN (
  SELECT conversation_id FROM conversation_members
  WHERE user_id IN ('d1eeb9c0-0000-4000-8000-000000000007',
                    'd1eeb9c0-0000-4000-8000-000000000008')
  GROUP BY conversation_id
  HAVING count(DISTINCT user_id) = 2
);

\echo === F. messages in order ===
SELECT m.sender_id, left(m.body, 50) AS body, m.created_at
FROM messages m
WHERE m.conversation_id = (
  SELECT conversation_id FROM conversation_members
  WHERE user_id IN ('d1eeb9c0-0000-4000-8000-000000000007',
                    'd1eeb9c0-0000-4000-8000-000000000008')
  GROUP BY conversation_id
  HAVING count(DISTINCT user_id) = 2
)
ORDER BY m.created_at;

ROLLBACK;
\echo === done (rolled back; no persistent changes) ===
