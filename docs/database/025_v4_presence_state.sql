-- V4 Presence State Table for realtime tracking
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'offline' CHECK (status IN ('offline','online','away','in_voice')),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  activity_context TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status) WHERE status = 'online';
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS presence_select_own ON user_presence;
CREATE POLICY presence_select_own ON user_presence FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS presence_update_own ON user_presence;
CREATE POLICY presence_update_own ON user_presence FOR UPDATE USING (auth.uid() = user_id);
