-- ============================================================================
-- src/lib/turn/credentials.ts  (MODULE SPEC — implemented Phase A1)
-- G4M37Z TURN REST API credential minting (draft-uberti-behave-turn-rest-00).
--
--   username  = "<expiry-unix-ts>:<user-id>"
--   password  = base64(HMAC-SHA1(TURN_SECRET, username))
--
-- TURN_SECRET lives server-side only (Supabase Edge Function). The browser
-- receives 1-hour credentials bound to the authenticated caller. The relay
-- node (coturn, --use-auth-secret --static-auth-secret=<same secret>)
-- validates the HMAC without any shared database.
--
-- Issuance policy: only authenticated users; per-allocation cap (TTL);
-- minted at call start / voice-room join inside the existing action flow.
-- ============================================================================

// Server (Edge Function / server action):
export async function mintTurnCredentials(userId: string, ttlSeconds = 3000) {
  const secret = process.env.TURN_SECRET!; // rotated via env, never in code
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:${userId}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(username));
  const password = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302"] },
      { urls: ["turn:turn.<region>.g4m37z.example:3478", "turns:turn.<region>.g4m37z.example:5349"], username, credential: password },
    ],
    ttl: ttlSeconds,
  };
}
