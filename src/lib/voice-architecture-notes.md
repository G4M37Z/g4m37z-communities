# Voice Architecture — Phase 1 Foundation Note
Status verified: DB FULL, WebRTC MISSING, Media Transport MISSING, Signaling MISSING
Approach: Separate signaling/state (DB/realtime) from media transport (WebRTC) per spec
No live audio stored in DB (verified from 009 SQL design)
Future infrastructure: WebRTC required for actual transport
No arbitrary code added — using verified existing components only
