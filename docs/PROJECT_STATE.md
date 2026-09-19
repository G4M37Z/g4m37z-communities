# G4M37Z Communities — Project State

> **This is the persistent project checkpoint.** Every agent should start here
> and reconcile this document against `git log -1` before doing anything.

---

## Project Identity

| Field | Value |
|---|---|
| Project | G4M37Z Communities |
| Repository | `G4M37Z/g4m37z-communities` |
| Stack | Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Supabase Auth + Postgres · Tailwind CSS v4 |
| Branch | `main` |
| Last verified HEAD | `8a32bf3` (messaging hydration-gate fix; prior `aee3494` 045 acceptance harnesses, `487dfcb` launch-hardening series) |
| Last verified tag | `v0.1.0` (older; pre-V3 — not a V3 milestone marker) |
| Remote | `github-g4m37z-communities:G4M37Z/g4m37z-communities.git` → `github.com/G4M37Z/g4m37z-communities` |
| Documentation version | 5 (launch-readiness sync 2026-09-19; governance layer: DECISIONS/DATA_SOURCES/TEST_MATRIX/SECURITY_MODEL/GAP_REGISTER added) |
| Last verified date | 2026-09-19 (session) |

---

## Current Checkpoint

**Launch-hardening acceptance + messaging send fix (2026-09-19) — VERIFIED.**

HEAD `8a32bf3`. Everything below is evidence-backed (commands + live outputs),
not inferred:

- **Migration 045 launch-hardening applied and accepted against the live DB**
  (`b820f05` + series through `487dfcb`): join/leave SECURITY DEFINER RPCs,
  soft-leave (`left_at`) with role preservation on rejoin, membership-gated
  posting, block-enforced `create_direct_conversation` (P0002, no state leak),
  storage hardening. Transaction-scoped acceptance (rolled back, zero
  persistent changes): `sql/resume-verify.sql`, `sql/accept-045-messaging.sql`,
  `sql/accept-045-leave-rejoin.sql` (committed `aee3494`).
- **Messaging send defect root-caused and fixed (`8a32bf3`):** the interrupted
  session's "native GET + aborted action POST" was a **pre-hydration native
  form submit** on client-component forms whose only submit path was React's
  `onSubmit` (the ERR_ABORTED entries in the network log are benign aborted
  RSC prefetches — a red herring). Fix: submit controls stay `disabled` until
  React is attached (hydration gate, deferred `queueMicrotask` per the house
  `react-hooks/set-state-in-effect` rule), plus `text-red` → `text-red-500`
  (bare `text-red` generates no CSS in this Tailwind v4 theme, so action
  errors rendered unstyled).
- **Messaging: TWO-USER RUNTIME VERIFIED** on the production build
  (`next start -p 3000`): autotest sends via UI → 1 action POST → redirect to
  thread, no native GET, rows confirmed in live DB (conversation
  `26bdebc3-1522-488f-9edb-0ccf6507843a`, both members, both messages);
  autotest2 sees the thread in `/messages` with unread badge and both
  messages, correct attribution. Gates: tsc PASS · eslint PASS · vitest
  258/258 · build PASS (49 routes).
- **Governance layer established (2026-09-19):** `docs/DECISIONS.md`,
  `docs/DATA_SOURCES.md`, `docs/TEST_MATRIX.md`, `docs/SECURITY_MODEL.md`,
  `docs/GAP_REGISTER.md` (consolidates `ERRORS.md` open items).

Still open (see `docs/GAP_REGISTER.md`): email-confirmation toggle must be
re-enabled before launch (dashboard action); WebRTC two-peer audio
runtime-blocked by single-endpoint environment; two non-messaging files still
use bare `text-red`; ~35 untracked one-off diagnostic SQL scripts to triage;
digests 3702571692 / 943033484@E352 need a user hard-refresh re-test.

**Brand & visual identity redesign (2026-09-16) — SHIPPED.**

