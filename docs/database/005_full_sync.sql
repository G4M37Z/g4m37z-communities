-- ============================================================================
-- G4M37Z Communities — Full Schema Sync (idempotent) — FIXED v2
-- Run this ONCE in Supabase SQL Editor. Handles all existing state.
-- Covers: profiles, community_categories, communities, community_members,
--         posts, post_votes, comments, comment_votes, storage bucket
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. SAFE DROP OF ALL POLICIES that reference community_members
--    (must drop before we can drop/recreate tables)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Community admins can delete posts in their community" ON public.posts;
DROP POLICY IF EXISTS "Community admins can delete comments in their community" ON public.comments;
DROP POLICY IF EXISTS "Moderators can update member roles" ON public.community_members;
DROP POLICY IF EXISTS "Moderators can remove members" ON public.community_members;
DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
DROP POLICY IF EXISTS "Users can leave communities" ON public.community_members;
DROP POLICY IF EXISTS "Memberships are viewable by everyone" ON public.community_members;
DROP POLICY IF EXISTS "Creator can delete own community" ON public.communities;
DROP POLICY IF EXISTS "Creator can update own community" ON public.communities;
DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.communities;
DROP POLICY IF EXISTS "Communities are viewable by everyone" ON public.communities;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.community_categories;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can update their posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can delete their posts" ON public.posts;
DROP POLICY IF EXISTS "Votes are viewable by everyone" ON public.post_votes;
DROP POLICY IF EXISTS "Authenticated users can vote" ON public.post_votes;
DROP POLICY IF EXISTS "Users can update their own vote" ON public.post_votes;
DROP POLICY IF EXISTS "Users can remove their own vote" ON public.post_votes;
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Authors can update their comments" ON public.comments;
DROP POLICY IF EXISTS "Authors can delete their comments" ON public.comments;
DROP POLICY IF EXISTS "Comment votes are viewable by everyone" ON public.comment_votes;
DROP POLICY IF EXISTS "Authenticated users can vote on comments" ON public.comment_votes;
DROP POLICY IF EXISTS "Users can update their own comment vote" ON public.comment_votes;
DROP POLICY IF EXISTS "Users can remove their own comment vote" ON public.comment_votes;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

-- Storage policies (safe to drop even if bucket doesn't exist)
DROP POLICY IF EXISTS "Anyone can read post images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Authors can update their post images" ON storage.objects;
DROP POLICY IF EXISTS "Authors can delete their post images" ON storage.objects;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. community_categories
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_categories_slug ON public.community_categories(slug);

ALTER TABLE public.community_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone" ON public.community_categories
  FOR SELECT USING (true);

INSERT INTO public.community_categories (slug, name) VALUES
  ('efootball', 'eFootball'),
  ('fifa-ea-fc', 'FIFA / EA FC'),
  ('gta', 'GTA'),
  ('call-of-duty', 'Call of Duty'),
  ('roblox', 'Roblox'),
  ('fortnite', 'Fortnite'),
  ('rpg', 'RPG'),
  ('pc-gaming', 'PC Gaming'),
  ('playstation', 'PlayStation'),
  ('xbox', 'Xbox'),
  ('nintendo', 'Nintendo'),
  ('mobile-gaming', 'Mobile Gaming')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. communities — ensure category_id column exists
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add category_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.communities ADD COLUMN category_id UUID REFERENCES public.community_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_communities_slug ON public.communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_creator_id ON public.communities(creator_id);
CREATE INDEX IF NOT EXISTS idx_communities_category_id ON public.communities(category_id);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON public.communities(created_at);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Communities are viewable by everyone" ON public.communities
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create communities" ON public.communities
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update own community" ON public.communities
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creator can delete own community" ON public.communities
  FOR DELETE USING (auth.uid() = creator_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. community_members — guard constraint creation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_members (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (community_id, user_id)
);

-- Add role check constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name = 'community_members_role_check'
  ) THEN
    ALTER TABLE public.community_members
      ADD CONSTRAINT community_members_role_check
      CHECK (role IN ('member', 'moderator', 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON public.community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_role ON public.community_members(role);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Memberships are viewable by everyone" ON public.community_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join communities" ON public.community_members
  FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'member');

CREATE POLICY "Users can leave communities" ON public.community_members
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Moderators can update member roles" ON public.community_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('moderator', 'admin')
    )
  );

