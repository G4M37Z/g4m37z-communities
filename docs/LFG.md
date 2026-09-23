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

- Reads through the caller's session (RLS decides visibility).
- Mutations via service-role admin client with server-resolved identity
  (host/user IDs forced server-side, never trusted from the client).
- `joinVerdict()` — pure, unit-tested gate for status/capacity/self-join.
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

## Deferred (documented, not built)

- **Service-role refactor**: mutations use the service-role admin client
  with server-side authorization checks. RLS-rejected writes (016's
  policies were designed to own this) would be the cleaner boundary;
  the refactor is safe but touching all of `service.ts` in one pass
  risks the working join/capacity logic. Tracked as debt, not a blocker:
  identity is still forced server-side on every path.
- Live multiplayer matchmaking, session chat, notifications on join.
- Recurring sessions and calendar integration.