Complete identity system: abstract "call & response" mark (two interlocked
crescents + spark — see `public/brand/`, `BrandMark.tsx`), Caveat
"Wassup wassup" signature (`BrandSignature.tsx`), burnished copper accent
(`#B4633C` dark / `#A44F28` light; `text-accent-text` for accent TEXT) on
obsidian `#0B0C0E` / warm-ivory `#F3F0E8` foundations, branded loading
reveal (motion-safe), new favicon/app-icon/OG (1200×630) assets.
Authoritative spec: `docs/BRAND.md`.
Also fixed en route: **pre-existing hydration mismatch #418** in
`ThemeToggle` (first render matches server; stored theme adopted
post-hydration) — light-stored users no longer throw on hard load.

---

**Full audit, synchronization & contributor cleanup (2026-09-16) — COMPLETE.**

HEAD `03b2d77` (fix: NotificationBell hydration mismatch). 118 commits on `main`.

What this checkpoint established (all evidence-based, nothing fabricated):

- **Deliverables:** `docs/IMPLEMENTATION_MATRIX.md` (44 requirements across 40 areas,
  status + evidence per row), `docs/IMPLEMENTATION_GAPS.md` (P0 none · P1 ×2 · P2 ×8 ·
  P3 ×4), `docs/IMPLEMENTATION_PLAN.md` (Phases A–E, no implementation performed).
- **Gate:** tsc 0 errors · eslint 0 errors (12 pre-existing warnings) · vitest
  161/169 (8 failures = `tests/browser/smoke.spec.ts` ECONNREFUSED, environment-blocked
  as documented) · `next build` PASS (42 pages + proxy).
- **Live DB (read-only):** 59/59 public tables RLS-enabled, 175 policies, 4 buckets
  (post-images, avatars, voice-recordings, community-media), 17 non-internal triggers;
  migrations 032/033/034 objects present (bookmarks, polls, reposts, community-media
  bucket). **2 orphan notifications** point at deleted posts — user-reported 404-on-tap
  bug confirmed in production data (GAP-01, P1). `platform_links`/`user_games` absent —
  platform import (Steam/Play/App Store) confirmed NOT IMPLEMENTED (GAP-06, P2;
  Steam feasible, Play/App Store infeasible per connectors assessment — do not fake).
- **Runtime:** mobile smoke via headless Chrome CDP at 390×844 on `/` and `/communities`:
  no horizontal overflow (scrollWidth 390), BottomNav present with material backdrop
  (`saturate(1.8) blur(20px)`), safe-area padding wired (0px on non-notched desktop);
  5 header/footer tap targets <44px logged (GAP-12). Production serving re-verified via
  Vercel MCP (theme-color #0B0C0E, viewport-fit=cover, og:image:width 677, robots
  /messages+/saved disallowed, sitemap /discover /events /creators).
- **Fixed during audit:** NotificationBell hydration mismatch (`03b2d77`, pre-existing
  SSR-null branch) — explains the previously-unexplained authenticated parentNode exception.
- **Contributor cleanup:** all commits normalized to `G4M37Z <193523970+G4M37Z@users.noreply.github.com>`;
  14 AI co-author trailers (13 Codebuff, 1 Claude) stripped. Backup ref
  `backup-before-contributor-cleanup` preserved locally (pre-rewrite tip `d119451`).
  Documented separately from application state — application content byte-identical
  (`git diff backup main` empty).

> **History-rewrite note (hashes):** the contributor cleanup rewrote commit
> metadata, so all pre-2026-09-16 commit hashes cited anywhere in docs/
> (e.g. `0cfd728`, `935fa44`, `7e2e6a4`, `03b2d77`) refer to pre-rewrite
> identifiers preserved by the local `backup-before-contributor-cleanup`
> branch. Content is identical; only author/committer identity and the 14 AI
> co-author trailers changed. Post-rewrite `main` tip: `04d6b8a`. Tag `v0.1.0`
> was repointed onto the rewritten history (`cb6c0f5`). GitHub's contributor
> graph recalculates asynchronously.
- **User-reported bugs recorded, NOT implemented:** deleted-post notifications 404
  (GAP-01, Phase A first item) and platform import (GAP-06, Phase C first item).
