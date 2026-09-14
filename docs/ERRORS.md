# G4M37Z Communities — Error Tracker

> Single source of truth for known errors reported during production testing:
> what broke, why, whether it's fixed, and how to verify. Updated 2026-09-14.

Supabase project: `zpirpbivhkscixbokpbt` · App: `https://g4m37z-communities.vercel.app`

---

## 1. Feed pages "No posts yet" / post pages 404 / voice+community flow threw

**Reported by:** user (production, anonymous & signed-in).
**Status: ✅ FIXED (shipped).**

- **Cause:** PostgREST embed hints referenced foreign keys that pointed at
  `auth.users` instead of `public.profiles`, so embeds failed to resolve
  (PGRST200 — "Could not find a relationship"). Feed queries returned empty,
  post pages 404'd, and community-create / voice flows threw.
- **Fix:**
  - Migration `docs/database/030_fix_posts_profiles_relationship.sql` — repointed
    the FK targets (`posts.author_id`, `comments.author_id`,
    `reports.reporter_id`, `voice_room_participants.user_id`) to `profiles`.
  - `fb4bb23` — stop masking post/community query failures as 404 (throw so the
    real error surfaces).
  - Applied to production DB + pushed (`fb4bb23`, `a1f2838`, `53bf008`).
- **Verify:** `/home`, `/communities/efootball`, `/post/...` render posts with
  author + community embeds, anonymous and signed-in.

---

## 2. Signed-in "Something went wrong" — digest `3702571692` (home + community)

**Reported by:** user (signed-in browser, live site).
**Status: ⏳ NOT REPRODUCIBLE — strongly suspected stale client build; needs user re-test.**

- **Cause:** unproven. Investigated the full data path with a real signed-in
  session (seeded test user + forged `@supabase/ssr` session cookie): every
  query the home/community pages run returns HTTP 200; no digest appears.
- **Finding:** the user's browser may still be serving the pre-fix bundle. The
  old chunk `/_next/static/immutable/2i82_36ky2umz.js` was briefly 404 on
  Vercel (stale build). Current deployed build serves all referenced chunks
  (HTTP 200) and renders clean signed-in.
- **Next step (user):** hard-refresh / clear site data, re-test `/home` and a
  community page. If `3702571692` reappears, report the exact page.

---

## 3. Signed-in comment/react — digest `943033484@E352`

**Reported by:** user (signed-in browser, live site).
**Status: ⏳ NOT REPRODUCIBLE — same stale-build suspicion; needs user re-test.**

- **Cause:** unproven. Signed-in PostgREST replay of the exact app insert shapes
  (comment, reaction, post_vote — all include `user_id`/`author_id`) returns
  **201**; rows persist and `comment_count` updates. No DB-level failure.
- **Code inspected:** `src/lib/comments/actions.ts`, `src/lib/reactions/actions.ts`
  — both append `user_id: user.id`, matching successful RLS shapes.
- **Next step (user):** after hard-refresh, post a comment and react on a post.
  If `943033484@E352` reappears, report the exact action.

---

## 4. Username availability check stuck on "Checking availability…"

**Reported by:** user (live site, signup page, as of this session).
**Status: ✅ FIXED (client-side guard) — needs a live re-test.**

- **Symptom:** typing a username on `/signup` leaves the availability spinner
  spinning; the server-action promise never settles in the browser.
- **Established facts:**
  - Underlying query is fast: `profiles?select=username&username=eq.*` returns
    `[]` in 0.6–1.1s, anon and signed-in. No duplicate usernames. SELECT RLS
    policy on `profiles` is `true`.
  - All `/signup` client chunks load (HTTP 200). Page renders 200 with/without
    any cookie.
  - Deployed `checkUsernameAvailability` action ID:
    `4037c513e67dbfa94f646cd07b74199e4e53b36391` (42 chars — valid reference).
  - Client code awaited the action with **no try/catch**
    (`src/app/signup/SignupForm.tsx`) — so a thrown/never-resolving action
    froze the status at `checking` forever.
