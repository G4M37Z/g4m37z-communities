-- ===================================================================
-- 043_tournament_frameworks.sql
-- Implements game-specific tournament frameworks, stages, and scoring.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. Tournament Frameworks (Templates)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_frameworks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 64),
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category     TEXT, -- e.g. 'Fortnite', 'EA FC', 'General'
  scoring_type TEXT NOT NULL CHECK (scoring_type IN ('points', 'win_loss', 'rank')),
  description  TEXT,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_frameworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS frameworks_select ON public.tournament_frameworks;
CREATE POLICY frameworks_select ON public.tournament_frameworks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS frameworks_insert ON public.tournament_frameworks;
CREATE POLICY frameworks_insert ON public.tournament_frameworks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS frameworks_update ON public.tournament_frameworks;
CREATE POLICY frameworks_update ON public.tournament_frameworks
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- -------------------------------------------------------------------
-- 2. Tournament Stages (Pipeline)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_stages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    UUID NOT NULL REFERENCES public.tournament_frameworks(id) ON DELETE CASCADE,
  stage_order     INT NOT NULL CHECK (stage_order >= 1),
  stage_name      TEXT NOT NULL CHECK (char_length(stage_name) BETWEEN 1 AND 100),
  progression_rule JSONB NOT NULL DEFAULT '{}', -- e.g. { "top_n": 16 }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (framework_id, stage_order)
);

ALTER TABLE public.tournament_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stages_select ON public.tournament_stages;
CREATE POLICY stages_select ON public.tournament_stages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS stages_insert ON public.tournament_stages;
CREATE POLICY stages_insert ON public.tournament_stages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tournament_frameworks f 
    WHERE f.id = framework_id AND f.created_by = auth.uid()
  ));

-- -------------------------------------------------------------------
-- 3. Tournament Scores (Manual Entry)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  stage_id      UUID NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score         NUMERIC NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, stage_id, user_id)
);

ALTER TABLE public.tournament_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scores_select ON public.tournament_scores;
CREATE POLICY scores_select ON public.tournament_scores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS scores_upsert ON public.tournament_scores;
CREATE POLICY scores_upsert ON public.tournament_scores
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
      AND (t.creator_id = auth.uid() OR t.event_id IS NULL) -- simplified ownership
    )
  );

-- -------------------------------------------------------------------
-- 4. Tournaments (Update to use Frameworks)
-- -------------------------------------------------------------------

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS framework_id UUID REFERENCES public.tournament_frameworks(id),
  ADD COLUMN IF NOT EXISTS current_stage_id UUID REFERENCES public.tournament_stages(id);

CREATE INDEX IF NOT EXISTS idx_tournaments_framework ON public.tournaments(framework_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_stage ON public.tournaments(current_stage_id);

-- -------------------------------------------------------------------
-- 5. Legacy Migration
-- -------------------------------------------------------------------

INSERT INTO public.tournament_frameworks (slug, name, category, scoring_type, description)
VALUES ('classic', 'Classic Bracket', 'General', 'win_loss', 'Standard tournament brackets')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tournament_stages (framework_id, stage_order, stage_name, progression_rule)
SELECT id, 1, 'Main Tournament', '{"top_n": 1}'::jsonb
FROM public.tournament_frameworks WHERE slug = 'classic';

UPDATE public.tournaments
SET framework_id = (SELECT id FROM public.tournament_frameworks WHERE slug = 'classic')
WHERE framework_id IS NULL;

UPDATE public.tournaments
SET current_stage_id = (
  SELECT id FROM public.tournament_stages
  WHERE framework_id = (SELECT id FROM public.tournament_frameworks WHERE slug = 'classic')
    AND stage_order = 1
)
WHERE current_stage_id IS NULL;

-- ===================================================================
-- End 043.
-- ===================================================================
