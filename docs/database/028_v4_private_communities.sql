-- V4 Private Communities
-- Adds an is_private flag. When true, only community members can view the
-- community page and its posts. Non-members see nothing in /communities.
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- Update the existing SELECT policy to hide private communities from non-members.
DROP POLICY IF EXISTS "Communities are viewable by everyone" ON public.communities;
CREATE POLICY "Communities are viewable by everyone (except private)" ON public.communities
  FOR SELECT USING (
    is_private = FALSE
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = communities.id
        AND cm.user_id = auth.uid()
    )
    OR creator_id = auth.uid()
  );

-- Posts in private communities should also be hidden from non-members.
-- The existing posts SELECT policy is "Posts are viewable by everyone". We
-- narrow it to exclude posts belonging to private communities the viewer
-- cannot access.
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone" ON public.posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = posts.community_id
        AND (
          c.is_private = FALSE
          OR c.creator_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.community_members cm
            WHERE cm.community_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
    OR community_id IS NULL
  );

-- Moderators can update community settings including is_private.
-- The existing "Creator can update own community" policy covers creator_id = auth.uid().
-- We extend UPDATE to also allow moderators/admins (same as 026).
DROP POLICY IF EXISTS "Creator can update own community" ON public.communities;
CREATE POLICY "Creator can update own community" ON public.communities
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = communities.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('moderator', 'admin')
    )
  );