# G4M37Z Communities — Master Read-Only Audit (2026-10-20)

> Audit snapshot at HEAD `295326d`. Conducted read-only: no files modified,
> no DB writes (SELECT-only live probes against the production Postgres via
> the `run-sql` helper), no deploy/branch/config changes. This document is a
> finding register — do not treat "documented fix" as "verified fix" without
> the evidence below.
>
> User-deferred: two-device voice/video media test (see §I).
> No credential values are reproduced in this document, only filenames and
> approximate line locations.

## A. Repository snapshot

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `295326d` — "feat(verification): badge everywhere an account appears…" |
| Remote | `git@github.com:G4M37Z/g4m37z-communities.git` (pushed, clean) |
| Worktree | Clean — zero modified/untracked files at audit time |
| Stack | Next.js 16.3.0 App Router (pinned `--webpack`; Turbopack unsupported on Termux/arm64), React 19.2.8, TypeScript, `@supabase/supabase-js` 2.112.2, Tailwind v4, Node 24.18 |
| Gate scripts | `npm run check` = typecheck + eslint + `test:unit` (browser suite excluded) |

## B. Executive summary

**Complete and evidenced:** auth chain (signup/login/logout/email-confirm+resend
PKCE/password reset), profile + username canonicalization, communities core
(join/leave/post/comment-tree/vote/bookmark/poll/repost/reaction), DM messaging
(read receipts, soft delete, attachments, GIFs, stickers, optimistic send,
realtime reconnect, unread RPC), `guard_profile_role` /
`guard_profile_verified` triggers, notification feed with stale-reference
guards, follows/search/valid nav routes, migration idempotency (0
non-`IF NOT EXISTS` DDL in 001–060), RLS enabled on ALL public tables
(live-verified), security headers (nosniff/XFO/HSTS/Permissions-Policy).

**Incomplete / broken:**
- **AUDIT-02 (P1, live-confirmed):** the `notifications_type_check` CHECK
  constraint in the live database omits the `community_post` and
  `missed_call` types that migration 055's triggers insert. Consequence:
  any post created in a community with ≥1 other member (prefs default ON)
  aborts, and `call_sessions` updates to MISSED/DECLINED abort.
- **AUDIT-03 (P1, live-confirmed):** admin tooling is non-functional.
  `admin_set_user_role` is revoked from `authenticated` (014, never
  re-granted) so the admin UI role dropdown silently fails with a misleading
  redirect; `adminDeletePost` returns success without deleting;
  `adminBanUser` is dead code (would violate `guard_profile_role`).
- **AUDIT-01 (P0):** a plaintext test-account password + email + username
  remain committed in `docs/PROJECT_STATE.md` (~line 675) and the test users
  are alive in the live DB.
- Two-device media verification deferred; TURN relay unprovisioned (blocked).

## C. Feature matrix

