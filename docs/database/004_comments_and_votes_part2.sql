-- ============================================================================
-- 004_comments_and_votes.sql — Part 2 of 2: RLS + policies
--
-- Run this AFTER part 1 has succeeded. Tables must exist already so the
-- DROP POLICY statements can resolve cleanly.
-- ============================================================================

-- 0. Drop existing policies (tables are guaranteed to exist after part 1).
DROP POLICY IF EXISTS "Comments are viewable by everyone"          ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments"    ON public.comments;
DROP POLICY IF EXISTS "Authors can update their comments"          ON public.comments;
DROP POLICY IF EXISTS "Authors can delete their comments"          ON public.comments;
DROP POLICY IF EXISTS "Community admins can delete comments in their community" ON public.comments;

DROP POLICY IF EXISTS "Comment votes are viewable by everyone"     ON public.comment_votes;
DROP POLICY IF EXISTS "Authenticated users can vote on comments"   ON public.comment_votes;
DROP POLICY IF EXISTS "Users can update their own comment vote"    ON public.comment_votes;
DROP POLICY IF EXISTS "Users can remove their own comment vote"    ON public.comment_votes;

-- 1. Enable RLS.
ALTER TABLE public.comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;

-- 2. Policies — comments.
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Community admins can delete comments in their community"
  ON public.comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.community_members cm ON cm.community_id = p.community_id
      WHERE p.id = comments.post_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- 3. Policies — comment_votes.
CREATE POLICY "Comment votes are viewable by everyone"
  ON public.comment_votes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote on comments"
  ON public.comment_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment vote"
  ON public.comment_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own comment vote"
  ON public.comment_votes FOR DELETE
  USING (auth.uid() = user_id);