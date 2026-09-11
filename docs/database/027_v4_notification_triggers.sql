-- V4 Notification Triggers — follow, mention, event RSVP.
-- Extends the notifications type CHECK and adds DB triggers that generate
-- notification rows (previously only comment/post-vote/report triggers existed).

-- 1. Extend the notifications.type CHECK with follow + event_rsvp.
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
      'event_rsvp'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Follow → notify the followed user.
CREATE OR REPLACE FUNCTION public.notify_follow() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.follower_id <> NEW.followed_id THEN
    PERFORM public.create_notification(NEW.followed_id, NEW.follower_id, 'follow', NEW.follower_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
AFTER INSERT ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.notify_follow();

-- 3. Mentions → notify each mentioned user when a post or comment body
--    contains "@username". Dedupes per post/comment and skips the author.
CREATE OR REPLACE FUNCTION public.notify_mentions(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_author_id UUID,
  p_body TEXT
) RETURNS VOID
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
       AND NOT (mentioned_id = ANY(notified_ids)) THEN
      PERFORM public.create_notification(mentioned_id, p_author_id, 'mention', p_entity_id);
      notified_ids := array_append(notified_ids, mentioned_id);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_mention_on_comment() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_mentions('comment', NEW.id, NEW.author_id, NEW.body);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mention_comment ON public.comments;
CREATE TRIGGER trg_notify_mention_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_mention_on_comment();

CREATE OR REPLACE FUNCTION public.notify_mention_on_post() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_mentions('post', NEW.id, NEW.author_id, NEW.body);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mention_post ON public.posts;
CREATE TRIGGER trg_notify_mention_post
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.notify_mention_on_post();

-- 4. Event RSVP → notify the event's community creator.
CREATE OR REPLACE FUNCTION public.notify_event_rsvp() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_creator_id UUID;
BEGIN
  SELECT community_id INTO v_community_id FROM public.events WHERE id = NEW.event_id;
  IF v_community_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT creator_id INTO v_creator_id FROM public.communities WHERE id = v_community_id;
  IF v_creator_id IS NOT NULL AND v_creator_id <> NEW.user_id THEN
    PERFORM public.create_notification(v_creator_id, NEW.user_id, 'event_rsvp', NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_rsvp ON public.event_participants;
CREATE TRIGGER trg_notify_event_rsvp
AFTER INSERT ON public.event_participants
FOR EACH ROW
EXECUTE FUNCTION public.notify_event_rsvp();