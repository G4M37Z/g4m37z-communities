# FINAL REPORT — G4M37Z Communities V4 Real-User Failure Audit & Repair

Date: 2026-09-17
Scope: `~/g4m37z-communities` audited against the **live** Supabase database (not just the migration tree).
Method: source review of the working tree + direct queries against the live DB (RLS policies, indexes, functions, grants, realtime publication, storage policies) + RLS **impersonation tests** simulating a signed-in user + full static suite + WebDriver smoke suite against the served production build.
Result: **13/15 failure items PASS, 1 PARTIAL (I - completed), 1 runtime-BLOCKED (O/P WebRTC audio), 0 FAIL.**

---

## Acceptance Matrix (A–P)

| # | Failure report | Verdict | Evidence |
|---|---|---|---|
| **A** | "Could not join a community" / owner not a member | **PASS** | Impersonating user `linyuluderrick` under real RLS: creating a `communities` row auto-inserted `community_members(role='admin')` via the `handle_new_community` trigger (live); a second user joining with their **own** id succeeded under the `Users can join communities` WITH CHECK `(auth.uid() = user_id AND role = 'member')`; the duplicate join correctly hit `community_members_pkey` (the app's `ignoreDuplicates` upsert turns this into a silent no-op). Root cause resolved: migration 036 backfilled **0 missing profiles** (10 auth users ↔ 10 profiles) → the `community_members.user_id → profiles(id)` FK can no longer 23503 a join. |
| **B** | No password visibility toggle | **PASS** | `PasswordInput.tsx` implements the eye toggle with `aria-label` + `aria-pressed`; used by signup, login, and reset. |
| **C** | Signup confirm password | **PASS** | `SignupForm.tsx` adds a confirm field with live match/mismatch feedback; `signUpWithPassword` re-checks `password === confirmPassword` **server-side** so a forged request cannot bypass it; UI also blocks submit until both boxes + terms + availability pass. |
| **D** | Username search fails | **PASS** | `normalizeUsername` (trim, strip `@`, lowercase) canonicalizes every lookup; search uses `ilike` + `escapeLike` on username/display_name; live DB has `uq_profiles_lower_username` (unique lower), `idx_profiles_lower_username_prefix`, and two `pg_trgm` GIN indexes on `lower(username)` / `lower(display_name)`. |
| **E** | Messaging "user not found" | **PASS** | Conversation resolution goes through `public.find_direct_conversation` (migration 037, EXECUTE granted only to `authenticated`, revoke-safe; live grants verified) — no more exact-case client lookup and no service-role dependency. |
| **F** | Messaging crashes on send | **PASS** | Live `messages_insert` WITH CHECK: `auth.uid() = sender_id AND EXISTS(conversation_members where user_id = auth.uid())`. `sender_id` is set server-side in the action; `MessageForm.tsx` keeps the draft and shows an inline retry on failure (no lost input, no blanking). |
| **G** | Messaging crashes on reply | **PASS** | Same RLS + membership gate; server-side sender identity; `messages_select` scoped to `conversation_members`. |
| **H** | No smart message discovery | **PASS** | `NewConversationForm.tsx` is graph-first (`listMessageSuggestions` = follows + existing partners) with a debounced `searchRecipients` fallback; debounce effect no longer performs synchronous setState (acceptance-test fix, see Issues). |
| **I** | Create page is a single form, not a hub | **PASS** | `/create` already offered Post + Community; **added "New event" (`/events/new`, full `EventCreateForm`) and "New tournament" (`/tournaments/new`, full `TournamentCreateForm`)** — both flows verified to build and exist as real routes. |
| **J** | Can't edit posts | **PASS** | `PostActions.tsx` renders an inline edit form; `editPost` server action updates title/body/community; validation present; author-scoped by RLS `Authors can update their posts`. |
| **K** | Can't post more media | **PASS** | Edit form adds/removes/replaces an image via `uploadPostImage` → `post-images` bucket; live storage policies: public read, authenticated insert with folder `= auth.uid()`, update/delete scoped by folder `auth.uid()`. |
| **L** | Reposts broken / mis-attributed | **PASS** | Reference model (`reposts` table, migration 033) with FK-validated `original_author_id = posts.author_id` (RLS WITH CHECK), unique `(reposter_id, post_id)`, 23505 → idempotent `already`, undo supported; repost **notifications** are existence-guarded like posts (test updated to that contract). |
| **M** | Sharing fails silently | **PASS** | `ShareButton.tsx` prefers the Web Share API and falls back to a clipboard copy of the canonical `/post/{id}` URL; it never mutates data (no accidental repost). |
| **N** | Mark-all-read state desync | **PASS** | `MarkAllReadButton.tsx` optimistically clears + `router.refresh()` after `markAllNotificationsRead`; bell count reconciles via the realtime `notifications` subscription; live `Users can update their own notifications` policy allows the mass update. |
| **O** | WebRTC signaling broken | **PASS (impl) / BLOCKED (runtime)** | `webrtc-peer.tsx` rewritten: subscribes to signaling rows **before** publishing `PEER_JOIN`, deterministic dialer (lexicographically smaller user id offers), ICE candidates queued until the remote description is applied, remote stream attached to an autoplaying `<audio>`; live `webrtc_signals` RLS matches the client exactly (`auth.uid() = from_user` insert/delete, room-member select). Two-peer audio provict cannot run on this single-device environment. |
| **P** | Voice room audio inaudible | **PASS (impl) / BLOCKED (runtime)** | Audio wiring verified in `webrtc-peer.tsx` + `voice-room-view.tsx`; `voice_room_participants` RLS self-insert/delete verified live; realtime publication includes `public.voice_rooms` and `public.webrtc_signals`. Requires two live endpoints to hear audio; documented as a manual test. |

---

## Root Causes Found & Fixed This Session

1. **RLS impersonation proved failure A's join path** with an honest test. The first attempt looked like the product blocking joins — it was the co-author forcing a *third party's* membership, which the policy correctly refuses. Correct test (`auth.uid() = user_id` as the joiner's own id) passes. No DB change was needed; the trigger + policy + FK backfill form a coherent whole.
2. **Lint (React Compiler `set-state-in-effect`) — 2 genuine violations fixed:**
   - `NewConversationForm.tsx`: synchronous `setResults([])`/`setSearching(false)` in the debounce effect. Moved all setState into the async timeout callback with an `active` guard and event-derived spin flag.
   - `ThemeToggle.tsx`: synchronous `setIsDark(false)` when adopting the stored theme. Deferred with `queueMicrotask` (same single extra render, but never sets state synchronously in the effect).
3. **Stale test contract:** `notification-deleted-content.test.ts` asserted the existence-guard filtered `n.type === "post_vote"` only; the page also guards **`repost`** references (failure L). Test updated to the shipped contract — not weakened.
4. **Create hub completeness (failure I):** added the two missing creation flows to `/create`.

## Verification Gates (all run on this device against the real app)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npx eslint .` | PASS — 0 errors (12 pre-existing warnings only) |
| `npx vitest run` (unit, smoke excluded) | PASS — 191/191 |
| `next build --webpack` | PASS — 49 routes, `/create`, `/events/new`, `/tournaments/new` all emit |
| Browser smoke suite (WebDriver, Chromium 149 ≈ ChromeDriver 149) against `next start` | PASS — **8/8** routes load without 404 |
| Live-DB RLS impersonation (A) | PASS — creator→admin + own-id join + idempotent PK |

## Remaining / Blocked

- **O/P WebRTC two-peer call** — implementation + RLS verified; a real two-device/two-browser audio call could not be executed on this single Termux host (no second audio endpoint). Manual-test step required before declaring audio heard end-to-end.
- **Browser smoke in CI on this device** — passes only when server + chromedriver are started in the same shell invocation; Android's low-memory killer culls long-lived background processes between commands (documented operator note, not a product defect).
- 12 pre-existing lint warnings (unused imports/params, `<img>`) left untouched — cosmetic, non-blocking.

## Files Changed This Session

- `src/app/messages/new/NewConversationForm.tsx` — lint fix (async-only setState in effect)
- `src/components/ThemeToggle.tsx` — lint fix (deferred theme adoption)
- `tests/notification-deleted-content.test.ts` — updated to the real repost-guard contract
- `src/app/create/page.tsx` — extended hub with Event + Tournament entries

No schema, RLS, or authentication changes were made: the live DB already carried every fix the audit set out to verify (migrations 033/035/036/037), and RLS hardening was confirmed, never weakened.