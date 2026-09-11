-- V4 Notification Preferences & Privacy
-- Adds profiles.notification_prefs (JSONB channel toggles, defaults on) and a
-- helper used by the notification triggers to respect each user's choices.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}';

-- helper: is a notification channel enabled for a user? Unknown/missing keys
-- default to enabled (opt-out model).
CREATE OR REPLACE FUNCTION public.notification_enabled(p_user UUID, p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (p.notification_prefs->>p_key)::boolean FROM public.profiles p WHERE p.id = p_user),
    TRUE
  );
$$;

-- Recompile the V4 notification triggers to respect notification_enabled.
CREATE OR REPLACE FUNCTION public.notify_follow() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.follower_id <> NEW.followed_id
     AND public.notification_enabled(NEW.followed_id, 'follow') THEN
    PERFORM public.create_notification(NEW.followed_id, NEW.follower_id, 'follow', NEW.follower_id);
  END IF;
  RETURN NEW;
END;
$$;

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
  IF v_creator_id IS NOT NULL AND v_creator_id <> NEW.user_id
     AND public.notification_enabled(v_creator_id, 'events') THEN
    PERFORM public.create_notification(v_creator_id, NEW.user_id, 'event_rsvp', NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$;

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
       AND NOT (mentioned_id = ANY(notified_ids))
       AND public.notification_enabled(mentioned_id, 'mentions') THEN
      PERFORM public.create_notification(mentioned_id, p_author_id, 'mention', p_entity_id);
      notified_ids := array_append(notified_ids, mentioned_id);
    END IF;
  END LOOP;
END;
$$;