# G4M37Z — Gaming Identity Architecture (Phase 1)

> What was built in Phase 1 — Gaming Identity, what it reuses, and the
> extension points Phase 2 — Game Graph may build on. Database state is
> verified live; this document describes intent, not assumptions.

## Implemented (2026-09-21)

### Data model — migration `docs/database/052_gaming_identity.sql`

| Object | Purpose | Rules |
| --- | --- | --- |
| `profiles.gaming_visibility` | Privacy gate for the gaming layer | `public` \| `followers` \| `private`, default `public`; CHECK-constrained |
| `user_games` | Structured game library | `status` ∈ owned/playing/want_to_play/favorite/followed; UNIQUE (user_id, game_id, status) so one game can hold several statuses but never the same one twice; optional `note` (≤280), `started_at`, `completed_at` |
| `game_platform_identities` | Per-game identity | in-game name (1–64, safe charset), optional rank label, region, catalogue `platforms.slug` link; UNIQUE (user_id, game_id) |

Both tables: FKs to `profiles`/`games` with ON DELETE CASCADE, `user_id`
index, RLS **enabled**, no anonymous writes.

### RLS / visibility model

- **SELECT**: owner always; everyone else only when the owner's
  `gaming_visibility = 'public'`, or `'followers'` **and** the viewer has an
  active row in `follows`. `private` admits only the owner.
- **INSERT/UPDATE/DELETE**: `TO authenticated` with `USING`/`WITH CHECK`
  pinned to `auth.uid()` — rows cannot be created, edited, moved, or deleted
  on another user's behalf.
- `private` gaming profiles are additionally 404'd at the page level for
  non-owners; `followers` renders a "limited" state with a follow prompt.

### Reused (deliberately not duplicated)

- **Platform handles** → `platform_links` (migration 042) + `lib/profiles/platform-links.ts`.
  Phase 1 adds no new platform-handle table; game identities only *reference*
  a catalogue `platforms.slug`.
- **"Following a game"** → `game_followers` (game discovery) still exists;
  `user_games.status='followed'` is the *library* presentation of the same
  idea. They coexist intentionally.
- **Loose gaming fields** from 022 (`gaming_handle`, `favorite_games` TEXT[],
  `play_style`, `lfg_available`) remain; the structured tables are the
  relational replacement going forward. A later cleanup may migrate/collapse
  022 columns — out of Phase 1 scope.
- **Catalogue** — `games`/`platforms` rows, cover art via
  `lib/games/cover-url.ts` + `GameCover` (official-CDN allowlist).

### Server layer

- `src/lib/gaming/types.ts` — DB-shaped types + status metadata.
- `src/lib/gaming/service.ts` — reads/writes through the caller's Supabase
  session (no service role). Pure validators (`cleanStatus`, `cleanNote`,
  `cleanInGameName`, `cleanRankLabel`, `cleanRegion`, `cleanVisibility`)
  exported for tests via `__gaming`. Writes re-validate in code before the
  DB and return result objects (`{ok}` / `{ok:false,error}`), never throw.
- `src/lib/gaming/actions.ts` — `"use server"` actions with
  `revalidatePath("/gaming" | "/profile")`, plus `searchGamesAction`
  (auth-gated catalogue search).

### UI

- `/gaming` — owner console: Visibility selector, Game library manager
  (search → per-status add/remove chips), In-game identities editor, platform
  handle shortcuts.
- `/gaming/profile/[username]` — public gaming profile: identity header with
  real actions only (Follow via `FollowButton`, Message → `/messages/new`,
  link to the full profile), platform badges, library sections with official
  cover art, in-game identity rows.
- No fake buttons: LFG/team invites and "view game profile" links are absent
  until those features exist.

### Tests

`tests/gaming-identity.test.ts` (19) — validator coverage + migration
regression: RLS enabled, owner-pinned writes, visibility-gated reads,
uniqueness, CHECK constraint values, and no credential-like columns.

## Verified live (2026-09-21, production build)

- autotest: search "call" → Call of Duty → Playing + Favorite added via UI;
  rows confirmed in `user_games`; sections re-rendered after revalidate.
- `/gaming/profile/autotest` (owner): platforms + both sections + cover art.
- Visibility switched to `followers` via UI (persisted to
  `profiles.gaming_visibility`), then as autotest2: gaming profile shows the
  limited state with a Follow prompt, no games visible; `/gaming` correctly
  shows autotest2's own empty console.
- State restored after proof (visibility `public`, probe rows deleted).

## Intentionally deferred

- Playtime, achievements, ratings, reviews on the library (schema is
  extensible via (user_id, game_id)-keyed additions).
- External platform verification (Steam OpenID etc.) — `verified_at`
  stays NULL; nothing renders as "verified".
- Migrating/collapsing the loose 022 profile columns.
- Phase 2 — Game Graph builds on: `user_games(game_id)` fan-out,
  `game_platform_identities` as game-scoped identity anchors, and the
  `games` catalogue joins already used by the UI.

## Phase 0 items still deferred (unchanged)

Two-device DM call verification, post hydration-gate live click re-test,
messaging sleep/wake soak, `TENOR_API_KEY` production config, final
production env/security audits — see `docs/GAP_REGISTER.md`.
