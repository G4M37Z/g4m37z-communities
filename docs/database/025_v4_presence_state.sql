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
-- INSERT: a user must create their own presence row (upsert via unique user_id).
DROP POLICY IF EXISTS presence_insert_own ON user_presence;
CREATE POLICY presence_insert_own ON user_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- SELECT: presence is a public-lite presence signal; any authenticated member
-- of the platform may observe it (status/activity context only, no PII).
DROP POLICY IF EXISTS presence_select_own ON user_presence;
DROP POLICY IF EXISTS presence_select_authed ON user_presence;
CREATE POLICY presence_select_authed ON user_presence
  FOR SELECT USING (auth.uid() IS NOT NULL);
-- UPDATE: only the owner may update their own presence row.
DROP POLICY IF EXISTS presence_update_own ON user_presence;
CREATE POLICY presence_update_own ON user_presence
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Realtime: presence changes stream to subscribers for live indicators.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
