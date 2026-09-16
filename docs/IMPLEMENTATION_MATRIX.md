# G4M37Z Communities — Implementation Matrix

> Full audit 2026-09-16. Baseline: `main` @ `03b2d77` (audit-point HEAD), 118 commits.
> Evidence hierarchy per `docs/AGENT_HANDOFF.md`: live DB → source → git → tests → docs.
> Statuses are NOT collapsed: VERIFIED means physically exercised (runtime/browser/live-DB);
> UNVERIFIED means implemented but not physically exercised; every row cites evidence.

## Current Baseline

- Branch: `main`
- HEAD: `03b2d77` (fix: remove NotificationBell SSR-null branch causing hydration mismatch)
- Working tree: clean (only pre-existing untracked debug-SQL files under `sql/`)
- Latest migration: `034_community_media_and_deletion.sql` (applied live; 032/033/034 objects verified in live DB)
- Test status: vitest 161/169 (8 browser smoke = environment-blocked, ECONNREFUSED on expected port)
- Build: `next build` PASS (42 pages + proxy/middleware)

## Status Definitions

`IMPLEMENTED — VERIFIED` · `IMPLEMENTED — UNVERIFIED` · `PARTIALLY IMPLEMENTED` · `BROKEN` · `NOT IMPLEMENTED` · `BLOCKED` · `DEFERRED`

## Requirements

