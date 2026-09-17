-- ============================================================================
-- 040_messaging_optimizations.sql — V3.9 Performance & Reliability
-- ============================================================================

-- 1. Optimized Unread Counts RPC
-- Replaces application-layer filtering with a server-side aggregation.
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE (
  conversation_id uuid,
  unread_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.conversation_id, 
    COUNT(*) as unread_count
  FROM public.messages m
  JOIN public.conversation_members cm ON m.conversation_id = cm.conversation_id
  WHERE cm.user_id = auth.uid()
    AND m.sender_id != auth.uid()
    AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
  GROUP BY m.conversation_id;
END;
$$;

-- 2. Membership Guarantee RPC
-- Ensures a user is a member of a conversation before sending a message
-- to prevent RLS 42501 errors on subsequent messages.
CREATE OR REPLACE FUNCTION public.ensure_conversation_membership(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (p_conv_id, auth.uid())
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unread_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_unread_counts() FROM ANON;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO AUTHENTICATED;

REVOKE ALL ON FUNCTION public.ensure_conversation_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_conversation_membership(uuid) FROM ANON;
GRANT EXECUTE ON FUNCTION public.ensure_conversation_membership(uuid) TO AUTHENTICATED;
