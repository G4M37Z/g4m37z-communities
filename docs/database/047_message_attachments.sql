-- ============================================================================
-- 047_message_attachments.sql — Media/stickers in direct threads
--
-- Schema (mirrors posts.image_url pattern):
--   messages.attachment_url  TEXT   — public URL of the stored attachment
--   messages.attachment_type TEXT   — 'image' | 'gif' | 'sticker'
--     CHECK keeps the union closed; NULLs together = text-only message.
--
-- Storage: a dedicated PUBLIC-READ bucket 'message-attachments' with the
-- same first-path-is-auth.uid() ownership model as post-images (003):
--   SELECT  anyone (bubbles render the image by URL)
--   INSERT/UPDATE/DELETE  owner only, folder-pinned to auth.uid()
--
-- RLS on messages is unchanged: members can only INSERT/SELECT rows via the
-- existing 020/033 policies; attachment columns ride along on the same row.
--
-- Idempotent: guarded ALTERs + dynamic policy creation with existence checks.
-- ============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_attachment_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'gif', 'sticker'));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_attachment_pair_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_attachment_pair_check
  CHECK ((attachment_url IS NULL) = (attachment_type IS NULL));

-- ---------------------------------------------------------------------------
-- Bucket + policies (dynamic SQL so re-runs never duplicate policies)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Anyone can read message attachments'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can read message attachments" ON storage.objects FOR SELECT USING (bucket_id = ''message-attachments'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Members can upload message attachments'
  ) THEN
    EXECUTE 'CREATE POLICY "Members can upload message attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''message-attachments'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Members can update their message attachments'
  ) THEN
    EXECUTE 'CREATE POLICY "Members can update their message attachments" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = ''message-attachments'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Members can delete their message attachments'
  ) THEN
    EXECUTE 'CREATE POLICY "Members can delete their message attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''message-attachments'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;
END $$;