| Feature | Evidence | Verification | Status | Remaining |
|---|---|---|---|---|
| Signup/login/logout/email confirm+resend | `src/lib/supabase/actions.ts:28-244`, `src/app/auth/callback/route.ts:34-107`, `src/proxy.ts:16-59` | unit (`auth-urls.test.ts`) + GAP-EMAIL-01 flow audit | VERIFIED WORKING | independently confirm dashboard confirm-email state |
| Password recovery | `actions.ts:291-366` | unit | VERIFIED WORKING | — |
| Profiles / verified / roles | `src/app/profile/[username]/page.tsx:94,212`; `docs/database/059` trigger | live DB probe (only `linyuluderrick` verified; trigger raises for self-change verified) | VERIFIED WORKING | criteria for others pending |
| Communities/posts/comments/votes | 045 RPCs; `src/lib/posts/actions.ts:195-205`; `src/lib/comments/queries.ts:110` | 408 unit tests; live trigger inventory | VERIFIED WORKING | AUDIT-02 breaking constraint |
| Reactions/bookmarks/polls/reposts | 032/033 + services | unit | VERIFIED WORKING | — |
| DM messaging | `src/lib/messaging/service.ts`, 046/055 RPCs, `ThreadLive.tsx:41-87` | historical two-user live test (autotest↔autotest2, PROJECT_STATE v5) | VERIFIED WORKING | AUDIT-06 paging |
| Messaging realtime reconnect | `ThreadLive.tsx:53-87`, `MessagesLive.tsx:26-48` | unit | IMPLEMENTED UNVERIFIED | live reassert |
| Voice rooms | `src/components/webrtc-peer.tsx`, `src/lib/voice/actions.ts` | protocol/signaling unit tests | IMPLEMENTED UNVERIFIED | AUDIT-07 sweep; device test |
| DM calls + piggyback | `dm-call.tsx`, `calls.ts`, 049/050/058, `src/lib/piggyback/*` | `piggyback-protocol`, `dm-calls`, `signaling-payload` tests (protocol-level) | IMPLEMENTED UNVERIFIED | §I device test |
| Notifications | 027/029/033/055 triggers; feed page; bell | live trigger query | PARTIAL (AUDIT-02, AUDIT-05) | constraint refresh + prefs wiring |
| Games/LFG/events/tournaments/creators | 052/053/056, `lfg/service.ts` (054 RPCs), `events/service.ts` (advisory-lock capacity), 043 | unit suites | VERIFIED WORKING | AUDIT-10 bootstrap |
| Reputation/achievements | 012/013 | unit | VERIFIED WORKING | — |
| Admin workflows | `src/app/admin/layout.tsx:23-41`, `src/lib/reports/actions.ts` | live privilege probe | CONFIRMED DEFECT | AUDIT-03 |
| Search/follows/saved/discovery | `src/lib/search/queries.ts`, 021, `feed-service.ts` | unit | VERIFIED WORKING | client-side trending (P3) |
| Uploads/storage | 034; 057 caps live-verified (avatars 2 MB, post-images 5 MB, message-attachments 10 MB, voice-recordings 5 MB); magic-byte sniffing | live bucket query | VERIFIED WORKING | AUDIT-09 cap sync |
| Responsive/a11y/nav | Sidebar/BottomNav aria routes validated | browser suite deferred (ChromeDriver) | IMPLEMENTED UNVERIFIED | `npm run test:browser` |
| Migrations | `docs/database/001–060` | idempotency scan + docs table match (no drift) | VERIFIED WORKING | AUDIT-10 |

## D. Prioritized defect and gap register

### AUDIT-01 — P0 — Plaintext test-account credentials in tracked docs
- Files: `docs/PROJECT_STATE.md` launch-blocker section, ~lines 660–680
  (value line 675); companion material in `docs/ERRORS.md:101-124`,
  `docs/TEST_MATRIX.md:34`, `docs/PROJECT_HISTORY.md:21-40`.
- Evidence: grep probes (values masked); the seeded accounts exist in the
  live DB (`autotest`, `autotest2`, `repro_fixture`).
- Impact: password in Git history of a GitHub repo → anyone with repo read
  access can authenticate a live account; test-only account would be
  downgraded over the PUBLIC platform (moderation tooling intact).
- Status: CONFIRMED DEFECT. **Blocks public launch.**
- Fix: (1) release-delete the seeded test users (Supabase Auth, never SQL);
  (2) redact `docs/PROJECT_STATE.md` values (copied as masked placeholders);
  (3) purge from Git history (filter-repo/BFG) or restrict repo access; (4)
  remove residual real-user email strings from docs.
- Prove: fresh clone does not contain the pattern; old password login fails.

### AUDIT-02 — P1 — `notifications_type_check` breaks community posts + missed-call notifications (live-confirmed)
- Files: `docs/database/033_v5_messaging_readstate_reposts.sql:127-145`
  (constraint without new types); `docs/database/055_notifications_and_messaging.sql:84,114`
  (triggers inserting `community_post`, `missed_call`); refresh never present
  in 047/049/055/056/057/058/060.
- Live evidence: `pg_get_constraintdef('notifications_type_check')` ends at
  `'repost'`; both triggers installed (`posts`, `call_sessions`);
  `notification_enabled()` defaults TRUE; `notifications` table contains
  zero rows of the two types.
- Impact: any community post insert (≥1 other member, prefs default) aborts
  with `new row violates check constraint`; call end-to-MISSED/DECLINED
  UPDATE abort. **Blocks beta.**
- Status: CONFIRMED DEFECT (static + live; runtime probe is a write — skipped).
- Fix: migration 061 re-adding both values to the CHECK constraint.
- Prove: transaction-scoped insert of each new type + a two-account
  community-post flow; re-verify zero failures in Supabase logs.

