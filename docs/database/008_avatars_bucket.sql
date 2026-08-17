-- ============================================================================
-- Additive: profile avatars bucket + RLS
-- Idempotent. Safe to re-run.
--
-- Creates storage.objects bucket "avatars" with policies that let:
--   - Anyone read any avatar (public bucket, like post-images)
--   - Authenticated users upload into their own folder
--   - Users overwrite/delete only their own files
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket layout: {user_id}/{filename}
-- Storage policies

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects';
  EXECUTE 'CREATE POLICY "Anyone can read avatars" ON storage.objects
    FOR SELECT USING (bucket_id = ''avatars'')';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'avatars SELECT policy skipped: %', SQLERRM;
END $storage$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects';
  EXECUTE 'CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = ''avatars''
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1] = auth.uid()::text
    )';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'avatars INSERT policy skipped: %', SQLERRM;
END $storage$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects';
  EXECUTE 'CREATE POLICY "Users can update their own avatar" ON storage.objects
    FOR UPDATE USING (
      bucket_id = ''avatars''
      AND (storage.foldername(name))[1] = auth.uid()::text
    )';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'avatars UPDATE policy skipped: %', SQLERRM;
END $storage$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects';
  EXECUTE 'CREATE POLICY "Users can delete their own avatar" ON storage.objects
    FOR DELETE USING (
      bucket_id = ''avatars''
      AND (storage.foldername(name))[1] = auth.uid()::text
    )';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'avatars DELETE policy skipped: %', SQLERRM;
END $storage$;

-- Enable realtime on profiles so avatar updates propagate
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;