- **UPDATE (same session, post-audit): GAP-01/GAP-04 FIXED.** Migration 035
  (`docs/database/035_notification_deleted_content_cleanup.sql`) applied live:
  one-time purge of the 2 confirmed orphan notifications + BEFORE DELETE
  cleanup triggers on `posts`/`comments` (SECURITY DEFINER, 027 pattern).
  Href guard added in `src/app/notifications/page.tsx` (stale post/event
  references render as plain text, never a 404 link). Regression tests:
  `tests/notification-deleted-content.test.ts` (16/16). Live verification:
  transactional delete→cleanup→rollback cycle proved the trigger on the
  production DB; orphan count now 0. Gate: tsc 0, full vitest 177/185
  (8 browser-smoke ECONNREFUSED environment class unchanged), build PASS.
  GAP-06 (platform import) remains NOT implemented — separate work.

---

## Prior Checkpoint

**Production PostgREST embed-FK fix (2026-09-14) — APPLIED & VERIFIED.**

After the repo-completeness checkpoint (`f2ded26`) a live production
regression surfaced: feed pages showed "No posts yet", post pages 404'd
("We couldn't find that page"), and voice/community-create flows threw a
shared Next.js error digest (`2226326061`). All Vercel app queries targeted
Supabase project `zpirpbivhkscixbokpbt` (anon key in the built JS chunk),
which is the same DB `run-sql` reaches.

Root cause: every query embeds the author via FK hints
(`author:profiles!posts_author_id_fkey`, etc.), but the schema created the
user columns with a bare inline `REFERENCES auth.users(id)`, so the
auto-named constraint (`posts_author_id_fkey`) pointed at `auth.users`, not
`public.profiles`. PostgREST therefore failed EVERY such query — anonymous
and authenticated alike — with `PGRST200` ("Could not find a relationship").
Covered embeds: `posts.author_id`, `comments.author_id`,
`reports.reporter_id`, `voice_room_participants.user_id`.

Fix (two commits, both pushed):

| Commit | Content |
|---|---|
| `fb4bb23` | app code: `post/[id]/page.tsx`, `communities/[slug]/page.tsx`, `community-service.ts` no longer mask non-PGRST116 query errors as 404 — they log + throw (defensive; keeps unexplained 404s from hiding DB failures) |
| `a1f2838` | DB migration `docs/database/030_fix_posts_profiles_relationship.sql` — renames the auth.users FKs to `*_auth_users_fkey` and adds same-named FKs to `public.profiles(id) ON DELETE CASCADE` for the four tables above |

Validated: full gate at `fb4bb23` (tsc 0, eslint 0/10, webpack build 45
routes, vitest 145/145); migration re-run is a clean no-op; every app embed
replayed via the SDK returns status 200 (err=none); live pages
`/post/<uuid>`, `/communities/efootball`, `/communities/efootball/voice`,
`/create`, `/communities`, `/home` now render with no server error digests.

---

## Checkpoint held from previous session

**Repo-completeness pass (2026-09-14) — PASS, gate green.**

Prior certified checkpoint: `5539aff` (browser suite green, 120/120 tests,
V4 audit finished). HEAD was `72c34e9` = `origin/main` (97 commits;
tag `v0.1.0` untouched). All prior milestones (Phase 0 → V4 gap work) remain
at HEAD on `main`.

This pass closed: the three tail services (`creators`, `social`, `messaging`)
deepened with full methods, server-resolved `auth.uid()`, `createAdminClient`
ownership re-checks where RLS requires a privileged path (creators writes;
followers feed; direct-thread dedup), and rewritten deterministic tests; new
`src/lib/creators/actions.ts` + `src/lib/social/actions.ts`;
`src/lib/messaging/actions.ts` now delegates to the service; `social/page.tsx`
followers feed served via `listFollowers` (a direct RLS query would always
return an empty list — see 021); `types/database.ts` drift fixed vs live
schema (`GameReview` `*_score` incl. nullable `value_score`,
`LfgSessionStatus` incl. `FULL/CANCELLED/EXPIRED`,
`LfgSessionPrivacy` = `public|private`, `WebRtcSignal.to_user` nullable,
`CommunityEvent.event_type` = `string | null`); removed committed `sql/`
auth-fixture files that contained auth-table mutations and password hashes
(`sql/master_v3.sql` and `sql/tables_check.sql` retained).

