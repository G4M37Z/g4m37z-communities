-- V4 Community Capabilities Persistence
-- Adds a capabilities TEXT[] column to communities so that moderator toggles
-- from the Community Settings page are stored (previously UI-only).
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS capabilities TEXT[] NOT NULL DEFAULT ARRAY['discussions','media','members','voice']::text[];

-- Moderators/admins may update community settings (in addition to the creator).
DROP POLICY IF EXISTS "Moderators can update community settings" ON public.communities;
CREATE POLICY "Moderators can update community settings" ON public.communities
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = communities.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('moderator', 'admin')
    )
  );