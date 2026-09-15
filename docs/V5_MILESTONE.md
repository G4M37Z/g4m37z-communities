# G4M37Z Communities — V5 Master Product Evolution (Planned Milestone)

> **STATUS: PLANNED — NOT STARTED.**
> This document preserves the V5 master product evolution specification for a
> **later milestone**. No V5 feature development has begun. Do not treat the
> sections below as implemented, in progress, or committed-to dates.

---

## Baseline when this milestone was filed (2026-09-15)

Verified V4 state at the time this spec was preserved (evidence-based):

| Area | State | Evidence |
|---|---|---|
| Build | PASS | `next build`, 41 routes + middleware |
| Types / lint | PASS | `tsc --noEmit` clean; eslint 0 errors |
| Tests | 145/153 | 8 failures are chromedriver E2E only (`ECONNREFUSED :9515`, environment-limited) |
| Posts | VERIFIED | `posts_author_id_fkey → profiles(id)` confirmed live; `/post/[id]` query returns author+community embeds for authenticated **and** anonymous |
| Notifications security | VERIFIED | RLS on; SELECT/UPDATE owner-only; **no INSERT policy** — 8 server-side triggers are the only writers |
| Role escalation guard | VERIFIED | `trg_guard_profile_role` live on `profiles` |
| Identity-resolution bug | FIXED (0d39316) | `auth.getUser()` was called on the service-role client in events/games/lfg/tournaments/profiles-v4; now resolved via cookie-bound server client |
| Events ownership contract | REPAIRED (031) | `events.created_by` added, backfilled, INSERT tightened to owner + community admin/moderator, UPDATE/DELETE honor recorded owner |
| Hardening commit | `0d39316` | 7 files: 5 services, `/events/new`, `docs/database/031_events_created_by_and_insert_policy.sql` |

**V5 entry requirement (Phase 0):** re-verify the above against the live DB and
a fresh production build before writing any V5 code. If a P0/P1 security or
database-integrity problem exists, fix it before V5 work begins.

## Frozen frameworks — these stay as-is through V5

Per decision when this milestone was filed:

1. **Supabase Auth** — no Clerk, no second authentication system.
2. **SQL execution framework** — `C:\Program Files\PostgreSQL\17\bin\psql.exe`
   (17.11) invoked only through `C:\Users\KKF\bin\run-sql.cmd`, which loads
   `C:\Users\KKF\.supabase_env`. Credentials stay outside the repository.
3. **Migration convention** — numbered, idempotent files in `docs/database/`
   (`0NN_name.sql`), applied via `run-sql.cmd`, then verified with a live
   read-only query. Documentation alone never proves a migration is applied.
4. **Client pattern** — identity from the cookie-bound server client
   (`createClient` from `@/lib/supabase/server`); privileged writes via the
   service-role admin client (`createAdminClient`) with server-side ownership
   checks. Never call `auth.getUser()` on the admin client.
5. **Next.js App Router structure, existing services/components/design
   primitives** — extend, don't rewrite.

---

# V5 — Master Product Evolution Specification

## ROLE
Principal product engineer, systems architect, and UX engineer for evolving
G4M37Z Communities V4 into V5.

V5 is NOT a rewrite. V5 is NOT permission to replace working infrastructure.
V5 begins only from a VERIFIED V4 foundation.

Goal: transform G4M37Z Communities from a functional social/community
application into a distinctive, polished, scalable social platform.

## CORE PRINCIPLE
V4 = FUNCTIONAL FOUNDATION.
V5 = PRODUCT DEPTH + SOCIAL GRAPH + DISCOVERY + REALTIME EXPERIENCE +
     PREMIUM UX + PLATFORM IDENTITY.

Do not sacrifice V4 stability for V5 features.
REAL IMPLEMENTATION > DOCUMENTATION > ASSUMPTION.

## 0. V5 ENTRY REQUIREMENT
Before touching V5: VERIFY V4 (git status, production build, tests, route
verification, database verification, auth verification, RLS/security
verification). If V4 has unresolved P0/P1 security or database integrity
problems: STOP V5 feature development. Fix the blocker first.

## 1. EXISTING STACK
Next.js, TypeScript, React, Supabase, PostgreSQL, Supabase Auth, existing
component architecture, shadcn-style primitives where appropriate.
DO NOT introduce Clerk. DO NOT replace Supabase Auth or PostgreSQL. Extend
the existing architecture.

