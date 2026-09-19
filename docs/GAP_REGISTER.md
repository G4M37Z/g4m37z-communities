# G4M37Z Communities — Gap Register

> Single register of unresolved issues. Never hide a gap. Statuses: OPEN ·
> IN PROGRESS · FIXED · VERIFIED · BLOCKED · DEFERRED · NOT REPRODUCED.
> Historical per-era audits live in `IMPLEMENTATION_GAPS.md` and `ERRORS.md`;
> this file tracks what is open **now**. Newest entries last.

---

## GAP-EMAIL-01 — Email confirmation disabled (launch blocker)

- Area: Authentication
- Severity: **P0 before launch** (deliberate temporary state)
- Description: "Confirm email" is OFF in Supabase Auth to work around the
  signup `429 over_email_send_rate_limit` (ERRORS.md #5).
- Reproduction: sign up with a fresh email → confirmation flow bypassed.
- Root cause: ox-auth email rate limit; cannot be changed via SQL.
- Status: BLOCKED — requires a Supabase **dashboard** action.
- Next action: re-enable "Confirm email" in `authentication → providers →
  email` immediately before launch; remove the seeded-user workaround notes.

## GAP-WEBRTC-01 — Two-peer voice audio remains unheard end-to-end

- Area: Voice / WebRTC
- Severity: P1 (core social feature; single-peer path now proven, pairwise
  audio still unproven)
- Description: Single-peer runtime verified 2026-09-19 on the production
  build + live DB (headless Chromium, autotest2): room join created the
  participant row and flipped presence to busy; Go Live ran getUserMedia +
  RTCPeerConnection and published a PEER_JOIN signal that passed the 045
  `webrtc_signals` RLS (sender must be a participant; row persisted);
  Leave deleted the participant row cleanly (no stale rows) and restored
  presence. What remains blocked: the answer/ICE exchange and mutual audio
  between two endpoints — this environment exposes one audio endpoint.
- Evidence: network log (`POST webrtc_signals → 201`),
  `sql/verify-voice-runtime.sql` output, `sql/seed-voice-room.sql`.
- Status: BLOCKED — environment (single-endpoint). Do not mark PASS without
  the two-device run.
- Next action: two authenticated sessions in one room; verify connect, mutual
  audio, mute, leave/rejoin, stale-peer cleanup, no console errors (per
  AGENT_HANDOFF voice checklist).

## GAP-UI-01 — Bare `text-red` error classes — CLOSED

- Area: UI (error rendering)
- Severity: P3 (cosmetic — no CSS was generated for the bare token)
- Fix: messaging forms in `8a32bf3`; analytics page + CommunityMediaForm in
  `e02968d`. `grep -rn "text-red\b" src/` now returns only `text-red-500`.
- Status: FIXED (gates PASS).

## GAP-SQL-01 — Diagnostic SQL script triage — CLOSED

- Area: Repository hygiene
- Severity: P3
- Fix: 2026-09-19 (`d988d5f`) — kept the 3 reusable scripts
  (`seed-second-user.sql`, `join-rls-policy-audit.sql`, `check-membership.sql`)
  alongside the committed acceptance harnesses; deleted the 31 one-off
  inspection scripts and `inspect-posts-fk.sql` per the AGENT_HANDOFF rule
  that temporary inspection files do not persist.
- Status: FIXED.

## GAP-DIGEST-01/02 — Legacy production digests need user re-test

- Area: Feed / post interactions (ERRORS.md #2, #3)
- Severity: P2
- Description: digests `3702571692` and `943033484@E352` were never
  reproduced under instrumentation; stale-client-build suspicion. Both need a
  hard-refresh re-test by the reporting user; if they recur, capture page +
  action.
- Status: NOT REPRODUCED (awaiting user re-test)

## GAP-RATE-01 — Env-gated rate limits dormant by default

- Area: Abuse hardening
- Severity: P2 (pre-launch decision)
- Description: application-side rate limits (`44d7cde`) only activate when
  env-configured. Nothing currently configures them in production.
- Status: OPEN (decision required)
- Next action: decide before launch: configure limits in prod env vs. rely on
  Supabase-side auth rate limits + dashboard controls; record in DECISIONS.md.

## GAP-VERIFY-01 — Acceptance harnesses are psql-driven, not CI

- Area: Testing
- Severity: P3
- Description: the 045 RPC acceptance tests run via `run-sql` against the
  live DB; they are not wired into CI (live-DB credentials cannot be shared
  with CI). Regression protection = committed, re-runnable scripts +
  TEST_MATRIX entries.
- Status: DEFERRED (by design; revisit if a staging DB becomes available)
