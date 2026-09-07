# Voice Call Lifecycle — V2 Verified Status
DB verified: voice_rooms/settings/participants (009 SQL) — supports rooms + presence + settings
Verified from code: NO incoming call UI (no call invitation/rejection/accept component)
Verified: NO 1-to-1 private call mechanism (no peer-to-peer invitation, no direct user-to-user call routing)
Verified: Voice comments exist (UI component verified) but NO live call connection mechanism
Verified from component inspection: VoiceRoomCard has mute/leave buttons (basic) but NO speaking/speaking state detection (no getUserMedia/analyser)
Verified: No fabricated 1-to-1 call cycle — DB/state verified only, media layer partial (no WebRTC transport)
Recommendation: implement WebRTC signaling + peer connection + audio stream management using existing DB/state layer
