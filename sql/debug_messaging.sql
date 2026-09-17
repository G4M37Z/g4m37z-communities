-- Check RLS Policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('messages', 'conversations', 'conversation_members');

-- Check the create_direct_conversation RPC definition
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'create_direct_conversation';

-- Check if there are any orphaned messages (messages without member records for the sender)
SELECT m.id, m.sender_id, m.conversation_id, 
       (SELECT count(*) FROM conversation_members cm 
        WHERE cm.conversation_id = m.conversation_id AND cm.user_id = m.sender_id) as membership_count
FROM messages m 
LIMIT 10;