## 2. DATABASE OPERATING RULE
The live Supabase database is the source of truth. Use the established
Windows SQL framework (`run-sql.cmd` → `.supabase_env` → `psql`).
Before schema changes: inspect existing schema/migrations/live state, create
a minimal migration, execute through the framework, verify live state,
verify application behavior. Do not create duplicate tables.

## 3. V5 PRODUCT VISION
A modern social ecosystem — not a generic dashboard, forum clone, CRUD admin
panel, Discord/Reddit/Facebook clone. Core loop:
DISCOVER → JOIN → PARTICIPATE → CREATE → CONNECT → RETURN → BUILD COMMUNITY.
Meaningful participation over empty engagement metrics.

## 4. INFORMATION ARCHITECTURE
Route-based experiences; primary areas: `/` (home feed), `/discover`,
`/communities`, `/communities/[slug]`, `/post/[id]`, `/events`,
`/events/[id]`, `/messages`, `/notifications`, `/profile/[username]`,
`/search`, `/settings`, `/admin`. Navigation stays understandable.

## 5. HOME EXPERIENCE
Answer: "What is happening in my G4M37Z world right now?" Personalized feed,
following, communities, trending discussions, upcoming events, active
conversations, recommended communities. Progressive disclosure; no
everything-on-one-page dump.

## 6. SOCIAL GRAPH
Stronger relationship layer where appropriate: following users, followers,
community membership, interests, interaction history, mutual
communities/connections. Coherent graph design; correct FKs, unique
constraints, indexes, RLS. Prevent duplicate relationships at the database
level.

## 7. PERSONALIZED FEED
Evolve beyond chronological. Transparent deterministic ranking: followed
users, joined communities, recent interaction, community activity,
freshness, relevance. Explainable labels ("From a community you follow",
"Trending in your communities"). No opaque AI recommendation engine.

## 8. FOLLOWING
Follow/unfollow, counts, follower/following lists, feed integration,
privacy. Prevent self-follow, duplicate follows, unauthorized manipulation.

## 9. COMMUNITY EVOLUTION
Communities as living spaces: posts, members, events, discussions, media,
announcements, moderators, rules, pinned content, identity. Owner/moderator
tools: pinned posts, announcements, member roles, moderation queue, rules,
discovery metadata, analytics. Member experience remains primary.

## 10. CREATOR EXPERIENCE
Publish, edit, organize, manage media, interact with comments, useful
engagement information. Analytics that answer real questions (what gets
engagement, which communities respond, what brings followers, when users
engage). No vanity metrics.

## 11. CONTENT TYPES
Potential primitives: POST, IMAGE, VIDEO, LINK, POLL, EVENT, ANNOUNCEMENT,
DISCUSSION. Each type needs DB representation, creation flow, rendering,
permissions, moderation, deletion, reporting, RLS, mobile support. Prefer an
extensible content architecture over dozens of unrelated tables.

## 12. POLLS
Create/vote/change-vote/results/close. DB constraints prevent invalid or
duplicate votes. Never trust client-supplied counts.

## 13. BOOKMARKS / SAVED CONTENT
Save/unsave/saved view. Private unless designed otherwise.

## 14. SHARING
Copy link, share to community/profile/feed, native share. Prefer references
over duplicating posts.

## 15. NOTIFICATIONS 2.0
Contextual types (follow, comment, reply, reaction, mention, community
activity, event reminder, moderation, message, system). Correct recipient,
privacy, read/unread, deduplication, secure generation. Never allow
arbitrary clients to impersonate notification producers.

## 16. REALTIME EXPERIENCE
Realtime where intentional: messages, notifications, presence, reactions,
comments, community activity, event participation. Subscriptions must be
scoped, cleaned up, permission-aware, memory-safe. No duplicate
subscriptions.

## 17. MESSAGING 2.0
Conversation list, unread counts, typing indicators, presence, reactions,
attachments, reply-to, search, settings. Privacy and RLS outrank features.

## 18. EVENTS 2.0
RSVP, attendee list, reminders, event discussion, image, organizer,
community association, online/offline, recurring if justified. Avoid
calendar complexity unless needed.

## 19. DISCOVERY ENGINE
Communities, creators, discussions, events, topics, trending. Sections:
TRENDING, FOR YOU, NEW COMMUNITIES, ACTIVE NOW, UPCOMING, CREATORS.
Explainable ranking; trending from real measurable activity — no fake
trending.

