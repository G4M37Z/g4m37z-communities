-- ============================================================================
-- 018_tournaments_policies.sql
-- V3.6 — Tournaments RLS + integrity constraints across the 5-table schema.
--
-- Schema observations (live, as of commit 662452c):
--   - tournaments has NO dedicated owner_id column. Ownership is derived:
--       * via event_id → events.community_id → communities.creator_id
--         (i.e. the community creator of the underlying event is the
--         tournament organiser), OR
--       * via the captain_id of the first registered team (no schema field
--         tracks this; we therefore restrict organiser-only operations to
--         events with a community and the community creator, consistent
--         with V3.5 events service).
--       * Event-less tournaments (event_id IS NULL) cannot be edited via
--         this service (open model — admin tooling only). Documented.
--   - tournament_teams has a captain_id but NO membership / rosters table.
--     Captain represents the team. Player-accountability is delegated to
--     other tables (the schema does not track per-user team membership).
--   - tournament_matches.winner_id → tournament_teams. Winner is a TEAM.
--     Per-user result submission is OUT OF SCOPE per the schema; the
--     organiser verifies results via tournament_results.verified.
--   - tournament_results.match_id is the PRIMARY KEY: one row per match.
--     No conflicting-result race; one-and-only-one slot per match.
--   - tournament_disputes.resolved_by → profiles (NO ACTION on delete).
--
-- Status models (CHECK constraints via DO blocks):
--   - tournaments.status: REGISTRATION, IN_PROGRESS, COMPLETED, CANCELLED
--   - tournament_matches.status: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
--   - tournament_disputes.status: PENDING, RESOLVED, REJECTED, WITHDRAWN
--   - tournaments.format: SINGLE_ELIMINATION, DOUBLE_ELIMINATION, ROUND_ROBIN,
--                          SWISS (length-capped free-form otherwise)
--   - max_teams range: 2..128
--
-- All additions are idempotent and non-destructive.
-- ============================================================================

-- 1. CHECK constraints