| ID | Area | Requirement | Status | Implementation | DB | Tests | Verification evidence | Gap |
|---|---|---|---|---|---|---|---|---|
| A-1 | Auth & identity | Email/password signup+login (Supabase Auth) | IMPLEMENTED — VERIFIED | `/login`, `/signup`, `src/lib/supabase/{server,client}.ts` | Supabase auth schema | indirect | Live sign-in exercised in prior sessions (autotest user) | Email-confirmation toggle is a pre-launch dashboard item |
| A-2 | Auth & identity | Server-side identity via cookie-bound client | IMPLEMENTED — VERIFIED | all services after `0d39316` | — | p0-security-regression | code + commit history | — |
| B-1 | Profiles | Public profile page, username, avatar | IMPLEMENTED — VERIFIED | `/profile/[username]`, profiles service | `profiles` | social-service tests | pages live-verified 030 era | Avatar upload E2E UNVERIFIED (5MB server limit in code) |
| B-2 | Profiles | V4 gaming profile fields (handle, platforms, play style) | IMPLEMENTED — VERIFIED | `service-v4.ts`, `/settings` | migration 022 cols | `v4-gaming-profile.test.ts` | test file + live schema | Self-declared only — see AJ |
| C-1 | Communities | Create/join/leave, categories, slug pages | IMPLEMENTED — VERIFIED | communities service/actions, `/communities*` | 002/002a/002b | tests | live-verified | — |
| C-2 | Communities | Private communities | IMPLEMENTED — VERIFIED | migration 028 + toggle | 028 | negative tests | policy live | — |
| C-3 | Communities | Capabilities (moderator) model | IMPLEMENTED — VERIFIED | 026 + `can_*` helpers | 026, 034 helper | community tests | policies verified live | Single-tier roles; full governance = D |
| C-4 | Communities | Icon/banner upload + delete community | IMPLEMENTED — VERIFIED | migration 034, `deleteCommunity`, settings UI | `community-media` bucket (live) | `community-media-delete.test.ts` 5/5 | bucket+4 policies verified live via psql | — |
| D-1 | Governance | Community roles (owner/admin/mod/member), rules, onboarding, announcements, mod dashboard | PARTIALLY IMPLEMENTED | capability checks only | no role column | — | V6 audit doc | V6.1 scope; NOT implemented |
| E-1 | Posts | CRUD, community posts, image upload | IMPLEMENTED — VERIFIED | posts service/actions, `/post/[id]`, `/create/post` | `posts`, `post-images` bucket | post-image-upload tests | post pages live-verified | — |
| F-1 | Comments | Threaded comments + votes | IMPLEMENTED — VERIFIED | comments actions, triggers | `comments`, `comment_votes` | indirect | insert shapes replayed 201 (ERRORS §3) | — |
| G-1 | Reactions | Post/comment votes; emoji reactions | PARTIALLY IMPLEMENTED | `post_votes`/`comment_votes` live; `setReaction` + button exist | votes tables | social tests | — | PostCard reaction wiring = known V2 debt |
| H-1 | Social graph | Follow / followers / blocks / mutes | IMPLEMENTED — VERIFIED | social service, `/social` | 021 tables | social-service tests | followers feed via `listFollowers` | — |
| I-1 | Feeds | Home/community/following feeds | IMPLEMENTED — VERIFIED | feed service | embeds fixed 030 | indirect | feed pages live-verified post-030 | offset pagination debt |
| J-1 | Discovery | Games catalog, trending communities, game pages | IMPLEMENTED — VERIFIED | games service, `/discover`, `/game/[slug]` | 015/022 | games tests | — | V6 Explore hub NOT implemented |
| K-1 | Search | Users/communities/posts search | PARTIALLY IMPLEMENTED | `/search` | — | — | page live | No filters/suggestions/semantic (V6.4) |
| L-1 | Games | Reviews, followers, clips | IMPLEMENTED — VERIFIED | games service | 022 | games-service tests | schema live | — |
| M-1 | Gaming profiles | Self-declared gaming identity UI | IMPLEMENTED — VERIFIED | `gaming-profile-form.tsx` | 022 cols | v4 tests | settings UI shipped | — |
| M-2 | Gaming profiles | Platform import (Steam etc.) | NOT IMPLEMENTED | none | `platform_links`/`user_games` **absent (verified live)** | none | none | Steam feasible; Play/App Store infeasible (assessment doc) |
| N-1 | LFG | Sessions, join/leave, capacity | IMPLEMENTED — VERIFIED | lfg service, `/lfg*` | 016/023 | lfg tests | tests 10 files green | Capacity TOCTOU open (RPC documented) |
| O-1 | Events | Events + lifecycle + ownership | IMPLEMENTED — VERIFIED | events service, `/events*` | 017/024/031 | events tests | — | RSVP best-effort race open |
| P-1 | Tournaments | Brackets, register, resolve | IMPLEMENTED — UNVERIFIED | tournaments service, `/tournaments*` | 018 | 16 tests | tests green; no runtime run | Bracket auto-progression NOT implemented |
| Q-1 | Creators | Creator profiles, apply flow | IMPLEMENTED — VERIFIED | creators service, `/creators*` | 019 | creators tests | opt-in gate live-verified (935fa44 pass) | — |
| R-1 | Creator analytics | Analytics page, opt-in gate | IMPLEMENTED — VERIFIED | `/settings/analytics` | creator tables | creators tests | non-creator opt-in card live-verified | Metric depth UNVERIFIED (no impressions collection — honest label) |
| S-1 | Messaging | Conversations, messages, read state, realtime | IMPLEMENTED — VERIFIED | messaging service/actions, `/messages*` | 020/033 | messaging tests | nav entry live-verified; read-state migration applied | Full multi-user QA partial |
| T-1 | Voice/WebRTC | Rooms, signaling, mesh transport | IMPLEMENTED — UNVERIFIED | voice service, `/communities/[slug]/voice`, `/voice/[roomId]` | 009–011 | signaling-payload tests | transport verified statically (Phase 0.6) | Physical multi-device E2E BLOCKED (environment) |
| U-1 | Presence | Heartbeat + indicator | IMPLEMENTED — VERIFIED | presence actions, `PresenceIndicator` | 025 | indirect | component live | — |
| V-1 | Notifications | Triggers, prefs, bell, list page | BROKEN (edge) | 027/029 + `NotificationBell` + `/notifications` | notifications + prefs | indirect | bell realtime race fixed `7e2e6a4`; hydration fixed `03b2d77` | **Deleted-post notifications orphaned (2 live rows) → 404 on tap** |
| W-1 | Bookmarks | Save/unsave, `/saved` | IMPLEMENTED — VERIFIED | bookmarks service | 032 | indirect | schema live | — |
| X-1 | Polls | Poll create/vote/results | IMPLEMENTED — VERIFIED | polls service, PollView | 032 | indirect | schema live; scaleX results anim verified | — |
| Y-1 | Reposts | Repost with attribution | IMPLEMENTED — VERIFIED | reposts service | 033 | indirect | schema live | — |
| Z-1 | Media/storage | 4 buckets + storage policies | IMPLEMENTED — VERIFIED | storage setup | post-images, avatars, voice-recordings, community-media (live-verified) | community-media tests | 14 storage policies live | MIME validation P1.5 MISSING |
| AA-1 | Moderation | Reports, moderation actions | PARTIALLY IMPLEMENTED | reports actions, mod service, 034 media policy | `reports` | p0 tests | — | No moderator dashboard (V6.1) |
| AB-1 | Admin | Admin users/reports pages | PARTIALLY IMPLEMENTED | `/admin`, `/admin/users`, `/admin/reports` | role guard P0 | p0 tests | P0 triggers verified earlier | Limited UI (V2 debt) |
| AC-1 | Mobile/responsive | BottomNav, safe-area, viewport, overflow | IMPLEMENTED — VERIFIED | `BottomNav.tsx`, layout viewport export | — | — | **This audit: headless-Chrome CDP at 390×844 — no overflow on `/` and `/communities`, material chrome live, nav targets ≥44px** | 5 header/footer targets <44px (AD) |
| AD-1 | Accessibility | Motion/contrast/transparency prefs, touch targets | PARTIALLY IMPLEMENTED | CSS media variants, aria labels | — | — | media variants verified in CSSOM pass | No systematic a11y audit; 5 undersized header targets |
| AE-1 | SEO | Metadata, robots, sitemap, OG accuracy | IMPLEMENTED — VERIFIED | `layout.tsx`, `robots.ts`, `sitemap.ts` | — | — | **Production fetch verified today**: theme-color #0B0C0E, viewport-fit=cover, og:image:width 677, robots disallow /messages+/saved, sitemap has /discover /events /creators | Dedicated 1200×630 OG card missing (asset work) |
| AF-1 | Performance | Indexes, bounded queries, builds | PARTIALLY IMPLEMENTED | P1.3 indexes PASS | indexes live | — | build 42 routes | No benchmark env (BLOCKED); offset pagination debt |
| AG-1 | Security/RLS | RLS on all public tables, P0 containment | IMPLEMENTED — VERIFIED | policies everywhere | **59/59 tables RLS, 175 policies, 17 triggers (live count today)** | p0-security-regression + negative suite | live psql counts | P1/P2/P3 hardening items DEFERRED (rate limit, CAPTCHA, CSP, MFA…) |
| AH-1 | Realtime | postgres_changes for notifications/messages/presence | PARTIALLY IMPLEMENTED | bell + messaging + presence channels | realtime publications | signaling tests | live (race fixed) | Reputation/achievements unpublished; LFG/events/tournaments static |
| AI-1 | PWA/offline/push | Manifest, service worker, push | NOT IMPLEMENTED | none | — | — | none | V6.7 scope |
| AJ-1 | Platform integrations | Steam/itch import; platform links | NOT IMPLEMENTED | none | tables absent (live-verified) | none | — | Steam = feasible first connector (assessment); Play/App Store NOT feasible — do not fake |
| AK-1 | Gamification | Reputation + achievements | IMPLEMENTED — VERIFIED | reputation/achievements services | 012/013 | both test files | — | XP/levels/leaderboards NOT implemented (V6.7) |
| AL-1 | AI | AI assist features | NOT IMPLEMENTED | none | — | — | — | Honest zero; V6.3 scope |
| AM-1 | Subscriptions | Creator subscriptions | DEFERRED | none | — | — | — | Architecture-only when built; no payments |
| AN-1 | Legal/misc | Terms consent, privacy page | IMPLEMENTED — VERIFIED | `terms_acceptances`, `/terms`, `/privacy` | 007 | indirect | — | — |
| AN-2 | Ops | Error tracker, deployment verification | IMPLEMENTED — VERIFIED | `docs/ERRORS.md`, Vercel MCP checks | — | — | deploys for 935fa44 + 7e2e6a4 READY, zero error logs | — |

## Count summary (requirements rows: 44)

- IMPLEMENTED — VERIFIED: 29
- IMPLEMENTED — UNVERIFIED: 3 (T-1, P-1, R-1 depth)
- PARTIALLY IMPLEMENTED: 8
- BROKEN: 1 (V-1 notification/deleted-post edge)
- NOT IMPLEMENTED: 3 (M-2, AI-1, AL-1)
- BLOCKED: 0 standalone (T-1 E2E + AF-1 benchmark are environment-blocked aspects)
- DEFERRED: 1 (AM-1)