## 20. SEARCH 2.0
Product-wide command surface: users, communities, posts, events. Filters,
recent searches, autocomplete, relevance ranking. Respect authorization; no
private content exposure.

## 21. PROFILE 2.0
Avatar, name, username, bio, communities, posts, events, followers,
following, saved/private areas where appropriate. Personal, not
administrative.

## 22. COMMUNITY IDENTITY
Avatar, banner, description, rules, controlled accent/theme metadata, member
count, activity, moderators. No arbitrary CSS injection — controlled design
tokens.

## 23. GAMIFICATION — USE CAREFULLY
Reputation, badges, milestones, achievements must reward useful
participation. No meaningless points; no reputation manipulation via
duplicate actions.

## 24. TRUST / SAFETY
Reporting, blocking, muting, moderation, content removal, community bans,
rate limits, abuse prevention. Blocking has clear behavioral semantics —
not merely hiding users in the UI.

## 25. RATE LIMITING
Server-side protection for login, posting, comments, messaging, follows,
reactions, reports, event creation. No fake client-side counters.

## 26. PREMIUM UI / UX
Premium, dark-first where appropriate, restrained color, strong typography,
deliberate spacing, subtle depth, polished surfaces, excellent mobile
behavior, precise interaction states, smooth transitions. NO NEON RAINBOW,
no excessive gradients, no generic dashboard cards, no visual noise.

## 27. DESIGN SYSTEM
Typography scale, spacing, radius, shadows, borders, surface hierarchy,
buttons, inputs, dialogs, sheets, cards, tabs, navigation, avatars, badges,
menus, toasts. Reuse shadcn-style primitives; no duplication.

## 28. MOTION
Subtle page transitions, hover/press states, modal transitions, feed
interactions, staggered entrance where useful. Respect
`prefers-reduced-motion`. Motion serves usability.

## 29. MOBILE-FIRST QUALITY
Excellent on Android: small screens, keyboard open, touch, scrolling, bottom
nav, sheets, dialogs, image uploads, messaging, feed interaction. Desktop
stays excellent.

## 30. ACCESSIBILITY
Keyboard navigation, focus states, semantic HTML, labels, contrast, reduced
motion, screen-reader-friendly controls.

## 31. PERFORMANCE
Avoid giant bundles, unnecessary hydration, duplicate requests, N+1,
uncontrolled subscriptions, infinite retries, huge media. Server rendering,
pagination, lazy loading, image optimization, caching. Measure first.

## 32. DATABASE ARCHITECTURE
Inspect the V4 schema first; reuse existing entities. Candidate tables
(examples, NOT mandatory): follows, bookmarks, polls, poll_options,
poll_votes, blocks, mutes, mentions, content_reports, community_rules,
pinned_content, creator analytics. Minimum schema necessary. Every table:
PK, FKs, indexes, constraints, RLS, ownership model.

## 33. RLS
Every V5 table: explicit SELECT/INSERT/UPDATE/DELETE analysis, ownership,
cross-user protection, anonymous access, service-role expectations. No
feature complete without security verification.

## 34. DATA MODEL RULE
Avoid denormalized counters when unnecessary. If used: authoritative source,
update mechanism, race-condition prevention, reconciliation. Never trust
client-provided counts/reputation.

## 35. API / SERVER ACTION SECURITY
Every mutation verifies authentication, authorization, input validation,
ownership, relationship permissions. No trusting hidden fields, client
roles, or client user IDs.

## 36. OBSERVABILITY
Track errors, failed mutations, performance problems, critical workflow
failures using the existing architecture. No personal data, no secrets in
logs.

## 37. PRODUCT ANALYTICS
Extend coherently if present: community joins, active communities, post
creation, meaningful interactions, event participation, retention, discovery
conversion. No vanity metrics; analytics must not become the product.

## 38. AI — OPTIONAL, NOT FOUNDATIONAL
Only where it provides obvious value (discovery, recommendations,
moderation assistance, summarization, search assistance, spam detection).
Core functionality never depends on an external AI API.

## 39. MEDIA / STORAGE
Images, supported video, thumbnails, optimized delivery, ownership,
deletion, authorization. No arbitrary storage access.

