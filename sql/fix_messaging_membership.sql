-- RPC to ensure a user is a member of a conversation before sending a message.
-- This prevents RLS failures in subsequent messages if membership was accidentally missing.
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

REVOKE ALL ON FUNCTION public.ensure_conversation_membership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_conversation_membership(uuid) FROM ANON;
GRANT EXECUTE ON FUNCTION public.ensure_conversation_membership(uuid) TO AUTHENTICATED;