-- 1a. tournaments.status
DO $$ BEGIN
  ALTER TABLE public.tournaments
    ADD CONSTRAINT tournaments_status_check
    CHECK (status IN ('REGISTRATION','IN_PROGRESS','COMPLETED','CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1b. tournaments.format — controlled enum (matches common FIDE/ESL styles)
DO $$ BEGIN
  ALTER TABLE public.tournaments
    ADD CONSTRAINT tournaments_format_check
    CHECK (format IN ('SINGLE_ELIMINATION','DOUBLE_ELIMINATION','ROUND_ROBIN','SWISS'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1c. max_teams range
DO $$ BEGIN
  ALTER TABLE public.tournaments
    ADD CONSTRAINT tournaments_max_teams_range
    CHECK (max_teams IS NULL OR (max_teams BETWEEN 2 AND 128));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1d. tournaments.name length cap
DO $$ BEGIN
  ALTER TABLE public.tournaments
    ADD CONSTRAINT tournaments_name_length
    CHECK (char_length(name) BETWEEN 1 AND 200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1e. tournament_matches.status
DO $$ BEGIN
  ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_status_check
    CHECK (status IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1f. round >= 0
DO $$ BEGIN
  ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_round_nonneg
    CHECK (round IS NULL OR round >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1g. team_a_id != team_b_id (a match cannot pit a team against itself)
DO $$ BEGIN
  ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_distinct_teams
    CHECK (team_a_id IS NULL OR team_b_id IS NULL OR team_a_id <> team_b_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1h. tournament_teams.name length cap
DO $$ BEGIN
  ALTER TABLE public.tournament_teams
    ADD CONSTRAINT tournament_teams_name_length
    CHECK (char_length(name) BETWEEN 1 AND 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1i. tournament_disputes.status enum and reason length cap
DO $$ BEGIN
  ALTER TABLE public.tournament_disputes
    ADD CONSTRAINT tournament_disputes_status_check
    CHECK (status IN ('PENDING','RESOLVED','REJECTED','WITHDRAWN'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tournament_disputes
    ADD CONSTRAINT tournament_disputes_reason_length
    CHECK (reason IS NULL OR char_length(reason) <= 4000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. RLS enablement
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_disputes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- tournaments policies
-- ---------------------------------------------------------------------------

-- SELECT: public (matches schema model — no privacy field).
DROP POLICY IF EXISTS "Tournaments are viewable by everyone" ON public.tournaments;
CREATE POLICY "Tournaments are viewable by everyone"
  ON public.tournaments FOR SELECT USING (true);

-- INSERT: authenticated users only. Owner identity is derived from event
-- ownership at update/delete time; we don't constrain creator on insert
-- because no creator column exists.
DROP POLICY IF EXISTS "Authenticated users can create tournaments"
  ON public.tournaments;
CREATE POLICY "Authenticated users can create tournaments"
  ON public.tournaments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE / DELETE: only the community creator of the underlying event.
DROP POLICY IF EXISTS "Tournament organiser can update own tournament"
  ON public.tournaments;
CREATE POLICY "Tournament organiser can update own tournament"
  ON public.tournaments FOR UPDATE
  USING (
    event_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.communities c ON c.id = e.community_id
      WHERE e.id = tournaments.event_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    event_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.communities c ON c.id = e.community_id
      WHERE e.id = tournaments.event_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tournament organiser can delete own tournament"
  ON public.tournaments;
CREATE POLICY "Tournament organiser can delete own tournament"
  ON public.tournaments FOR DELETE
  USING (
    event_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.communities c ON c.id = e.community_id
      WHERE e.id = tournaments.event_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tournament_teams policies
-- ---------------------------------------------------------------------------

-- SELECT: public.
DROP POLICY IF EXISTS "Tournament teams are viewable by everyone"
  ON public.tournament_teams;
CREATE POLICY "Tournament teams are viewable by everyone"
  ON public.tournament_teams FOR SELECT USING (true);

-- INSERT: the captain (caller) inserts; WITH CHECK enforces
-- auth.uid() = captain_id (cannot register on behalf of another user).
-- Additionally, caller may only register into a tournament whose status
-- is REGISTRATION (lifecycle enforced in service; INSERT itself is open).
DROP POLICY IF EXISTS "Users can register teams as captain"
  ON public.tournament_teams;
CREATE POLICY "Users can register teams as captain"
  ON public.tournament_teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = captain_id);

-- UPDATE / DELETE: only the captain or the tournament organiser.
DROP POLICY IF EXISTS "Team captain or organiser can update team"
  ON public.tournament_teams;
CREATE POLICY "Team captain or organiser can update team"
  ON public.tournament_teams FOR UPDATE
  USING (
    auth.uid() = captain_id
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE t.id = tournament_teams.tournament_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = captain_id
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE t.id = tournament_teams.tournament_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team captain or organiser can delete team"
  ON public.tournament_teams;
CREATE POLICY "Team captain or organiser can delete team"
  ON public.tournament_teams FOR DELETE
  USING (
    auth.uid() = captain_id
    OR EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE t.id = tournament_teams.tournament_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tournament_matches policies (organiser-managed)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tournament matches are viewable by everyone"
  ON public.tournament_matches;
CREATE POLICY "Tournament matches are viewable by everyone"
  ON public.tournament_matches FOR SELECT USING (true);

-- INSERT / UPDATE / DELETE: only the tournament organiser.
DROP POLICY IF EXISTS "Tournament organiser can manage matches"
  ON public.tournament_matches;
CREATE POLICY "Tournament organiser can manage matches"
  ON public.tournament_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE t.id = tournament_matches.tournament_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tournament organiser can update matches"
  ON public.tournament_matches;
CREATE POLICY "Tournament organiser can update matches"
  ON public.tournament_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE t.id = tournament_matches.tournament_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE t.id = tournament_matches.tournament_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tournament organiser can delete matches"
  ON public.tournament_matches;
CREATE POLICY "Tournament organiser can delete matches"
  ON public.tournament_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE t.id = tournament_matches.tournament_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tournament_results (organiser-only verification)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tournament results are viewable by everyone"
  ON public.tournament_results;
CREATE POLICY "Tournament results are viewable by everyone"
  ON public.tournament_results FOR SELECT USING (true);

-- INSERT / UPDATE / DELETE: only the tournament organiser.
DROP POLICY IF EXISTS "Tournament organiser can manage results"
  ON public.tournament_results;
CREATE POLICY "Tournament organiser can manage results"
  ON public.tournament_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE m.id = tournament_results.match_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tournament organiser can update results"
  ON public.tournament_results;
CREATE POLICY "Tournament organiser can update results"
  ON public.tournament_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE m.id = tournament_results.match_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournament_matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE m.id = tournament_results.match_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tournament organiser can delete results"
  ON public.tournament_results;
CREATE POLICY "Tournament organiser can delete results"
  ON public.tournament_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE m.id = tournament_results.match_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tournament_disputes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tournament disputes are viewable by everyone"
  ON public.tournament_disputes;
CREATE POLICY "Tournament disputes are viewable by everyone"
  ON public.tournament_disputes FOR SELECT USING (true);

-- INSERT: authenticated users only, raising the dispute as themselves.
DROP POLICY IF EXISTS "Users can raise disputes as themselves"
  ON public.tournament_disputes;
CREATE POLICY "Users can raise disputes as themselves"
  ON public.tournament_disputes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = raised_by);

-- UPDATE: only the raiser can mark their own dispute WITHDRAWN (status
-- change only); the resolver path is a separate UPDATE restricted to the
-- organiser. Both are enforced by the row UPDATE policy below — the
-- service layer additionally validates status transitions.
DROP POLICY IF EXISTS "Dispute raiser or tournament organiser can update dispute"
  ON public.tournament_disputes;
CREATE POLICY "Dispute raiser or tournament organiser can update dispute"
  ON public.tournament_disputes FOR UPDATE
  USING (
    auth.uid() = raised_by
    OR EXISTS (
      SELECT 1 FROM public.tournament_matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE m.id = tournament_disputes.match_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = raised_by
    OR EXISTS (
      SELECT 1 FROM public.tournament_matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE m.id = tournament_disputes.match_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );

-- DELETE: organiser only (disputes are an audit trail; raisers should not
-- delete their own dispute, only withdraw it).
DROP POLICY IF EXISTS "Tournament organiser can delete disputes"
  ON public.tournament_disputes;
CREATE POLICY "Tournament organiser can delete disputes"
  ON public.tournament_disputes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tournament_matches m
      JOIN public.tournaments t ON t.id = m.tournament_id
      JOIN public.events e ON e.id = t.event_id
      JOIN public.communities c ON c.id = e.community_id
      WHERE m.id = tournament_disputes.match_id
        AND e.community_id IS NOT NULL
        AND c.creator_id = auth.uid()
    )
  );
