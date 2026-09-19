# G4M37Z Communities — Test Matrix

> Verification levels: **L1** static inspection · **L2** automated (tsc /
> eslint / vitest) · **L3** runtime against the running system · **L4**
> two-user runtime. Never record a higher level than actually executed.
> Update the "Last run" column when you re-execute; do not carry stale
> results forward.

Last full gate run: **2026-09-19** — tsc PASS · eslint PASS (0 errors) ·
vitest **258/258** (unit, browser excluded) · `next build --webpack` PASS
(49 routes).

## Gates (always run after code changes)

| Gate | Command | Level | Last run | Result |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | L2 | 2026-09-19 | PASS |
| Lint | `npx eslint .` | L2 | 2026-09-19 | PASS (0 errors) |
| Unit tests | `npx vitest run --exclude 'tests/browser/**'` | L2 | 2026-09-19 | PASS 258/258 |
| Build | `./node_modules/.bin/next build --webpack` | L2 | 2026-09-19 | PASS (49 routes) |

## Critical flows

| Flow | Level reached | Evidence | Last run |
|---|---|---|---|
| Community join/leave/rejoin RPC (soft-leave, role preserved) | L3 (live DB, transaction-scoped) | `sql/accept-045-leave-rejoin.sql` output | 2026-09-19 |
| Direct conversation create/reuse + block enforcement | L3 (live DB, transaction-scoped) | `sql/accept-045-messaging.sql` output | 2026-09-19 |
| Messaging send, sender side (UI → rows → redirect → ✓) | L3 (prod build, real login) | Network log: 1 action POST, no native GET; `sql/verify-surface-send.sql` | 2026-09-19 |
| Messaging receive, recipient side (unread badge, thread view) | L4 (autotest ↔ autotest2) | Preview snapshots of `/messages` + thread as autotest2 | 2026-09-19 |
| Signup (confirm-password, visibility toggle, terms) | L2 + prior L3 (FINAL_REPORT 2026-09-17) | FINAL_REPORT matrix B/C | 2026-09-17 |
| Username search / recipient discovery | L3 (FINAL_REPORT D/H) | FINAL_REPORT matrix | 2026-09-17 |
| Repost idempotency + undo | L2 + L3 (033 contract) | FINAL_REPORT matrix L | 2026-09-17 |
| Repost UI full loop (create → row + notification → undo → clean) | L3 (prod build, real click) | `sql/check-repost-fixtures.sql` + notif query; fixed use-server export + comment validation | 2026-09-19 |
| Post votes via UI (up → +1 row; switch → same row −1; clear → row deleted, 0/0) | L3 (prod build, real clicks) | Network log clean; `/tmp/vote-check.sql` live-DB output; no stale rows | 2026-09-19 |
| Message send latency (click → bubble) | L3 (prod build, timed) | 1504 ms measured (was 14.9s: realtime-echo dependency); optimistic append via ThreadClient | 2026-09-19 |
| Mark-all-read reconciliation | L3 (FINAL_REPORT N) | FINAL_REPORT matrix | 2026-09-17 |
| Post media upload/edit | L3 (FINAL_REPORT K) | FINAL_REPORT matrix | 2026-09-17 |
| Post image upload → post → render → persistence (UI, prod build) | L3 (prod build, real upload) | Canvas-generated PNG via real file input → preview → publish → redirect to `/post/<id>`; row `has_img=t`, storage object served `200 image/png`; remove-image + delete-post both cleaned rows and storage (0 orphans) | 2026-09-19 |
| Reactions via UI (add love → row; toggle-off → row gone; laugh switch → row; toggle-off → row gone) | L3 (prod build, real clicks) | `/tmp/react-check.sql` live-DB output; toggle-off/switch fixed in `reactions/actions.ts` (DELETE, not RLS-blocked UPDATE) | 2026-09-19 |
| WebRTC two-peer audio | **BLOCKED — environment** (single audio endpoint) | FINAL_REPORT O/P; re-test on two devices required | — |
| Voice room single-peer runtime (join, Go Live, signaling write, leave cleanup) | L3 (prod build, headless Chromium, live DB) | `sql/verify-voice-runtime.sql` + network log; GAP-WEBRTC-01 narrowed | 2026-09-19 |
| Browser smoke (8 routes) | L3 (WebDriver, same-shell invocation) | FINAL_REPORT; Android low-memory-killer note | 2026-09-17 |

## Regression protection rule

Every real bug fixed gets one of: a committed regression test, a committed
transaction-scoped SQL acceptance script, or a documented manual acceptance
procedure in this matrix. Bug → root cause → fix → test → result is recorded
in `docs/GAP_REGISTER.md`.
