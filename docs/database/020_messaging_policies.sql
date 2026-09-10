-- ============================================================================
-- 020_messaging_policies.sql — V3.8 Messaging RLS policies
-- Additive, non-destructive. RLS stays enabled.
--
-- Security model (verified against live schema):
--   • conversations / conversation_members / messages all have RLS = t,
--     0 policies before this migration.
--   • A user may only SEE a message if they are a member of that
--     conversation (member-scoped SELECT via EXISTS on conversation_members).
--   • A user may only INSERT a message where they are the sender_id AND a
--     member of the conversation. sender_id is server-resolved to auth.uid().
--   • Messages are append-only: UPDATE hard-denied (USING/WITH CHECK false),
--     DELETE hard-denied (USING false). Rows are immutable once written.
--   • conversation_members: user may read/leave (delete) their own
--     membership; a direct conversation may be joined by the invitee.
--   • conversations: SELECT only if the user is a member; INSERT requires an
--     authenticated uid; UPDATE restricted to members; DELETE denied.
--
-- No service-role is used here. Application writes go through the normal
-- authenticated client, and RLS enforces auth.uid() server-side.
-- ============================================================================

-- conversations
DROP POLICY IF EXISTS conversations_select ON conversations;
CREATE POLICY conversations_select ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS conversations_insert ON conversations;
CREATE POLICY conversations_insert ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS conversations_update ON conversations;
CREATE POLICY conversations_update ON conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS conversations_delete ON conversations;
CREATE POLICY conversations_delete ON conversations
  FOR DELETE
  USING (false);

-- conversation_members
DROP POLICY IF EXISTS conversation_members_select ON conversation_members;
CREATE POLICY conversation_members_select ON conversation_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Direct conversations may be joined by the invitee (the member row is
-- created server-side with the invitee's user_id; the CHECK permits the
-- row when user_id is the requesting uid OR when creating an invitee row
-- in a direct conversation).
DROP POLICY IF EXISTS conversation_members_insert ON conversation_members;
CREATE POLICY conversation_members_insert ON conversation_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      SELECT type FROM conversations WHERE id = conversation_members.conversation_id
    ) = 'direct'
  );

DROP POLICY IF EXISTS conversation_members_delete ON conversation_members;
CREATE POLICY conversation_members_delete ON conversation_members
  FOR DELETE
  USING (user_id = auth.uid());

-- messages (append-only: SELECT + INSERT only)
DROP POLICY IF EXISTS messages_select ON messages;
CREATE POLICY messages_select ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_insert ON messages;
CREATE POLICY messages_insert ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = messages.sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_update ON messages;
CREATE POLICY messages_update ON messages
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS messages_delete ON messages;
CREATE POLICY messages_delete ON messages
  FOR DELETE
  USING (false);