### AUDIT-03 — P1 — Admin role-change/ban/delete dead but report success
- Live evidence: `has_function_privilege('authenticated','admin_set_user_role(uuid,text)','EXECUTE') = false`
  (014:74-78 revoked; never re-granted).
- Files: `src/app/admin/users/page.tsx:118-133` (RPC via anon-key client;
  error swallowed to `console.error`; unconditional redirect = misleading
  success); `src/lib/reports/actions.ts:100-135` (`adminDeletePost` returns
  success without deleting); `:164-196` (`adminBanUser` dead code, guarded
  out by 014 trigger).
- Impact: moderation loop cannot mutate roles or remove reported content;
  admins see success they didn't get. **Blocks beta.**
- Status: CONFIRMED DEFECT.
- Fix: `GRANT EXECUTE … TO authenticated` (function is admin-checked
  internally) + surface action errors; delete or correctly implement the two
  dead actions (service-role client + confirmation).
- Prove: role change persists in DB; report → delete removes the post.

### AUDIT-04 — P2 — `suspended` role has no enforcement
- Evidence: no `role === "suspended"` check in `src/` (grep); proxy/current-user never consult it.
- Impact: suspension is cosmetic until AUDIT-03 lands; banned users keep full session.
- Fix: gate at `getCurrentUser()`/proxy + short-TTL cache.
- Prove: suspended fixture session blocked.

### AUDIT-05 — P2 — Notification preferences partially inert
- Files: `src/components/settings/notification-prefs-form.tsx:13` persists
  key `follows`; triggers read `'follow'` (029). Comment/reply/vote triggers
  (legacy 005 path) never consult `notification_enabled` (live trigger
  inventory confirms 6 legacy triggers; 029 gating covers
  follow/events/mentions, 033 reposts, 055 posts/calls only).
- Impact: "New followers", comments, replies, votes toggles no-op.
- Fix: canonical key map + extend gating to legacy triggers (rewrite or wrapper).
- Prove: toggled-off fixture produces no notification rows.

### AUDIT-06 — P2 — DM history beyond page 1 unreachable
- Files: `src/lib/messaging/service.ts:319-346` supports paging; no UI calls
  page > 1 (`src/app/messages/[conversationId]/page.tsx:48`).
- Prove: 25-message thread fully navigable.

### AUDIT-07 — P2 — Voice rooms stall on lost signaling
- Files: `src/components/webrtc-peer.tsx` consumes only live INSERTs; no
  replay/idempotent sweep (contrast `dm-call.tsx:557-589`).
- Prove: replayed OFFER/ICE repair on channel drop.

### AUDIT-08 — P2 — DM ring timeout is caller-tab-only
- Files: 049 RPC `timeout_dm_call` exists; only caller tab fires it
  (`dm-call.tsx:667-677`). No cron.
- Impact: ringing deadlock when caller's browser dies without `pagehide`.
- Prove: forced caller death → callee ring ends.

### AUDIT-09 — P2 — Upload-cap mismatches
- Files: `src/lib/supabase/avatar-actions.ts:10` allows 5 MB + GIF vs live
  bucket 2 MB png/jpeg/webp;` src/lib/messaging/service.ts:29` 5 MB vs bucket
  10 MB (stricter client direction).
- Impact: acceptable avatars fail with generic "Try again." apex message.
- Fix: single constants module synced to 057; friendlier errors.
- Prove: 2.5 MB PNG avatar rejected client-side with true reason.

### AUDIT-10 — P2 — Fresh-DB bootstrap gap (V3 tables missing from canonical migrations)
- Files: 015–019 are policy-only; `sql/master_v3.sql` is out-of-tree for
  `events`, `event_participants`, `lfg_sessions`, `tournaments`,
  `creator_profiles`, `achievements` DDL.
- Impact: a clean DB can not be upshot from `docs/database/` alone.
- Fix: restoration migration (or explicit master-bootstrap note).
- Prove: clean sandbox restore from the canonical tree.

### AUDIT-11 — P2 — No account deletion path
- Files: `src/app/privacy/page.tsx:98` (email-support text only).
- Fix: self-serve delete via confirmation + service-role `admin.deleteUser`.
- Prove: delete fixture; FK cascades verified.

