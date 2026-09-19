-- sql/verify-voice-runtime.sql — post-runtime state of the voice room.
\echo === room state ===
SELECT id, name, is_active, is_locked FROM public.voice_rooms
WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001';

\echo === participants (should be empty after clean leave) ===
SELECT room_id, user_id, role, is_muted, joined_at
FROM public.voice_room_participants
WHERE room_id = 'aaaaaaaa-0000-4000-8000-000000000001';

\echo === signaling rows (PEER_JOIN published; stale check) ===
SELECT from_user, to_user, type, payload, created_at
FROM public.webrtc_signals
WHERE room_id = 'aaaaaaaa-0000-4000-8000-000000000001'
ORDER BY created_at;
