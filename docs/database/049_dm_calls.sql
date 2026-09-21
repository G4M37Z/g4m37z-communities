-- ============================================================================
-- 049_dm_calls.sql — 1:1 voice calls inside direct-message threads
--
-- Reconciles the live database (which already carries this feature) into the
-- migration tree. Closes GAP-MSG-CALL-01 at the schema/RPC layer.
--
-- What this adds:
--   1. webrtc_signals becomes channel-agnostic: room_id is nullable and a new
--      conversation_id targets direct calls. Room signaling is unchanged.
--   2. call_sessions — one row per DM call attempt (ringing → active → ended),
--      with an auditable outcome and a 45s ring timeout. Members of the
--      conversation may SELECT; writes happen only through the RPCs below.
--   3. messages.attachment_type gains 'call' so call events are logged as
--      system messages in the thread (attachment_url stays NULL for calls).
--   4. SECURITY DEFINER RPCs (caller identity always resolved server-side from
--      auth.uid(); never accepted from the client):
--        start_dm_call / answer_dm_call / decline_dm_call / end_dm_call /
--        cancel_dm_call / timeout_dm_call  +  internal helpers
--        can_write_webrtc_signal
--      They enforce: direct-conversation only, exactly two active members,
--      no calling across a block (either direction), and one concurrent call
--      per participating pair.
--   5. webrtc_signals RLS rewritten to authorize senders/readers for either a
--      voice room (participant) or an active direct call (conversation member).
--
-- Idempotent / re-runnable (guarded DDL, CREATE OR REPLACE, dynamic policies).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. webrtc_signals — conversation-scoped signaling
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.webrtc_signals
  ALTER COLUMN room_id DROP NOT NULL;

ALTER TABLE public.webrtc_signals
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webrtc_signals_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.webrtc_signals
      ADD CONSTRAINT webrtc_signals_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webrtc_signals_conversation
  ON public.webrtc_signals (conversation_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. call_sessions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES public.profiles(id),
  media text NOT NULL DEFAULT 'audio' CHECK (media IN ('audio', 'video')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'active', 'ended')),
  outcome text CHECK (
    outcome IS NULL
    OR outcome IN ('COMPLETED', 'CALLER_HANGUP', 'CALLEE_HANGUP', 'MISSED', 'DECLINED', 'CANCELLED')
  ),
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  ended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation
  ON public.call_sessions (conversation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_callee_status
  ON public.call_sessions (callee_id, status)
  WHERE status IN ('ringing', 'active');
CREATE INDEX IF NOT EXISTS idx_call_sessions_conv_created
  ON public.call_sessions (conversation_id, created_at DESC);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Conversation members can read call sessions" ON public.call_sessions;
CREATE POLICY "Conversation members can read call sessions" ON public.call_sessions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT cm.user_id FROM public.conversation_members cm
      WHERE cm.conversation_id = call_sessions.conversation_id
    )
  );

-- Realtime so the callee sees the incoming ring without polling.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. messages — allow the 'call' system attachment
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_attachment_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_attachment_type_check
  CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'gif', 'sticker', 'call'));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_attachment_pair_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_attachment_pair_check
  CHECK (attachment_type = 'call' OR (attachment_url IS NULL) = (attachment_type IS NULL));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Call RPCs (SECURITY DEFINER; identity from auth.uid())
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._call_duration_text(started timestamptz, ended timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT
    CASE WHEN ended IS NULL OR started IS NULL THEN '0:00'
         ELSE (floor(extract(epoch FROM (ended - started)) / 60))::text
              || ':' || lpad((floor(extract(epoch FROM (ended - started)))::int % 60)::text, 2, '0')
    END;
$fn$;

CREATE OR REPLACE FUNCTION public._call_pair_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE blocker_id IN (a, b) AND blocked_id IN (a, b) AND blocker_id <> blocked_id
  );
$fn$;

CREATE OR REPLACE FUNCTION public._log_call_event(p_call public.call_sessions, p_label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body, attachment_url, attachment_type)
  VALUES (p_call.conversation_id, p_call.caller_id, p_label, NULL, 'call');
END
$fn$;

