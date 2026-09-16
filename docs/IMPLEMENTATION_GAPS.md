# G4M37Z Communities — Implementation Gap Register

> Audit 2026-09-16. Evidence-based; severity P0 (security/data-loss/production blocker) → P3 (polish/future).
> This register does NOT implement anything — it records.

## 1. Broken existing functionality

### GAP-01 · Deleted-post notifications 404 on tap — **FIXED 2026-09-16** (was P1)
- **Fix implemented:** migration `035_notification_deleted_content_cleanup.sql` (one-time orphan purge — the 2 audit-confirmed rows deleted; `BEFORE DELETE` triggers `trg_cleanup_notifications_post` / `trg_cleanup_notifications_comment` with SECURITY DEFINER `cleanup_notifications_for_deleted_content()`) + existence-guarded `getNotificationHref` (`validPostIds`/`validEventIds` sets; stale references render as plain text instead of a 404 link).
- **Files changed:** `docs/database/035_notification_deleted_content_cleanup.sql` (new), `src/app/notifications/page.tsx`, `tests/notification-deleted-content.test.ts` (new, 16 tests).
- **Verification:** migration applied live (`DELETE 2`, triggers verified in pg_trigger, `prosecdef = t`); transactional lifecycle test on live DB (insert post+notification → delete post → notification count 0 → ROLLBACK, zero residue); orphans now 0; targeted tests 16/16; tsc 0; full suite 177/185 (8 = documented browser ECONNREFUSED environment class); build PASS.
- **Remaining limitation:** the href guard is a read-time defense only for the historical window between a deletion and any pre-trigger notifications created by non-post/comment writers (none exist today); events cleanup is href-guarded but not trigger-covered (event deletions keep their notifications as plain text — acceptable, no 404 path).
- **Problem:** deleting a post leaves its notifications; tapping one navigates to `/post/{id}` → "We couldn't find that page".
- **Evidence:** user report; live query today: `orphan_post_notifications = 2` (notifications whose `reference_id` post no longer exists); `getNotificationHref` (`src/app/notifications/page.tsx`) builds `/post/${reference_id}` for `post_vote`, `comment_on_post`, etc.
- **Files:** `src/app/notifications/page.tsx`, `src/lib/posts/actions.ts` (deletePost), trigger creators in `docs/database/027_v4_notification_triggers.sql`.
- **Recommended order:** FIRST of Phase A. Smallest correct fix has two layers: (1) UI guard — `getNotificationHref` must resolve target existence (posts/comments fetched server-side already; drop the link when the target row is gone and render plain text "deleted content"); (2) data hygiene — ON DELETE CASCADE-like cleanup: trigger on `posts` DELETE removing `notifications` rows referencing it (and comments likewise). Both are additive migration 035 + small TSX change + regression test.

### GAP-02 · NotificationBell hydration mismatch — **FIXED in this audit** (`03b2d77`)
- SSR returned null, client rendered `<a>` → guaranteed mismatch on every authenticated load. Recorded here because it explains the previously-documented "authenticated-only parentNode exception". No action remaining.

## 2. Security issues
### GAP-03 · Launch-hardening set missing — **P1 pre-launch** (tracked, not new)
- Rate limiting (P1.1), CAPTCHA (P1.2), upload MIME validation (P1.5), telemetry/anomaly (P2), CSP/MFA/rotation/WAF (P3). All documented in `docs/PROJECT_STATE.md` + `docs/ROADMAP.md`; unchanged by this audit. RLS posture verified sound today (59/59 tables, 175 policies).

