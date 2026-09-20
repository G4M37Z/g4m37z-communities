# G4M37Z Communities — Security Model

> What protects what, and where the boundaries are. Verify against the live
> DB (`run-sql` policy inspections), never against this document alone.

## Authentication

- Supabase Auth (email/password; Google OAuth button present), cookie sessions
  via `@supabase/ssr`; middleware refreshes sessions. Signup enforces
  confirm-password client- AND server-side (`signUpWithPassword` re-checks).
- Server-validated terms version (commit `44d7cde`); rate limiting exists but
  is **env-gated off** unless configured (see Abuse surface below).
- ⚠️ Email confirmation is currently **DISABLED** as a manual workaround for a
  signup 429 — **MUST be re-enabled before launch** (dashboard-only setting).

## Authorization boundaries

- Every user identity is `auth.uid()` server-side; client-supplied ids are
  never trusted for ownership.
- RLS on all 59 public tables (verified 2026-09-16 audit; 175 policies).
- Membership writes only through `join_community` / `leave_community`
  SECURITY DEFINER RPCs (045) — neither can mutate `role`, so self-service
  cannot escalate. `trg_guard_profile_role` likewise blocks client role edits.
- Posting into a community requires **active** membership (`left_at IS NULL`,
  045). Event/tournament creation is creator/mod-gated.
- Messaging: sender identity resolved server-side; `messages_select` scoped to
  conversation members; blocked pairs cannot start threads (P0002, no leak).
- Storage: folder-per-user (`(storage.foldername(name))[1] = auth.uid()`),
  045 added UPDATE WITH CHECK and made `voice-recordings` owner-only read.
- `webrtc_signals` INSERT requires room participation (045).

## Server-only secrets

- `SUPABASE_SERVICE_ROLE_KEY` (if used via `createAdminClient`) stays in
  server contexts only; never imported into client components.
- DB credentials live in `~/.supabase_env`, applied only by the run-sql
  wrappers; never echoed, never committed. `.env.local` is blocked from agent
  reads and never printed.

## Abuse surfaces & current state

| Surface | Protection | State |
|---|---|---|
| Auth email sends | Supabase rate limit | 429 hit in testing; workaround = confirmation off (temporary) |
| Signup/login abuse | Rate limits (in-process default, Vercel KV shared backend) | Active by default since 2026-09-20 (GAP-RATE-01) |
| Message/post/comment spam | Body length caps, membership gates, block enforcement | Active |
| Upload abuse | Storage policies, magic-byte sniffing, ownership validation (`f52d86d`) | Active |
| Security headers | Set in `44d7cde` | Active — re-verify CSP on any new external origin |
| Search input | `escapeLike` + parameterized `ilike` | Active |

## Known limitations

- Rate limits are active in-process by default since 2026-09-20 (GAP-RATE-01).
  Counters are per instance; configure shared Vercel KV before relying on the
  limits at multi-instance scale.
- Two non-messaging files still use bare `text-red` for error text (cosmetic;
  tracked in GAP_REGISTER).