### AUDIT-12 — P2 — TURN relay unprovisioned (BLOCKED, external)
- Files: `src/lib/env/public.ts:44-50`, `src/lib/env/contract.ts:65-79`,
  `src/lib/ice-servers.ts` (STUN fallback when unset/nonsensical);
  plans in `docs/media/relay-node/*`, `SETUP_RELAY.md`,
  `turn-minting.spec.md` (not implemented per `docs/DECISIONS.md:246`).
- Impact: STUN-only socket paths across symmetric NAT/CGNAT fail until
  relay is configured (`NEXT_PUBLIC_TURN_URL/USERNAME/CREDENTIAL` at
  Vercel, unverified from here) or the piggyback fallback carries.
- Prove: deferred with the device test.

### AUDIT-13 — P3 — Piggyback robustness nits
- `dm-call.tsx:254-255` drops PB_KEY if pcRef null; `session.ts:140-158`
  publishKey no retry; `protocol.ts:290-323` RateMeter warns only;
  broadcast rides an unauthenticated channel (E2E AES-GCM only, documented
  `session.ts:10-15`). Prove: fault-injection round trip.

### AUDIT-14 — P3 — `/settings` username-claim dead end
- Files: `src/app/settings/page.tsx:61-68` (`?error=username_taken`
  unread by UI); `:42-59` backfill bypasses `normalizeUsername`.

### AUDIT-15 — P3 — `updateProfile` accepts arbitrary `avatar_url`
- Files: `src/lib/supabase/actions.ts:397-404`. Validate first-party
  `{userId}/` storage path.

### AUDIT-16 — P3 — Rate limiter fail-open without KV env
- Files: `src/lib/rate-limit.ts:82-96`; message-send 60/min currently no-op
  (single-instance memory). Documented (GAP-RATE-01 CLOSED);
  decide pre-launch: KV or accept memory backend single-region.

### AUDIT-17 — P3 — Stale documentation
- `docs/PROJECT_STATE.md`: "Last verified HEAD `c4bd11e`" vs actual
  `295326d`; stack claims Turbopack vs webpack-pin; historical counts.
- `docs/PROJECT_STATE.md` launch-blockers still instruct disabling email
  confirmation; `GAP_REGISTER.md GAP-EMAIL-01` says RESOLVED 2026-10-20 —
  GAP_REGISTER is authoritative.
- `docs/TEST_MATRIX.md` counts predate 408 suite; browser suite excluded
  from unit gate today.

## E. Security audit

- Credentials: AUDIT-01 (P0). No values reproduced here.
- Authorization model: SECURITY DEFINER RPCs, ownership predicates,
  `auth.uid()`-only writes, server-gated admin layout — solid in principle;
  AUDIT-03/04 are execution bugs, not design flaws.
- RLS: enabled on all public tables (live query returned zero RLS-off).
- RPC grant sanity: 014/045/046/055 revokes+grants consistent functions;
  `admin_set_user_role` too-revoked (AUDIT-03).
- Uploads: magic-byte sniffing, per-user path prefixes, whitelist MIME,
  bucket caps live-verified; AUDIT-09 mismatch.
- Rate limiting: signup 5/h, resend 3/h, messages 60/min; reset flow relies
  on upstream GoTrue limits only (P3); fail-open without KV (AUDIT-16).
- Headers: `next.config.ts:6-14` (nosniff/XFO DENY/HSTS preload/strict
  referrer/camera+mic Permissions-Policy). No CSP (documented P3 defer,
  ROADMAP P3). No admin action audit log (P3).
- Monitoring: Supabase log triage manual only (no CI surface).
- Unresolved: Supabase Auth dashboard toggles, Vercel env values, TURN —
  not safely verifiable from the repo.
- Vercel: production deploy of `295326d` verified Ready (vercel ls);
  `verified-badge.png` serves 200 from production.

## F. Database and deployment audit

- Migrations 001 → 060 applied to the live DB; canonical log in
  `docs/database/`; intentional quirks documented (010d style: dup 031,
  missing 039). `docs/DATABASE.md` matches files (no drift); idempotency
  scan: 0 non-`IF NOT EXISTS` DDL; all DROPs IF EXISTS.