## 3. Data-integrity issues
### GAP-04 · Notification rows lack referential integrity — **FIXED 2026-09-16** (was P1, root of GAP-01)
- Fixed by the same migration 035 trigger-based hygiene (see GAP-01). `reference_id` remains polymorphic by design; deletion hygiene is now database-enforced for posts and comments (the two types that produce content URLs via `/post/{id}`).
- `notifications.reference_id` is a bare uuid; no FK, no cleanup on content deletion. Migration 035 should add cleanup triggers (FK to heterogeneous targets isn't possible; trigger-based hygiene is the correct pattern).

### GAP-05 · Capacity TOCTOU races (LFG + Events) — **P2** (long-documented)
- count-then-insert without advisory lock. Fix documented (`try_rsvp_session`/`try_rsvp_event` RPCs). Not new.

## 4. Missing backend logic
### GAP-06 · Platform gaming-profile import — **P2** (user-reported "never implemented" — correct)
- **Evidence:** `platform_links`/`user_games` absent from live DB (verified today); V4 `service-v4.ts` is self-declared fields only; `docs/PLATFORM_CONNECTORS_ASSESSMENT.md` verdicts: Steam feasible (OpenID + Web API), Play Store / App Store **not technically possible** — must not be faked.
- **Recommended order:** Phase C. Migration 036 (`platform_links`, `user_games`, RLS, indexes) → Steam OpenID server route + import → profile "games they play" section → manual add from catalog as universal fallback. Explicitly label Play/App Store unsupported.

### GAP-07 · Realtime coverage gaps — **P2**
- Reputation/achievements events unpublished; LFG/events/tournaments render statically. Documented V2 debt; unchanged.

## 5. Missing frontend functionality
### GAP-08 · V6 product surface not built — **P2/P3** (planned, per V6 plan doc)
- No quote posts, post editing, drafts, hashtag pages, link previews, Explore hub, search 2.0, community governance UI, moderator dashboard, XP/levels/leaderboards, AI layer, PWA manifest/push/offline shell. All match `docs/V6_AUDIT_AND_PLAN.md` phases; this audit found no drift between that doc and reality.

## 6. Missing database functionality
### GAP-09 · Bracket progression — **P3** (documented; no `next_match_id`)
## 7. Missing realtime functionality
- Covered by GAP-07.

## 8. Missing tests
### GAP-10 · Browser/E2E suite environment-blocked — **P2**
- 8 `tests/browser/smoke.spec.ts` failures = `ECONNREFUSED` (require app on expected port + ChromeDriver). Not application failures. Mobile smoke was performed this audit via headless Chrome CDP at 390×844 instead.

## 9. Unverified functionality
### GAP-11 · IMPLEMENTED — UNVERIFIED set — **P2**
- Tournaments (tests green, no runtime run), WebRTC physical transport (multi-device BLOCKED), creator-analytics metric depth (no impressions collected — must stay honestly labeled).

## 10. UX/accessibility issues
### GAP-12 · Five header/footer tap targets below 44px — **P3**
- Measured this audit at 390×844: logo link (32h), theme toggle (34×34), Sign in (30h), Sign up (34h), "Browse all →" (15h). BottomNav targets all pass. Smallest fix: increase hit area (padding/`min-h`) without visual redesign.
### GAP-13 · OG social card is an icon — **P3**
- `og:image` points at 677×369 icon; dimensions now accurate, but a designed 1200×630 card would improve link sharing.

## 11. Performance issues
### GAP-14 · Offset pagination + no benchmark environment — **P2/P3**
- Long-documented; P1.4 benchmark remains environment-blocked.

## 12. Documentation drift (fixed by this audit)
### GAP-15 · PROJECT_STATE.md stale — **P2** (fixed in this audit's sync)
- Last verified HEAD was `a1f2838` (2026-09-14); V5 completion (032/033), 0cfd728 V6 blockers, a9785d7 production-500 fix, 935fa44/7e2e6a4/03b2d77 polish+fixes all post-dated it. Updated (see PROJECT_STATE.md).

## 13. Planned but not implemented product features
- All V6 phases V6.1–V6.7 per plan doc (GAP-08). Also: platform connectors V6.3 (GAP-06).

## 14. Deferred/future features
- Creator subscriptions architecture (no payments), itch.io connector, Xbox/PSN (policy-infeasible today).

## Severity summary
- **P0:** none open.
- **P1:** GAP-03 pre-launch set (GAP-01 + GAP-04 fixed 2026-09-16).
- **P2:** GAP-05, GAP-06, GAP-07, GAP-08, GAP-10, GAP-11, GAP-14, GAP-15 (fixed).
- **P3:** GAP-09, GAP-12, GAP-13, deferred list.
