-- ============================================================================
-- 034_community_media_and_deletion.sql
--
-- 1. Community media bucket ("community-media", public) for icons + banners.
--    Object layout: {communityId}/{icon|banner}.{ext} — ownership checkable
--    from the path because the first path segment IS the community id.
-- 2. Storage RLS: authenticated users may upload/update/delete only objects
--    under communities they moderate or own. Reads are public.
-- 3. Safe community deletion backstop: clearing icon_url/banner_url is fine,
--    but the DB must also tolerate explicit object cleanup done by the app.
--    (FK cascades already handle rows; nothing else needed there.)
--
-- Idempotent.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', true)
ON CONFLICT (id) DO NOTHING;

-- Helpers referenced by policies (idempotent create-or-replace)
CREATE OR REPLACE FUNCTION public.can_manage_community_media(bucket text, path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT bucket = 'community-media'
    AND EXISTS (
      SELECT 1
      FROM public.communities c
      LEFT JOIN public.community_members cm
        ON cm.community_id = c.id AND cm.user_id = auth.uid()
      WHERE c.id::text = split_part(path, '/', 1)
        AND (c.creator_id = auth.uid()
             OR cm.role IN ('admin', 'moderator'))
    );
$$;

-- Reads: public bucket
DROP POLICY IF EXISTS "Anyone can read community media" ON storage.objects;
CREATE POLICY "Anyone can read community media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'community-media');

-- Writes: moderator/owner of the community named by the first path segment
DROP POLICY IF EXISTS "Moderators can upload community media" ON storage.objects;
CREATE POLICY "Moderators can upload community media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_community_media(bucket_id, name));

DROP POLICY IF EXISTS "Moderators can update community media" ON storage.objects;
CREATE POLICY "Moderators can update community media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (public.can_manage_community_media(bucket_id, name))
  WITH CHECK (public.can_manage_community_media(bucket_id, name));

DROP POLICY IF EXISTS "Moderators can delete community media" ON storage.objects;
CREATE POLICY "Moderators can delete community media"
  ON storage.objects FOR DELETE TO authenticated
  USING (public.can_manage_community_media(bucket_id, name));
