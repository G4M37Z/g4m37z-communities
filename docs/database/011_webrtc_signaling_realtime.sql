-- ============================================================================
-- 011_webrtc_signaling_realtime.sql
-- Phase 0.6 — add webrtc_signals to supabase_realtime publication so the
-- existing realtime service can subscribe to signaling messages for
-- offer/answer/ICE exchange. Idempotent (DO block swallows duplicate_object).
-- ============================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
