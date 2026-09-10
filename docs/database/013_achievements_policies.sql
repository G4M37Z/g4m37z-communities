-- ============================================================================
-- 013_achievements_policies.sql
-- Phase 1 / V3.2 — RLS policies for achievements + user_achievements, plus
-- a deterministic seed of the initial achievement catalogue.
--
-- Schema was created by master_v3.sql. This migration is additive only:
--   - Enables RLS policies (RLS is already on via rls_auto_enable).
--   - Seeds a small, deliberate set of achievements with criteria shapes
--     that V3.2 evaluation code understands.
--   - Does NOT alter existing rows.
-- ============================================================================

-- RLS enablement (idempotent; rls_auto_enable already turns it on).
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- achievements policies
-- Browseable by everyone. Inserts/updates/deletes are reserved for the
-- service_role (used by admin tooling / future seeder scripts).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Achievements are viewable by everyone"
  ON public.achievements;
CREATE POLICY "Achievements are viewable by everyone"
  ON public.achievements FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated → writes require
-- service_role (createAdminClient).

-- ---------------------------------------------------------------------------
-- user_achievements policies
-- Public SELECT so profiles can display earned badges. Writes are reserved
-- for service_role to prevent client-side achievement forgery. The composite
-- primary key (user_id, achievement_id) guarantees duplicate prevention at
-- the database level.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "User achievements are viewable by everyone"
  ON public.user_achievements;
CREATE POLICY "User achievements are viewable by everyone"
  ON public.user_achievements FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated.

-- ---------------------------------------------------------------------------
-- Seed catalogue
-- Criteria shapes supported by V3.2:
--   { "type": "reputation_threshold", "value": <int> }
--   { "type": "posts_created",        "value": <int> }
--   { "type": "events_attended",      "value": <int> }
--   { "type": "manual",               "note": "<text>" }   -- awarded by admin only
--
-- Use ON CONFLICT (name) DO NOTHING so re-runs are idempotent.
-- ---------------------------------------------------------------------------

INSERT INTO public.achievements (name, description, icon_url, criteria) VALUES
  ('First Steps',
   'Created your first post on G4M37Z Communities.',
   NULL,
   '{"type":"posts_created","value":1}'::jsonb),
  ('Conversationalist',
   'Posted 10 times across the platform.',
   NULL,
   '{"type":"posts_created","value":10}'::jsonb),
  ('Prolific Poster',
   'Posted 100 times across the platform.',
   NULL,
   '{"type":"posts_created","value":100}'::jsonb),
  ('Rising Star',
   'Earned 25 reputation points through community activity.',
   NULL,
   '{"type":"reputation_threshold","value":25}'::jsonb),
  ('Trusted Member',
   'Earned 100 reputation points through community activity.',
   NULL,
   '{"type":"reputation_threshold","value":100}'::jsonb),
  ('Community Pillar',
   'Earned 500 reputation points through community activity.',
   NULL,
   '{"type":"reputation_threshold","value":500}'::jsonb),
  ('Event Goer',
   'Attended your first community event.',
   NULL,
   '{"type":"events_attended","value":1}'::jsonb),
  ('Event Regular',
   'Attended 10 community events.',
   NULL,
   '{"type":"events_attended","value":10}'::jsonb)
ON CONFLICT (name) DO NOTHING;