CREATE POLICY "Moderators can remove members" ON public.community_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('moderator', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. posts
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  comment_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT post_title_length CHECK (char_length(title) BETWEEN 3 AND 200),
  CONSTRAINT post_body_length CHECK (body IS NULL OR char_length(body) <= 20000)
);

CREATE INDEX IF NOT EXISTS idx_posts_community_id_created_at ON public.posts(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_comment_count ON public.posts(comment_count);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts are viewable by everyone" ON public.posts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their posts" ON public.posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their posts" ON public.posts
  FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Community admins can delete posts in their community" ON public.posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. post_votes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_votes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_votes_post_id ON public.post_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_votes_user_id ON public.post_votes(user_id);

ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are viewable by everyone" ON public.post_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote" ON public.post_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vote" ON public.post_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own vote" ON public.post_votes
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. comments
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT comment_body_length CHECK (char_length(body) BETWEEN 1 AND 10000),
  CONSTRAINT comment_no_self_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON public.comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone" ON public.comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their comments" ON public.comments
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their comments" ON public.comments
  FOR DELETE USING (auth.uid() = author_id);

CREATE POLICY "Community admins can delete comments in their community" ON public.comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      JOIN public.community_members cm ON cm.community_id = p.community_id
      WHERE p.id = comments.post_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. comment_votes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_votes (
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON public.comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON public.comment_votes(user_id);

ALTER TABLE public.comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment votes are viewable by everyone" ON public.comment_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can vote on comments" ON public.comment_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment vote" ON public.comment_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove their own comment vote" ON public.comment_votes
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. comment_count trigger on posts
-- ─────────────────────────────────────────────────────────────────────────────
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

DROP TRIGGER IF EXISTS trg_update_post_comment_count ON public.comments;
CREATE TRIGGER trg_update_post_comment_count
AFTER INSERT OR DELETE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_comment_count();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. profiles (already exists from Milestone 1 — just ensure policies)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Storage bucket for post images
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (each in its own block to avoid failure cascading)
DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can read post images" ON storage.objects';
  EXECUTE 'CREATE POLICY "Anyone can read post images" ON storage.objects
    FOR SELECT USING (bucket_id = ' || quote_literal('post-images') || ')';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage SELECT policy skipped: %', SQLERRM;
END $storage$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects';
  EXECUTE 'CREATE POLICY "Authenticated users can upload post images" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = ' || quote_literal('post-images') || '
      AND auth.uid() IS NOT NULL
      AND (storage.foldername(name))[1] = auth.uid()::text
    )';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage INSERT policy skipped: %', SQLERRM;
END $storage$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authors can update their post images" ON storage.objects';
  EXECUTE 'CREATE POLICY "Authors can update their post images" ON storage.objects
    FOR UPDATE USING (
      bucket_id = ' || quote_literal('post-images') || '
      AND (storage.foldername(name))[1] = auth.uid()::text
    )';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage UPDATE policy skipped: %', SQLERRM;
END $storage$;

DO $storage$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authors can delete their post images" ON storage.objects';
  EXECUTE 'CREATE POLICY "Authors can delete their post images" ON storage.objects
    FOR DELETE USING (
      bucket_id = ' || quote_literal('post-images') || '
      AND (storage.foldername(name))[1] = auth.uid()::text
    )';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage DELETE policy skipped: %', SQLERRM;
END $storage$;

-- ============================================================================
-- DONE. All tables, indexes, RLS, policies, triggers, and storage synced.
-- ============================================================================
