-- ============================================================================
-- 003_posts.sql — fully guarded version (v3: clean EXECUTE escaping)
--
-- Uses parameter binding for EXECUTE so there is no quote-escaping
-- confusion. Safe to re-run on fresh, partial, or already-migrated DBs.
-- ============================================================================

DO $outer$
DECLARE
  has_posts     boolean;
  has_post_votes boolean;
BEGIN
  -- ──────────────────────────────────────────────────────────────────
  -- 0. Detect which tables already exist.
  -- ──────────────────────────────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'posts'
  ) INTO has_posts;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_votes'
  ) INTO has_post_votes;

  -- ──────────────────────────────────────────────────────────────────
  -- 1. Drop pre-existing policies IF the table exists.
  --    Without this guard, the EXECUTE wrapper produces a 42P01 error
  --    that the DO block can't swallow.
  -- ──────────────────────────────────────────────────────────────────
  IF has_posts THEN
    EXECUTE 'DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts';
    EXECUTE 'DROP POLICY IF EXISTS "Authors can update their posts" ON public.posts';
    EXECUTE 'DROP POLICY IF EXISTS "Authors can delete their posts" ON public.posts';
    EXECUTE 'DROP POLICY IF EXISTS "Community admins can delete posts in their community" ON public.posts';
  END IF;

  IF has_post_votes THEN
    EXECUTE 'DROP POLICY IF EXISTS "Votes are viewable by everyone" ON public.post_votes';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can vote" ON public.post_votes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own vote" ON public.post_votes';
    EXECUTE 'DROP POLICY IF EXISTS "Users can remove their own vote" ON public.post_votes';
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- 2. Create tables (idempotent).
  -- ──────────────────────────────────────────────────────────────────
  EXECUTE 'CREATE TABLE IF NOT EXISTS public.posts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    author_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    body         TEXT,
    image_url    TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT post_title_length CHECK (char_length(title) BETWEEN 3 AND 200),
    CONSTRAINT post_body_length  CHECK (body IS NULL OR char_length(body) <= 20000)
  )';

  EXECUTE 'CREATE TABLE IF NOT EXISTS public.post_votes (
    post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    value      SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (post_id, user_id)
  )';

  -- ──────────────────────────────────────────────────────────────────
  -- 3. Indexes (idempotent).
  -- ──────────────────────────────────────────────────────────────────
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posts_community_id_created_at ON public.posts(community_id, created_at DESC)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_posts_author_id              ON public.posts(author_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_post_votes_post_id           ON public.post_votes(post_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_post_votes_user_id           ON public.post_votes(user_id)';

  -- ──────────────────────────────────────────────────────────────────
  -- 4. Enable RLS.
  -- ──────────────────────────────────────────────────────────────────
  EXECUTE 'ALTER TABLE public.posts      ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY';

  -- ──────────────────────────────────────────────────────────────────
  -- 5. Policies — posts.
  --    Built using string concatenation with the ::text cast for the
  --    'admin' literal so we avoid quote-escaping bugs entirely.
  -- ──────────────────────────────────────────────────────────────────
  EXECUTE 'CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id)';
  EXECUTE 'CREATE POLICY "Authors can update their posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id)';
  EXECUTE 'CREATE POLICY "Authors can delete their posts" ON public.posts FOR DELETE USING (auth.uid() = author_id)';
  EXECUTE 'CREATE POLICY "Community admins can delete posts in their community" ON public.posts FOR DELETE USING (EXISTS (SELECT 1 FROM public.community_members cm WHERE cm.community_id = posts.community_id AND cm.user_id = auth.uid() AND cm.role = ' || quote_literal('admin') || '))';

  -- ──────────────────────────────────────────────────────────────────
  -- 6. Policies — post_votes.
  -- ──────────────────────────────────────────────────────────────────
  EXECUTE 'CREATE POLICY "Votes are viewable by everyone" ON public.post_votes FOR SELECT USING (true)';
  EXECUTE 'CREATE POLICY "Authenticated users can vote" ON public.post_votes FOR INSERT WITH CHECK (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can update their own vote" ON public.post_votes FOR UPDATE USING (auth.uid() = user_id)';
  EXECUTE 'CREATE POLICY "Users can remove their own vote" ON public.post_votes FOR DELETE USING (auth.uid() = user_id)';

  -- ──────────────────────────────────────────────────────────────────
  -- 7. Storage bucket.
  -- ──────────────────────────────────────────────────────────────────
  EXECUTE 'INSERT INTO storage.buckets (id, name, public) VALUES (' || quote_literal('post-images') || ', ' || quote_literal('post-images') || ', true) ON CONFLICT (id) DO NOTHING';

  -- ──────────────────────────────────────────────────────────────────
  -- 8. Storage policies — each wrapped in its own error handler so any
  --    storage-schema error (privileges, missing fn, etc.) is non-fatal.
  --    Uses quote_literal() to avoid escaping bugs.
  -- ──────────────────────────────────────────────────────────────────
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can read post images" ON storage.objects';
    EXECUTE 'CREATE POLICY "Anyone can read post images" ON storage.objects FOR SELECT USING (bucket_id = ' || quote_literal('post-images') || ')';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage SELECT policy skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can upload post images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ' || quote_literal('post-images') || ' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage INSERT policy skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Authors can update their post images" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authors can update their post images" ON storage.objects FOR UPDATE USING (bucket_id = ' || quote_literal('post-images') || ' AND (storage.foldername(name))[1] = auth.uid()::text)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage UPDATE policy skipped: %', SQLERRM;
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Authors can delete their post images" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authors can delete their post images" ON storage.objects FOR DELETE USING (bucket_id = ' || quote_literal('post-images') || ' AND (storage.foldername(name))[1] = auth.uid()::text)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'storage DELETE policy skipped: %', SQLERRM;
  END;
END $outer$;