Validation gate result (this checkpoint):

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS (0 errors) |
| `npx eslint .` | 0 errors, 10 warnings (all pre-existing V2 debt) |
| `npx next build --webpack` | PASS — 45 routes (44 listed + root) |
| `npx vitest run` (browser suite excluded on this host) | PASS — 145 tests across 14 files |
| Browser smoke suite | NOT run on this host (requires ChromeDriver @9515 + app @:3000) |

---

## Completed Milestones (verified from Git)

| # | Milestone | Final commit | Status |
|---|---|---|---|
| 0.5 | Phase 0.5 readiness gate (lint cleanup, types/build green) | `78d8cd3` | PASS |
| 0.6 | Phase 0.6 DB + WebRTC gate (webrtc_signals realtime pub, SDP/ICE transport) | `a79fc91` | PASS |
| 1 | V3.1 Reputation system | `ef8e681` | PASS |
| 2 | V3.2 Achievements system | `edbf925` | PASS |
| P0 | P0 security containment (profiles.role guard, RPC EXECUTE revocations) | `fe324a4` | PASS |
| 3 | V3.3 Game Discovery | `5386337` | PASS |
| 4 | V3.4 LFG | `a578663` | PASS |
| 5 | V3.5 Events | `662452c` | PASS |
| 6 | V3.6 Tournaments | `ea3c598` | PASS |
| 7 | V3.7 Creators | `7d36d93` | PASS |
| 8 | V3.8 Messaging | `19e862f` | PASS |
| 9 | V3.9 Social Graph | `8460b32` | PASS |
| 10 | V4 gap — presence, reactions, capabilities, voice, events lifecycle, notifications, private communities, proxy/middleware, feed/mod services, gaming profile + notification prefs UI, real tests | `6f18852` | PASS |
| 10a | Browser smoke spec fix (Chromedriver/DOCTYPE assertion) | `5539aff` | PASS |
| FIX | Production PostgREST embed-FK fix (feed 404s / empty feeds / voice+create digests) | `fb4bb23` + `a1f2838` (030 migration) | PASS |

Launch Hardening status: P1.1 PARTIAL (audit done, subagents 400/429 env); P1.2 NONE REQUIRED; P1.3 PASS; P1.4 PARTIAL (static OK, runtime benchmark external); P2 PASS; P2.3 VERIFIED (browser harness added — `tests/browser/smoke.spec.ts`, real Chromium 149 / ChromeDriver 149 session, mobile 375×812, all smoke routes PASS); P3 PASS (webpack build 34 routes, TS 0, vitest 120/120 incl. browser smoke, security pass, DB pass, lint 0 errors).

V4 gap work (audit fixes): all item tracked in `docs/PHASE_0_AUDIT.md` completed at `6f18852` — presence (025 + heartbeat/realtime indicator), reactions (setReaction + button), community capabilities (026 + persist UI), voice rooms (full create/join/leave + mesh transport), events lifecycle fields (024 wired end-to-end), notification triggers (027, incl. follow/mention/RSVP, honored via 029 prefs), private communities (028 + toggle), Next 16 proxy session refresh (`src/proxy.ts`), feed + moderation services implemented, gaming profile + notification prefs settings UI, placeholder tests replaced with real verdict + RLS regression assertions.

Each milestone had:
- One migration under `docs/database/NNN_*.sql` (executed via `run-sql`).
- One service module under `src/lib/<domain>/service.ts` with deterministic
  validation tests under `tests/<domain>-service.test.ts`.
