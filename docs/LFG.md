# G4M37Z — LFG (Looking For Group)

> Phase 3 of the gaming roadmap. LFG was found **already implemented
> end-to-end** during the Phase 3 audit — database tables, RLS policies
> (016), a service layer, and three routes — but completely orphaned:
> nothing linked to it and it had zero rows. Phase 3 wires the existing
> system into the Game Graph so game hubs become the discovery surface.
> No rebuild, no duplicate tables.

## Existing system (audited, unchanged)

### Data model — migrations 023 (table) + 016 (policies)

`lfg_sessions`: `game_id` (FK → games), `host_id` (FK → profiles),
`platform_id` (FK → platforms), `mode`, `region`, `skill_level`,
`players_required` (1..100 CHECK), `microphone_required`, `language`,
`session_time`, `status` (CREATED/OPEN/FULL/CLOSED/CANCELLED/COMPLETED/
EXPIRED), `privacy` (public/private), `description` (023).
Indexes: `idx_lfg_sessions_game`, `idx_lfg_sessions_status`.

`lfg_participants`: `(session_id, user_id)` PRIMARY KEY — duplicate joins
are impossible at the DB level.

RLS (016): public SELECT of non-private sessions, membership-scoped
participant reads, INSERT forced to `auth.uid()` as host, host-only
UPDATE/DELETE, CHECK constraints on free-text columns.

### Service — `src/lib/lfg/service.ts` + `actions.ts`

- Every query runs as the caller (RLS decides visibility). Mutations were
  originally service-role based; the Phase 3 verification exposed that
  this made LFG unusable wherever `SUPABASE_SERVICE_ROLE_KEY` is not
  configured (hard throw), so mutations now run caller-scoped under the
  016 policies — with one exception below (migration 054, `98153c9`).
- **Join** is the race-sensitive path: it goes through the atomic
  `lfg_join` RPC (054) — SECURITY DEFINER, executable only by
  `authenticated`, joiner always `auth.uid()` — which re-checks
  status/host-lock/capacity in-transaction and auto-transitions the
  session to FULL on the last slot. `leaveLfgSession` flips a FULL
  session back to OPEN when a member leaves (`f210e59`).
- `lfg_participant_count` RPC (054) gives non-host viewers the real
  participant count (RLS only admits their own rows to a direct count).
- `joinVerdict()` — pure, unit-tested gate mirrored by the RPC logic.
- Capacity: PK-constrained atomic race for the last slot.

## Phase 3 wiring (implemented 2026-09-23)

1. **Game hub section** — `/game/[slug]` gains an "LFG" section listing
   open sessions for that game (host, mode, region, players needed,
   session time) with a "Host a session" CTA that prefills the game, and
   a real empty state linking to the same form when nothing is open.
2. **Prefilled creation** — `/lfg/new?game=<uuid>` preselects the game in
   the create form (validated server-side against the catalogue).
3. **Discover page game links** — LFG session cards link their game name
   to `/game/[slug]`, closing the loop: hub → LFG → hub.
4. **Tests** — prefill/query validation and hub-section regression tests
   alongside the existing `joinVerdict` coverage.

## Verified live (2026-09-23, production build, two users)

- Hub section: `/game/call-of-duty` shows "Looking for group" with open
  sessions, empty state, and the prefilled host CTA.
- Prefill: `/lfg/new?game=<uuid>` preselects the game (unknown ids
  degrade to "Any", validated against the catalogue).
- Create as autotest through the real form → row confirmed in the live
  DB (`game_id`, mode, region, host) → listed on the hub.
- Join as autotest2 through the real button → Players 1/2, roster shows
  "Auto Test Two", count RPC works for a non-host viewer.
- Leave → back to 0/2, empty roster, no stale rows in the DB.
- Gates: tsc PASS · eslint 0 errors · vitest **354/354** · build PASS.

## Deferred (documented, not built)

- Live multiplayer matchmaking, session chat, notifications on join.
- Recurring sessions and calendar integration.
- The FULL auto-transition is tested at the RPC level and the reopen
  path through leave; a full two-user FULL-cycle (capacity ≥ 2 filled
  simultaneously) soak remains for user-run testing.
