-- ============================================================================
-- 045_launch_hardening.sql
--
-- Launch-readiness hardening (all changes additive / idempotent / re-runnable):
--
--   1. Unique constraint on reposts(post_id, reposter_id) — the service layer
--      already relies on 23505 (duplicate_key_violation) being caught as an
--      idempotent re-repost, but the constraint was never applied, so the
--      guard silently never fired.
--   2. community_members.left_at — soft-leave column so that an admin or
--      moderator who leaves a community does NOT lose their role on rejoin
--      (previously the membership row was hard-deleted, so rejoin re-created
--      it as a plain member).
--   3. join_community() / leave_community() SECURITY DEFINER RPCs — the only
--      place membership rows may be (un)joined and left_at flipped; neither
--      function can ever mutate the role column, so self-service cannot
--      escalate privileges.
--   4. posts INSERT policy — the caller must be an ACTIVE member of the
--      target community (previously any authenticated user could post into
--      any community, including private ones).
--   5. Policy updates across posts / events / communities / voice_rooms /
--      voice_room_participants that treat community_members membership as a
--      capability now exclude soft-left members (left_at IS NULL).
--   6. webrtc_signals INSERT — the sender must be a participant of the
--      target room (previously any authenticated user could inject signals
--      into any room).
--   7. Storage: avatars & post-images UPDATE policies gain WITH CHECK; voice
--      recordings become owner-only readable instead of readable by every
--      authenticated user.
--   8. create_direct_conversation() now refuses to start threads with a
--      blocked user (either direction) — surfaced as the same P0002
--      "recipient not found" so block state is not leaked.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. reposts unique constraint
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reposts_reposter_post_key'
  ) THEN
    ALTER TABLE public.reposts
      ADD CONSTRAINT reposts_reposter_post_key UNIQUE (reposter_id, post_id);
  END IF;
END $$;

-- Deduplicate any existing duplicates before the constraint bites.
DELETE FROM public.reposts a
USING public.reposts b
WHERE a.reposter_id = b.reposter_id
  AND a.post_id = b.post_id
  AND a.created_at > b.created_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 + 3. community_members.left_at + join/leave RPCs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- Backfill: rows currently present are active.
UPDATE public.community_members
SET left_at = NULL
WHERE left_at IS NULL;

CREATE OR REPLACE FUNCTION public.join_community(p_community_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'join_community: not authenticated' USING errcode = '28000';
  END IF;

  -- Only re-activate; the role column is deliberately never touched here so
  -- an admin/moderator who left keeps their role on rejoin.
  INSERT INTO public.community_members (community_id, user_id, role, joined_at, left_at)
  VALUES (p_community_id, uid, 'member', now(), NULL)
  ON CONFLICT ON CONSTRAINT community_members_pkey
  DO UPDATE SET joined_at = now(), left_at = NULL;
END $$;

REVOKE ALL ON FUNCTION public.join_community(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_community(uuid) FROM ANON;
GRANT EXECUTE ON FUNCTION public.join_community(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_community(p_community_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'leave_community: not authenticated' USING errcode = '28000';
  END IF;

  UPDATE public.community_members
  SET left_at = now()
  WHERE community_id = p_community_id
    AND user_id = auth.uid()
    AND left_at IS NULL;
END $$;

REVOKE ALL ON FUNCTION public.leave_community(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_community(uuid) FROM ANON;
GRANT EXECUTE ON FUNCTION public.leave_community(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 + 5. Membership-gated / active-member policies
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
CREATE POLICY "Authenticated users can create posts" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      community_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.community_members cm
        WHERE cm.community_id = posts.community_id
          AND cm.user_id = auth.uid()
          AND cm.left_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Community admins can delete posts in their community" ON public.posts;
CREATE POLICY "Community admins can delete posts in their community" ON public.posts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create events" ON public.events;
CREATE POLICY "Authenticated users can create events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      community_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.community_members cm
        WHERE cm.community_id = events.community_id
          AND cm.user_id = auth.uid()
          AND cm.role IN ('admin', 'moderator')
          AND cm.left_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Moderators can update community settings" ON public.communities;
CREATE POLICY "Moderators can update community settings" ON public.communities
  FOR UPDATE USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = communities.id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('moderator', 'admin')
        AND cm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Community members can create" ON public.voice_rooms;
CREATE POLICY "Community members can create" ON public.voice_rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = voice_rooms.community_id
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Self can insert" ON public.voice_room_participants;
CREATE POLICY "Self can insert" ON public.voice_room_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.voice_rooms vr
      JOIN public.community_members cm
        ON cm.community_id = vr.community_id
      WHERE vr.id = voice_room_participants.room_id
        AND vr.is_active
        AND cm.user_id = auth.uid()
        AND cm.left_at IS NULL
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. webrtc_signals — sender must be a participant of the target room
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Self can insert" ON public.webrtc_signals;
CREATE POLICY "Self can insert" ON public.webrtc_signals
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user
    AND EXISTS (
      SELECT 1 FROM public.voice_room_participants vrp
      WHERE vrp.room_id = webrtc_signals.room_id
        AND vrp.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Storage policy hardening
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "Authors can update their post images" ON storage.objects;
CREATE POLICY "Authors can update their post images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "Anyone can read voice recordings" ON storage.objects;
CREATE POLICY "Anyone can read voice recordings" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'voice-recordings'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. create_direct_conversation — block enforcement (both directions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_direct_conversation(p_other uuid, p_body text)
RETURNS TABLE (conversation_id uuid, reused boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  conv_id uuid;
  was_reused boolean := false;
  clean_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'create_direct_conversation: not authenticated'
      USING errcode = '28000';
  END IF;

  IF p_other IS NULL OR p_other = uid THEN
    RAISE EXCEPTION 'create_direct_conversation: cannot message yourself'
      USING errcode = '22023';
  END IF;

  IF length(clean_body) < 1 OR length(clean_body) > 4000 THEN
    RAISE EXCEPTION 'create_direct_conversation: message body out of range'
      USING errcode = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other) THEN
    RAISE EXCEPTION 'create_direct_conversation: recipient not found'
      USING errcode = 'P0002';
  END IF;

  -- A blocked pair cannot start a thread. Surfaced identically to an
  -- unknown recipient so block state is never leaked to either party.
  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE blocker_id = uid AND blocked_id = p_other
  ) OR EXISTS (
    SELECT 1 FROM public.blocks
    WHERE blocker_id = p_other AND blocked_id = uid
  ) THEN
    RAISE EXCEPTION 'create_direct_conversation: recipient not found'
      USING errcode = 'P0002';
  END IF;

  -- Reuse an existing two-member direct thread when one already exists.
  conv_id := public.find_direct_conversation(p_other);
  IF conv_id IS NOT NULL THEN
    was_reused := true;
  ELSE
    INSERT INTO public.conversations (type)
    VALUES ('direct')
    RETURNING id INTO conv_id;

    INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (conv_id, uid), (conv_id, p_other);
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (conv_id, uid, clean_body);

  RETURN QUERY SELECT conv_id, was_reused;
END $$;

REVOKE ALL ON FUNCTION public.create_direct_conversation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_direct_conversation(uuid, text) FROM ANON;
GRANT EXECUTE ON FUNCTION public.create_direct_conversation(uuid, text) TO authenticated;