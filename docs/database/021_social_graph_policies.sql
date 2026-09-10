-- ============================================================================
-- 021_social_graph_policies.sql — V3.9 Social Graph RLS policies
-- Additive; RLS stays enabled (verified live: follows/blocks/mutes/
-- notification_events all have relrowsecurity=t, 0 policies).
--
-- Security model (source of truth: live DB inspection 2026-09-10):
--   • follows / blocks / mute: compound PK (pair); FKs to auth users.
--     User may only see/leave their own row (SELECT/DELETE on user_id).
--     A user can only follow/block/unmute someone else — they must be
--     the initiating user (follower_id = auth.uid(), blocker_id = auth.uid(),
--     muter_id = auth.uid()). Mutual/block/mute rows have no mutual
--     restriction; a blocked user can still technically block back, which
--     matches the simple pair model.
--   • notification_events: user_id = auth.uid() scoped SELECT; INSERT
--     requires auth.uid() = user_id; UPDATE (read/delivered) requires
--     auth.uid() = user_id. DELETE denied (notifications are append-only
--     audit records, kept until manually cleared). No service-role path
--     needed for normal operations — RLS enforces auth.uid().
-- ============================================================================

-- follows
DROP POLICY IF EXISTS follows_select ON follows;
CREATE POLICY follows_select ON follows FOR SELECT USING (follower_id = auth.uid());
DROP POLICY IF EXISTS follows_insert ON follows;
CREATE POLICY follows_insert ON follows FOR INSERT WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS follows_delete ON follows;
CREATE POLICY follows_delete ON follows FOR DELETE USING (follower_id = auth.uid());

-- blocks
DROP POLICY IF EXISTS blocks_select ON blocks;
CREATE POLICY blocks_select ON blocks FOR SELECT USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS blocks_insert ON blocks;
CREATE POLICY blocks_insert ON blocks FOR INSERT WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS blocks_delete ON blocks;
CREATE POLICY blocks_delete ON blocks FOR DELETE USING (blocker_id = auth.uid());

-- mutes
DROP POLICY IF EXISTS mutes_select ON mutes;
CREATE POLICY mutes_select ON mutes FOR SELECT USING (muter_id = auth.uid());
DROP POLICY IF EXISTS mutes_insert ON mutes;
CREATE POLICY mutes_insert ON mutes FOR INSERT WITH CHECK (muter_id = auth.uid());
DROP POLICY IF EXISTS mutes_delete ON mutes;
CREATE POLICY mutes_delete ON mutes FOR DELETE USING (muter_id = auth.uid());

-- notification_events
DROP POLICY IF EXISTS notification_events_select ON notification_events;
CREATE POLICY notification_events_select ON notification_events FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS notification_events_insert ON notification_events;
CREATE POLICY notification_events_insert ON notification_events FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notification_events_update ON notification_events;
CREATE POLICY notification_events_update ON notification_events FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notification_events_delete ON notification_events;
CREATE POLICY notification_events_delete ON notification_events FOR DELETE USING (false);