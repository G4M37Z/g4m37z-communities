-- ============================================================================
-- 012_reputation_policies.sql
-- Phase 1 / V3.1 — secure the reputation_events table for application use.
-- Schema is already in place (master_v3.sql); this migration only adds:
--   1. CHECK constraint on event_type (controlled enum, prevents free-text abuse)
--   2. CHECK constraint on source_type (controlled enum)
--   3. UNIQUE constraint preventing duplicate events for the same source
--   4. RLS policies (SELECT public; INSERT/UPDATE/DELETE service_role only)
-- All operations are additive / non-destructive. Existing rows (if any) are
-- preserved; the new constraints only validate them.
-- ============================================================================

-- 1. Controlled enum via CHECK on event_type.
DO $$ BEGIN
  ALTER TABLE public.reputation_events
    ADD CONSTRAINT reputation_events_event_type_check
    CHECK (event_type IN (
      'POST_CREATED',
      'POST_UPVOTED',
      'POST_DOWNVOTED',
      'COMMENT_CREATED',
      'COMMENT_UPVOTED',
      'COMMENT_DOWNVOTED',
      'COMMUNITY_JOINED',
      'COMMUNITY_CREATED',
      'EVENT_CREATED',
      'EVENT_PARTICIPATED',
      'LFG_HOSTED',
      'LFG_PARTICIPATED',
      'TOURNAMENT_REGISTERED',
      'TOURNAMENT_COMPLETED',
      'REVIEW_POSTED',
      'GAME_FOLLOWED',
      'ACHIEVEMENT_EARNED',
      'MESSAGE_SENT'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Controlled enum via CHECK on source_type.
DO $$ BEGIN
  ALTER TABLE public.reputation_events
    ADD CONSTRAINT reputation_events_source_type_check
    CHECK (source_type IN (
      'post',
      'comment',
      'community',
      'event',
      'lfg_session',
      'tournament',
      'review',
      'game',
      'achievement',
      'message',
      'profile'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. UNIQUE constraint: a single source can only trigger one reputation event
--    of a given type for a given user. Prevents duplicate awards.
DO $$ BEGIN
  ALTER TABLE public.reputation_events
    ADD CONSTRAINT reputation_events_dedup_key
    UNIQUE (user_id, source_type, source_id, event_type);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. RLS policies. Read is public (reputation is a visible score).
--    Write paths are intentionally restricted to the service_role bypass
--    so client-side code cannot tamper with reputation. All write paths
--    MUST go through server-side reputation service helpers.
ALTER TABLE public.reputation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reputation events are viewable by everyone"
  ON public.reputation_events;
CREATE POLICY "Reputation events are viewable by everyone"
  ON public.reputation_events FOR SELECT
  USING (true);

-- No INSERT / UPDATE / DELETE policies for the anon / authenticated roles.
-- Service role bypasses RLS, so the trusted server-side helper still works.
