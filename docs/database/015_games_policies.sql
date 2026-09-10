-- ============================================================================
-- 015_games_policies.sql
-- V3.3 — RLS policies + integrity constraints for the Game Discovery schema.
--
-- Goals:
--   1. Make catalogue data (games, genres, platforms, game_genres,
--      game_platforms) publicly readable.
--   2. Constrain user-owned data (game_followers, game_reviews) so each
--      authenticated user only sees/mutates their own rows. Explicit
--      ownership checks via auth.uid() = user_id.
--   3. Add score-range CHECK constraints on game_reviews so reviews cannot
--      exceed or fall below a sane range.
--   4. Add a useful baseline genre/platform seed so the catalogue isn't
--      empty (idempotent via ON CONFLICT).
--
-- All changes are additive / non-destructive. Existing tables, indexes,
-- RLS settings, and P0/V1/V2/V3.1/V3.2 protections are preserved.
-- ============================================================================

-- 1. Score range constraints: 1..10 for *_score fields, 0..100 for overall.
DO $$ BEGIN
  ALTER TABLE public.game_reviews
    ADD CONSTRAINT game_reviews_score_range_1_10
    CHECK (
      (gameplay_score IS NULL OR (gameplay_score BETWEEN 1 AND 10)) AND
      (graphics_score IS NULL OR (graphics_score BETWEEN 1 AND 10)) AND
      (performance_score IS NULL OR (performance_score BETWEEN 1 AND 10)) AND
      (story_score IS NULL OR (story_score BETWEEN 1 AND 10)) AND
      (audio_score IS NULL OR (audio_score BETWEEN 1 AND 10)) AND
      (value_score IS NULL OR (value_score BETWEEN 1 AND 10)) AND
      (overall_score IS NULL OR (overall_score BETWEEN 0 AND 100))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Reasonable body length cap on review text.
DO $$ BEGIN
  ALTER TABLE public.game_reviews
    ADD CONSTRAINT game_reviews_body_length
    CHECK (body IS NULL OR char_length(body) <= 8000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. RLS is already enabled on all game tables via rls_auto_enable; explicitly
--    re-enable to make this migration self-contained against future drift.
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_reviews ENABLE ROW LEVEL SECURITY;

-- 4. Catalogue policies: public SELECT; no client writes (admin tooling only).
DROP POLICY IF EXISTS "Games are viewable by everyone" ON public.games;
CREATE POLICY "Games are viewable by everyone" ON public.games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Genres are viewable by everyone" ON public.genres;
CREATE POLICY "Genres are viewable by everyone" ON public.genres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platforms are viewable by everyone" ON public.platforms;
CREATE POLICY "Platforms are viewable by everyone" ON public.platforms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Game genres are viewable by everyone" ON public.game_genres;
CREATE POLICY "Game genres are viewable by everyone" ON public.game_genres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Game platforms are viewable by everyone" ON public.game_platforms;
CREATE POLICY "Game platforms are viewable by everyone" ON public.game_platforms FOR SELECT USING (true);

-- 5. Followers policies.
--    Public SELECT so games can show follower counts (caller joins a count only).
DROP POLICY IF EXISTS "Game followers are viewable by everyone" ON public.game_followers;
CREATE POLICY "Game followers are viewable by everyone" ON public.game_followers FOR SELECT USING (true);

--    Mutations restricted to authenticated users for their own rows.
DROP POLICY IF EXISTS "Users can follow a game for themselves" ON public.game_followers;
CREATE POLICY "Users can follow a game for themselves"
  ON public.game_followers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unfollow a game for themselves" ON public.game_followers;
CREATE POLICY "Users can unfollow a game for themselves"
  ON public.game_followers FOR DELETE
  USING (auth.uid() = user_id);

--    Update is meaningful only for denormalised fields if any; allow self-only.
DROP POLICY IF EXISTS "Users can update their own follow rows" ON public.game_followers;
CREATE POLICY "Users can update their own follow rows"
  ON public.game_followers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Reviews policies.
--    Public SELECT so game pages can show reviews.
DROP POLICY IF EXISTS "Game reviews are viewable by everyone" ON public.game_reviews;
CREATE POLICY "Game reviews are viewable by everyone" ON public.game_reviews FOR SELECT USING (true);

--    INSERT: authenticated users only, and only as themselves (user_id forced
--    from auth.uid() at the application layer; RLS enforces it as defense).
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.game_reviews;
CREATE POLICY "Users can insert their own reviews"
  ON public.game_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

--    UPDATE: self only.
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.game_reviews;
CREATE POLICY "Users can update their own reviews"
  ON public.game_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

--    DELETE: self only.
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.game_reviews;
CREATE POLICY "Users can delete their own reviews"
  ON public.game_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Seed a small baseline catalogue so discovery/browse pages have
--    something to render. Idempotent via ON CONFLICT (slug).
INSERT INTO public.genres (name, slug) VALUES
  ('Action', 'action'),
  ('Adventure', 'adventure'),
  ('RPG', 'rpg'),
  ('Strategy', 'strategy'),
  ('Simulation', 'simulation'),
  ('Sports', 'sports'),
  ('Puzzle', 'puzzle'),
  ('Shooter', 'shooter')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.platforms (name, slug) VALUES
  ('PC', 'pc'),
  ('PlayStation', 'playstation'),
  ('Xbox', 'xbox'),
  ('Nintendo Switch', 'nintendo-switch'),
  ('Mobile', 'mobile')
ON CONFLICT (slug) DO NOTHING;
