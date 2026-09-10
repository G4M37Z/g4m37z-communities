# G4M37Z Communities — Project History

> Chronological record reconstructed from Git history, existing reports
> (`PHASE_0_AUDIT.md`, `PHASE_0_AUDIT_SUMMARY.md`, `PHASE_0_SUMMARY.md`,
> `PHASE_0_READY.md`, `EXECUTIVE_BRIEFING.md`, `DEVELOPMENT_MEMORY.md`,
> `G4M37Z_V3_ARCHITECTURE.md`, `V3_ARCHITECTURE.md`, `DEVICE-MATRIX-VERIFICATION.md`,
> milestone report content captured in conversation session memory) and the
> SQL migration history.
>
> Where exact historical detail cannot be recovered from the repository, the
> entry says so explicitly.

---

## Day 1 / Project Foundation

What can be verified:

- Stack decision: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript +
  Supabase + Tailwind CSS v4 (recorded in `README.md` and `package.json`).
- Authentication choice: **Supabase Auth** (email/password). NOT Clerk, NOT
  PostHog, NOT Resend — the early `EXECUTIVE_BRIEFING.md` listed those as
  possible stack components but the implementation chose Supabase Auth.
- Bootstrap source: cloned from an existing online-store scaffolding (per
  conversation memory). E-commerce remnants must have been stripped pre-V3;
  V3 milestone work does not reintroduce them.
- The earliest recoverable commit on the current `main` is `9018de7` (the
  querySelectorAll fix on `staggerIn`); `git log --oneline` does not surface
  anything older than that on this branch. Earlier history (the original
  scaffolding and pre-V1 cleanup) was either squashed or rebased into the
  current linear history. The exact bootstrap commit is **not recoverable
  from the current repository**.

---

## V1 (verified)

V1 is the foundational social/community layer described in `README.md`:

- **Auth**: email/password sign-up and sign-in via Supabase Auth.
- **Profiles**: `profiles` table; username, display name, avatar, bio.
- **Communities**: `communities` + `community_members` with create/join/leave.
- **Posts**: `posts` table; CRUD + community association.
- **Comments**: `comments` table with threading (`parent_id`).
- **Voting**: `post_votes` + `comment_votes` (DB unique constraint prevents
  duplicate votes per user/post).
- **Search**: `/search` page.
- **Notifications**: `notifications` table + notification bell component.
- **Moderation**: `reports` table + `/admin/reports` page.
- **Storage**: avatars bucket (`008_avatars_bucket.sql`).
- **Terms consent**: `terms_acceptances` table (`007_terms_consent.sql`).

Migrations contributing to V1: `001_profiles.sql` through
`008_avatars_bucket.sql` (8 files; some split across `_part1` / `_part2`).

---

## V2 (verified)

V2 is the **capability / framework** layer described in `PHASE_0_AUDIT.md`.
The V2 status report marked 18 domains; `PHASE_0_AUDIT_SUMMARY.md` enumerates:

- Community service, permission / capability system.
- Feed service (`feed-service.ts`).
- Realtime service (`realtime/service.ts`).
- Notification events (`notification-events.ts`).
- Voice / WebRTC: `voice_rooms`, `voice_room_participants`,
  `voice_room_settings`, `voice_comments`, `gif_refs`, `emoji_usage`.
- WebRTC signaling schema (`webrtc_signals`) added in `010_webrtc_signaling.sql`.

The voice / WebRTC domain was historically **DB + UI only** per the audit.
Real RTCPeerConnection media transport landed in **Phase 0.6** (commit
`a79fc91`), not in the original V2 timeframe.

---

## V3 milestones (verified from Git)

The V3 sequence below is the authoritative record. Where the milestone report
existed in session memory, it is summarised here; otherwise it is reconstructed
from the Git commit content, SQL migration, and source files committed at that
commit.

### V3 Phase 0.5 — Readiness gate
- Commit: `78d8cd3`
- Objective: clean lint + types + build after Phase 0.4 (a preceding,
  not-fully-recoverable milestone).
- Implementation: fixed 5 lint errors (setState-in-effect in
  `ThemeToggle`, `presence-indicator`, `community-permission`; explicit
  `any` in `discover/page.tsx` and `realtime/service.ts`); added `Game`
  type to `src/types/database.ts`; refactored `realtime/service.ts` to use
  `RealtimePostgresChangesPayload<T>` with a `RealtimeRow` generic constraint.
- Database: none.
- Tests: existing tests still passed.
- Validation: 0 ESLint errors, tsc PASS, build PASS.

