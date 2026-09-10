# G4M37Z Communities — Architecture

> Reference architecture for the current `main` branch (HEAD `ea3c598`).
> Verified against the live source tree, package.json, and migration history.

---

## Frontend

### Framework
- **Next.js 16** (App Router, Turbopack).
- **React 19**, **TypeScript**.
- **Tailwind CSS v4** with `@theme` design tokens in `src/app/globals.css`.
  All colors, spacing, radii, typography come from tokens; no hardcoded
  values in components.

### Routing
- App Router under `src/app/`. Each route has either a `page.tsx` (server
  component by default) or a `route.ts` (Route Handler).
- 35 verified routes on V3.6 (see `PROJECT_STATE.md` for the count).
- The Next.js 16 `proxy.ts` middleware replaces the legacy `middleware.ts`;
  it refreshes the Supabase session cookie and gates protected routes
  (`/home`, `/create`, `/settings`, `/notifications`, `/admin`).

### Component architecture
- **Primitives** in `src/components/` — `Button`, `Badge`, `Skeleton`,
  `EmptyState`, `Logo`, `Header`, `Footer`, `BottomNav`, `Pagination`,
  `ThemeToggle`, `UserMenu`, `SignOutButton`, `NotificationBell`,
  `PageEnter`, `HeaderScrollObserver`.
- **Domain components** under `src/components/<domain>/`:
  - `comments/` — `Comment`, `CommentForm`, `RealtimeComments`.
  - `voting/` — `PostVoteControl`, `CommentVoteControl`.
  - `games/` — `FollowGameButton`.
  - `lfg/` — `LfgJoinLeaveButton`, `LfgHostControls`, `LfgCreateForm`.
  - `events/` — `EventRsvpButton`, `EventHostControls`, `EventCreateForm`.
  - `tournaments/` — `TournamentRegisterButton`, `TournamentOrgControls`,
    `TournamentCreateForm`, `TournamentDisputeForm`, `TournamentResolveButton`.

### UI system
- Premium / dark-capable / restrained / PlayStation-Apple polish.
- Mobile-first responsive layouts.
- Light / dark mode toggled via `ThemeToggle` + `data-theme` attribute on
  `<html>`; persisted in `localStorage` under the `g4m37z-theme` key.
- No neon-heavy styling. No generic AI-dashboard aesthetic.
- Touch targets ≥ 44px on mobile, where reasonable.

### Major shared components
- `Header` + `BottomNav` — top-level navigation.
- `PageEnter` — wraps GSAP stagger entrance for direct children.
- `EmptyState` — used across every list page when there are no items.
- `Skeleton` — placeholder for loading states.

---

## Backend

### Authentication
- **Supabase Auth** (`@supabase/ssr` + `@supabase/supabase-js`).
- Two Supabase clients:
  - `createServerClient` (in `src/lib/supabase/server.ts`) — per-request
    client bound to cookies, used inside Server Components and Route Handlers.
  - `createClient` (in `src/lib/supabase/client.ts`) — browser client.
  - `createAdminClient` (in `src/lib/supabase/admin.ts`) — service_role
    client. **Server-only**. Used inside trusted server-side service helpers.

### Authorization
- **Application layer**: every server action and every service mutation
  calls `await supabase.auth.getUser()` (admin client) and resolves
  `auth.uid()` server-side. Clients never supply `user_id`, `host_id`,
  `captain_id`, `raised_by`, or `from_user`.
- **Database layer**: RLS policies on every public table. Mutations are
  scoped to `auth.uid() = user_id` / `auth.uid() = host_id` / community
  creator / service_role paths as appropriate.
- **Server-only mutations**: all V3 write operations go through
  `createAdminClient` so that the admin client bypasses RLS for the
  trusted write path. Defence-in-depth: service helpers additionally check
  ownership before mutating (e.g. `isTournamentOrganiser`, ownership
  re-check in `updateGameReview`/`deleteGameReview`).

### Server actions
- "use server" modules under `src/lib/<domain>/actions.ts`.
- All V3 actions are thin wrappers that call the corresponding service
  helper and shape the result into `ActionResult { ok, status, error?, id? }`.
- No action accepts a client-supplied `user_id` field.

### Service layer
- Per-domain modules under `src/lib/<domain>/service.ts`.
- Pattern: types + validators → reads via regular Supabase client → writes
  via `createAdminClient` (service_role) → `__test` re-export for deterministic
  unit tests.
