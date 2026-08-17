# G4M37Z Communities — Deployment Guide

**Status:** v0.1.0 — production-grade community platform foundation.

---

## Live deployment

| | |
|---|---|
| **Production URL** | https://g4m37z-communities.vercel.app |
| **Repo** | https://github.com/G4M37Z/g4m37z-communities |
| **Stack** | Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase (Postgres + Auth + Realtime + Storage) |
| **Hosting** | Vercel (auto-deploy on push to `main`) |
| **Supabase project** | `eimivtfqwfvislxxhnac` |

---

## Environment variables

These are set per environment. **Never commit `.env.local` to git.**

| Variable | Scope | Where to find it |
|----------|-------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase Dashboard → Project Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Supabase Dashboard → Project Settings → API → `service_role` |
| `NEXT_PUBLIC_SITE_URL` | public | The deployed site URL (e.g. `https://g4m37z-communities.vercel.app`) |

**Set these in:** Vercel Dashboard → Project → Settings → Environment Variables.

---

## Database migrations

Schema is managed via `docs/database/` SQL files. **Run in order in Supabase SQL Editor:**

| Order | File | Purpose |
|-------|------|---------|
| 1 | `005_full_sync.sql` | Full schema sync — profiles, communities, members, posts, votes, comments, storage bucket |
| 2 | `006_m7_m8_additions.sql` | Additive — notifications, reports, admin RPCs, notification triggers, realtime publication |

Each file is **idempotent** — safe to re-run. DO blocks with EXISTS guards prevent constraint conflicts.

**The service-role key CANNOT run DDL** like `CREATE TABLE`. Schema changes must be pasted into Supabase SQL Editor manually.

---

## Vercel deployment

Vercel auto-deploys on every push to `main`.

**Manual redeploy:**
```bash
# Empty commit to trigger redeploy
git commit --allow-empty -m "redeploy"
git push origin main
```

**Build settings** (auto-detected from `vercel.json`):
- Framework: Next.js
- Build command: `next build`
- Output directory: `.next`
- Region: `iad1` (US East)

---

## Smoke test — manual end-to-end journey

After every deploy, verify this user journey works in production:

### New user flow
- [ ] Visit `/` — landing page loads, hero visible
- [ ] Click "Create your account"
- [ ] Sign up with email + password + username + display name
- [ ] Receive confirmation email; click link → lands on `/auth/callback?next=...`
- [ ] Redirected to `/` (or wherever `next` points)
- [ ] Profile auto-created (visible by going to `/profile/<my-username>`)

### Browse & join
- [ ] Visit `/communities` — list shows existing communities (or empty state)
- [ ] Click a community → `/communities/<slug>` loads with banner + posts
- [ ] Click "Join community" → membership created, button toggles to "Leave"

### Post & engage
- [ ] Visit `/create/post?community=<slug>` — form loads with community preselected
- [ ] Submit a post → redirected to `/post/<id>` with new content
- [ ] Comment on the post → comment appears
- [ ] Reply to a comment → nested reply appears
- [ ] Upvote the post → score increments, notification fires for author

### Notifications
- [ ] Bell icon (top-right) shows unread count
- [ ] Click bell → `/notifications` shows recent activity
- [ ] Click "Mark all as read" → count drops to 0

### Moderation
- [ ] Click "Report" on a post → modal opens, submit feedback
- [ ] Sign in as admin (`/admin` is gated to admins/moderators)
- [ ] Verify report appears in `/admin/reports` queue
- [ ] Click "Resolve" → status updates, reporter gets notification

### Search & profile
- [ ] `/search?q=<term>` returns matching communities/posts/users
- [ ] Empty search → friendly empty state
- [ ] Visit another user's profile → shows bio + posts + communities

### Auth boundaries
- [ ] Sign out — protected routes redirect to `/login?next=...`
- [ ] Try `/admin` as a regular user → redirected away with error
- [ ] Try editing someone else's post → "not authorized" error

### Mobile layout
- [ ] Resize to 375px wide → no horizontal scroll
- [ ] Header collapses cleanly, nav remains accessible
- [ ] Cards stack into single column

