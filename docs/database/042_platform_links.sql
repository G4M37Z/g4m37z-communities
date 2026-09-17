-- ===================================================================
-- 042_platform_links.sql
-- Manual, self-reported gaming-platform identities.
--
-- A user types their own handle for Steam / PlayStation / Xbox /
-- Google Play Games / Apple Game Center so other members can find
-- them. This table stores DECLARED identities only:
--   * verified_at is always NULL until a real connector (Steam OpenID
--     + Web API) sets it. Nothing may render a self-reported row as
--     "verified" or "connected".
--   * there is deliberately no user_games / import table here.
--
-- RLS (mirrors public.profiles: world-readable, owner-only writes):
--   SELECT  — true (links appear on the public profile page).
--   INSERT  — user_id = auth.uid().
--   UPDATE  — user_id = auth.uid() (WITH CHECK pins ownership, so a
--             row cannot be reassigned to another user).
--   DELETE  — user_id = auth.uid().
-- ===================================================================

CREATE TABLE IF NOT EXISTS public.platform_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN
                 ('steam','playstation','xbox','google_play','apple_game_center')),
  handle       TEXT NOT NULL CHECK (char_length(handle) BETWEEN 1 AND 64),
  profile_url  TEXT CHECK (profile_url IS NULL OR profile_url ~ '^https://'),
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_links_user ON public.platform_links(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_links_handle ON public.platform_links(lower(handle));

ALTER TABLE public.platform_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_links_select ON public.platform_links;
CREATE POLICY platform_links_select ON public.platform_links
  FOR SELECT USING (true);

DROP POLICY IF EXISTS platform_links_insert ON public.platform_links;
CREATE POLICY platform_links_insert ON public.platform_links
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS platform_links_update ON public.platform_links;
CREATE POLICY platform_links_update ON public.platform_links
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS platform_links_delete ON public.platform_links;
CREATE POLICY platform_links_delete ON public.platform_links
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===================================================================
-- End 042.
-- ===================================================================