- Existing services:
  - `reputation/service.ts`
  - `achievements/service.ts`
  - `games/service.ts`
  - `lfg/service.ts`
  - `events/service.ts`
  - `tournaments/service.ts`
  - Plus legacy services: `posts/actions.ts`, `comments/actions.ts`,
    `communities/actions.ts`, `notifications/actions.ts`, `reports/actions.ts`,
    `supabase/actions.ts` (auth), `supabase/avatar-actions.ts`,
    `feed-service.ts`, `community-service.ts`, `community-permission.ts`,
    `community-capability.ts`, `realtime/service.ts`, `webrtc-signaling.ts`,
    `webrtc-peer.ts`, `notification-events.ts`, `moderation-service.ts`.

---

## Database

### Supabase / Postgres architecture
- Hosted Supabase Postgres; accessed via `run-sql.cmd` from this machine
  (uses a service connection string stored in `~/.supabase_env`, never
  committed).
- 35 public tables (verified via `pg_tables`), all RLS-enabled.
- Realtime: `supabase_realtime` publication includes `notifications`,
  `profiles`, `reactions`, `reports`, `voice_room_participants`,
  `voice_rooms`, `webrtc_signals`.
- Storage: avatars bucket (`008_avatars_bucket.sql`), voice-recordings
  bucket (`009_v1_expression_voice.sql`).

### Migration ordering (cumulative)
1. `001_profiles.sql` — profiles table + RLS.
2. `002_communities.sql` / `002a_categories.sql` / `002b_communities.sql` /
   `002c_cleanup.sql` — communities + categories + members.
3. `003_posts.sql` — posts + post_votes.
4. `004_comments_and_votes.sql` (+ `_part1`, `_part2`) — comments +
   comment_votes.
5. `005_full_sync.sql` — consolidated V1 schema (8 tables).
6. `006_m7_m8_additions.sql` — notifications + reports.
7. `007_terms_consent.sql` — terms_acceptances.
8. `008_avatars_bucket.sql` — avatars storage bucket + policies.
9. `009_v1_expression_voice.sql` — voice tables + voice-recordings bucket.
10. `010_webrtc_signaling.sql` — webrtc_signals table + RLS.
11. `011_webrtc_signaling_realtime.sql` — add webrtc_signals to realtime publication.
12. `012_reputation_policies.sql` — reputation_events constraints + RLS.
13. `013_achievements_policies.sql` — achievements + user_achievements RLS + seed.
14. `014_p0_security_containment.sql` — guard_profile_role trigger + RPC revocations.
15. `015_games_policies.sql` — games domain constraints + RLS.
16. `016_lfg_policies.sql` — LFG constraints + RLS.
17. `017_events_policies.sql` — events constraints + RLS.
18. `018_tournaments_policies.sql` — tournament constraints + RLS.

### RPC / SECURITY DEFINER functions
- `public.create_notification(p_user_id uuid, p_type text, p_actor_id uuid, p_reference_id uuid)` —
  SECURITY DEFINER, owned by `postgres`, anon/authenticated EXECUTE
  revoked (V3 P0 containment). Used by trigger functions.
- `public.admin_set_user_role(p_user_id uuid, p_role text)` — SECURITY DEFINER,
  anon/authenticated EXECUTE revoked. Internal admin check unchanged.
- `public.notify_comment_on_post` / `notify_comment_vote` /
  `notify_post_vote` / `notify_report_resolved` — SECURITY DEFINER trigger
  functions that call `create_notification`.
- `public.update_post_comment_count` — SECURITY DEFINER counter trigger.
- `public.handle_new_community` — SECURITY DEFINER.
- `public.get_my_platform_role` — SECURITY DEFINER.
- `public.rls_auto_enable` — DDL event trigger that auto-enables RLS on
  every new `public` table.

---

## V3 Architecture

### How the V3 systems fit together

```
                  ┌────────────────────────────────────────────┐
                  │       profiles (auth.uid() root)            │
                  └────────────────────────────────────────────┘
                                       │
       ┌───────────────┬───────────────┼───────────────┬───────────────┐
       ▼               ▼               ▼               ▼               ▼
  reputation_events  achievements    games         communities        posts
  (service_role      (service_role  (catalogue      (service-role     (CRUD)
   writes only)       writes)       public-read)     writes)
       │               │               │               │               │
       ▼               ▼               ▼               ▼               ▼
  profile display  profile display  game_reviews /  community_members /  comments / 
                                    game_followers   events → tournaments  post_votes
                                    (auth.uid()      (community_creator    (auth.uid()
                                     = user_id)        authorisation)       = user_id)
```

