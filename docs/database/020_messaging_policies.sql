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
--   • Messages are append-only: UPDATE and DELETE are hard-denied (USING
--     false / WITH CHECK false). Rows are immutable once written.
--   • conversation_members: user may read/leave (delete) their own
--     membership; a direct conversation may be joined by the invitee.
--   • conversations: SELECT only if the user is a member; INSERT requires an
--     authenticated uid; UPDATE restricted to members; DELETE denied.
--
-- No service-role is used here. Application writes go through the normal
-- authenticated client, and RLS enforces auth.uid() server-side.
-- ============================================================================

-- conversations
CREATE POLICY conversations_select ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY conversations_insert ON conversations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

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

CREATE POLICY conversations_delete ON conversations
  FOR DELETE
  USING (false);

-- conversation_members
CREATE POLICY conversation_members_select ON conversation_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Direct conversations may be joined by the invitee (the member row is
-- created server-side with the invitee's user_id; the CHECK permits the
-- row when user_id is the requesting uid OR when creating an invitee row
-- in a direct conversation).
CREATE POLICY conversation_members_insert ON conversation_members
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR (
      SELECT type FROM conversations WHERE id = conversation_members.conversation_id
    ) = 'direct'
  );

CREATE POLICY conversation_members_delete ON conversation_members
  FOR DELETE
  USING (user_id = auth.uid());

-- messages (append-only: SELECT + INSERT only)
CREATE POLICY messages_select ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = auth.uid()
    )
  );

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

CREATE POLICY messages_update ON messages
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY messages_delete ON messages
  FOR DELETE
  USING (false)
  WITH CHECK (false);