- live SELECT probes executed during the audit (read-only):
  - `notifications_type_check` definition (missing 055 types),
  - trigger inventory (`posts`, `call_sessions`, `comments`, `post_votes`,
    `follows`),
  - function privileges (`admin_set_user_role`),
  - `storage.buckets` caps,
  - RLS coverage (0 tables with RLS off),
  - `notification_enabled()` body (defaults TRUE),
  - `get_conversation_partner`/`list_message_partners` post-060 column bodies,
  - `profiles.verified` seed state (only `linyuluderrick`).
- Not verifiable from the repo: Supabase Auth settings (dashboard), Vercel
  runtime env values, TURN infra state.

## G. Test evidence (exactly executed)

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit --incremental false` | PASS (0) |
| ESLint | `npx eslint .` | 0 errors / 18 pre-existing warnings |
| Unit suite | `npx vitest run --exclude 'tests/browser/**'` | 408/408 PASS (30 files) |
| Live DB reads | `run-sql` + SELECT-only probes (8 files in tmp) | findings above |
| Production deploy | `vercel ls` (+ HEAD-level curl) | `295326d`-derived deploy → Ready |

Not run: `npm run build` (`.next` write, OOM risk on android), browser smoke
(`tests/browser`, ChromeDriver :9515 not running), any DB write/mutation or
RLS-probe insert, Vercel/Supabase config inspection. Production build gate
reference from docs (`next build --webpack PASS, 49 routes`) is historical,
not re-verified during this audit.

## H. Documentation contradictions

| # | Claim | Actual evidence | Authority |
|---|---|---|---|
| 1 | `docs/PROJECT_STATE.md`: last verified HEAD `c4bd11e`, stack Turbopack, older-test counts/snapshots | HEAD = `295326d`; webpack pinned by `AGENTS.md`; gate is 408 | git + package.json |
| 2 | `docs/PROJECT_STATE.md` launch-blocker asks to disable email confirmation | `GAP_REGISTER.md GAP-EMAIL-01` says disablement RESOLVED/re-enabled 2026-10-20; code has full confirm+resend path | GAP_REGISTER |
| 3 | `docs/TEST_MATRIX.md`-era audits fold pre-258 browser suites into unit counts | unit gate excludes `tests/browser` today | package.json |
| 4 | ROADMAP P1.*(dated 2026-09-11) statuses | superseded by GAP_REGISTER statuses | GAP_REGISTER |
| 5 | Migration 055 presents its notify triggers as functional | live CHECK excludes its payload types (AUDIT-02) | live DB |

## I. Two-device calling test — DEFERRED (user-deferred)

Recorded explicitly as user-deferred; excluded from this audit's gate.

Can already be evidenced (code/config): RPC state machine + RLS +
publication for `call_sessions`/`webrtc_signals` (049/050/058); reconnect
one-shot + orphan sweep (`dm-call.tsx:483-497,552-589`); watch/relay error
copy (`:906`); ICE config construction (`ice-servers.ts`); protocol
crypto/format unit tests (`piggyback-protocol.test.ts`).

Must wait for the real-device test: user-agent media paths (rooms 1:1,
DM audio, DM video), TURN relay path, ringing across devices, real piggyback
fallback, ring timeout UX (AUDIT-08), reconnect reseeding on tabs, video
overlay UI.

## J. Ordered execution plan (post-approval)

1. **061_notif_types.sql** — re-add `community_post`, `missed_call` to the CHECK constraint (AUDIT-02; smallest, blocking).
2. **Admin repair** — grant + UI error surfacing (AUDIT-03), dead action cleanup.
3. **Credential hygiene** — redact doc; delete test users; history purge if repo public (AUDIT-01).
4. Prefs alignment (AUDIT-05).
5. Suspended enforcement (AUDIT-04).
6. DM history load-more (AUDIT-06).
7. Voice-room signaling sweep (AUDIT-07).
8. Upload constants sync (AUDIT-09).
9. Settings error surfacing (AUDIT-14) + canonical backfill.
10. Then: account deletion (AUDIT-11), CSP, KV decision (AUDIT-16), TURN provisioning (AUDIT-12).

## K. Recommended next action

**Execute migration `061_notifications_type_update.sql`** (AUDIT-02): the
smallest change, release-blocking, live-evidenced — the live DB constraint
and 055's triggers are mutually contradictory today, so every community
post hard-fails from the moment it is submitted into a second-member
community. Everything else follows evidence, not priority theater.
