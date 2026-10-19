-- ============================================================================
-- 057_storage_hardening.sql
-- GAP-STORAGE-01 closure (decision 2026-10-19). Caps every upload bucket:
-- size + MIME allowlists, mirroring the community-media precedent
-- (5 MB images). Voice recordings get a size cap only — MediaRecorder MIME
-- varies per browser (e.g. audio/webm;codecs=opus), and exact-match MIME
-- filtering would break voice notes.
--
-- Direct bucket UPDATEs are permitted (the storage protect guard covers
-- DELETE on storage.objects only, not bucket metadata).
-- Idempotent: plain UPDATEs.
-- =====================================================================

-- Chat attachments (images/GIFs/sticker-grade media): 10 MB, image MIMEs
UPDATE storage.buckets SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/gif','image/webp']
WHERE id = 'message-attachments';

-- Avatars: 2 MB, image MIMEs
UPDATE storage.buckets SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp']
WHERE id = 'avatars';

-- Post images: 5 MB + image MIMEs (same as community-media)
UPDATE storage.buckets SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/gif','image/webp']
WHERE id = 'post-images';

-- Voice recordings: 5 MB, no MIME allowlist (browser MediaRecorder variance)
UPDATE storage.buckets SET
  file_size_limit = 5242880
WHERE id = 'voice-recordings';

-- ============================================================================
-- End 057.
-- ============================================================================
