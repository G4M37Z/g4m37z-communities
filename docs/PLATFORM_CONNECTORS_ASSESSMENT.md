# G4M37Z PLATFORM CONNECTORS — HONEST FEASIBILITY ASSESSMENT

Status: ASSESSMENT ONLY (no code). Requested: "connectors to Steam, Play Store, or App Store so people can import their gaming profiles."

## Current foundation (verified live)

Migration 022 built a **game-catalog-centric** model: `games`, `game_genres`, `game_platforms`, `game_reviews`, `game_followers`, `game_clips`.
There is **no per-user gaming library and no platform-link table** (`player_profiles`, `user_games`, `platform_links`, `external_profiles` all absent — verified against production DB).

Any connector therefore needs two new tables plus one auth flow:

1. `platform_links` — (user_id, platform, platform_user_id, handle, verified_at) — one verified external identity per user per platform.
2. `user_games` — (user_id, game_id → games nullable, external_ref, name, playtime_minutes, last_played_at, source) — the imported library.
3. A server-side OAuth/OpenID route per platform. Identity is NEVER accepted from the client; it comes from the platform's callback.

## Per-platform verdicts

| Platform | Verdict | Why | What it takes |
|---|---|---|---|
| **Steam** | **FEASIBLE — recommended first connector** | Steam OpenID 2.0 sign-in is free, needs no API key, and returns the user's SteamID after they log in on steamcommunity.com. The Steam Web API (free key) can then read profile + owned games. | Server route for OpenID callback; free Web API key stored as a Vercel env var; the user must set their Steam profile **Game details** to public, or the games list is empty by design. Steam has been narrowing what `GetOwnedGames` returns over time — verify response shape at build time and degrade gracefully (show linked identity even when the library is private). |
| **Google Play (Play Games)** | **NOT feasible as imagined** | Google Play Games Services has no consumer "export my profile" API for arbitrary third-party apps. Play Games profiles are not readable by other apps; the Play Console is for app developers. | Closest honest substitute: manual "add game" from our own `games` catalog, or linking a YouTube/Google identity — neither imports play history. |
| **App Store (Apple / Game Center)** | **NOT feasible as imagined** | Game Center has no public REST API for third parties to read a player's games. Apple exposes it only inside one's own app via GKLocalPlayer. | Same substitute: manual library from our catalog. |
| **itch.io (bonus)** | **Feasible later** | itch.io supports OAuth2 with profile/purchase read scopes — a genuine import path for indie PC gamers. | Same `platform_links`/`user_games` tables; low priority. |
| **Xbox / PlayStation** | **Not now** | Xbox Live needs a Microsoft consent flow with restricted scopes; PSN has no public consumer API. | Revisit only if Microsoft/ Sony policy changes. |

## Recommendation

Build **Steam only** as the first connector (it is the one real import path for PC gamers), with `platform_links` + `user_games` designed platform-agnostic so itch.io can slot in later. Show imported games on profiles ("games they play") via the existing games catalog where a match exists, falling back to the external name. Explicitly label Play Store / App Store as **not technically possible** — do not fake it.

Anti-fabrication note: an imported library is only shown if it was actually imported. Nothing in the UI may present a manually added or empty library as a "connected account."