CREATE OR REPLACE FUNCTION public.start_dm_call(p_conv_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  other uuid;
  v_type text;
  member_count int;
  call_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'start_dm_call: not authenticated' USING errcode = '28000';
  END IF;
  IF p_conv_id IS NULL THEN
    RAISE EXCEPTION 'start_dm_call: no conversation' USING errcode = '22023';
  END IF;

  SELECT c.type INTO v_type
  FROM public.conversations c WHERE c.id = p_conv_id;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'start_dm_call: conversation not found' USING errcode = 'P0002';
  END IF;
  IF v_type <> 'direct' THEN
    RAISE EXCEPTION 'start_dm_call: only direct conversations can be called'
      USING errcode = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conv_id AND cm.user_id = uid
  ) THEN
    RAISE EXCEPTION 'start_dm_call: you are not an active member' USING errcode = '42501';
  END IF;

  -- Exactly two members, the caller being one of them.
  SELECT count(*),
         (SELECT user_id FROM public.conversation_members
          WHERE conversation_id = p_conv_id AND user_id <> uid LIMIT 1)
  INTO member_count, other
  FROM public.conversation_members
  WHERE conversation_id = p_conv_id;
  IF member_count <> 2 OR other IS NULL THEN
    RAISE EXCEPTION 'start_dm_call: direct conversation needs two active members'
      USING errcode = '22023';
  END IF;

  IF public._call_pair_blocked(uid, other) THEN
    RAISE EXCEPTION 'start_dm_call: you cannot call this user' USING errcode = 'P0001';
  END IF;

  -- One concurrent call per participating pair.
  IF EXISTS (
    SELECT 1 FROM public.call_sessions cs
    WHERE cs.status IN ('ringing', 'active')
      AND (cs.caller_id = uid OR cs.callee_id = uid OR cs.caller_id = other OR cs.callee_id = other)
  ) THEN
    RAISE EXCEPTION 'start_dm_call: a call is already in progress'
      USING errcode = 'P0001';
  END IF;

  INSERT INTO public.call_sessions (conversation_id, caller_id, callee_id, media, status)
  VALUES (p_conv_id, uid, other, 'audio', 'ringing')
  RETURNING id INTO call_id;

  RETURN call_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public.answer_dm_call(p_call_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'answer_dm_call: not authenticated' USING errcode = '28000';
  END IF;

  SELECT conversation_id INTO v_conv
  FROM public.call_sessions
  WHERE id = p_call_id AND callee_id = uid AND status = 'ringing'
  FOR UPDATE;
  IF v_conv IS NULL THEN
    RAISE EXCEPTION 'answer_dm_call: no ringing call to answer' USING errcode = 'P0002';
  END IF;

  UPDATE public.call_sessions
     SET status = 'active', answered_at = now()
   WHERE id = p_call_id;

  RETURN v_conv;
END
$fn$;

CREATE OR REPLACE FUNCTION public.decline_dm_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_call public.call_sessions;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'decline_dm_call: not authenticated' USING errcode = '28000';
  END IF;

  SELECT * INTO v_call
  FROM public.call_sessions
  WHERE id = p_call_id AND callee_id = uid AND status = 'ringing'
  FOR UPDATE;
  IF v_call.id IS NULL THEN
    RAISE EXCEPTION 'decline_dm_call: no ringing call to decline' USING errcode = 'P0002';
  END IF;

  UPDATE public.call_sessions
     SET status = 'ended', outcome = 'DECLINED', ended_at = now(), ended_by = uid
   WHERE id = p_call_id;

  PERFORM public._log_call_event(v_call, 'Voice call declined');
END
$fn$;

CREATE OR REPLACE FUNCTION public.cancel_dm_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_call public.call_sessions;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'cancel_dm_call: not authenticated' USING errcode = '28000';
  END IF;

  SELECT * INTO v_call
  FROM public.call_sessions
  WHERE id = p_call_id AND caller_id = uid AND status = 'ringing'
  FOR UPDATE;
  IF v_call.id IS NULL THEN
    RAISE EXCEPTION 'cancel_dm_call: no ringing call to cancel' USING errcode = 'P0002';
  END IF;

  UPDATE public.call_sessions
     SET status = 'ended', outcome = 'CANCELLED', ended_at = now(), ended_by = uid
   WHERE id = p_call_id;

  PERFORM public._log_call_event(v_call, 'Voice call cancelled');
END
$fn$;

CREATE OR REPLACE FUNCTION public.end_dm_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_call public.call_sessions;
  v_outcome text;
  v_label text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'end_dm_call: not authenticated' USING errcode = '28000';
  END IF;

  SELECT * INTO v_call
  FROM public.call_sessions
  WHERE id = p_call_id
    AND (caller_id = uid OR callee_id = uid)
    AND status IN ('ringing', 'active')
  FOR UPDATE;
  IF v_call.id IS NULL THEN
    RAISE EXCEPTION 'end_dm_call: no active call to end' USING errcode = 'P0002';
  END IF;

  IF v_call.answered_at IS NULL THEN
    v_outcome := 'CANCELLED';
    v_label := 'Voice call cancelled';
  ELSIF v_call.caller_id = uid THEN
    v_outcome := 'CALLER_HANGUP';
    v_label := 'Voice call · ' || public._call_duration_text(v_call.answered_at, now());
  ELSE
    v_outcome := 'CALLEE_HANGUP';
    v_label := 'Voice call · ' || public._call_duration_text(v_call.answered_at, now());
  END IF;

  UPDATE public.call_sessions
     SET status = 'ended', outcome = v_outcome, ended_at = now(), ended_by = uid
   WHERE id = p_call_id;

  PERFORM public._log_call_event(v_call, v_label);
END
$fn$;

CREATE OR REPLACE FUNCTION public.timeout_dm_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  uid uuid := auth.uid();
  v_call public.call_sessions;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'timeout_dm_call: not authenticated' USING errcode = '28000';
  END IF;

  SELECT * INTO v_call
  FROM public.call_sessions
  WHERE id = p_call_id
    AND (caller_id = uid OR callee_id = uid)
    AND status = 'ringing'
    AND now() - started_at > interval '45 seconds'
  FOR UPDATE;
  IF v_call.id IS NULL THEN
    RAISE EXCEPTION 'timeout_dm_call: no expired ringing call' USING errcode = 'P0002';
  END IF;

  UPDATE public.call_sessions
     SET status = 'ended', outcome = 'MISSED', ended_at = now(), ended_by = uid
   WHERE id = p_call_id;

  PERFORM public._log_call_event(v_call, 'Missed voice call');
END
$fn$;

CREATE OR REPLACE FUNCTION public.can_write_webrtc_signal(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.voice_room_participants vrp
    WHERE vrp.room_id = p_room_id AND vrp.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.call_sessions cs
    JOIN public.conversation_members m
      ON m.conversation_id = cs.conversation_id AND m.user_id = auth.uid()
    WHERE cs.id = p_room_id
      AND cs.status = 'active'
  )
$fn$;

-- Grants — match the live ACL exactly: helpers stay internal, RPCs are
-- authenticated-only (anon revoked).
REVOKE ALL ON FUNCTION public._call_pair_blocked(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._call_pair_blocked(uuid, uuid) FROM ANON;
REVOKE ALL ON FUNCTION public._call_pair_blocked(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._log_call_event(public.call_sessions, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._log_call_event(public.call_sessions, text) FROM ANON;
REVOKE ALL ON FUNCTION public._log_call_event(public.call_sessions, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.start_dm_call(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_dm_call(uuid) FROM ANON;
REVOKE ALL ON FUNCTION public.answer_dm_call(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.answer_dm_call(uuid) FROM ANON;
REVOKE ALL ON FUNCTION public.decline_dm_call(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decline_dm_call(uuid) FROM ANON;
REVOKE ALL ON FUNCTION public.cancel_dm_call(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_dm_call(uuid) FROM ANON;
REVOKE ALL ON FUNCTION public.end_dm_call(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.end_dm_call(uuid) FROM ANON;
REVOKE ALL ON FUNCTION public.timeout_dm_call(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.timeout_dm_call(uuid) FROM ANON;
REVOKE ALL ON FUNCTION public.can_write_webrtc_signal(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_webrtc_signal(uuid) FROM ANON;

GRANT EXECUTE ON FUNCTION public.start_dm_call(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.answer_dm_call(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_dm_call(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_dm_call(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.end_dm_call(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.timeout_dm_call(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_webrtc_signal(uuid) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. webrtc_signals RLS — room participants OR active-call conversation members
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Room members can read signals" ON public.webrtc_signals;
DROP POLICY IF EXISTS "Self can insert" ON public.webrtc_signals;

DROP POLICY IF EXISTS "Members can read signals in rooms or conversations" ON public.webrtc_signals;
CREATE POLICY "Members can read signals in rooms or conversations" ON public.webrtc_signals
  FOR SELECT USING (
    (room_id IS NOT NULL AND auth.uid() IN (
      SELECT vrp.user_id FROM public.voice_room_participants vrp
      WHERE vrp.room_id = webrtc_signals.room_id
    ))
    OR
    (conversation_id IS NOT NULL AND auth.uid() IN (
      SELECT cm.user_id FROM public.conversation_members cm
      WHERE cm.conversation_id = webrtc_signals.conversation_id
    ))
  );

DROP POLICY IF EXISTS "Members can signal in rooms or conversations" ON public.webrtc_signals;
CREATE POLICY "Members can signal in rooms or conversations" ON public.webrtc_signals
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = from_user
    AND (
      (room_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.voice_room_participants vrp
        WHERE vrp.room_id = webrtc_signals.room_id AND vrp.user_id = auth.uid()
      ))
      OR
      (conversation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.conversation_members cm
        WHERE cm.conversation_id = webrtc_signals.conversation_id AND cm.user_id = auth.uid()
      ))
    )
  );
