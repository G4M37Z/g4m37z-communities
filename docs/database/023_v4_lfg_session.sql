-- ============================================================================
-- 023_v4_lfg_session.sql
-- V4 LFG Session table — REVISED (additive).
--
-- History:
--   The original V4 file defined a brand-new, incompatible `lfg_sessions`
--   table (game_slug / created_by / status in the draft-live-cancelled enum).
--   That definition was never applied: the live DB already holds the V3
--   lfg_sessions table (016_lfg_policies.sql) with its own columns
--   (game_id, host_id, platform_id, ...) and its own status enum
--   (CREATED/OPEN/FULL/CLOSED/CANCELLED/COMPLETED/EXPIRED). Because
--   CREATE TABLE IF NOT EXISTS would silently no-op against the existing
--   table and the old policy bodies referenced columns that do not exist,
--   the original file would (a) change nothing and then (b) error out.
--
--   This revision is additive and non-destructive. It keeps the V3 table
--   intact and only:
--     1. adds a `description` column (nullable, no default) that the
--        original V4 shape carried and V3 lacks,
--     2. re-enables RLS idempotently (policies live in 016_lfg_policies.sql).
--   It does NOT alter `status`/`privacy` enums nor any V3 columns, so the
--   existing LFG service and UI keep working unchanged.
-- ============================================================================

-- 1. Additive column from the original V4 design that V3 was missing.
ALTER TABLE public.lfg_sessions
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. RLS re-assertion (idempotent). The full policy set is defined in
--    016_lfg_policies.sql; this only guards against RLS being disabled.
ALTER TABLE public.lfg_sessions ENABLE ROW LEVEL SECURITY;