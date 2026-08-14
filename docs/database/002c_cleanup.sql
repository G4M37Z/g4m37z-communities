-- Safe cleanup first: drop policies if they exist, then drop tables if they exist
-- Run this BEFORE the create chunks if you had partial failures

-- Drop policies on community_members (if table exists)
DROP POLICY IF EXISTS "Memberships are viewable by everyone" ON public.community_members;
DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
DROP POLICY IF EXISTS "Users can leave communities" ON public.community_members;
DROP POLICY IF EXISTS "Moderators can update member roles" ON public.community_members;
DROP POLICY IF EXISTS "Moderators can remove members" ON public.community_members;

-- Drop policies on communities (if table exists)
DROP POLICY IF EXISTS "Communities are viewable by everyone" ON public.communities;
DROP POLICY IF EXISTS "Authenticated users can create communities" ON public.communities;
DROP POLICY IF EXISTS "Creator can update own community" ON public.communities;
DROP POLICY IF EXISTS "Creator can delete own community" ON public.communities;

-- Drop policies on community_categories (if table exists)
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.community_categories;

-- Drop tables in dependency order
DROP TABLE IF EXISTS public.community_members;
DROP TABLE IF EXISTS public.communities;
DROP TABLE IF EXISTS public.community_categories;
