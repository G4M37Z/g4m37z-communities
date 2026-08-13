-- ============================================================================
-- 004_comments_and_votes.sql — Part 1 of 2: Tables, indexes, column, trigger
--
-- Run this FIRST. Pure DDL — no policy work. Safe to re-run (all IF EXISTS).
-- ============================================================================

-- 1. comments (threaded, parent_id → comments.id)
CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT comment_body_length CHECK (char_length(body) BETWEEN 1 AND 10000),
  CONSTRAINT comment_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

-- 2. comment_votes
CREATE TABLE IF NOT EXISTS public.comment_votes (
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON public.comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id          ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id          ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id    ON public.comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id       ON public.comment_votes(user_id);

-- 4. Add posts.comment_count column if missing.
DO $col$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'comment_count'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_posts_comment_count ON public.posts(comment_count);
  END IF;
END $col$;

-- 5. Trigger function — recreated idempotently each run.
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger
DROP TRIGGER IF EXISTS trg_update_post_comment_count ON public.comments;
CREATE TRIGGER trg_update_post_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_comment_count();