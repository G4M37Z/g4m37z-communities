# Spec: Platform Links (manual, self-reported)

## Objective

Let a signed-in user save the gaming IDs they already have on the major
platforms — Steam, PlayStation Network, Xbox, Google Play Games, Apple Game
Center — so other members can find and add them. This is **manual linking**:
the user types their own handle/ID and it is stored as **self-reported,
unverified**. It does not import a game library and never claims to.

Why manual first: the platform APIs required for real import are not available
to us yet (Steam Web API key + public profile; Play/Game Center have no
third-party consumer API at all — see `docs/PLATFORM_CONNECTORS_ASSESSMENT.md`).
Manual linking delivers the user-facing value now and gives the future Steam
OpenID connector a table and RLS surface to write into.

**Explicit non-goals:** no OAuth/OpenID, no library import, no "verified"
badge, no presenting a self-reported handle as a connected account. Steam
OpenID verification is a separate later module that will set `verified_at`.

## Tech Stack

Unchanged: Next.js 16.3 (App Router, webpack only on this device), React 19,
TypeScript, Supabase (Postgres + RLS), Tailwind v4, Vitest 5.

## Commands

```
Check:  npm run check        # tsc + eslint + unit tests (~30s)
Dev:    npm run dev          # webpack
Build:  NODE_OPTIONS=--max-old-space-size=2048 npm run build
Test:   npm run test:unit
DB run: ~/.local/bin/run-sql docs/database/042_platform_links.sql
```

## Project Structure

```
docs/database/042_platform_links.sql      → new table + RLS + indexes
src/lib/profiles/platform-links.ts        → service + pure validators
src/lib/profiles/actions.ts               → add savePlatformLinkAction / removePlatformLinkAction
src/types/database.ts                     → PlatformLink type
src/components/settings/platform-links-form.tsx  → editor on /settings
src/app/profile/[username]/page.tsx       → render links on public profile
tests/platform-links.test.ts              → validator + migration/RLS regression
```

## Data model

One new table (migration `042_platform_links.sql`), mirroring the
`platform_links` shape already named in the connectors assessment:

```sql
create table if not exists public.platform_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in
    ('steam','playstation','xbox','google_play','apple_game_center')),
  handle text not null check (char_length(handle) between 1 and 64),
  profile_url text,
  verified_at timestamptz,          -- always NULL until a real connector exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);
```

RLS (matching the profiles model — world-readable profile, owner-only writes):
- `select` — true (links appear on a public profile).
- `insert`/`update`/`delete` — `auth.uid() = user_id`.
- No service-role needed for writes; unlike `profiles` there is no protected
  column, so the owner's own session can write directly under RLS. (If the
  existing style prefers service-role writes, the service will resolve
  `auth.getUser()` server-side and write via the admin client — same as
  `service-v4.ts`. **Decision needed, see Open Questions.**)

`user_games` and any import tables are **out of scope** for this spec.

## Code Style

Pure validators stay in the service module and are exported for tests, exactly
like `__v4Gaming`:

```ts
export const PLATFORMS = ["steam", "playstation", "xbox", "google_play", "apple_game_center"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function cleanHandle(platform: Platform, raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 64) return null;
  return /^[a-zA-Z0-9_.\- ]+$/.test(s) ? s : null;
}
```

Server actions return the existing result-object shape
(`{ ok: true } | { ok: false; error: string }`) and never throw across the
boundary (`src/lib/profiles/actions.ts` pattern).

## Testing Strategy

Vitest, `tests/platform-links.test.ts`:
1. `cleanHandle` accepts each platform's valid form and rejects invalid chars /
   over-length input.
2. `cleanPlatform` rejects unknown platform strings.
3. Migration/RLS regression: read `docs/database/042_platform_links.sql` and
   assert the `unique (user_id, platform)` constraint and the owner-only
   write policies are present (same technique as `tests/games-service.test.ts`
   reading `015_games_policies.sql`), so a future edit can't silently drop them.

No browser tests required for this module.

## Boundaries

- Always: run `npm run check`; keep validation server-side; label the UI
  "self-reported" and never show a verified/connected badge.
- Ask first: applying the migration to the live DB; adding any dependency.
- Never: weaken RLS; accept `user_id`/`verified_at` from the client; show
  fabricated imports or fake verified state; touch the deferred
  tournament-format work in this module.

## Success Criteria

1. On `/settings`, a user can add, edit, and remove a handle for each of the
   five platforms; invalid input is rejected with a visible error.
2. A saved link is visible on the user's public `/profile/[username]` page,
   rendered as **self-reported** (no verified badge).
3. A user cannot create/modify a row for another user (RLS), proven by a
   regression test.
4. Zeros rows are written for platforms with no handle.
5. `npm run check` is green (tsc 0 errors, eslint 0 errors, all tests pass),
   including the new tests.

## Capability Map (initiative)

| Module id | Responsibility | Depends on | Status |
|---|---|---|---|
| `platform-links` | Manual self-reported gaming IDs (this spec) | — | **Approved to build** |
| `platform-verify` | Steam OpenID + Web API import, sets `verified_at` | `platform-links` | Deferred (no API key yet) |
| `tournament-formats` | Per-game, category-aware competition formats | — | Deferred (separate spec) |

Build order: `platform-links` → `platform-verify`; `tournament-formats` is
independent.

## Open Questions

1. Write path: direct RLS write from the user's session (simplest, table has no
   protected columns) or service-role write like `service-v4.ts` (consistent
   with the existing gaming-profile code)? Recommend direct RLS.
2. Visibility: should links be public (visible to logged-out visitors, matching
   the public profile) or signed-in members only? Default in this spec: public.
3. Handle syntax: one shared regex, or per-platform rules (PSN 3–16,
   Xbox gamertag ≤15, SteamID64/vanity)? Default: one shared safe charset now,
   per-platform rules when a real connector needs them.
