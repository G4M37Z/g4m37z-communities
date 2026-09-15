-- test-notification-fns.sql — decisive runtime tests (all changes rolled back)

\echo '=== F1: real follow insert (trigger notify_follow fires?) ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
INSERT INTO public.follows (follower_id, followed_id)
VALUES ('d1eeb9c0-0000-4000-8000-000000000007',
        'd1eeb9c0-0000-4000-8000-000000000008');
ROLLBACK;

\echo '=== F2: create_notification with (user, type, actor, ref) — 006 order ==='
BEGIN;
SET LOCAL request.jwt.claims = '{"sub":"d1eeb9c0-0000-4000-8000-000000000007","role":"authenticated"}';
SELECT public.create_notification(
  'd1eeb9c0-0000-4000-8000-000000000008'::uuid,
  'follow',
  'd1eeb9c0-0000-4000-8000-000000000007'::uuid,
  NULL::uuid
) AS notif_id;
ROLLBACK;

\echo '=== F3: notification_enabled prefs gate signature/behavior ==='
SELECT public.notification_enabled('d1eeb9c0-0000-4000-8000-000000000008'::uuid, 'follow') AS follow_enabled;
