-- ============================================================================
-- 035_notification_deleted_content_cleanup.sql
--
-- GAP-01 / GAP-04: notifications whose reference_id points at deleted
-- posts/comments must not survive deletion. They produced "/post/{id} 404"
-- click-throughs — confirmed live before this migration: 2 orphan rows
-- (types: post_vote, comment_on_post).
--
-- Why triggers, not FKs: notifications.reference_id is a polymorphic pointer
-- (posts OR comments OR events — see getNotificationHref). A real FK is
-- impossible against heterogeneous targets; the existing architecture uses
-- trigger functions (027 notify_*, 033 notify_on_repost) — this follows it.
--
-- Why BEFORE DELETE + SECURITY DEFINER: no app user has DELETE on
-- notifications (policies are owner-SELECT/UPDATE only). A AFTER DELETE
-- trigger run as the deleting user would be blocked by RLS. SECURITY DEFINER
-- matches the existing notify_* pattern (search_path pinned; no owner input).
--
-- BEFORE DELETE (not AFTER): reads OLD in a statement-level-safe way and
-- guarantees cleanup is atomic with the content deletion.
--
-- Comment notifications need no separate trigger: comments.post_id has
-- ON DELETE CASCADE (004), so deleting a post fires this trigger and removes
-- comment-referencing notifications in the same statement.
--
-- Idempotent: IF EXISTS / IF NOT EXISTS everywhere; safe to re-run.
-- ============================================================================

-- 1. One-time purge of audit-confirmed orphans --------------------------------
DELETE FROM public.notifications n
WHERE n.reference_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.posts p    WHERE p.id = n.reference_id)
  AND NOT EXISTS (SELECT 1 FROM public.comments c WHERE c.id = n.reference_id);

-- 2. Cleanup function ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_notifications_for_deleted_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE reference_id = OLD.id;
  RETURN OLD;
END;
$$;

-- 3. Triggers on posts and comments -------------------------------------------
DROP TRIGGER IF EXISTS trg_cleanup_notifications_post ON public.posts;
CREATE TRIGGER trg_cleanup_notifications_post
BEFORE DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.cleanup_notifications_for_deleted_content();

DROP TRIGGER IF EXISTS trg_cleanup_notifications_comment ON public.comments;
CREATE TRIGGER trg_cleanup_notifications_comment
BEFORE DELETE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.cleanup_notifications_for_deleted_content();
