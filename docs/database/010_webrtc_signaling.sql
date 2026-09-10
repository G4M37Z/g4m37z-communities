-- docs/database/010_webrtc_signaling.sql — for WebRTC Gap 1 (offer/answer/ice/peer_join/leave)
-- Use ONLY when Gap 1 signaling layer is needed; read 009 first (voice_rooms/participants already exist)
-- Do NOT run if no voice-room feature requires signaling.
CREATE TABLE IF NOT EXISTS public.webrtc_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES auth.users(id),
  to_user uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('OFFER','ANSWER','ICE_CANDIDATE','PEER_JOIN','PEER_LEAVE')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_room ON public.webrtc_signals(room_id, created_at DESC);
CREATE POLICY "Room members can read signals" ON public.webrtc_signals FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.voice_room_participants WHERE room_id = webrtc_signals.room_id));
CREATE POLICY "Self can insert" ON public.webrtc_signals FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "Self can delete" ON public.webrtc_signals FOR DELETE USING (auth.uid() = from_user);
