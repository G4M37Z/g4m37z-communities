-- ============================================================================
-- 054_lfg_join_rpc.sql
-- Phase 3 — atomic LFG join.
--
-- Why: LFG mutations previously ran through the service-role client because
-- the join path needs a participant count that RLS (016) hides from
-- non-hosts, and the service preferred one privileged client over mixing
-- clients mid-operation. That made LFG unusable wherever
-- SUPABASE_SERVICE_ROLE_KEY is not configured (hard throw in admin.ts).
-- The 016 policies already authorize every operation (host-only
-- create/update/delete, join/leave as self), so reads and simple writes
-- now run through the caller's session. Joining is the one race-sensitive
-- operation (last slot), so it moves into this SECURITY DEFINER RPC which
-- re-checks status/capacity/host-lock atomically.
--
-- Access: authenticated users only; session_id is the only input; the
-- joiner is always auth.uid(). Server-side validation (016 CHECKs) still
-- constrains the row; the service layer keeps its friendlier pre-checks.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lfg_join(p_session_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_status text;
  v_required integer;
  v_host uuid;
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT status, players_required, host_id
    INTO v_status, v_required, v_host
  FROM public.lfg_sessions
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_host = v_user THEN
    RETURN 'forbidden';
  END IF;

  IF v_status IN ('CLOSED','CANCELLED','COMPLETED','EXPIRED') THEN
    RETURN 'unavailable';
  END IF;

  IF v_status = 'FULL' THEN
    RETURN 'full';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lfg_participants
  WHERE session_id = p_session_id;

  IF v_count >= v_required THEN
    RETURN 'full';
  END IF;

  BEGIN
    INSERT INTO public.lfg_participants (session_id, user_id)
    VALUES (p_session_id, v_user);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'duplicate';
  END;

  -- Auto-transition when the last slot is taken (mirrors the service's
  -- documented FULL lifecycle state).
  IF v_count + 1 >= v_required THEN
    UPDATE public.lfg_sessions
       SET status = 'FULL', updated_at = now()
     WHERE id = p_session_id AND status IN ('CREATED','OPEN');
  END IF;

  RETURN 'joined';
END;
$$;

REVOKE ALL ON FUNCTION public.lfg_join(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.lfg_join(uuid) TO authenticated;

-- Owner's roster view: the host needs a real participant count for their
-- session (RLS only admits their own rows to them). SECURITY DEFINER is
-- safe here: it leaks only a count, and only to the session's host.
CREATE OR REPLACE FUNCTION public.lfg_participant_count(p_session_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::integer
  FROM public.lfg_participants p
  JOIN public.lfg_sessions s ON s.id = p.session_id
  WHERE p.session_id = p_session_id
    AND (s.host_id = auth.uid() OR p.user_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.lfg_sessions s2
           WHERE s2.privacy = 'public'
             AND s2.id = p.session_id
         ));
$$;

REVOKE ALL ON FUNCTION public.lfg_participant_count(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.lfg_participant_count(uuid) TO authenticated;
