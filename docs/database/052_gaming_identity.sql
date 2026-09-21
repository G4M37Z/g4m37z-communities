-- ===================================================================
-- 052_gaming_identity.sql
-- PHASE 1 — Gaming Identity Foundation.
--
-- Builds the relational base the Game Graph (Phase 2) extends:
--   * profiles.gaming_visibility  — privacy gate for the gaming layer
--     ('public' | 'followers' | 'private'). Enforced by RLS on the
--     gaming tables below; profiles itself stays world-readable.
--   * user_games                  — structured user↔game library
--     (owned / playing / want_to_play / favorite / followed). One row
--     per (user, game, status): a game MAY hold several statuses at
--     once (owned + playing + favorite) but never the same status
--     twice. Extensible later (playtime, achievements, ratings) by
--     adding columns/tables keyed on (user_id, game_id) — not done
--     here on purpose.
--   * game_platform_identities    — per-game identity: in-game name,
--     rank label, region, platform. One row per (user, game). No
--     credentials, no external verification claims (mirrors 042).
--
-- Deliberately NOT duplicated:
--   * platform handles          → 042 platform_links (reuse, do not
--     add another identity system).
--   * "followed" as a game edge → game_followers exists; user_games
--     also carries a 'followed' status for library presentation.
--     They are independent on purpose (catalogue follows vs personal
--     library).
--
-- RLS model (mirrors profiles/042 conventions):
--   SELECT  — owner always; others only when the owner's
--             gaming_visibility admits them (public, or followers
--             with an active follow edge).
--   INSERT/UPDATE/DELETE — owner only, WITH CHECK pinned to auth.uid().
--   RLS stays ENABLED on every new table; no anonymous writes.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Gaming visibility on profiles
-- -------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gaming_visibility TEXT NOT NULL DEFAULT 'public';

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_gaming_visibility_check
    CHECK (gaming_visibility IN ('public', 'followers', 'private'));
EXCEPTION
  WHEN duplicate_object THEN NULL; -- re-run safety
END $$;

-- -------------------------------------------------------------------
-- 2. Game library — user_games
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_games (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id      UUID NOT NULL REFERENCES public.games(id)    ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'playing'
               CHECK (status IN ('owned','playing','want_to_play','favorite','followed')),
  note         TEXT CHECK (note IS NULL OR char_length(note) <= 280),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id, status)
);

CREATE INDEX IF NOT EXISTS idx_user_games_user ON public.user_games(user_id);
CREATE INDEX IF NOT EXISTS idx_user_games_game ON public.user_games(game_id);
CREATE INDEX IF NOT EXISTS idx_user_games_user_status ON public.user_games(user_id, status);

ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_games_select ON public.user_games;
CREATE POLICY user_games_select ON public.user_games
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_games.user_id
        AND (
          p.gaming_visibility = 'public'
          OR (
            p.gaming_visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = auth.uid()
                AND f.followed_id = p.id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS user_games_insert ON public.user_games;
CREATE POLICY user_games_insert ON public.user_games
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_games_update ON public.user_games;
CREATE POLICY user_games_update ON public.user_games
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_games_delete ON public.user_games;
CREATE POLICY user_games_delete ON public.user_games
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- -------------------------------------------------------------------
-- 3. Per-game identities — game_platform_identities
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_platform_identities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id       UUID NOT NULL REFERENCES public.games(id)    ON DELETE CASCADE,
  platform_slug TEXT REFERENCES public.platforms(slug) ON DELETE SET NULL,
  in_game_name  TEXT NOT NULL CHECK (char_length(in_game_name) BETWEEN 1 AND 64),
  rank_label    TEXT CHECK (rank_label IS NULL OR char_length(rank_label) <= 64),
  region        TEXT CHECK (region IS NULL OR region ~ '^[A-Za-z0-9][A-Za-z0-9 /-]{0,15}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_identities_user ON public.game_platform_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_game_identities_game ON public.game_platform_identities(game_id);

ALTER TABLE public.game_platform_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_identities_select ON public.game_platform_identities;
CREATE POLICY game_identities_select ON public.game_platform_identities
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = game_platform_identities.user_id
        AND (
          p.gaming_visibility = 'public'
          OR (
            p.gaming_visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = auth.uid()
                AND f.followed_id = p.id
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS game_identities_insert ON public.game_platform_identities;
CREATE POLICY game_identities_insert ON public.game_platform_identities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS game_identities_update ON public.game_platform_identities;
CREATE POLICY game_identities_update ON public.game_platform_identities
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS game_identities_delete ON public.game_platform_identities;
CREATE POLICY game_identities_delete ON public.game_platform_identities
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===================================================================
-- End 052.
-- ===================================================================