## 40. NOTIFICATION PREFERENCES
Category control that actually affects behavior. No UI-only switches.

## 41. SETTINGS ARCHITECTURE
ACCOUNT, PROFILE, PRIVACY, NOTIFICATIONS, SECURITY, COMMUNITY where
relevant. No dozens of meaningless switches.

## 42. ADMIN / MODERATION PLATFORM
Reports, users, communities, moderation actions, system health, content
trends. Server-side authorization on every capability; no unnecessary
sensitive exposure.

## 43. TESTING
Three levels per feature: code correctness, database correctness, real user
workflow. Example — FOLLOW USER is complete only when: DB row created,
duplicates prevented, RLS works, counts correct, unfollow works, feed
behavior correct, mobile UI works, unauthorized access blocked.

## 44. REGRESSION PROTECTION
After V5 changes, verify V4: auth, profiles, communities, posts, comments,
reactions, feeds, events, messaging, notifications, search, discovery,
moderation, admin, settings.

## 45. DEVELOPMENT ORDER
PHASE 0 V4 verification → 1 architecture/design system → 2 social graph →
3 profiles/community identity → 4 feed/discovery → 5 content primitives →
6 bookmarks/polls/sharing → 7 notifications/realtime → 8 messaging →
9 events → 10 trust/safety → 11 creators → 12 performance/accessibility/
mobile → 13 security/RLS audit → 14 full regression → 15 production build.

## 46. IMPLEMENTATION RULE
DISCOVER → DESIGN → DATABASE → SECURITY → SERVICE → UI → TEST → VERIFY →
DOCUMENT. No UI-first backfilling; no DB-first without understanding the
user flow.

## 47. NO REWRITE RULE
Do not rewrite auth, database client, routing, services, components, or
working V4 features without a concrete technical reason. Before replacing:
identify the current implementation, explain the problem, explain why
incremental repair is insufficient, identify dependencies.

## 48. NO FAKE FEATURES
Never create fake activity, trending numbers, notifications, followers,
communities, events, analytics, or placeholder production states. Empty data
is acceptable; fake data is not.

## 49. ANTI-LOOP PROTOCOL
Stop repeated inspection; state CURRENT UNKNOWN / AVAILABLE EVIDENCE /
NEXT TEST. DB unknowns → SQL. App unknowns → run the app. Build unknowns →
run the build.

## 50. GIT DISCIPLINE
git status before, git diff during, logical commits if authorized. Never
reset user work, commit secrets, or commit temporary artifacts. Do not push
unless explicitly authorized.

## 51. DOCUMENTATION
Update V5 docs only after implementation is verified; docs must reflect
reality.

## 52. V5 DEFINITION OF DONE
FOUNDATION (V4 stable), SOCIAL GRAPH (secure relationships), DISCOVERY
(real), FEED (relevant, explainable), COMMUNITIES (living spaces), CONTENT
(meaningful types end-to-end), MESSAGING (secure), REALTIME (reliable,
scoped), EVENTS (participation), CREATORS (useful capabilities), TRUST
(report/block/mute), MODERATION (secure tools), SECURITY (audited RLS),
MOBILE (excellent on Android), UX (coherent, premium, distinctive),
PERFORMANCE (fast), ACCESSIBILITY (core workflows), DATABASE (migrated +
verified), BUILD (passes), REGRESSION (V4 intact).

## 53. FINAL V5 REPORT
Produce: V5 STATUS, V4 BASELINE STATUS, FEATURES IMPLEMENTED, FEATURES
VERIFIED, DATABASE MIGRATIONS, LIVE DATABASE VERIFICATION, RLS/SECURITY
RESULTS, PERFORMANCE RESULTS, MOBILE RESULTS, ACCESSIBILITY RESULTS, BUILD
RESULT, TEST RESULT, KNOWN LIMITATIONS, REMAINING WORK, GIT STATUS. Every
major claim needs evidence.

## FINAL RULE
V5 IS AN EVOLUTION, NOT A REWRITE. BUILD ON THE VERIFIED V4 FOUNDATION.
PRIORITIZE: 1 REAL USER VALUE, 2 RELIABILITY, 3 SECURITY, 4 DISCOVERY,
5 SOCIAL CONNECTION, 6 PREMIUM UX, 7 PERFORMANCE.
BUILD THE PLATFORM. VERIFY THE PLATFORM. THEN EVOLVE THE PLATFORM.