### V3 Phase 0.6 — DB + WebRTC gate
- Commit: `a79fc91`
- Objective: secure the `webrtc_signals` table, add it to the
  `supabase_realtime` publication, and complete the SDP/ICE transport in
  `useWebRTCPeer`.
- Implementation: `useWebRTCPeer` hook subscribes to `postgres_changes` on
  `webrtc_signals` filtered by `room_id`; handles OFFER → ANSWER → ICE_CANDIDATE
  round-trip; queues candidates until remote description is set.
- Database: `011_webrtc_signaling_realtime.sql` (idempotent
  `ALTER PUBLICATION`).
- Tests: `tests/signaling-payload.test.ts` (5 deterministic tests).
- Validation: lint 0 errors, tsc PASS, build PASS, vitest PASS.

### V3.1 — Reputation system
- Commit: `ef8e681`
- Objective: implement reputation events with strict server-side authoring.
- Implementation: `src/lib/reputation/service.ts` with
  `recordReputationEvent` (UUID + enum + weight range validation, service_role
  INSERT, 23505 → duplicate no-op), `getUserReputation`, `getUserReputationEventCount`.
- Database: `012_reputation_policies.sql` (CHECK constraints on event_type
  enum 18 values + source_type enum 11 values; UNIQUE
  (user_id, source_type, source_id, event_type); SELECT-public policy;
  no INSERT/UPDATE/DELETE policy for anon/authenticated).
- UI: profile page shows reputation score + event count.
- Tests: `tests/reputation-service.test.ts` (9 tests).
- Validation: lint 0 errors / 9 warnings, tsc PASS, build PASS, vitest 18 passed.

### V3.2 — Achievements system
- Commit: `edbf925`
- Objective: achievement definitions + award/evaluation using
  `achievements` + `user_achievements`.
- Implementation: `src/lib/achievements/service.ts` with controlled
  `AchievementCriteria` union (reputation_threshold / posts_created /
  events_attended / manual), `evaluateAchievementEligibility` (pure
  function), `awardAchievementByName` and `ById` (service_role,
  idempotent), `evaluateAndAward` high-level helper.
- Database: `013_achievements_policies.sql` (SELECT-public policies; 8
  achievement rows seeded; idempotent `ON CONFLICT (name) DO NOTHING`).
- UI: profile page shows achievements grid (earned vs locked).
- Tests: `tests/achievements-service.test.ts` (9 tests).
- Validation: lint 0 errors / 9 warnings, tsc PASS, build PASS, vitest 27 passed.

### V3 P0 Security Containment
- Commit: `fe324a4`
- Objective: close two P0 vulnerabilities identified by the V3 Security
  Foundation Audit.
- Implementation: `BEFORE UPDATE` trigger `guard_profile_role` on
  `profiles` that rejects changes to `role` unless `auth.uid() IS NULL`
  (service_role path); `REVOKE EXECUTE ON FUNCTION
  public.create_notification FROM anon, authenticated`; `REVOKE EXECUTE ON
  FUNCTION public.admin_set_user_role FROM anon, authenticated`.
- Database: `014_p0_security_containment.sql`.
- Tests: `tests/p0-security-regression.test.ts` (9 deterministic tests
  replicating the trigger decision logic).
- Validation: lint 0 errors / 9 warnings, tsc PASS, build PASS, vitest 36 passed.

### V3.3 — Game Discovery
- Commit: `5386337`
- Objective: implement browse/search/detail/follow/review for games.
- Implementation: `src/lib/games/service.ts` with `listGames`,
  `getGameById/Name/Slug`, `followGame`/`unfollowGame`, `createGameReview`/
  `updateGameReview`/`deleteGameReview`. Search length-capped at 64 chars;
  ilike wildcard escaping; result limit clamped 1..50. Score range 1..10
  per category, 0..100 for overall.
- Database: `015_games_policies.sql` (CHECK scores 1..10, body length ≤ 8000;
  SELECT-public policies on games/genres/platforms/joins; follow/reviews
  policies scoped to `auth.uid() = user_id`).
- UI: `/discover` rebuilt with search form, empty state; `/game/[slug]`
  rebuilt with follow button, reviews list, genres/platforms.
- Tests: `tests/games-service.test.ts` (12 tests).
- Validation: lint 0 errors / 9 warnings, tsc PASS, build PASS, vitest 48 passed.

