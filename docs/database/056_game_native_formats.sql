-- =====================================================================
-- 056_game_native_formats.sql
-- Makes each game's esports hosting format a first-class, engraved part
-- of tournament creation instead of one template in a flat gallery.
--
--   * tournament_frameworks gains is_official (curated, per-game formats
--     seeded from official/league research vs. user-defined ones)
--   * the 044 per-game frameworks are flagged official
--   * index for the game-first creation filter
--
-- Rationale: non-competitive titles (GTA RP, Roblox experiences) get
-- their "server-style" formats defined by an ADMIN via the framework
-- builder (is_official) — those read as the game's way of running
-- events, not as user templates. Enforcement of the admin gate lives
-- in frameworks-service.ts (the SSE layer), matching the security model.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS / guarded UPDATE).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Official/curated flag
-- ---------------------------------------------------------------------

ALTER TABLE public.tournament_frameworks
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 2. Flag the 044 per-game formats as the games' official hosting styles
--    (idempotent: matched by slug, re-run safe)
-- ---------------------------------------------------------------------

UPDATE public.tournament_frameworks
SET is_official = true
WHERE slug IN (
  'pubg-br-points',
  'fncs-style-points',
  'football-league-knockout',
  'efootball-pro-cup',
  'cod-cdl-series',
  'mk-fighting-double-elim',
  'gta-racing-cup',
  'roblox-multi-experience'
);

-- ---------------------------------------------------------------------
-- 3. Index for the game-first creation query (game's formats, official first)
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_frameworks_game_official
  ON public.tournament_frameworks(game_id, is_official);

-- =====================================================================
-- End 056.
-- =====================================================================
