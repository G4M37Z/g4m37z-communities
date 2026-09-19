-- sql/seed-voice-room.sql — idempotent active test voice room for runtime checks.
-- Room id is a fixed uuid so re-runs no-op; community is the release-verification
-- squad where the seeded test users are members (045 requires active membership).
INSERT INTO public.voice_rooms (id, community_id, name, created_by, is_active, is_locked)
SELECT
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  c.id,
  'Launch Acceptance Room',
  'd1eeb9c0-0000-4000-8000-000000000007',
  true,
  false
FROM public.communities c
WHERE c.slug = 'release-verification-squad'
ON CONFLICT (id) DO NOTHING;

SELECT id, name, is_active, is_locked FROM public.voice_rooms
WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001';