- Server actions under `src/lib/<domain>/actions.ts`.
- UI pages and components under `src/app/<domain>/` and
  `src/components/<domain>/`.
- Lint = 0 errors, TypeScript PASS, build PASS, vitest PASS at commit time.
- Manual browser / live-DB / multi-user testing: **NOT performed** (Windows
  headless dev environment).

---

## Current Milestone Detail: V3.6 Tournaments

| Field | Value |
|---|---|
| Starting commit | `662452c` |
| Final commit | `ea3c598` |
| Commit message | `feat: implement v3 tournaments` |
| Migration | `docs/database/018_tournaments_policies.sql` (20 RLS policies + 10 CHECK constraints) |
| Service | `src/lib/tournaments/service.ts` |
| Server actions | `src/lib/tournaments/actions.ts` (9 actions) |
| UI pages | `/tournaments`, `/tournaments/[id]`, `/tournaments/new` |
| UI components | `TournamentRegisterButton`, `TournamentOrgControls`, `TournamentCreateForm`, `TournamentDisputeForm`, `TournamentResolveButton` |
| Tests | `tests/tournaments-service.test.ts` (16 deterministic tests) |
| ESLint | 0 errors, 9 warnings (unchanged) |
| TypeScript | PASS |
| Production build | PASS (34 routes listed + root; 35 total) |
| Vitest | 91 passed across 9 files |
| P0 regression | `create_notification` anon=f, `admin_set_user_role` anon=f, `trg_guard_profile_role` present |
| Browser verification | NOT performed |
| Live mutation happy path | NOT performed (requires `SUPABASE_SERVICE_ROLE_KEY` in test harness) |
| Bracket progression | NOT implemented (schema has no `next_match_id` column); documented as future enhancement |
| Concurrent capacity testing | NOT performed |

---

## Current Milestone Detail: V3.7 Creators

| Field | Value |
|---|---|
| Starting commit | `7d36d93` |
| Final commit | `7d36d93` |
| Commit message | `feat: implement v3.7 creators` |
| Migration | `docs/database/019_creators_policies.sql` (10 RLS policies on `creator_profiles`, `creator_content`, `creator_followers`) |
| Service | `src/lib/creators/service.ts` |
| UI pages | `/creators`, `/creators/[id]` |
| Tests | `tests/creators-service.test.ts` (2 deterministic tests) |
| Validation | vitest PASS (2 tests); TS clean (0 errors); live RLS inspection verified via `run-sql` |
| Live mutation happy path | NOT performed (as with prior milestones) |
| Browser verification | NOT performed (consistent with dev environment) |

## Current Milestone Detail: V3.8 Messaging

| Field | Value |
|---|---|
| Final commit | `19e862f` |
| Commit message | `feat: implement v3.8 messaging` |
| Migration | `docs/database/020_messaging_policies.sql` (11 RLS policies; SELECT/INSERT member-scoped, messages immutable) — APPLIED live via `run-sql`, fix `dadaf6e` corrected invalid `WITH CHECK` on DELETE + added `DROP IF EXISTS` idempotency; 11 policies verified present in live DB query |
| Service | `src/lib/messaging/service.ts` |
| UI pages | `/messages`, `/messages/[conversationId]` |
| Tests | `tests/messaging-service.test.ts` (3 deterministic tests) |
| Validation | vitest PASS (3 tests); TS clean (0 errors); live RLS confirmed — 11 policies present on `conversations` / `conversation_members` / `messages` |
| Live mutation happy path | NOT performed (consistent with prior milestones) |
| Browser verification | NOT performed (consistent with dev environment) |

## In-Progress / Next Work

Repo-completeness pass and the production PostgREST embed-FK fix are both
**PASS and committed** (this checkpoint). The gate is green: tsc 0 errors,
eslint 0 errors (10 pre-existing warnings), webpack build 45 routes, vitest
145/145 (unit; browser suite not run on this host). Migration 030 is applied
to the live DB; all feed/post/voice/community has been verified live.
Launch hardening is the explicit next phase (see `ROADMAP.md` — do not
intermix).

