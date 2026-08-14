-- 1. Table: community_categories (gaming topics)
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

-- Seed initial gaming categories
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
