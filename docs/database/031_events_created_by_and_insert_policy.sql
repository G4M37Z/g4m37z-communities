-- ===================================================================
-- 031_events_created_by_and_insert_policy.sql
-- V4 events contract repair (minimal, additive, idempotent):
--   1. Adds events.created_by (FK -> public.profiles(id) ON DELETE SET NULL)
--      so events have a real owner. Until now the events table had no owner
--      column; UPDATE/DELETE could only be exercised by community creators
--      and INSERT allowed any authenticated user to create an event in any
--      community.
--   2. Backfills created_by from the owning community's creator where a
--      community is set. NULL-community events keep created_by NULL until
--      their next edit (no reliable owner is recorded for them today).
--   3. INSERT policy tightened: the caller must be the recorded creator AND
--      either create a standalone event (community_id IS NULL) or be an
--      admin/moderator member of the target community.
--   4. UPDATE/DELETE policies extended: events.created_by = auth.uid() also
--      qualifies as owner (this closes the "NULL-community events cannot be
--      edited by anyone" gap once created_by is set).
-- Re-runnable: ADD COLUMN IF NOT EXISTS, backfill guarded by created_by
-- IS NULL, DROP POLICY IF EXISTS + CREATE POLICY.
-- ===================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by UUID
  REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.events e
SET created_by = c.creator_id
FROM public.communities c
WHERE c.id = e.community_id
  AND e.created_by IS NULL;

DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      community_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.community_members cm
        WHERE cm.community_id = events.community_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('admin', 'moderator')
      )
    )
  );

DROP POLICY IF EXISTS "Event owner can update own event" ON public.events;
CREATE POLICY "Event owner can update own event"
  ON public.events
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR (
      community_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.communities c
        WHERE c.id = events.community_id AND c.creator_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (
      community_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.communities c
        WHERE c.id = events.community_id AND c.creator_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Event owner can delete own event" ON public.events;
CREATE POLICY "Event owner can delete own event"
  ON public.events
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR (
      community_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.communities c
        WHERE c.id = events.community_id AND c.creator_id = auth.uid()
      )
    )
  );