---

## Known Technical Debt (verified)

| Item | Source | Status |
|---|---|---|
| **LFG capacity TOCTOU** (count-then-insert without transactional advisory lock) | V3.4 implementation, documented in service | Open. Future `try_rsvp_session` RPC documented |
| **Events capacity best-effort RSVP race** | V3.5 implementation, documented | Open. Future `try_rsvp_event` RPC documented |
| **Tournament bracket progression** | V3.6 implementation: no auto-advancement, no `next_match_id` column | Open. Schema change deferred |
| **Admin UI** | `src/app/admin/` exists but limited | Pre-existing V2 debt |
| **PostCard reaction wiring** | `EmojiPicker` exists, partial integration | Pre-existing V2 debt |
| **Avatar upload E2E** | 5MB server limit in code, full E2E untested | Pre-existing V2 debt |
| **Notifications consumer wiring** | Tables published, subscription code in `useRealtime` hook | Pre-existing V2 debt |
| **Offset-only pagination** | Used across feeds/messages/etc. | Pre-existing V2 debt |
| **8 lint warnings** | Pre-existing across `src/components/Logo.tsx`, `UserMenu.tsx`, `event-card.tsx`, `post/PostCard.tsx`, `reaction-button.tsx`, `device-matrix-test.ts` | Pre-existing V2 debt |
| **WebRTC physical E2E** | Signaling transport verified statically; real microphone/device tests not performed | Pre-existing V2 debt |
| **Realtime subscriptions partially wired** | Reputation + Achievements events not yet published; LFG/Events/Tournaments have static rendering, not live updates | Open |

---

## Security State

### P0 Containment (commit `fe324a4`) — VERIFIED INTACT

- `profiles.role` self-update blocked by `BEFORE UPDATE` trigger
  `trg_guard_profile_role` (auth.uid() IS NULL = service role path;
  raises otherwise).
- `create_notification` RPC: anon/authenticated EXECUTE revoked;
  service_role retains EXECUTE. Trigger-based callers
  (`notify_comment_on_post` etc.) unaffected because SECURITY DEFINER.
- `admin_set_user_role` RPC: anon/authenticated EXECUTE revoked;
  service_role retains EXECUTE. Internal admin check unchanged.

### RLS State

- All 35 public tables (excluding migrations, vector tables) have RLS enabled.
- RLS is auto-enabled on every new public table via DDL event trigger
  `rls_auto_enable` (SECURITY DEFINER, `search_path='pg_catalog'`).
- All V1/V2/V3 tables have explicit per-CMD policies scoped to
  `auth.uid() = user_id` / `auth.uid() = host_id` / community creator /
  service-role paths as appropriate.

### Service-Role Isolation

- `createAdminClient` in `src/lib/supabase/admin.ts` is the only consumer
  of `SUPABASE_SERVICE_ROLE_KEY`. Key is server-only; `.env.local` is the
  runtime source.
- All V3 services (`reputation`, `achievements`, `games`, `lfg`, `events`,
  `tournaments`) route mutations through `createAdminClient` and resolve
  `auth.uid()` server-side. Client components never see the service role.

### P1 / P2 / P3 Launch Hardening — PARTIAL / BLOCKED (NOT CLAIMED COMPLETE, per master rules)

Audit completed honestly (manual + partial subagent; environment failures 400/429 recorded, not fabricated). Build: webpack succeeded (34 routes, exit 0); Turbopack blocked on android/arm64 (platform, not code).
P1.1 PARTIAL (DB verified; auth manual; no middleware). P1.3 PASS (indexes present). P1.4 BLOCKED (no benchmark environment). P2 PASS (106 vitest; 0 TS errors; lint binary missing — pre-existing). P2.3 BLOCKED (UI static OK; no mobile/browser verification). P3 PARTIAL (security/DB/test verified; build full not executed; performance blocked; UI/mobile blocked). No false PASS claims. Deferred items (rate, CAPTCHA, MIME, advanced search/IP, telemetry, P3 CSP/MFA/rotation) remain deferred.

