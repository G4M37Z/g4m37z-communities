-- ============================================================================
-- 033_v5_messaging_readstate_reposts.sql — V5 completion sprint
--
-- 1. Messaging read-state: conversation_members UPDATE policy restricted to
--    last_read_at only (via column-privileged UPDATE). Members may record
--    when they last read a thread; nothing else on the row changes.
-- 2. Reposts (share-to-feed): first-class table. A repost is a real row:
--    (reposter, original post, optional quip). Attribution via
--    original_author_id snapshot. Self-notification never created.
-- 3. Creator analytics indexes: engagement counting by author.
--
-- Idempotent. Uses ON CONFLICT DO NOTHING for trigger provenance guard.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Messaging read-state
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS conversation_members_update ON public.conversation_members;
CREATE POLICY conversation_members_update
  ON public.conversation_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Hardening: RLS WITH CHECK cannot compare against OLD values, so the policy
-- alone would let a member move their membership row onto another conversation
-- (membership escalation). PostgreSQL column privileges are additive to the
-- table-level grant, so the correct restriction is: revoke table-wide UPDATE,
-- grant back UPDATE on last_read_at only (proven live: a plain column REVOKE
-- did NOT stop the escalation — the table grant still covered every column).
REVOKE UPDATE ON TABLE public.conversation_members FROM authenticated;
GRANT UPDATE (last_read_at)
  ON TABLE public.conversation_members
  TO authenticated;

-- Hardening: self-follow is prohibited by product rule; the service layer
-- blocks it but the DB must backstop it (proven live: a direct INSERT of
-- follower = followed succeeds without this constraint).
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_no_self_follow;
ALTER TABLE public.follows
  ADD CONSTRAINT follows_no_self_follow CHECK (follower_id <> followed_id);

-- ---------------------------------------------------------------------------
-- 2. Reposts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reposts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reposter_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id             UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  original_author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One repost per (reposter, post) pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reposts_reposter_post
  ON public.reposts (reposter_id, post_id);
-- Feed query: reposts by a set of users, newest first.
CREATE INDEX IF NOT EXISTS idx_reposts_reposter_created
  ON public.reposts (reposter_id, created_at DESC);
-- Post-detail / count aggregation.
CREATE INDEX IF NOT EXISTS idx_reposts_post_created
  ON public.reposts (post_id, created_at DESC);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reposts_select ON public.reposts;
CREATE POLICY reposts_select
  ON public.reposts FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS reposts_insert ON public.reposts;
CREATE POLICY reposts_insert
  ON public.reposts FOR INSERT TO authenticated
  WITH CHECK (
    reposter_id = auth.uid()
    AND original_author_id = (SELECT p.author_id FROM public.posts p WHERE p.id = post_id)
  );

DROP POLICY IF EXISTS reposts_delete ON public.reposts;
CREATE POLICY reposts_delete
  ON public.reposts FOR DELETE TO authenticated
  USING (reposter_id = auth.uid());

-- Repost notification: mirror notify_follow (027), but with the LIVE
-- create_notification signature (user_id, type, actor_id, reference_id — 006).
-- Snapshot author, skip self-notification, write through create_notification
-- into the canonical user-facing notifications stream (typed + realtime).
CREATE OR REPLACE FUNCTION public.notify_on_repost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.original_author_id <> NEW.reposter_id
     AND public.notification_enabled(NEW.original_author_id, 'repost') THEN
    PERFORM public.create_notification(
      NEW.original_author_id,
      'repost',
      NEW.reposter_id,
      NEW.post_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_repost ON public.reposts;
CREATE TRIGGER trg_notify_on_repost
  AFTER INSERT ON public.reposts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_repost();

-- ---------------------------------------------------------------------------
-- 3. Creator analytics indexes (aggregations scan by author/post)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_post_votes_post ON public.post_votes (post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON public.reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON public.posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON public.follows (followed_id);

-- ---------------------------------------------------------------------------
-- 4. notifications.type CHECK gains 'repost' (mirrors 027 pattern)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'comment_on_post',
      'reply_to_comment',
      'post_vote',
      'comment_vote',
      'moderation_action',
      'report_resolved',
      'mention',
      'community_invite',
      'follow',
      'event_rsvp',
      'repost'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Realtime delivery for messages (thread live updates)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Repair 005-order create_notification calls in live 027-era triggers.
--    The live create_notification signature is (user_id, type, actor_id,
--    reference_id) — migration 006 redefined it — but notify_follow and
--    notify_mentions still pass (user, actor, type, reference), so EVERY
--    follow insert and every comment containing a mention fails at the
--    database with "function create_notification(uuid, uuid, unknown, uuid)
--    does not exist". Proven live: follow INSERT errors inside its trigger.
--    Calls are rewritten to the 006 order; prefs gates preserved.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.follower_id <> NEW.followed_id
     AND public.notification_enabled(NEW.followed_id, 'follow') THEN
    PERFORM public.create_notification(
      NEW.followed_id,
      'follow',
      NEW.follower_id,
      NEW.follower_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_mentions(
  p_entity_type text,
  p_entity_id uuid,
  p_author_id uuid,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m RECORD;
  mentioned_id UUID;
  notified_ids UUID[] := '{}';
BEGIN
  IF p_body IS NULL THEN RETURN; END IF;
  FOR m IN
    SELECT DISTINCT LOWER(matched[1]) AS name
    FROM regexp_matches(p_body, '@([a-zA-Z0-9_]{1,30})', 'g') AS matched
  LOOP
    SELECT id INTO mentioned_id FROM public.profiles WHERE username = m.name;
    IF mentioned_id IS NOT NULL
       AND mentioned_id <> p_author_id
       AND NOT (mentioned_id = ANY(notified_ids))
       AND public.notification_enabled(mentioned_id, 'mentions') THEN
      PERFORM public.create_notification(mentioned_id, 'mention', p_author_id, p_entity_id);
      notified_ids := array_append(notified_ids, mentioned_id);
    END IF;
  END LOOP;
END;
$$;
