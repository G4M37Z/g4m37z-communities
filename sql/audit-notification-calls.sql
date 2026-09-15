-- Audit: dump every live function body that references create_notification.
-- 006 order (correct): create_notification(user_id, type, actor_id, reference_id)
-- 05/027 order (wrong): create_notification(user_id, actor_id, type, reference_id)
SELECT p.proname, pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- normal functions only; pg_get_functiondef chokes on aggregates
  AND pg_get_functiondef(p.oid) LIKE '%create_notification%'
ORDER BY p.proname;