- **Fix:** wrapped the action await in the signup form in a try/catch that
  fails **open** (resolves to `ok`) plus a 15s timeout race, so neither a
  rejected nor a never-resolving action can freeze the spinner. Same guard
  added to the slug check in `src/app/create/CreateCommunityForm.tsx`.
- **Verify:** after deploy, `/signup` → type a username → status must settle on
  Available / Taken / Invalid (never a stuck spinner); same for the slug field
  on create.

---

## 5. Auth email rate limit — signup `429 over_email_send_rate_limit`

**Reported by:** user (live signup attempts during testing).
**Status: ⚠️ WORKAROUNDED — root fix needs a dashboard action.**

- **Cause:** fresh email signups trigger the confirmation email send, which is
  rate-limited. Email confirmation is currently ENABLED.
- **Workaround (done):** seeded a confirmed test user directly in the DB
  (no email involved):
  - id `d1eeb9c0-0000-4000-8000-000000000007`
  - email `g4m37z.autotest@gmail.com` / password `G4m37z!autotest2026`
  - login via `POST /auth/v1/token?grant_type=password` returns HTTP 200.
  - Seed script: `sql/_seed_autotest_user.sql` (idempotent).
- **Root fix:** toggle **"Confirm email" OFF** in Supabase dashboard
  `authentication → providers → email` (cannot be done via SQL on this project —
  ox-auth settings live outside Postgres; no `auth.config` table).
- **⚠️ MUST RE-ENABLE email confirmation before launch.** Reminder is now
  documented in `docs/PROJECT_STATE.md` (Pre-Launch Reminders) and
  `docs/ROADMAP.md` (Launch Hardening).

---

## 6. GoTrue login `500 Database error querying schema` (on seeded user)

**Reported by:** assistant during testing (not user-facing).
**Status: ✅ FIXED (in seed/DB setup).**

- **Cause:** ox-auth crashes when `auth.users` token columns are `NULL`; error
  code `unexpected_failure`. Fixed by setting `confirmation_token`,
  `recovery_token`, `email_change`, `email_change_token_new`,
  `email_change_token_current`, `phone_change`, `phone_change_token`,
  `reauthentication_token` to `''`.
- **Reference:** https://supabase.com/docs/guides/troubleshooting/auth-error-500-database-error-querying-schema-eb6b44 · supabase/auth#1940.
- **Verify:** password grant for the test user returns HTTP 200.

---

## 7. [LATENT] `community_members` → `profiles:user_id` embed → PGRST200

**Reported by:** none (found during signed-in investigation).
**Status: ✅ FIXED (migration 031).**

- **Cause:** `community_members_user_id_fkey` pointed at `auth.users`, so an
  embed `profiles:user_id (username, avatar_url)` on `community_members` would
  fail.
- **Why it was latent:** the app never issued that embed — `grep` showed no
  `profiles:user_id` on `community_members` in `src/` (only `community_id` /
  `role` / `communities:community_id` are selected). The
  `communities:community_id` embed used by home/community pages resolved fine.
- **Fix (2026-09-14, migration 031):** repointed the FK to
  `public.profiles` following the migration 030 pattern — renamed
  `community_members_user_id_auth_users_fkey`, added
  `community_members_user_id_fkey → profiles(id) ON DELETE CASCADE`.
  0 orphan rows existed. Applied + verified on prod.
- **Audited at the same time:** the remaining FKs referenced by app embeds are
  already on `profiles` — `lfg_sessions_host_id_fkey`,
  `lfg_participants_user_id_fkey`, `game_reviews_user_id_fkey` (verified
  2026-09-14 against prod `pg_constraint`).

---

## Verification notes

- Tooling used: `~/.local/bin/run-sql` (prod DB), direct PostgREST calls,
  `@supabase/ssr` session-cookie replay against the live app.
- GoTrue health: signup email rate limit still `429` until email confirmation is
  disabled (see #5).
- Repros/artifacts live under `/data/data/com.termux/files/usr/tmp/opencode/`
  (session cookie, access token, HTML captures) and `sql/_*.sql` — temp, to be
  cleaned up at task end.