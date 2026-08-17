-- ============================================================================
-- Additive: terms-of-service consent tracking
-- Idempotent. Safe to re-run.
--
-- Adds two columns to public.profiles:
--   terms_accepted_at  TIMESTAMPTZ  — when the user accepted the current ToS
--   terms_version      TEXT        — which version of the ToS they accepted
--
-- Both are nullable so existing users are not broken; the app treats NULL as
-- "has not yet accepted" and forces re-acceptance on next visit.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_version TEXT;

COMMENT ON COLUMN public.profiles.terms_version IS 'ToS version the user accepted. Format: "vN" where N is monotonic.';

-- Full audit trail of every acceptance
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user_id
  ON public.terms_acceptances(user_id, accepted_at DESC);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own acceptances" ON public.terms_acceptances;
CREATE POLICY "Users can view their own acceptances" ON public.terms_acceptances
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can record their own acceptance" ON public.terms_acceptances;
CREATE POLICY "Anyone can record their own acceptance" ON public.terms_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);
