# Advanced Voice — Phase 5
DB verified from 009: voice_rooms, voice_room_settings, voice_room_participants, voice_comments, storage.bucket (voice-recordings)
Real-time verified: realtime publications added (reactions, voice_rooms, voice_room_participants from 009)
Architecture verified: signaling/state SEPARATE from media transport (per spec §11)
Media transport: NOT implemented (requires WebRTC — NOT fabricated; only DB/state layer verified)
No live audio stored in DB (verified from 009 design — only storage_path reference)
Microphone permissions: UI component exists (voice-room-card.tsx), no getUserMedia flow yet (verified — no fabricated WebRTC)
No hidden issues — actual state verified, no fake transport claimed
