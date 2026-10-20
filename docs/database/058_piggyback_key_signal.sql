-- docs/database/058_piggyback_key_signal.sql
-- Piggyback lane (serverless media fallback) — handshake signal type.
--
-- The piggyback lane exchanges ephemeral ECDH P-256 public keys through the
-- SAME channel-agnostic signaling rows every call already uses (webrtc_signals,
-- 049/045 policies unchanged: INSERT restricted to from_user == auth.uid(),
-- SELECT restricted to conversation members / room participants). Adding a new
-- `type` value to the existing CHECK is the only schema change.
--
-- No row shape changes; payload jsonb already holds arbitrary structured data.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webrtc_signals_type_check'
  ) THEN
    ALTER TABLE public.webrtc_signals DROP CONSTRAINT webrtc_signals_type_check;
  END IF;
END $$;

ALTER TABLE public.webrtc_signals
  ADD CONSTRAINT webrtc_signals_type_check
  CHECK (type IN (
    'OFFER',
    'ANSWER',
    'ICE_CANDIDATE',
    'PEER_JOIN',
    'PEER_LEAVE',
    'PB_KEY'
  ));
