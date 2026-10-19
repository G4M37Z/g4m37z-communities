# G4M37Z MEDIA STACK — the self-existent framework

> The plan to run calls and streams on infrastructure G4M37Z owns end-to-end —
> no third-party call/streaming provider. Written 2026-10-20. First principle:
> browsers dictate two protocols we cannot change (WebRTC peer connections,
> WebTransport client/server). Everything **around** those two rails is ours
> to invent. That boundary is not a limit — it is the design space.

---

## 1. Who owns what today (the honest audit)

| Plane | Standard/name | Status at G4M37Z |
|---|---|---|
| Signaling | *none standardized by the IETF* | **OURS ALREADY** — `call_sessions` + `webrtc_signals` in Postgres, realtime delivery, ring/accept/hangup state machine |
| Connectivity (ICE/STUN/TURN) | RFC 8445 / 5389 / 5766 (browser-side embedded) | Browser code we can't touch; **relay is the gap** — currently public STUN only |
| Media transport | SRTP/DTLS/SCTP (browser-embedded) | Browser-native, free |
| Admission | — | **ours to build** — mint ephemeral TURN creds, session tokens |
| Voice rooms | community voice rooms exist on the same `webrtc_signals` mesh | ours, capped by mesh size (~5) |
| Streaming/egress | WHIP (RFC 9725) / WHEP (final draft) | nothing built yet |

The "ancient framework" summary: every commercial provider (Cloudflare Calls,
Twilio, LiveKit Cloud…) is a bundled resale of the same five primitives. We
already own the hardest privatized-looking one (signaling). What remains is a
relay box and an admission path — both spec-standard, both trivially
self-hostable, both fully under G4M37Z's control.

## 2. The G4M37Z Media Grid (target architecture)

```
phone A ──P2P/STUN────────── phone B            (1:1 and ≤5: mesh, free)
   │
   └──G4M37Z Relay Node───phone B                (CGNAT fallback, our box)
              │
phone A ══AND B══ G4M37Z Cast Node (WebTransport/MoQ)
              │
        whole community listeners                   (rooms/streams, 1→N)
```

Three runnable node types, one machine each, all G4M37Z-managed:

1. **Relay Node** (Phase A): coturn with `--use-auth-secret`. Vanilla TURN,
   no provider. Cheap ($4–6/mo). Replaces `NEXT_PUBLIC_TURN_*` static env
   with dynamic minted creds (`docs/media/turn-minting.spec.ts`).
2. **Cast Node** (Phase B/C): a WebTransport (HTTP/3/QUIC) endpoint of our
   own. Custom "GT Cast" protocol: Subscribe(community_id, room_id) →
   Datagram/Unreliable-stream frames carrying Opus/VP8/AV1 payloads encoded
   **in-browser via WebCodecs**. No ICE at all (server reachability needs no
   NAT traversal); Pion (Go) or RawQUIC server on the same VPS class.
   WHIP/WHEP-shaped HTTP handshake for interop with OBS as a producer later.
3. **Presence Plane**: untouched (Postgres). Rooms, roles, joins, mutes,
   admissions — all rows in our DB, all real already.

## 3. Quality + latency decisions (the "very fast, best quality" engineering)

- **Voice**: Opus at 24–32 kbps mono, validated by the browser; DTX on for
  bandwidth headroom. Forward error correction stays G.711-style built-in.
- **Rendering loop**: sub-100ms mouth-to-ear on relayed paths is realistic
  (one relay hop + DTLS). No transcode anywhere in the P2P path means the
  browser's packet pacing and jitter buffer run at full native quality.
- **Congestion control**: browser-native (Transport-wide CC in WebRTC; NewReno
  + quality signals in QUIC). We don't reinvent this — it's 20 years of audio
  research; we *configure* it instead (bitrate ceilings per room role).
- **1→N growth rule**: >5 speakers ⇒ everyone keeps P2P (mesh-free) but
  listeners switch to Cast Node subscribe-only (unidirectional, zero TURN
  cost to the platform — no ICE on egress).

## 4. Phase plan (execution order)

**Phase A — call self-sufficiency (small, imminent):**
1. VPS + Docker coturn, `use-auth-secret` + shared `TURN_SECRET` env.
2. `/api/turn-credentials` server action (minting spec exists in docs/media/)
   wired into `beginCallMedia` before the PeerConnection is built.
3. Remove the `NEXT_PUBLIC_TURN_*` static config from `ice-servers.ts` —
   creds come per-call, not at boot.
4. Gates: two-device test with both phones on mobile data (CGNAT pair).

**Phase B — GT Cast MVP (streaming plane):**
1. WebTransport server proof (node on the same VPS, cert for subdomain:
   `cast.g4m37z.net`).
2. Codec: WebCodecs Opus encode → WebTransport datagrams on the server; the
   server forwards per-subscriber. No SFU "brand" — ours, ~400 lines Go.
3. Community voice rooms get a "stream to listeners" affordance; listeners
   decode with WebCodecs in `<audio>` pipelines.

**Phase C — the invention frontier (unguarded):**
- Listener-side **WebTransport inside the same browser page** as the live
  message rail: one arrival path for chat reactions + stream frames — a
  reaction wave on a stream with zero HTTP serving of the audio path.
- Inter-community streaming federation: two communities bridge via each
  other's Cast Nodes with G4M37Z-signed tokens (WhIP-style HTTP handshake).
- Phone-as-relay experiments (Termux hosting a Relay Node) as a dormant
  idea until the serious grid need justifies it.

## 5. What we deliberately keep standard

STUN discovery, DTLS keys, SDP BETWEEN PEERS, congestion control, and the
TURN relay protocol (5389/5766 on the wire). G4M37Z's invention lives **on
top** of the wire, where differentiation is real: issues, admission tokens,
room topology, and the MoQ-style relay protocol on our Cast Node. "Not
relying on providers" ≠ "not obeying physics".

## 6. Cost ceiling of full self-existence

One VPS ($5) covers: coturn + GT Cast sampling (≤5 concurrent casts at 32
kbps ≈ trivial bandwidth). At real community scale, the ONLY variable cost is
relay/egress bytes — ours to meter, at our cost, per our rules. That is the
god-mode end state: zero third-party, zero per-seat fee, zero hand-me-down
constraints beyond the browser spec itself.
