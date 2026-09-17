-- RPC to get unread counts per conversation for the current user
-- Optimized to run entirely on the server using a single aggregation query.
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
