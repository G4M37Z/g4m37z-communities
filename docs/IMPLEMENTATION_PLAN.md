# G4M37Z Communities — Implementation Plan

> Companion to `docs/IMPLEMENTATION_MATRIX.md` + `docs/IMPLEMENTATION_GAPS.md`.
> Audit 2026-09-16. This plan organizes remaining work; it implements NOTHING.

## PHASE A — Broken / security / production blockers (do first)

| Item | Gap | Evidence | Dependencies | Files | DB | Tests | Verification |
|---|---|---|---|---|---|---|---|
| Deleted-post notification hygiene | GAP-01, GAP-04 | 2 orphan rows live; 404 on tap | none | `notifications/page.tsx`, `posts/actions.ts`, triggers | migration 035: DELETE triggers on `posts`/`comments` cleaning `notifications` | regression: delete post → notifications gone; orphan-proof href | click-through a post-deletion notification; no 404 |
| Pre-launch hardening set | GAP-03 | PROJECT_STATE/ROADMAP | dashboard access for email toggle | Upstash/KV integration, MIME checks, CSP | none (rate-limit KV external) | security suite | load/abuse test, security pass |
| Pre-launch dashboard toggles | ERRORS §5 | email confirmation currently disabled-for-testing | Supabase dashboard | — | — | — | signup flow with confirmation ON |

## PHASE B — Incomplete existing features

| Item | Gap | Notes |
|---|---|---|
| Tap-target a11y pass | GAP-12 | padding-only changes to header/footer controls; no redesign |
| Moderator dashboard | GAP-08 (subset), AA-1 | V6.1 first slice: reports queue + auditable actions |
| Community roles/rules/announcements | D-1 | V6.1 remainder, capability-based server-side |
| OG social card | GAP-13 | one designed 1200×630 asset |

## PHASE C — Missing required V5/V6 functionality

| Item | Gap | Order |
|---|---|---|
| **Platform gaming connectors** | GAP-06 | 1. migration 036 `platform_links`+`user_games` (RLS+indexes) → 2. Steam OpenID route + Web API import (env key; graceful degradation when library private) → 3. profile "games they play" → 4. manual-add fallback. Play Store/App Store: NOT feasible — state it, never fake |
| Social publishing (edit, drafts, quotes, hashtags) | GAP-08 | per V6.2 order in plan doc |
| Search 2.0 / Explore | GAP-08 | V6.4 |
| Realtime coverage (reputation/achievements publish, live LFG/events) | GAP-07 | V6.6 adjacency |

## PHASE D — V6+ product expansion
- Creator ecosystem depth (milestones/badges backed by real conditions), XP/levels/leaderboards with anti-abuse, AI layer (authorized-retrieval only), PWA/push/offline shell — per `docs/V6_AUDIT_AND_PLAN.md` V6.5–V6.7.

## PHASE E — Future/deferred
- Creator subscriptions architecture (no payments), itch.io connector, Xbox/PSN revisits, benchmark environment for P1.4, bracket progression.

## Standing rules (unchanged)
Additive idempotent migrations verified live via `run-sql.cmd`; RLS + indexes in the same migration; every bug gets a regression test; verify before "done" (tsc, eslint, vitest, build, smoke, Vercel MCP); no RLS weakening; no fake data; anti-fabrication labels on every report.
