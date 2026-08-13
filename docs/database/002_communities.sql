-- ============================================================================
-- 002_communities.sql
--
-- Schema for Milestone 3: Communities.
--
-- Tables:
--   communities          — name, slug, description, icon/banner, creator
--   community_members    — user/community + role (member/moderator/admin)
--   community_categories — taxonomy (gaming topics like eFootball, GTA, ...)
--   community_category_links — many-to-many join
--
-- Plus indexes, RLS, and a helper function for creator-as-admin membership.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. community_categories
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_categories_slug
  ON public.community_categories(slug);

ALTER TABLE public.community_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.community_categories;
CREATE POLICY "Categories are viewable by everyone" ON public.community_categories
  FOR SELECT USING (true);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. communities
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT,
  banner_url TEXT,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT community_slug_format CHECK (
    slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'
  )
);

CREATE INDEX IF NOT EXISTS idx_communities_slug ON public.communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_creator_id ON public.communities(creator_id);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON public.communities(created_at DESC);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Communities are viewable by everyone" ON public.communities;
CREATE POLICY "Communities are viewable by everyone" ON public.communities
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.communities;
CREATE POLICY "Authenticated users can create communities" ON public.communities
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their communities" ON public.communities;
CREATE POLICY "Creators can update their communities" ON public.communities
  FOR UPDATE USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete their communities" ON public.communities;
CREATE POLICY "Creators can delete their communities" ON public.communities
  FOR DELETE USING (auth.uid() = creator_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 3. community_members
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_members (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_user_id
  ON public.community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community_id
  ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_role
  ON public.community_members(community_id, role);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Memberships are viewable by everyone" ON public.community_members;
CREATE POLICY "Memberships are viewable by everyone" ON public.community_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join communities themselves" ON public.community_members;
CREATE POLICY "Users can join communities themselves" ON public.community_members
  FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'member');

-- Leaving a community = deleting the membership row.
DROP POLICY IF EXISTS "Users can leave communities themselves" ON public.community_members;
CREATE POLICY "Users can leave communities themselves" ON public.community_members
  FOR DELETE USING (auth.uid() = user_id);

-- Role changes (moderator/admin promotion) require elevated permissions.
-- For v0.1 we don't expose role escalation through RLS — admins use the
-- service_role client in Milestone 8. We still grant UPDATE so legitimate
-- flows don't break, gated by auth.uid() = user_id (you can only edit
-- your own membership row, and only the role-allowing code path runs).
-- For now we restrict UPDATE to non-role changes only is not expressible
-- in RLS, so we deny UPDATE entirely in v0.1 and revisit in Milestone 8.
DROP POLICY IF EXISTS "Users cannot change their own role" ON public.community_members;
CREATE POLICY "Users cannot change their own role" ON public.community_members
  FOR UPDATE USING (false);

-- ──────────────────────────────────────────────────────────────────────────
-- 4. community_category_links  (many-to-many join)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_category_links (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.community_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (community_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_community_category_links_category
  ON public.community_category_links(category_id);

ALTER TABLE public.community_category_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Category links are viewable by everyone" ON public.community_category_links;
CREATE POLICY "Category links are viewable by everyone" ON public.community_category_links
  FOR SELECT USING (true);

-- Only the community creator can tag their community.
DROP POLICY IF EXISTS "Creators can tag their community" ON public.community_category_links;
CREATE POLICY "Creators can tag their community" ON public.community_category_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_id AND creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Creators can untag their community" ON public.community_category_links;
CREATE POLICY "Creators can untag their community" ON public.community_category_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE id = community_id AND creator_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Helper trigger: when a community is created, automatically add the
--    creator as an admin member. SECURITY DEFINER so it runs as table owner
--    and bypasses the WITH CHECK guard on community_members.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_community()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_community_created ON public.communities;
CREATE TRIGGER on_community_created
AFTER INSERT ON public.communities
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_community();

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Seed default gaming categories (idempotent — uses ON CONFLICT).
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO public.community_categories (slug, name) VALUES
  ('efootball',     'eFootball'),
  ('ea-fc',         'EA FC / FIFA'),
  ('gta',           'GTA'),
  ('call-of-duty',  'Call of Duty'),
  ('roblox',        'Roblox'),
  ('fortnite',      'Fortnite'),
  ('rpg',           'RPG'),
  ('pc-gaming',     'PC Gaming'),
  ('playstation',   'PlayStation'),
  ('xbox',          'Xbox'),
  ('nintendo',      'Nintendo'),
  ('mobile-gaming', 'Mobile Gaming')
ON CONFLICT (slug) DO NOTHING;
