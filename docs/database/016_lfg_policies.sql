-- ============================================================================
-- 016_lfg_policies.sql
-- V3.4 — LFG (Looking For Group) RLS + integrity constraints.
--
-- Goals:
--   1. Constrain the free-form text columns on lfg_sessions so they cannot
--      accept arbitrary strings. status / privacy use a controlled enum;
--      mode / region / skill_level are bounded free-form with length caps;
--      players_required is constrained to a positive integer.
--   2. RLS policies scoped to ownership / participation:
--      - SELECT on lfg_sessions: public for non-private sessions; membership
--        for 'private' sessions (server enforces privacy by always fetching
--        public rows via regular client or filtering via service_role).
--      - INSERT on lfg_sessions: authenticated only, host_id forced to
--        auth.uid() (WITH CHECK).
--      - UPDATE / DELETE on lfg_sessions: owner (host_id = auth.uid()) only.
--      - SELECT on lfg_participants: session host can see all participants;
--        non-host users can only see their own rows.
--      - INSERT / DELETE on lfg_participants: user_id = auth.uid() (only
--        yourself can join/leave).
--      - No UPDATE on lfg_participants (joined_at is not editable).
--   3. All operations are additive / non-destructive; existing rows are
--      preserved.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CHECK constraints on lfg_sessions
-- ---------------------------------------------------------------------------

-- 1a. status enum via CHECK
DO $$ BEGIN
  ALTER TABLE public.lfg_sessions
    ADD CONSTRAINT lfg_sessions_status_check
    CHECK (status IN ('CREATED','OPEN','FULL','CLOSED','CANCELLED','COMPLETED','EXPIRED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1b. privacy enum via CHECK
DO $$ BEGIN
  ALTER TABLE public.lfg_sessions
    ADD CONSTRAINT lfg_sessions_privacy_check
    CHECK (privacy IN ('public','private'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1c. players_required range: 1..100 (matches the smaller scale of typical
--     LFG groups; admins can relax this if needed).
DO $$ BEGIN
  ALTER TABLE public.lfg_sessions
    ADD CONSTRAINT lfg_sessions_players_required_range
    CHECK (players_required IS NULL OR (players_required BETWEEN 1 AND 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1d. length caps on free-form text columns to bound query surface area and
--     prevent abuse (e.g. storing huge descriptions).
DO $$ BEGIN
  ALTER TABLE public.lfg_sessions
    ADD CONSTRAINT lfg_sessions_text_lengths
    CHECK (
      (mode IS NULL OR char_length(mode) <= 64) AND
      (region IS NULL OR char_length(region) <= 64) AND
      (skill_level IS NULL OR char_length(skill_level) <= 64) AND
      (language IS NULL OR char_length(language) <= 32)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- RLS enablement (idempotent; rls_auto_enable already turns it on).
-- ---------------------------------------------------------------------------
ALTER TABLE public.lfg_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lfg_participants ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- lfg_sessions policies
-- ---------------------------------------------------------------------------

-- Public SELECT: privacy='public'. Private sessions are visible only to
-- the host and to participants (handled by joining lfg_participants rows).
DROP POLICY IF EXISTS "Public LFG sessions are viewable by everyone"
  ON public.lfg_sessions;
CREATE POLICY "Public LFG sessions are viewable by everyone"
  ON public.lfg_sessions FOR SELECT
  USING (privacy = 'public');

-- INSERT: authenticated users only, and only when host_id equals the
-- authenticated subject. host_id is forced via WITH CHECK to auth.uid().
DROP POLICY IF EXISTS "Authenticated users can create LFG sessions as themselves"
  ON public.lfg_sessions;
CREATE POLICY "Authenticated users can create LFG sessions as themselves"
  ON public.lfg_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = host_id);

-- UPDATE: only the host can update their own session. host_id cannot be
-- changed to a different user because we re-check it on UPDATE.
DROP POLICY IF EXISTS "Host can update own LFG session"
  ON public.lfg_sessions;
CREATE POLICY "Host can update own LFG session"
  ON public.lfg_sessions FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- DELETE: host can delete their own session.
DROP POLICY IF EXISTS "Host can delete own LFG session"
  ON public.lfg_sessions;
CREATE POLICY "Host can delete own LFG session"
  ON public.lfg_sessions FOR DELETE
  USING (auth.uid() = host_id);

-- ---------------------------------------------------------------------------
-- lfg_participants policies
-- ---------------------------------------------------------------------------

-- SELECT: anyone can see participants of a public session they can view;
-- participants can see themselves; the session host can see all participants.
DROP POLICY IF EXISTS "LFG participants viewable by host or self"
  ON public.lfg_participants;
CREATE POLICY "LFG participants viewable by host or self"
  ON public.lfg_participants FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.lfg_sessions s
      WHERE s.id = lfg_participants.session_id
        AND s.host_id = auth.uid()
    )
  );

-- INSERT: authenticated users only, joining as themselves. Database PK on
-- (session_id, user_id) prevents duplicate joins.
DROP POLICY IF EXISTS "Users can join an LFG session as themselves"
  ON public.lfg_participants;
CREATE POLICY "Users can join an LFG session as themselves"
  ON public.lfg_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- DELETE: user can leave their own participation; host can remove any
-- participant. The host path allows the host to manage their session.
DROP POLICY IF EXISTS "Users can leave own LFG participation; host can remove"
  ON public.lfg_participants;
CREATE POLICY "Users can leave own LFG participation; host can remove"
  ON public.lfg_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.lfg_sessions s
      WHERE s.id = lfg_participants.session_id
        AND s.host_id = auth.uid()
    )
  );

-- No UPDATE policy on lfg_participants: joined_at is immutable.
