# G4M37Z — Game Graph Architecture (Phase 2)

> Phase 2 connects games to everything else: communities, posts, and the
> players behind them. It builds directly on the Phase 1 identity layer
> (`docs/GAMING_IDENTITY.md`, migration 052). This document describes the
> implemented design; deferred items are listed at the end.

## Goal

A visitor can move in any direction:

```
        discover (catalogue)
             │
        /game/[slug]  ← the game hub (existing route, extended)
        /  │  \
   players  communities  posts   (all live per-game views)
        \  │  /
      Phase 1 identity (user_games, game_platform_identities)
```

Who plays this game, which communities rally around it, and what is being
said about it — every edge is real data, RLS-scoped, no fake buttons.

## Data model — migration `docs/database/053_game_graph.sql`

| Change | Purpose | Rules |
| --- | --- | --- |
| `communities.game_id` | Optional primary game for a community | FK → `games(id)` ON DELETE SET NULL; nullable — most communities are game-agnostic |
| `posts.game_id` | Optional game context on a post | FK → `games(id)` ON DELETE SET NULL; nullable — retro-tagging is fine, nothing breaks without it |
| indexes | Hub lookups fan out by game | `idx_communities_game`, `idx_posts_game` (btree on game_id) |

Deliberately **no** join tables: a community has one primary game and a
post has at most one game context. Many-to-many (a community spanning
several games) is a Phase 3 decision, not guessed at here. `ON DELETE SET
NULL` keeps communities/posts alive if a catalogue entry is ever removed.

## Service layer — `src/lib/games/graph.ts`

Read-only aggregation over the Phase 1 + Phase 2 edges, all through the
caller's session (RLS decides visibility):

- `getGameGraph(gameId)` → `{ game, players, communities, posts, stats }`
  - **players**: top `user_games` rows joined to `profiles` (and
    `game_platform_identities` names for the game) — visibility follows
    each player's `gaming_visibility` via the 052 policies automatically.
  - **communities**: `communities.game_id = game` (world-readable table).
  - **posts**: `posts.game_id = game` (RLS on posts applies as everywhere).
  - **stats**: cheap counts the hub header shows.
- Pure shaping helpers exported via `__graph` for unit tests.

## UI — `/game/[slug]`

The hub extends the **existing** game detail route (no duplicate route —
discover cards already linked here): catalogue header (cover, name, release
date, description, genres, platforms, follow) stays, with three new
server-rendered sections:
- **Players** section: avatars linking to `/gaming/profile/[username]`.
- **Communities** section: cards linking to the community; empty state
  CTA → `/create/community` (real destination).
- **Posts** section: title/author/time linking to `/post/[id]`; empty
  state CTA → `/create/post` (also real).
- `generateMetadata` emits og/twitter for the game (audit item #8 pattern).
- `/discover` cards now link to their game hub.

## Content creation integration

- **Create community** (`CreateCommunityForm` + `createCommunity` action):
  optional "Primary game" select fed by the catalogue (search-style dropdown,
  top 100 games). `game_id` validated server-side (must exist if provided).
  Community page shows a game chip linking to the hub.
- **Create post** (`CreatePostForm` + action): optional "Game context"
  select of the same shape. Server-side existence validation. Post detail
  shows a game chip linking to the hub.

No destructive changes to either flow: absent `game_id` behaves exactly as
before.

## RLS / security

No new policies needed: `communities` and `posts` keep their existing
world-read/owner-write models; `games` is public catalogue data. The hub's
player list is filtered by the 052 visibility policies at the database
level — a `private` gamer never appears, a `followers` gamer appears only
to their followers. No service role anywhere.

## Tests

`tests/game-graph.test.ts`:
- migration regression: FKs with ON DELETE SET NULL, both indexes exist,
  nullable columns, RLS untouched on base tables;
- `__graph` pure shaping helpers.

## Verified live (2026-09-23)

- Tag a community with a game via the real create form → chip on the
  community page → hub lists the community.
- Tag a post via the real create form → chip on the post → hub lists the
  post (row confirmed in the live DB with `game_id` set).
- Phase 1 rows (autotest playing/favoriting) surface in the hub's players
  section (visibility-gated).
- Post page shows both the community link and the game chip.

### Defect found and fixed during verification (1613835)

The post page's multi-line embedded select separated embeds with
newlines and no commas. postgrest-js 2.116's whitespace-stripping
`select()` parser merges those into a single token, silently dropping
every embed after the first — this had already been hiding the community
link on post pages since the supabase-js bump. Fixed by comma-separating
the embeds; a codebase-wide scan confirmed it was the only occurrence.

## Deferred (not guessed at)

- Many-to-many community↔game edges.
- Per-game forums, leaderboards, match history (needs real data sources).
- Game follow (Phase 1 `game_followers` surfaces later as its own feature).
- Playtime/achievements — as documented in GAMING_IDENTITY.md.
