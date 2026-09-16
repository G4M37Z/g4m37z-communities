# G4M37Z COMMUNITIES V6 — AUDIT + IMPLEMENTATION MAP

Status: AUDIT + PLAN. Commit `0cfd728` shipped the four production blockers (community delete, community media, messages in nav, regression tests). Nothing beyond that is built. This document is the required pre-coding audit per section 27 of the V6 master prompt.

## 1. Audit — where the platform actually stands

### Production reliability (verified via Vercel MCP)
- Vercel 54.9% metric: fully diagnosed and fixed in `a9785d7`. One `"use server"` object-export crash class, 457 errors / 13 routes since Sep 11. Post-fix deployment: **0× 500** (126× 200). DB telemetry (Supabase logs, 24h): zero 5xx. No open production errors.
- Latest deployment `dpl_HoxvXrjJhF17Y8SUWkveJUxdwWHC` (commit `0cfd728`) READY, clean status-code table.
- Deployment Protection (SSO) is ON for the project — public testers hit the Vercel login wall. Requires an owner decision (disable SSO or use share links), not a code fix.

### Bug fixes verified this milestone (commit 0cfd728)
| Bug | Root cause | Fix | Verified |
|---|---|---|---|
| Cannot delete communities | RLS delete policy existed (`creator_id`); **zero application code** | `deleteCommunity` action (creator-only server check + RLS), delete button with confirm on settings page; child FKs are ON DELETE CASCADE (members/posts/events/voice rooms — verified live) | tsc/lint/vitest/build; migration 034 policies verified live via psql |
| Cannot add community icon/banner | `icon_url`/`banner_url` columns existed; **no bucket, no policies, no UI** | Migration 034: `community-media` bucket (5 MB, image mimes), 4 storage policies behind `can_manage_community_media(uid)` SECURITY DEFINER helper (SECURITY DEFINER required for storage.objects RLS), moderator-support policy, cleaned-up earlier partial state | `tests/community-media-delete.test.ts`; verified bucket + policies live |
| Messaging invisible | `/messages` fully built in V5 but had no nav entry | Added to UserMenu (desktop) and BottomNav (mobile, replaced duplicate Alerts entry; bell already pinned in header) | UI surfaces; full flow remains authenticated-QA |
| (repro prevention) | — | `tests/community-media-delete.test.ts` guards the `"use server"` export discipline that caused the 54.9% incident | 5/5 passing |

### Existing architecture (kept intact)
- Next.js 16.3 App Router + Turbopack; Supabase Auth (cookie-bound server client) — unchanged.
- Service layer under `src/lib/<domain>/{service,actions}.ts`; admin-client pattern for privileged mutations; RLS is the enforcement layer (V5 negative-test suite exists: `sql/security-negative-tests.sql`).
- Gaming data is **catalog-centric** (migration 022): `games`, `game_reviews`, `game_followers`, `game_clips`. No per-user library or platform-link tables (verified live).
- Test pyramid exists (vitest static-contract + service tests; 8 chromedriver E2E tests are environment-blocked on this machine).

### Known gaps vs. the V6 pillar list (evidence-based)
- Social: no quote posts, post editing, drafts, hashtag pages, link previews, mention autocomplete (mention notifications exist).
- Creator: analytics page exists (V5, real signals); no milestones/badges/subscription architecture.
- Communities: single `member`/moderator capability model; no rules, onboarding, announcements, moderator dashboard.
- Discovery: deterministic trending exists; no Explore hub, no explainable ranking, no search 2.0.
- AI layer: none (honest zero).
- Communication: messaging + read state + realtime (V5); no typing/presence UI, reactions, replies, attachments, calls remain one-to-one WebRTC.
- Progression: no XP/levels/badges/leaderboards.
- Mobile: BottomNav exists; no PWA manifest, push, offline shell.

## 2. Implementation map — phased

Order chosen so each phase lands on verified foundations and the user's stated priorities first.

**V6.1 — Community governance (next)**
1. Community roles (owner/admin/moderator/member) — new `role` column, capability checks server-side, RLS-audited.
2. Community rules (ordered, moderated via 034's helper), announcements (pinned posts in community feed).
3. Moderator dashboard: reports queue + auditable actions (extends existing reports table).

**V6.2 — Social publishing (V6.0 foundations)**
1. Post editing (author-only, edited timestamp) — smallest real gap, high user value.
2. Drafts (owner-scoped table, poll config preserved).
3. Quote posts (relationship to original, never duplicated; deleted-post handling).
4. Hashtags (extraction + indexed hashtag table + pages).
5. Link previews only with an SSRF-safe allowlisted fetcher; otherwise defer.

**V6.3 — Gaming connectors**
1. `platform_links` + `user_games` (platform-agnostic, per the connectors assessment).
2. Steam OpenID link + library import (Steam Web API key as Vercel env var; degrade gracefully when library is private).
3. "Games they play" on profiles; manual add from catalog as universal fallback. Play Store / App Store: NOT feasible — documented, not faked.

**V6.4 — Discovery**
Explore hub; search 2.0 (users/communities/posts/hashtags); explainable ranking (recency × engagement quality × relationship, deterministic); trending hashtags.

**V6.5 — Creator ecosystem**
Creator profile surface; analytics 2.0; milestones/badges backed by real DB conditions; subscription architecture (no payments).

**V6.6 — Communication 3.0**
Typing/presence/read-receipt UX; message reactions, replies, editing, attachments; call improvements (WebRTC multi-device testing still environment-blocked).

**V6.7 — Progression + Mobile**
XP/levels/badges with anti-abuse; leaderboards; PWA manifest + push architecture; offline shell.

## 3. Standing rules for every phase
- Migrations: additive, idempotent, numbered (`docs/database/035+…`), verified live via `run-sql.cmd`, RLS + policies + indexes in the same migration.
- Every bug → regression test. Every feature → static-contract/service tests where applicable.
- Verify before "done": tsc, eslint, vitest, `npm run build`, smoke, then Vercel runtime check via MCP.
- No metric gaming, no fake data, no RLS weakening. Anti-fabrication labels (IMPLEMENTED / TESTED / ENVIRONMENT-BLOCKED / NOT IMPLEMENTED) on every report.