### Inter-system wiring (current state)
- **Reputation ↔ Achievements**: ready to integrate — `evaluateAndAward`
  can be invoked by reputation-earning server actions (future V3.x wiring;
  no callers yet).
- **Games ↔ LFG ↔ Events ↔ Tournaments**: each domain is independently
  wired. Tournaments reference `events.id` for ownership derivation; Events
  reference `communities.id`. Games are referenced by tournaments and
  events as a soft reference (`games.id` FK in tournaments). No cross-domain
  service composition yet.
- **Notifications**: tables exist; trigger functions fire on votes /
  comments / report resolution. V3 services do NOT yet generate
  notifications directly; that wiring is deferred.
- **Messaging** (`conversations`, `conversation_members`, `messages`) and
  **Social Graph** (`follows`, `blocks`, `mutes`) tables exist but are
  uninitialised in the V3 service layer — they are V3.8 and V3.9.

### V3 sequence (see `ROADMAP.md`)
- V3.1 Reputation, V3.2 Achievements, V3.3 Game Discovery, V3.4 LFG,
  V3.5 Events, V3.6 Tournaments — all PASS on `main`.
- V3.7 Creators — NEXT.
- V3.8 Messaging, V3.9 Social Graph + Notifications — pending.
- Launch Hardening (P1+P2+P3) — post-V3.

---

## Realtime / WebRTC

### Realtime
- Publication: `supabase_realtime` covers notifications, profiles,
  reactions, reports, voice_rooms, voice_room_participants, webrtc_signals.
- Client-side realtime helper: `src/lib/realtime/service.ts`
  (`subscribe`, `useRealtime`).
- V3 services currently do NOT actively subscribe to realtime updates
  from the database; the realtime subscription layer for V3 systems
  (reputation updates, achievement unlocks, RSVP changes) is a future
  hardening task.

### WebRTC
- Schema: `webrtc_signals` table; `webrtc_signals` is in the realtime
  publication.
- Service: `src/lib/webrtc-signaling.ts` (types + `sendSignal`,
  `clearOwnSignals`); `src/components/webrtc-peer.tsx` (`useWebRTCPeer` hook
  with full SDP/ICE transport via postgres_changes).
- **Verification level: statically verified, not browser-runtime
  verified, not multi-peer verified, not physical-media verified.**
  Real WebRTC end-to-end audio transmission requires a browser with
  microphone permission + two connected peers; this environment cannot
  perform that.

---

## Testing

### Framework
- **Vitest** for unit tests (Node environment, jsdom not configured).
- Each V3 service exports a `__test` namespace with the pure / deterministic
  helpers so unit tests can exercise the contract without a live Supabase.
- 91 tests across 9 files at V3.6.

### Commands
```
npx eslint .                # 0 errors expected (warnings allowed)
npx tsc --noEmit            # 0 errors expected
npm run build               # PASS expected
npx vitest run              # all tests pass expected
```

### DB-layer testing
- Live DB inspection via `run-sql.cmd <path-to-sql-file>`.
- Migrations are applied via `run-sql <migration>` and verified with read-only
  queries immediately after.
- DB-layer happy paths for V3 services are NOT exercised from the test
  harness (no `SUPABASE_SERVICE_ROLE_KEY` env var in vitest).

---

## Deployment

### Verified deployment architecture
- **Vercel** hosts the Next.js app at `https://g4m37z-communities.vercel.app`.
- `vercel.json` contains `outputDirectory: ".next"` and a non-empty
  `public/` directory placeholder (commit `78d8cd3`).
- Environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `NEXT_PUBLIC_SITE_URL`) live in the Vercel project env store; never in
  the repository.

### Not verified
- Custom WAF rules.
- CDN-level DDoS mitigation beyond Vercel defaults.
- Production telemetry pipeline.

---

## How the parts interact end-to-end (a single V3 request flow)

```
browser request
   ↓
Next.js proxy.ts (session refresh; auth gate on protected prefixes)
   ↓
Server Component (e.g. /events/[id])
   ↓
createClient() → service.read() → regular Supabase client → RLS-public SELECT
   ↓
Client Component (e.g. <EventRsvpButton onClick={rsvpEventAction(eventId)} />)
   ↓
Server Action ("use server"; src/lib/events/actions.ts)
   ↓
service.rsvpEvent() → createAdminClient() → supabase.auth.getUser() → user_id
   ↓
admin client INSERT → RLS INSERT policy auth.uid() = user_id passes
   ↓
admin client UPDATE → RLS UPDATE policy / service-side capacity check
   ↓
post-mutation: router.refresh() on the client
```
