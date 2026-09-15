-- v5-sprint-baseline3.sql — READ-ONLY
-- 1. follows + comments columns (analytics + ranking signals)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('follows','comments','reactions','post_votes')
ORDER BY table_name, ordinal_position;

-- 2. existing notification trigger to mirror (repost notifications)
SELECT tgname, tgrelid::regclass AS on_table, prosrc
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND tgrelid = 'public.notification_events'::regclass;

SELECT tgname, tgrelid::regclass AS on_table, proname
FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND tgrelid IN ('public.reactions'::regclass,'public.comments'::regclass,'public.follows'::regclass)
ORDER BY tgrelid::regclass::text, tgname;

-- 3. trigger function source (pattern to reuse)
SELECT proname, prosrc FROM pg_proc
WHERE pronamespace='public'::regnamespace AND proname LIKE '%notif%'
LIMIT 3;
