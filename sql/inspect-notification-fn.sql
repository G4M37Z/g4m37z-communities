-- Inspect live notification helper functions (read-only)
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%notif%' OR p.proname ILIKE '%create%')
ORDER BY p.proname;

-- How migration 027's follow notification trigger actually writes
SELECT proname, pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'notify_follow';

-- The notifications INSERT pattern used by existing triggers
SELECT tgname, tgrelid::regclass AS on_table, tgfoid::regproc AS fn
FROM pg_trigger
WHERE tgrelid IN ('public.follows'::regclass, 'public.reposts'::regclass)
  AND NOT tgisinternal;
