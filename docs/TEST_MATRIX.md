# G4M37Z Communities — Test Matrix

> Verification levels: **L1** static inspection · **L2** automated (tsc /
> eslint / vitest) · **L3** runtime against the running system · **L4**
> two-user runtime. Never record a higher level than actually executed.
> Update the "Last run" column when you re-execute; do not carry stale
> results forward.

Last full gate run: **2026-09-19** — tsc PASS · eslint PASS (0 errors) ·
vitest **258/258** (unit, browser excluded) · `next build --webpack` PASS
(49 routes).

Last partial gate run: **2026-09-20** — tsc PASS · eslint PASS (0 errors) ·
vitest **285/285** (unit, browser excluded). Build not re-run (no build-affecting
change; prefer the CI/Vercel cloud build per AGENTS.md).

## Gates (always run after code changes)

| Gate | Command | Level | Last run | Result |
|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | L2 | 2026-09-20 | PASS |
| Lint | `npx eslint .` | L2 | 2026-09-20 | PASS (0 errors, 15 warnings) |
| Unit tests | `npx vitest run --exclude 'tests/browser/**'` | L2 | 2026-09-20 | PASS 285/285 |
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
| Thread chat-surface UI (header identity, shaped bubbles, smart auto-scroll, jump pill, GIF panel no-key state) | L3 (prod build, real clicks + screenshot) | header shows partner avatar/name/@handle + Call/Video; send → accent bubble with in-bubble time + ✓; GIF panel shows no-key empty state without TENOR_API_KEY | 2026-09-21 |
| GIF source validation (Tenor hosts + first-party bucket only) | L2 | `tests/messaging-service.test.ts` 6 cases (Tenor ok, bucket ok, hotlink/lookalike/non-https rejected) | 2026-09-21 |
| Mark-all-read reconciliation | L3 (FINAL_REPORT N) | FINAL_REPORT matrix | 2026-09-17 |
| Post media upload/edit | L3 (FINAL_REPORT K) | FINAL_REPORT matrix | 2026-09-17 |
| Post image upload → post → render → persistence (UI, prod build) | L3 (prod build, real upload) | Canvas-generated PNG via real file input → preview → publish → redirect to `/post/<id>`; row `has_img=t`, storage object served `200 image/png`; remove-image + delete-post both cleaned rows and storage (0 orphans) | 2026-09-19 |
| Reactions via UI (add love → row; toggle-off → row gone; laugh switch → row; toggle-off → row gone) | L3 (prod build, real clicks) | `/tmp/react-check.sql` live-DB output; toggle-off/switch fixed in `reactions/actions.ts` (DELETE, not RLS-blocked UPDATE) | 2026-09-19 |
| WebRTC two-peer audio | **BLOCKED — environment** (single audio endpoint) | FINAL_REPORT O/P; re-test on two devices required | — |
| Voice room single-peer runtime (join, Go Live, signaling write, leave cleanup) | L3 (prod build, headless Chromium, live DB) | `sql/verify-voice-runtime.sql` + network log; GAP-WEBRTC-01 narrowed | 2026-09-19 |
| Browser smoke (8 routes) | L3 (WebDriver, same-shell invocation) | FINAL_REPORT; Android low-memory-killer note | 2026-09-17 |
| Sticker send + render in DMs | L3 (prod build, real clicks) + L2 | picker → Fire → send → row (`attachment_type=sticker`) → renders in thread; `tests/messaging-stickers.test.ts` 8/8 | 2026-09-21 |
| Sticker URL server-side validation (`sendMessage`) | L2 | `tests/messaging-service.test.ts` 5 cases (arbitrary URL / unknown id / traversal rejected) | 2026-09-20 |
| Rate limiting active by default (msg 60/min/user, signup 5/hr/username) | L2 | `tests/rate-limit.test.ts` 8 cases (backend selection, window enforce/reset, KV fail-open) | 2026-09-20 |
| Official platform logos on profile + platform-links form | L3 (prod build, real clicks) | settings UI → Steam link saved (row verified in live DB) → profile renders official Steam SVG glyph beside the handle | 2026-09-21 |
| Seeded game covers (all 8 games) | L3 (live DB + rendered page) + L2 | 048 idempotent (`UPDATE 0` ×8); live `has_cover=t` ×8; `/discover` renders 8/8 Steam CDN covers (`naturalWidth>0`); game page hero cover confirmed; `tests/game-cover-url.test.ts` 5/5 | 2026-09-21 |
| Post create/edit pre-hydration submit gate | L2 (+ hardening) | hydration gate + `action={hydrated ? onSubmit : undefined}` (implicit-submission route closed); live click re-test owed (user-run) | 2026-09-21 |
| Brand logo placement (auth, BottomNav, 404, error) | L3 (prod build, screenshots) | lockup on login header + 404 hero glyph + BottomNav; discover header lockup | 2026-09-21 |
| DM call helpers + 049 authorization contract | L2 | `tests/dm-calls.test.ts` 22/22 (duration, start guards, error mapping, outcome labels, RLS/RPC contract) | 2026-09-21 |
| DM video call single-peer runtime (Video → row `media=video` ringing; Cancel → `ended/CANCELLED` + call-log message) | L3 (prod build, real clicks) + impersonated SQL probes (050) | `/tmp/call-check.sql` live-DB output; partner-resolution fix (041 RPC in `getCallContext`) verified — Call/Video buttons render | 2026-09-21 |
| DM call two-peer audio (ring→accept→media→end) | **BLOCKED — environment** (single audio endpoint, same as GAP-WEBRTC-01) | two-device test owed; static + realtime wiring complete | — |

## Regression protection rule

Every real bug fixed gets one of: a committed regression test, a committed
transaction-scoped SQL acceptance script, or a documented manual acceptance
procedure in this matrix. Bug → root cause → fix → test → result is recorded
in `docs/GAP_REGISTER.md`.
