-- ============================================================================
-- 055_notifications_and_messaging.sql
-- Notification & messaging expansion (user-direction 2026-10-18):
--   1. post_views + posts.view_count — view metrics, deduped per user.
--   2. notify_community_post — "new post in a community you joined".
--   3. notify_missed_call — notify the callee when a call ends MISSED/DECLINED.
--   4. messages.deleted_at — soft delete (own message).
--   5. conversation_members.is_archived — archive a DM from the list.
--   6. get_unread_counts respects deleted_at; grant to authenticated so the
--      client badge hook can call it directly (RLS scopes rows anyway).
--   7. Grants: post_views insert for the client-side tracker.
-- Queries verified against the live DB BEFORE writing: community_members has
-- left_at; messages_update policy was false/false (replaced); notifications is
-- already in supabase_realtime (bell reacts automatically).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. View metrics
-- ---------------------------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.post_views (
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_views_insert ON public.post_views;
CREATE POLICY post_views_insert
  ON public.post_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS post_views_select ON public.post_views;
CREATE POLICY post_views_select
  ON public.post_views FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- SECURITY DEFINER so the viewer's RLS on posts cannot block the counter bump.
CREATE OR REPLACE FUNCTION public.bump_post_views()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
     SET view_count = view_count + 1
   WHERE id = NEW.post_id
     AND author_id <> NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_post_views ON public.post_views;
CREATE TRIGGER trg_bump_post_views
AFTER INSERT ON public.post_views
FOR EACH ROW EXECUTE FUNCTION public.bump_post_views();

-- ---------------------------------------------------------------------------
-- 2. "New post in a community you joined"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_community_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT cm.user_id
    FROM public.community_members cm
    WHERE cm.community_id = NEW.community_id
      AND cm.user_id <> NEW.author_id
      AND cm.left_at IS NULL
  LOOP
    IF public.notification_enabled(rec.user_id, 'posts') THEN
      INSERT INTO public.notifications (user_id, actor_id, type, reference_id)
      VALUES (rec.user_id, NEW.author_id, 'community_post', NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_community_post ON public.posts;
CREATE TRIGGER trg_notify_community_post
AFTER INSERT ON public.posts
FOR EACH ROW
WHEN (NEW.community_id IS NOT NULL)
EXECUTE FUNCTION public.notify_community_post();

-- ---------------------------------------------------------------------------
-- 3. Missed / declined call notification (callee notified, caller is actor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_missed_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ended'
     AND NEW.answered_at IS NULL
     AND NEW.outcome IN ('MISSED', 'DECLINED')
     AND NEW.callee_id IS NOT NULL
     AND public.notification_enabled(NEW.callee_id, 'calls') THEN
    INSERT INTO public.notifications (user_id, actor_id, type, reference_id)
    VALUES (NEW.callee_id, NEW.caller_id, 'missed_call', NEW.conversation_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_missed_call ON public.call_sessions;
CREATE TRIGGER trg_notify_missed_call
AFTER UPDATE ON public.call_sessions
FOR EACH ROW
EXECUTE FUNCTION public.notify_missed_call();

-- ---------------------------------------------------------------------------
-- 4. Soft-delete own messages
-- ---------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_delete_own
  ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- The realtime INSERT listener used by the unread badge must not count
-- deleted rows; the RPC below now filters them out as well.
-- ---------------------------------------------------------------------------
-- 5. Archive a conversation (per-user member flag)
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 6./7. RPC + grants
-- ---------------------------------------------------------------------------
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
    COUNT(*)::bigint AS unread_count
  FROM public.messages m
  JOIN public.conversation_members cm
    ON m.conversation_id = cm.conversation_id
  WHERE cm.user_id = auth.uid()
    AND m.sender_id != auth.uid()
    AND m.deleted_at IS NULL
    AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
  GROUP BY m.conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated;
