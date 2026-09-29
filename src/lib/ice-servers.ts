// ============================================================================
// src/lib/ice-servers.ts
// Shared ICE configuration for every WebRTC surface (DM voice/video calls,
// voice rooms). Kept in one place so no call surface can silently drift back
// to STUN-only — the configuration that made two-peer media fail behind
// symmetric NAT / CGNAT (GAP-WEBRTC-01, 2026-09-28).
//
// STUN alone lets peers discover their public addresses but cannot relay
// traffic. Carrier NAT and most corporate/home symmetric NATs require a TURN
// relay for the media path. Configure one in production:
//
//   NEXT_PUBLIC_TURN_URL          e.g. turn:turn.example.com:3478
//                                 (comma-separate multiple URLs from the
//                                  same provider; they share one credential)
//   NEXT_PUBLIC_TURN_USERNAME     static or ephemeral credential user
//   NEXT_PUBLIC_TURN_CREDENTIAL   static password or time-limited HMAC
//
// These are NEXT_PUBLIC by design: ICE credentials travel to the browser with
// every session description — TURN secrets are inherently client-visible and
// must be short-lived (Cloudflare Calls / Twilio / Xirsys all issue them).
// Without TURN config the list degrades to public STUN and direct-NAT calls
// keep working where a hole punch is possible.
// ============================================================================

export const STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

function parseTurnServers(): RTCIceServer[] {
  const raw = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  if (!raw) return [];
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim();
  if (!username || !credential) {
    console.warn(
      "[ice] NEXT_PUBLIC_TURN_URL is set without username/credential — TURN disabled",
    );
    return [];
  }
  return [{ urls: raw.split(",").map((u) => u.trim()), username, credential }];
}

export const ICE_SERVERS: RTCIceServer[] = [...STUN_SERVERS, ...parseTurnServers()];
