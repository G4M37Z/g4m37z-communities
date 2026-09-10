-- V4 LFG Session Table
CREATE TABLE IF NOT EXISTS lfg_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  platform TEXT,
  region TEXT,
  language TEXT DEFAULT 'en',
  session_type TEXT DEFAULT 'casual',
  skill_rank TEXT,
  party_size INTEGER DEFAULT 2,
  voice_required BOOLEAN DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','live','completed','cancelled')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lfg_game ON lfg_sessions(game_slug);
CREATE INDEX IF NOT EXISTS idx_lfg_status ON lfg_sessions(status) WHERE status IN ('published','live');
CREATE INDEX IF NOT EXISTS idx_lfg_scheduled ON lfg_sessions(scheduled_at);
-- RLS: owners + members can manage
ALTER TABLE lfg_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS lfg_owner_select ON lfg_sessions FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS lfg_owner_all ON lfg_sessions FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
