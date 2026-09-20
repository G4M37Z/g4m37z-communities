# G4M37Z Communities — Gap Register

> Single register of unresolved issues. Never hide a gap. Statuses: OPEN ·
> IN PROGRESS · FIXED · VERIFIED · BLOCKED · DEFERRED · NOT REPRODUCED.
> Historical per-era audits live in `IMPLEMENTATION_GAPS.md` and `ERRORS.md`;
> this file tracks what is open **now**. Newest entries last.

---

## GAP-EMAIL-01 — Email confirmation disabled (launch blocker)

- Area: Authentication
- Severity: **P0 before launch** (deliberate temporary state)
- Description: "Confirm email" is OFF in Supabase Auth to work around the
  signup `429 over_email_send_rate_limit` (ERRORS.md #5).
- Reproduction: sign up with a fresh email → confirmation flow bypassed.
- Root cause: ox-auth email rate limit; cannot be changed via SQL.
- Status: BLOCKED — requires a Supabase **dashboard** action.
- Next action: re-enable "Confirm email" in `authentication → providers →
  email` immediately before launch; remove the seeded-user workaround notes.

## GAP-WEBRTC-01 — Two-peer voice audio remains unheard end-to-end

- Area: Voice / WebRTC
- Severity: P1 (core social feature; single-peer path now proven, pairwise
  audio still unproven)
- Description: Single-peer runtime verified 2026-09-19 on the production
  build + live DB (headless Chromium, autotest2): room join created the
  participant row and flipped presence to busy; Go Live ran getUserMedia +
  RTCPeerConnection and published a PEER_JOIN signal that passed the 045
  `webrtc_signals` RLS (sender must be a participant; row persisted);
  Leave deleted the participant row cleanly (no stale rows) and restored
  presence. What remains blocked: the answer/ICE exchange and mutual audio
  between two endpoints — this environment exposes one audio endpoint.
- Evidence: network log (`POST webrtc_signals → 201`),
  `sql/verify-voice-runtime.sql` output, `sql/seed-voice-room.sql`.
- Status: BLOCKED — environment (single-endpoint). Do not mark PASS without
  the two-device run.
- Next action: two authenticated sessions in one room; verify connect, mutual
  audio, mute, leave/rejoin, stale-peer cleanup, no console errors (per
  AGENT_HANDOFF voice checklist).

## GAP-UI-01 — Bare `text-red` error classes — CLOSED

- Area: UI (error rendering)
- Severity: P3 (cosmetic — no CSS was generated for the bare token)
- Fix: messaging forms in `8a32bf3`; analytics page + CommunityMediaForm in
  `e02968d`. `grep -rn "text-red\b" src/` now returns only `text-red-500`.
- Status: FIXED (gates PASS).

## GAP-SQL-01 — Diagnostic SQL script triage — CLOSED

- Area: Repository hygiene
- Severity: P3
- Fix: 2026-09-19 (`d988d5f`) — kept the 3 reusable scripts
  (`seed-second-user.sql`, `join-rls-policy-audit.sql`, `check-membership.sql`)
  alongside the committed acceptance harnesses; deleted the 31 one-off
  inspection scripts and `inspect-posts-fk.sql` per the AGENT_HANDOFF rule
  that temporary inspection files do not persist.
- Status: FIXED.

## GAP-DIGEST-01/02 — Legacy production digests — RESOLVED (root cause found)

- Area: Post interactions (ERRORS.md #2, #3)
- Description: digests `3702571692` and `943033484@E352` were never
  reproduced under instrumentation. On 2026-09-19 the `@E352` suffix was
  traced to the illegal `export const __postImageTest` object in the
  "use server" `src/lib/posts/actions.ts` — it poisoned the whole actions
  chunk (reposts, votes, reactions, image uploads) at runtime with exactly
  this class of digest. Fixed 2026-09-19 (helpers moved to
  `src/lib/posts/image-validation.ts`); runtime repost re-verified after.
- Status: FIXED (was NOT REPRODUCED). ERRORS.md #3's suspected stale build
  was in fact the actions-bundle defect; #2 may share the same cause —
  re-test after deploy and close if clean.

- Area: Feed / post interactions (ERRORS.md #2, #3)
- Severity: P2
- Description: digests `3702571692` and `943033484@E352` were never
  reproduced under instrumentation; stale-client-build suspicion. Both need a
  hard-refresh re-test by the reporting user; if they recur, capture page +
  action.
- Status: NOT REPRODUCED (awaiting user re-test)

## GAP-RATE-01 — Env-gated rate limits dormant by default

- Area: Abuse hardening
- Severity: P2 (pre-launch decision)
- Description: application-side rate limits (`44d7cde`) only activate when
  env-configured. Nothing currently configures them in production.
- Status: OPEN (decision required)
- Next action: decide before launch: configure limits in prod env vs. rely on
  Supabase-side auth rate limits + dashboard controls; record in DECISIONS.md.

## GAP-VERIFY-01 — Acceptance harnesses are psql-driven, not CI

- Area: Testing
- Severity: P3
- Description: the 045 RPC acceptance tests run via `run-sql` against the
  live DB; they are not wired into CI (live-DB credentials cannot be shared
  with CI). Regression protection = committed, re-runnable scripts +
  TEST_MATRIX entries.
- Status: DEFERRED (by design; revisit if a staging DB becomes available)

---

# Feature requests logged 2026-09-19 (user: "ill attend to them later")

## GAP-POST-01 — First Save/Publish click on a fresh post form occasionally swallowed — OPEN

**ID:** GAP-POST-01
**Area:** Posts (create/edit submit)
**Severity:** P3 (works on retry; no data loss)
**Description:** The first Save/Publish click on a freshly mounted create/edit post form is occasionally swallowed — the action POST returns 200 but no row mutation occurs and the edit form stays open. Reproduced once during the 2026-09-19 image-upload verification (remove-image save needed a second click). The earlier "create-post never submits" report is now believed to be the same hydration-timing race; server logs and DB were clean throughout.
**Reproduction:** Open `/create/post` or a post's edit form, attach an image, click Save/Publish immediately after mount.
**Root cause:** UNKNOWN — suspected React transition event-timing race, not an action bug. Needs instrumentation.
**Status:** FIXED (2026-09-20) — pending live browser re-test
**Root cause:** Pre-hydration submit race. Both forms pass `action={onSubmit}`, so a Save/Publish click that lands before React hydrates can fall through to the native form GET instead of the transition handler (the action POST returns 200 with no mutation).
**Fix:** Added the house hydration gate (a `hydrated` state set via `queueMicrotask` in an effect; submit control `disabled={pending || uploading || !hydrated}`) to `src/app/create/post/CreatePostForm.tsx` and the `EditForm` in `src/app/post/[id]/PostActions.tsx`, mirroring `MessageForm.tsx`.
**Verification:** `npm run check` PASS (tsc 0 errors, eslint 0 errors, 271/271 unit). Live click-timing re-test on the production build still owed.
**Owner/Agent:** agent (2026-09-20)

## GAP-POST-02 — Orphaned post-images object from failed create — OPEN (DEFERRED cleanup)

**ID:** GAP-POST-02
**Area:** Posts storage hygiene
**Severity:** P4 (cosmetic debris, no user impact)
**Description:** One orphaned post-images object (`d1eeb9c0-...007/0a987ab8-...png`, ~26 KB) remains in storage from the interrupted session's failed create-post attempt. Current remove-image and delete-post flows are verified to clean their own objects (0 new orphans).
**Reproduction:** `SELECT name FROM storage.objects WHERE bucket_id='post-images' AND owner='d1eeb9c0-0000-4000-8000-000000000007';`
**Root cause:** Failed create-post during the interrupted session, before cleanup ran.
**Status:** BLOCKED — environment (2026-09-20). A `DELETE FROM storage.objects` migration (`sql/049_purge_orphan_post_image.sql`) was attempted and rejected by Supabase's `storage.protect_delete()`:
`ERROR: Direct deletion from storage tables is not allowed. Use the Storage API instead.`
The guard is gated by the `storage.allow_delete_query` GUC; bypassing it via SQL would only drop the metadata row and leave a dangling S3 object, so no bypass was applied. The attempted migration file was deleted (not committed). Live object is 100 bytes (`d1eeb9c0-...007/0a987ab8-...png`), unreferenced (0 `posts.image_url` matches). This environment has only `DATABASE_URL` provisioned — no service-role key.
**Fix:** Remove via Supabase Dashboard → Storage, or a service-role Storage API `remove()` call.
**Verification:** Re-run `SELECT name FROM storage.objects WHERE bucket_id='post-images' AND owner='d1eeb9c0-0000-4000-8000-000000000007';` → expect 0 rows.
**Owner/Agent:** requires dashboard/service-role access (agent blocked)

## GAP-MSG-UI-01 — Inside-messaging UI polish

- Area: Messaging UI
- Severity: P2
- Description: User reports the conversation view "doesn't look good".
  Current thread is a plain list (`ThreadClient.tsx`) — no day dividers,
  no grouping of consecutive messages from one sender, no delivery states
  beyond ✓/✓✓, minimal empty state.
- Status: FIXED + VERIFIED (2026-09-20) — implemented in `2984c3e`
- Fix: `ThreadClient.tsx` renders day dividers (Today / Yesterday / locale date), groups consecutive same-sender bubbles within 5 minutes (spacer alignment for grouped runs), and has a dedicated empty state. Receipts (046) already drive ✓/✓✓ from the partner's read state.
- Verification: code inspection (`dayLabel`, `showDivider`, `grouped` in `ThreadClient.tsx`) + commit `2984c3e`; `npm run check` PASS.

## GAP-MSG-CALL-01 — Voice + video calls inside the messages UI

- Area: Messaging / WebRTC
- Severity: P2
- Description: User wants 1:1 voice AND video calls initiated from the
  conversation view. Today WebRTC exists only for community voice rooms
  (`webrtc-peer.tsx`, room-scoped signaling); DM threads have no calling
  affordance.
- Status: OPEN (feature work)
- Next action: extend `webrtc_signals` usage to conversation-scoped calls
  (call state machine: ringing → active → ended), reuse the deterministic
  dialer + ICE-queueing from `webrtc-peer.tsx`, video = getUserMedia with
  video track + PiP-style local preview; respect 045 signaling RLS. Two-peer
  audio must be verified after (GAP-WEBRTC-01).

## GAP-MSG-RICH-01 — Stickers, GIFs, media in messages

- Area: Messaging content
- Severity: P2
- Description: User wants stickers/GIF pickers and media attachments in DMs.
  Today messages are text-only (`messages.body text`), with no attachment
  storage path in DMs.
- Status: PARTIAL (2026-09-20) — images, GIFs, and stickers shipped; GIF *picker* deferred
- Shipped: image + GIF attachments (`cfc66ef`); sticker pack — 10 SVGs in `public/stickers/`, `src/lib/messaging/stickers.ts`, picker in `MessageForm.tsx`, renderer in `ThreadClient.tsx` (`h-28 w-28 object-contain`, no bubble), `messages.attachment_type` widened to `"image"|"gif"|"sticker"`. `tests/messaging-stickers.test.ts` 8/8 pass.
- Deferred: GIF *picker* (third-party Tenor/GIPHY API key — decision required).
- Remaining: GIF picker integration; keep attachment uploads RLS-neutral (select follows `messages_select`).

## GAP-MSG-RICH-02 — Sticker attachments are not validated server-side

- Area: Messaging content / abuse
- Severity: P3 (defense-in-depth; UI picker is the only sender today)
- Description: `stickerVerdict` exists in `src/lib/messaging/stickers.ts` but is not wired into `sendMessage` (`src/lib/messaging/service.ts`), so a crafted client could send `attachment_type: "sticker"` with an arbitrary `attachment_url`.
- Status: FIXED (2026-09-20)
- Fix: `sendMessage` now runs a pure `attachmentVerdict` helper (`src/lib/messaging/service.ts`) that enforces `stickerVerdict` when `attachment.type === "sticker"`, rejecting arbitrary URLs, unknown ids, and path traversal before insert. Exported through `__test`.
- Verification: `tests/messaging-service.test.ts` adds 5 cases (known URL accepted; arbitrary URL, unknown id, and `/stickers/../` traversal rejected; image/gif untouched) — PASS; `npm run check` 276/276.

## GAP-BRAND-01 — Logo placement across required sections

- Area: Brand / UI
- Severity: P3
- Description: User wants the G4M37Z wordmark/logo applied consistently in
  the sections that currently lack it (auth pages, mobile nav header,
  empty states, email templates if any, OG images).
- Status: FIXED (2026-09-20) — pending live visual pass
- Fix: added the `Logo` lockup (inline `BrandMark` + `BrandWordmark`) to the auth card headers (`login`, `signup`, `forgot-password`, `reset-password`, replacing the generic lucide badge); the Home tab in `BottomNav.tsx` now renders `BrandMark`; `BrandMark` added to `not-found.tsx` and `error.tsx`. `loading.tsx` and the OG/Twitter image (`/og.png` in `layout.tsx`) were already branded.
- Verification: `npm run check` PASS. Live visual pass owed.

## GAP-GAMES-01 — Seeded games should show official cover art

- Area: Games / Discovery
- Severity: P2
- Description: Seeded games render as generic cards; user wants original
  official covers (IGDB/Steam grid images or locally hosted art).
- Status: FIXED + VERIFIED (2026-09-20)
- Fix: schema column is `cover_url` (not `cover_image_url`). `docs/database/048_game_covers.sql` seeds official CDN art for all 8 games — Steam `header.jpg` (`cdn.cloudflare.steamstatic.com`) and IGDB `t_cover_big` (`images.igdb.com`). Rendering via `src/lib/games/cover-url.ts` (`isOfficialCoverUrl` allowlist, https-only) + `src/components/games/GameCover.tsx` (initials fallback), wired into `discover` and `game/[slug]`.
- Verification: re-running 048 is idempotent (8× `UPDATE 0`); live DB shows all 8 rows `has_cover=t`; `tests/game-cover-url.test.ts` 5/5 pass.

## GAP-PLATFORM-01 — Platform linkages need official platform logos

- Area: Platform links / Profiles
- Severity: P2
- Description: Platform link entries (Steam, PlayStation, Xbox, etc.) render
  text-only; user wants each platform's official logo.
- Status: FIXED + VERIFIED (2026-09-20)
- Fix: rewrote `src/components/platform-icon.tsx` with official marks only — Steam/PlayStation/Google Play from Simple Icons (CC0), Xbox from `simple-icons@12.4.0` (removed in v13+; brand hex `#107C10`), Apple Game Center = Apple's official mark (four overlapping circles, Wikimedia source `developer.apple.com/game-center`). Rendered monochrome via `currentColor` (per docs/BRAND.md "no hardcoded hex in components"); per-platform `viewBox`; `Record<Platform, …>` map is a compile-time coverage guard. Wired into the profile page and the platform-links settings form, text label kept for accessibility.
- Verification: `npx tsc --noEmit` exit 0; eslint on changed files exit 0; `npm run check` PASS.
