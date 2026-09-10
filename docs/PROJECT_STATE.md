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
| Last verified HEAD | `7d36d93` |
| Last verified tag | `v0.1.0` (older; pre-V3 — not a V3 milestone marker) |
| Remote | `github-g4m37z-communities:G4M37Z/g4m37z-communities.git` |
| Documentation version | 1 (this commit) |
| Last verified date | 2026-09-10 (session) |

---

## Current Checkpoint

**V3.7 Creators — PASS, committed (`7d36d93`).** V3.8 Messaging is NEXT (NOT started).

- HEAD commit: `ea3c598 feat: implement v3 tournaments`
- Working tree: clean (only pre-existing untracked dev logs: `dev.log`, `dev2.log`, `dev3.log`, `nul`).
- All V3.1–V3.6 milestones + P0 security containment + Phase 0.5/0.6 gates
  are at HEAD on `main` and on `origin/main`.

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

## Next Milestone

**V3.8 — Messaging** (the next authorised feature milestone after V3.7 PASS).

- Tables: `conversations`, `conversation_members`, `messages`
  (RLS-enabled with 0 policies — inaccessible until V3.8).
- Migration `020_messaging_policies.sql`, `src/lib/messaging/service.ts` (cursor-paginated),
  UI `/messages`, `/messages/[conversationId]` with realtime subscription, tests.

See `ROADMAP.md` for the full sequence. Do not skip ahead.

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

### P1 / P2 / P3 Security — DEFERRED (Launch Hardening)

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

## Validation State (last verified at V3.6 commit)

| Check | Result |
|---|---|
| `npx eslint .` | 0 errors, 9 warnings (all pre-existing V2 debt; no new warnings) |
| `npx tsc --noEmit` | PASS (0 errors) |
| `npm run build` | PASS (34 routes listed + root; 35 total) |
| `npx vitest run` | PASS (91 tests across 9 files) |
| Live DB inspection | PASS via `run-sql` (queries executed and removed post-verification) |

Manual / browser verification: NOT performed in the dev environment.

---

## Environment Requirements (variable NAMES only — never values)

| Variable | Used by | Server-only? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Server + client | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server + client | No |
| `NEXT_PUBLIC_SITE_URL` | Server (auth callbacks) | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (`createAdminClient`) | YES — server-only |

The repository does NOT commit `.env.local`. Local secrets live in
`~/.supabase_env` (read by `run-sql.cmd` only).

---

## NEXT AGENT ACTION

**Read `docs/AGENT_HANDOFF.md`, reconcile this document against `git log` and
the actual repository state, then begin V3.8 Messaging only — assuming V3.7 is
verified PASS at the current HEAD (`7d36d93`).**

If any verification has changed (broken build, lint errors, missing migration,
DB regression), STOP at the failed checkpoint and update `PROJECT_STATE.md`
before any further work.