Per the explicit "build surface first, harden before launch" strategy, the
following remain tracked but **not implemented**:

- **P1.1** Rate limiting (Upstash / Vercel KV) — MISSING
- **P1.2** Turnstile / CAPTCHA — MISSING
- **P1.5** Upload MIME validation (post images) — MISSING
- **P1.6** Advanced search / IP hardening — partial (length caps, bounded queries)
- **P2** Telemetry / anomaly scoring / security observability — MISSING
- **P3** CSP headers, MFA, secrets rotation, WAF — MISSING

### DO NOT claim security is "complete."

The platform is structurally sound for V3 features but **not** hardened
for adversarial production traffic. Launch hardening is the explicit next
post-V3 phase.

---

## Validation State (last verified at repo-completeness checkpoint)

| Check | Result |
|---|---|
| `npx eslint .` | 0 errors, 10 warnings (all pre-existing V2 debt; no new warnings) |
| `npx tsc --noEmit` | PASS (0 errors) |
| `npx next build --webpack` | PASS — 45 routes (44 listed + root); proxy present |
| `npx vitest run` | PASS — 145 tests across 14 files (browser suite excluded on this host) |
| Live DB inspection | PASS via `run-sql` (previous sessions; no DB change in this pass) |

Browser smoke suite (tests/browser): requires ChromeDriver @9515 + app @:3000
— not run on this host in this pass.

---

## Environment Requirements (variable NAMES only — never values)

| Variable | Used by | Server-only? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Server + client | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server + client | No |
| `NEXT_PUBLIC_SITE_URL` | Server (auth callbacks) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (`createAdminClient`) | YES — server-only |

The repository does NOT commit `.env.local`. Local secrets live in
`~/.supabase_env` (read by the authorised `run-sql` interface only).

---

## Pre-Launch Reminders

> Both items below must be resolved before any public launch. Do not ship
> until they are. Full context: `docs/ERRORS.md`.

- **RE-ENABLE email confirmation before launch.** Supabase project
  `zpirpbivhkscixbokpbt` currently has "Confirm email" ENABLED. The approved
  plan is to disable it — Supabase dashboard `authentication → providers →
  email` — for rate-limit-free testing (signup confirmations currently trip
  `429 over_email_send_rate_limit`). This is a **DASHBOARD-ONLY toggle**:
  ox-auth settings live outside Postgres (there is no `auth.config` table),
  so it cannot be changed via SQL. **It MUST be turned BACK ON before public
  launch.**
- **Remove TEST-ONLY test user before launch.** A confirmed test user was
  seeded for rate-limit-free testing: id
  `d1eeb9c0-0000-4000-8000-000000000007`, email `g4m37z.autotest@gmail.com`,
  password `G4m37z!autotest2026`, username `autotest`. Defined in
  `sql/_seed_autotest_user.sql` (idempotent) — temp-only, clean up at launch.
  ox-auth caveat: `auth.users` token columns must be `''` (not `NULL`), or
  login 500s with "Database error querying schema". See `docs/ERRORS.md` §5/§6.

---

## NEXT AGENT ACTION

**Read `docs/AGENT_HANDOFF.md`, reconcile this document against `git status`
and `git log`, then begin Launch Hardening (see `ROADMAP.md`). The
repo-completeness pass is committed; do not re-run it unless the gate has
regressed.**

Do not run `run-sql` against the live DB unless the task explicitly requires
it, and never read or print `~/.supabase_env`.
V4 Milestones complete (gaming profiles 022, LFG session 023, events lifecycle 024, presence 025). Service: src/lib/profiles/service-v4.ts + test passed. Security: service_role isolated (acknowledged, no exposure). Build: webpack verified. Browser: Chromium 149 session verified (prior session). Limitations preserved: P1.4 benchmark BLOCKED external, auth E2E config-blocked, desktop skipped.
