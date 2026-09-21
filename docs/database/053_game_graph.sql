-- ===================================================================
-- 053_game_graph.sql
-- PHASE 2 — Game Graph.
--
-- Wires the game catalogue into the content graph:
--   * communities.game_id — optional primary game for a community.
--   * posts.game_id       — optional game context on a post.
--
-- Both nullable with ON DELETE SET NULL: a removed catalogue entry
-- must never destroy user content, and game-agnostic communities/
-- posts stay exactly as they are today. No join tables on purpose —
-- one primary game per community, at most one game per post; many-
-- to-many is a later, explicit decision (docs/GAME_GRAPH.md).
--
-- RLS: unchanged. communities/posts keep their existing world-read/
-- owner-write policies; games is public catalogue data. The hub's
-- player fan-out is filtered by the 052 gaming-visibility policies
-- at the database level.
-- ===================================================================

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.games(id) ON DELETE SET NULL;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.games(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_communities_game ON public.communities(game_id);
CREATE INDEX IF NOT EXISTS idx_posts_game ON public.posts(game_id);

-- ===================================================================
-- End 053.
-- ===================================================================