### Build & lint
- [ ] `npm run build` exits 0 with all 21 routes
- [ ] `npm run lint` exits 0 with no errors
- [ ] TypeScript `tsc --noEmit` exits 0

---

## Production checklist

- [x] `.env.local` excluded from git (`.gitignore`)
- [x] `.env.example` documents required variables
- [x] `vercel.json` sets build command and output directory
- [x] Supabase Auth redirect URLs configured (see below)
- [ ] Custom domain (optional, post-v0.1)

### Supabase Auth → URL Configuration

**Required in:** Supabase Dashboard → Authentication → URL Configuration

| Setting | Value |
|---------|-------|
| Site URL | `https://g4m37z-communities.vercel.app` |
| Additional Redirect URLs | `https://g4m37z-communities.vercel.app/auth/callback` |
| | `http://localhost:3000/auth/callback` (for local dev) |

### Email templates (Supabase → Auth → Email Templates)

Customize the **Confirm signup** template to match the brand:
- Subject: "Welcome to G4M37Z Communities — confirm your email"
- Body: Use `{{ .ConfirmationURL }}` with copy that mentions gaming and joining communities.

---

## Rollback

Revert to a prior commit:
```bash
git revert <bad-commit-sha>
git push origin main
```

Vercel rebuilds and redeploys the reverted code. Database changes are NOT reverted by Vercel — those would need a separate migration.

---

## Monitoring

**Add before public launch:**
- [ ] Vercel Analytics (free tier available)
- [ ] Sentry or equivalent for error tracking
- [ ] Supabase Dashboard → Logs → Postgres for DB slow-query alerts
- [ ] Uptime monitoring (e.g. UptimeRobot for `/healthz` endpoint if added)

---

## Project structure

```
g4m37z-communities/
├── docs/database/            — SQL migrations, run in Supabase SQL Editor
├── public/                   — Static assets (icon.svg, favicon)
├── src/
│   ├── app/                  — Next.js App Router
│   │   ├── admin/            — Admin dashboard (admin-only layout)
│   │   ├── api/              — Route handlers
│   │   ├── auth/callback/    — OAuth/email-callback handler
│   │   ├── communities/      — Browse + single community view
│   │   ├── create/           — Create community / post forms
│   │   ├── home/             — Authenticated home feed
│   │   ├── notifications/    — In-app notification feed
│   │   ├── post/[id]/        — Single post + threaded comments
│   │   ├── profile/[username]/ — Public user profile
│   │   ├── search/           — Federated search
│   │   ├── settings/         — Profile editing
│   │   ├── admin/(admin)/users/ — User management
│   │   └── (login, signup, etc.)
│   ├── components/           — Reusable client/server components
│   │   ├── comments/         — Comment tree + form
│   │   ├── post/             — PostCard
│   │   ├── voting/           — PostVoteControl, CommentVoteControl
│   │   ├── EmptyState.tsx    — Standardized empty UI
│   │   ├── NotificationBell.tsx
│   │   ├── ReportButton.tsx
│   │   └── (Header, Footer, UserMenu, etc.)
│   ├── lib/                  — Server-side helpers
│   │   ├── comments/         — Comment queries + actions
│   │   ├── communities/      — Community queries + actions
│   │   ├── notifications/    — Notification queries + actions
│   │   ├── posts/            — Post queries + actions
│   │   ├── reports/          — Report queries + actions
│   │   ├── search/           — Search queries
│   │   └── supabase/         — Client, server, admin, auth actions
│   └── types/database.ts     — TypeScript shapes mirroring Postgres schema
├── .env.example              — Required env vars (safe to commit)
├── vercel.json               — Vercel deployment config
├── next.config.ts            — Next.js config
└── package.json
```

---

## v0.1 — Milestones completed

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Foundation | ✅ |
| 2 | Auth + Profiles | ✅ |
| 3 | Communities | ✅ |
| 4 | Posts | ✅ |
| 5 | Comments + Voting | ✅ |
| 6 | Feeds + Search | ✅ |
| 7 | Notifications | ✅ |
| 8 | Moderation/Admin | ✅ |
| 9 | Polish (OG, sitemap, robots, empty states) | ✅ |
| 10 | Test + Deploy | ✅ |

**v0.1 complete.** Ready for product validation and incremental rollout.
