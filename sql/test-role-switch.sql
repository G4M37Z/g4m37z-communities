-- Probe: can we SET ROLE to the API roles for true RLS testing?
\echo 'current user / session user:'
SELECT current_user, session_user;

\echo 'try SET LOCAL ROLE authenticated:'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT count(*) AS notif_as_authenticated FROM public.notifications;
ROLLBACK;

\echo 'try SET LOCAL ROLE anon:'
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS notif_as_anon FROM public.notifications;
ROLLBACK;
