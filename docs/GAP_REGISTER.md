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

## GAP-WEBRTC-01 — Two-peer voice audio never heard end-to-end

- Area: Voice / WebRTC
- Severity: P1 (core social feature, unproven at runtime)
- Description: `webrtc-peer.tsx` rewritten and RLS verified (FINAL_REPORT
  O/P), but a real two-device audio call has never been executed — this
  environment exposes one audio endpoint.
- Status: BLOCKED — environment. Do not mark PASS without the two-device run.
- Next action: two authenticated sessions in one room; verify connect, mutual
  audio, mute, leave/rejoin, stale-peer cleanup, no console errors (per
  AGENT_HANDOFF voice checklist).

## GAP-UI-01 — Bare `text-red` remains in two non-messaging files

- Area: UI (error rendering)
- Severity: P3 (cosmetic — no CSS is generated for the bare token)
- Description: `src/app/settings/analytics/page.tsx` and
  `src/components/communities/CommunityMediaForm.tsx` still use `text-red`.
  The messaging forms were fixed in `8a32bf3`; these two were deliberately
  left (change minimization — unrelated to the messaging defect).
- Status: OPEN
- Next action: swap to `text-red-500` in the next touch of either file (or as
  a one-line standalone fix).

## GAP-SQL-01 — ~35 untracked one-off diagnostic SQL scripts

- Area: Repository hygiene
- Severity: P3
- Description: `sql/` contains untracked one-off inspection scripts from the
  Sep 17–19 sessions (plus `inspect-posts-fk.sql` at repo root). The reusable
  acceptance harnesses were committed in `aee3494`; the rest await triage.
- Status: OPEN
- Next action: commit genuinely reusable checks (e.g. `seed-second-user.sql`,
  `join-rls-policy-audit.sql`), delete the rest.

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
