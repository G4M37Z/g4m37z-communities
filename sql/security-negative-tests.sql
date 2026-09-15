-- ============================================================================
-- sql/security-negative-tests.sql — V5 sprint security pass (REAL RLS tests)
--
-- Technique: SET LOCAL ROLE authenticated/anon + request.jwt.claims. The
-- runner connects as table owner (postgres), which bypasses RLS, so tests
-- that only set jwt.claims are vacuous. Switching to the API roles makes
-- every check below run under actual RLS evaluation.
--
-- Fixtures use \gset + gen_random_uuid() per test: fresh conversation ids,
-- no collision with committed data, everything ROLLBACKed.
-- Markers: DENIED (boundary held), ALLOWED (permitted by design),
--          LEAK (boundary failed — investigate), FAIL (expected-allow failed).
-- ============================================================================

-- autotest2 identity (idempotent, owner mode, persists — test fixture)
DO $$
DECLARE
  uid uuid := 'd1eeb9c0-0000-4000-8000-000000000008';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous
  ) VALUES (
    uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'g4m37z.autotest2@gmail.com',
    crypt('G4m37z!autotest2026', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"autotest2","display_name":"Auto Test Two"}'::jsonb,
    now(), now(), false, false
  )
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = now(),
        updated_at = now();

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at,
    created_at, updated_at, id
  ) VALUES (
    uid, uid,
    jsonb_build_object('sub', uid::text, 'email', 'g4m37z.autotest2@gmail.com'),
    'email', now(), now(), now(), uid
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  INSERT INTO public.profiles (
    id, username, display_name, created_at, updated_at, role,
    presence_state, notification_prefs
  ) VALUES (
    uid, 'autotest2', 'Auto Test Two', now(), now(), 'member',
    'offline', '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

\echo ''
\echo '=== T1: member may update ONLY last_read_at on own membership row ==='
-- Fixed literal UUIDs (rolled back below; fresh per run, never collides).
BEGIN;
INSERT INTO public.conversations (id, type) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'direct'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'direct');
-- conv1: autotest + autotest2. conv2: autotest2 ONLY — autotest is NOT a
-- member, so moving their conv1 row onto conv2 would GRANT them membership
-- (FK valid, PK free, user_id unchanged => RLS passes). Only the REVOKE stops it.
INSERT INTO public.conversation_members (conversation_id, user_id) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'd1eeb9c0-0000-4000-8000-000000000007'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'd1eeb9c0-0000-4000-8000-000000000008'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'd1eeb9c0-0000-4000-8000-000000000008');
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  UPDATE public.conversation_members
  SET last_read_at = now()
  WHERE conversation_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    AND user_id = 'd1eeb9c0-0000-4000-8000-000000000007';
  IF NOT FOUND THEN RAISE EXCEPTION 'no membership row visible'; END IF;
  RAISE NOTICE 'ALLOWED (expected): member updated last_read_at';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL (should be allowed): %', SQLERRM;
END $$;
-- Real escalation shape: attacker is a member of BOTH conversations, so the
-- FK passes and the RLS WITH CHECK (user_id unchanged) passes — only the
-- column-scoped REVOKE can stop this.
DO $$ BEGIN
  UPDATE public.conversation_members
  SET conversation_id = 'aaaaaaaa-0000-4000-8000-000000000002'
  WHERE conversation_id = 'aaaaaaaa-0000-4000-8000-000000000001'
    AND user_id = 'd1eeb9c0-0000-4000-8000-000000000007';
  RAISE NOTICE 'LEAK: member moved membership row onto another conversation';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DENIED (expected): conversation_id rewrite blocked: %', SQLERRM;
END $$;
ROLLBACK;

\echo ''
\echo '=== T2: messages SELECT is member-scoped ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT count(*) AS autotest_visible_messages FROM public.messages;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS anon_visible_messages FROM public.messages;
ROLLBACK;

\echo ''
\echo '=== T3: message INSERT cannot impersonate another sender ==='
BEGIN;
INSERT INTO public.conversations (id, type)
VALUES ('aaaaaaaa-0000-4000-8000-000000000003', 'direct');
INSERT INTO public.conversation_members (conversation_id, user_id) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000003', 'd1eeb9c0-0000-4000-8000-000000000007'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'd1eeb9c0-0000-4000-8000-000000000008');
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000008","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000003',
          'd1eeb9c0-0000-4000-8000-000000000007', 'impersonation-test');
  RAISE NOTICE 'LEAK: impersonated sender accepted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DENIED (expected): impersonation blocked: %', SQLERRM;
END $$;
-- Sanity: the same member sending as THEMSELVES must succeed.
DO $$ BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000003',
          'd1eeb9c0-0000-4000-8000-000000000008', 'own-voice-test');
  RAISE NOTICE 'ALLOWED (expected): member sent own message';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FAIL (member send should work): %', SQLERRM;
END $$;
ROLLBACK;

\echo ''
\echo '=== T4: repost INSERT requires self + real original author ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.reposts (reposter_id, post_id, original_author_id)
  SELECT 'd1eeb9c0-0000-4000-8000-000000000007', p.id,
         'd1eeb9c0-0000-4000-8000-000000000008'
  FROM public.posts p
  WHERE p.author_id <> 'd1eeb9c0-0000-4000-8000-000000000007'
  LIMIT 1;
  RAISE NOTICE 'LEAK: repost with spoofed original_author_id accepted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DENIED (expected): spoofed repost blocked: %', SQLERRM;
END $$;
ROLLBACK;

\echo ''
\echo '=== T5: notifications recipient-scoped; client INSERT forbidden ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT count(*) AS autotest_visible_notifications FROM public.notifications;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS anon_visible_notifications FROM public.notifications;
ROLLBACK;
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, reference_id)
  VALUES ('d1eeb9c0-0000-4000-8000-000000000008',
          'd1eeb9c0-0000-4000-8000-000000000007',
          'follow', NULL);
  RAISE NOTICE 'LEAK: client forged a notification';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DENIED (expected): forged notification blocked: %', SQLERRM;
END $$;
ROLLBACK;

\echo ''
\echo '=== T6: bookmarks are owner-private ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT count(*) AS autotest_visible_bookmarks FROM public.bookmarks;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS anon_visible_bookmarks FROM public.bookmarks;
ROLLBACK;

\echo ''
\echo '=== T7: poll votes are self-scoped ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT count(*) AS autotest_visible_poll_votes FROM public.poll_votes;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS anon_visible_poll_votes FROM public.poll_votes;
ROLLBACK;

\echo ''
\echo '=== T8: self-follow rejected ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO public.follows (follower_id, followed_id)
  VALUES ('d1eeb9c0-0000-4000-8000-000000000007',
          'd1eeb9c0-0000-4000-8000-000000000007');
  RAISE NOTICE 'LEAK: self-follow accepted';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DENIED (expected): self-follow blocked: %', SQLERRM;
END $$;
ROLLBACK;

\echo ''
\echo '=== T9: conversation_members visibility is member-scoped ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SET LOCAL ROLE authenticated;
SELECT count(*) AS autotest_member_rows FROM public.conversation_members;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS anon_member_rows FROM public.conversation_members;
ROLLBACK;

\echo ''
\echo '=== DONE — every check must read DENIED/ALLOWED-by-design; any LEAK/FAIL is a failure ==='
