-- ============================================================================
-- G4M37Z Communities — Migrations v7+v8 (additive — safe to run on top of v5)
-- Run AFTER 005_full_sync.sql. Adds notifications, reports, profile.role,
-- admin RPCs, and notification triggers.
--
-- Safe to re-run (everything uses CREATE OR REPLACE / IF NOT EXISTS / DO
-- blocks with EXISTS guards).
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles.role — extend CHECK to include 'suspended'
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
      CHECK (role IN ('member', 'moderator', 'admin', 'suspended'));
  END IF;
END $$;

-- If the role column already exists with a different CHECK, expand it
DO $$
DECLARE v_check TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO v_check
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
   WHERE n.nspname = 'public'
     AND c.conrelid = 'public.profiles'::regclass
     AND c.conname LIKE '%role%';

  IF v_check IS NOT NULL AND v_check NOT LIKE '%suspended%' THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(c.conname)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
        AND c.conrelid = 'public.profiles'::regclass
        AND c.conname LIKE '%role%'
      LIMIT 1
    );
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('member', 'moderator', 'admin', 'suspended'));
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notifications table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'comment_on_post',
    'reply_to_comment',
    'post_vote',
    'comment_vote',
    'moderation_action',
    'report_resolved',
    'mention',
    'community_invite'
  )),
  reference_id UUID,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_created_at
  ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id
  ON public.notifications(reference_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. reports table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  target_id UUID NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created_at
  ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target
  ON public.reports(target_type, target_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create reports" ON public.reports;
CREATE POLICY "Anyone can create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Reporters can view their own reports" ON public.reports;
CREATE POLICY "Reporters can view their own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Moderators/Admins can view all reports" ON public.reports;
CREATE POLICY "Moderators/Admins can view all reports" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Moderators/Admins can update reports" ON public.reports;
CREATE POLICY "Moderators/Admins can update reports" ON public.reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'moderator')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. create_notification RPC (used by triggers)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_type TEXT,
  p_reference_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, reference_id)
  VALUES (p_user_id, p_actor_id, p_type, p_reference_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(UUID, UUID, TEXT, UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Admin helper RPCs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_platform_role() RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_platform_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_role TEXT;
BEGIN
  caller_id := auth.uid();
  SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;

  IF p_role NOT IN ('member', 'moderator', 'admin', 'suspended') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = NOW() WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Notification triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. Comment on a post → notify post author; reply → notify parent author
CREATE OR REPLACE FUNCTION public.notify_comment_on_post() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE post_author UUID; parent_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author <> NEW.author_id THEN
    PERFORM public.create_notification(post_author, NEW.author_id, 'comment_on_post', NEW.id);
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO parent_author FROM public.comments WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author <> NEW.author_id THEN
      PERFORM public.create_notification(parent_author, NEW.author_id, 'reply_to_comment', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_on_post ON public.comments;
CREATE TRIGGER trg_notify_comment_on_post
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_comment_on_post();

-- 6b. Upvote on a post → notify post author
CREATE OR REPLACE FUNCTION public.notify_post_vote() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE post_author UUID;
BEGIN
  IF NEW.value = 1 THEN
    SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
    IF post_author IS NOT NULL AND post_author <> NEW.user_id THEN
      PERFORM public.create_notification(post_author, NEW.user_id, 'post_vote', NEW.post_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_vote ON public.post_votes;
CREATE TRIGGER trg_notify_post_vote
AFTER INSERT OR UPDATE ON public.post_votes
FOR EACH ROW
WHEN (NEW.value = 1)
EXECUTE FUNCTION public.notify_post_vote();

-- 6c. Upvote on a comment → notify comment author
CREATE OR REPLACE FUNCTION public.notify_comment_vote() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE comment_author UUID;
BEGIN
  IF NEW.value = 1 THEN
    SELECT author_id INTO comment_author FROM public.comments WHERE id = NEW.comment_id;
    IF comment_author IS NOT NULL AND comment_author <> NEW.user_id THEN
      PERFORM public.create_notification(comment_author, NEW.user_id, 'comment_vote', NEW.comment_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment_vote ON public.comment_votes;
CREATE TRIGGER trg_notify_comment_vote
AFTER INSERT OR UPDATE ON public.comment_votes
FOR EACH ROW
WHEN (NEW.value = 1)
EXECUTE FUNCTION public.notify_comment_vote();

-- 6d. Report resolved/dismissed → notify reporter
CREATE OR REPLACE FUNCTION public.notify_report_resolved() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'resolved' OR NEW.status = 'dismissed') AND OLD.status = 'open' THEN
    PERFORM public.create_notification(NEW.reporter_id, NEW.resolved_by, 'report_resolved', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_report_resolved ON public.reports;
CREATE TRIGGER trg_notify_report_resolved
AFTER UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.notify_report_resolved();


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Realtime publication for live notifications / reports
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- DONE. Run after 005_full_sync.sql. Idempotent.
-- ============================================================================