### V3.4 — LFG
- Commit: `a578663`
- Objective: Looking For Group sessions + participants.
- Implementation: `src/lib/lfg/service.ts` with `listLfgSessions`,
  `getLfgSession`, `getLfgParticipantCount`, `listLfgParticipants`,
  `getMyParticipation`, `createLfgSession`/`updateLfgSession`/
  `closeLfgSession`/`cancelLfgSession`/`deleteLfgSession`/`joinLfgSession`/
  `leaveLfgSession`. Status enum CREATED/OPEN/FULL/CLOSED/CANCELLED/
  COMPLETED/EXPIRED; privacy enum public/private; players_required 1..100.
- Database: `016_lfg_policies.sql` (status/privacy/length CHECKs; SELECT-public
  on public sessions; INSERT/UPDATE/DELETE scoped to host_id /
  user_id respectively; participants SELECT scoped to host-or-self).
- UI: `/lfg`, `/lfg/[id]`, `/lfg/new` plus 3 client components (Join/Leave,
  HostControls, CreateForm).
- Tests: `tests/lfg-service.test.ts` (12 tests).
- Validation: lint 0 errors / 9 warnings, tsc PASS, build PASS, vitest 60 passed.

### V3.5 — Events
- Commit: `662452c`
- Objective: community events with RSVP / capacity / status lifecycle.
- Implementation: `src/lib/events/service.ts` with `listEvents`,
  `getEvent`, `getEventParticipantCount`, `listEventParticipants`,
  `getMyRsvp`, `createEvent`/`updateEvent`/`publishEvent`/`cancelEvent`/
  `deleteEvent`/`rsvpEvent`/`cancelRsvpEvent`. Status enum DRAFT/PUBLISHED/
  FULL/CANCELLED/COMPLETED/EXPIRED; capacity 1..1000; **advisory-lock
  helpers** `hashUuidForLock` + `lockKeyInt4` exported for a future
  `try_rsvp_event` RPC; current best-effort path is sequential check +
  insert (DB-level PK prevents user double-RSVP).
- Database: `017_events_policies.sql` (status/length/time-sanity/title/capacity
  CHECKs; SELECT-public; INSERT events (auth.uid() IS NOT NULL); UPDATE /
  DELETE events scoped via communities.creator_id; INSERT participant
  scoped to user_id; DELETE participant self-or-organiser).
- UI: `/events`, `/events/[id]`, `/events/new` plus 3 client components
  (RsvpButton, HostControls, CreateForm).
- Tests: `tests/events-service.test.ts` (17 tests).
- Validation: lint 0 errors / 9 warnings, tsc PASS, build PASS, vitest 75 passed.

### V3.6 — Tournaments
- Commit: `ea3c598`
- Objective: 5-table tournament system (tournaments, tournament_teams,
  tournament_matches, tournament_results, tournament_disputes) with
  bracket UI and dispute resolution.
- Implementation: `src/lib/tournaments/service.ts` with full CRUD on
  tournaments, teams, matches; results submission (winner validated to be
  one of the two match teams); dispute create/resolve/withdraw. OpResult
  interface (renamed from local `TournamentResult` to avoid table-row
  collision). Schema observations documented in code: no `owner_id` on
  tournaments (ownership via event's community creator); no membership
  table (captain represents the team); no per-team result submission
  (organiser-only verification).
- Database: `018_tournaments_policies.sql` (10 CHECKs, 20 RLS policies
  across 5 tables). Tournament organiser authorisation joins
  tournaments → events → communities.creator_id.
- UI: `/tournaments`, `/tournaments/[id]` with bracket grouped by round,
  `/tournaments/new` plus 5 client components (Register, OrgControls,
  CreateForm, DisputeForm, ResolveButton).
- Tests: `tests/tournaments-service.test.ts` (16 tests).
- Validation: lint 0 errors / 9 warnings, tsc PASS, build PASS, vitest 91 passed.

---

## What is NOT recoverable

- The exact pre-V1 scaffold / Day 1 commit hash. The current `git log` is
  linear from `9018de7` (a small bug fix) onward; nothing earlier is in the
  reflog on this branch.
- The exact day/date for V1 features (sign-up, posts, comments) — the
  original V1 work pre-dates the recoverable commit range; only the
  resulting migration files (`001..008`) remain.
- The exact commit messages and dates for each migration prior to
  `005_full_sync.sql`. The migrations exist; the commits that produced
  them are not recoverable from this branch.

These gaps do not affect the V3 work: every V3 milestone is anchored to a
verifiable Git commit, migration file, and test file.
