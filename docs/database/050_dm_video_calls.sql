-- ============================================================================
-- 050_dm_video_calls.sql — Video calls in direct threads (GAP-MSG-CALL-01)
--
-- 049 shipped the call state machine but hardcoded media='audio'. The
-- call_sessions column already admits ('audio','video'); this migration only
-- opens the parameter on the RPC. Old single-arg signature is dropped and
-- replaced with a defaulted two-arg version so existing callers and tests
-- keep working unchanged.
-- ============================================================================

DROP FUNCTION IF EXISTS public.start_dm_call(uuid);

-- Call-log labels arrive from the 049 RPCs as 'Voice call …'; with video
-- calls those rows would mislabel the medium. Rewriting the prefix here keeps
-- every caller RPC unchanged.
CREATE OR REPLACE FUNCTION public._log_call_event(p_call public.call_sessions, p_label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  INSERT INTO public.messages (conversation_id, sender_id, body, attachment_url, attachment_type)
  VALUES (
    p_call.conversation_id,
    p_call.caller_id,
    CASE WHEN p_call.media = 'video'
      THEN replace(p_label, 'Voice call', 'Video call')
      ELSE p_label END,
    NULL,
    'call'
  );
END
$fn$;

CREATE OR REPLACE FUNCTION public.start_dm_call(
  p_conv_id uuid,
  p_media text DEFAULT 'audio'
)
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
  IF p_media NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'start_dm_call: media must be audio or video' USING errcode = '22023';
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
  VALUES (p_conv_id, uid, other, p_media, 'ringing')
  RETURNING id INTO call_id;

  RETURN call_id;
END
$fn$;
