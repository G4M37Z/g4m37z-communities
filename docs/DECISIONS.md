# G4M37Z Communities — Decision Log

> Every significant architectural decision gets an entry here. Newest last.
> Format per the governance protocol. Statuses: ACTIVE / SUPERSEDED.

## Decision: Messaging writes go through SECURITY DEFINER RPCs

Date: 2026-09-17 (038) / 2026-09-18 (045 block enforcement)
Status: ACTIVE

Context: The client-side "start a message" path did three request-scoped
writes that RLS made self-contradictory (RETURNING filtered by the
member-only SELECT policy; batch member insert violating the invitee WITH
CHECK). Any client-side reordering is a race, not a fix.

Decision: `public.create_direct_conversation(p_other, p_body)` — SECURITY
DEFINER, granted only to `authenticated` — atomically creates/reuses the
thread, inserts both member rows and the first message. Migration 045 added
two-direction block enforcement surfaced as P0002 so block state never leaks.
`join_community` / `leave_community` follow the same pattern for membership.

Alternatives: multi-step client writes with rollback (the original, broken);
loosening conversation SELECT policy (weakens membership privacy); a
PostgREST function-free batch insert (cannot express the invariant).

Reason: One server-side, auditable boundary per invariant; RLS stays closed;
client code becomes trivial.

Consequences: New messaging/membership invariants MUST be added to these RPCs
(or sibling RPCs), never re-exposed as multi-step client writes. Error codes
(22023 self, P0002 ghost/blocked) are part of the client contract.

## Decision: Pre-hydration submit gating on client-component forms

Date: 2026-09-19
Status: ACTIVE

Context: `/messages/new` and thread `MessageForm` had React `onSubmit` as
their only submit path. A click before React attaches handlers falls through
to a native form GET: the message body leaks into the URL, the page unloads,
any in-flight server action aborts client-side ("destination stream closed
early" / ERR_ABORTED), and no rows are written. Confirmed by the built CSS
also missing `text-red`, so error output was unstyled if any surfaced.

Decision: Submit controls render `disabled` server-side and enable after
mount via `useEffect` + `queueMicrotask` (house pattern for
`react-hooks/set-state-in-effect`, cf. `ThemeToggle`). Applied to the two
messaging forms; other client-component forms may adopt it as they are
touched. Error text uses `text-red-500` (a real token) — not bare `text-red`.

Alternatives: `useActionState` progressive enhancement (larger refactor of
`createConversation`'s redirect contract; deliberate non-choice under change
minimization); noV. Recipient-picker suggestion buttons are `type="button"`
so they never native-submit.

Reason: Minimal diff, removes the only path to a native GET, keeps the
existing action contract.

Consequences: A pre-hydration click is inert (button disabled) rather than a
destructive navigation. Any new form in a client component must either gate
submit the same way or be verified to render no uncontrolled submit control.

## Decision: Windows host DB interface is run-sql.cmd

Date: 2026-09-19 (codified; earlier practice)
Status: ACTIVE

Context: DATABASE.md documented the Termux interface (`~/.local/bin/run-sql`).
This machine is Windows (Git Bash); `C:/Users/KKF/bin/run-sql.cmd` →
`run-sql.ps1` exists, sources `~/.supabase_env`, and shells to
`psql -v ON_ERROR_STOP=1`.

Decision: On this host, `run-sql.cmd` is the authorized SQL interface — same
guarantees (no credentials on the command line, execute exactly once). All
live-DB work goes through SQL files under `sql/`.

Alternatives: invoking psql directly with the URL (forbidden — leaks
credentials to process lists); the Supabase Management-API MCP `execute_sql`
(client tool-set does not approve it on this machine).

Reason: Same trust contract as the documented Termux path, matches the host.

Consequences: DATABASE.md should gain a Windows-host note; anything needing
write access to the DB must go through this interface and produce a
committed, reviewable SQL file.

## Decision: Platform icons are official marks rendered monochrome via currentColor

Date: 2026-09-20
Status: ACTIVE

Context: Platform links (Steam, PlayStation, Xbox, Google Play, Apple Game
Center) rendered text-only; the user required official logos ("dont hand
draw use official logos"). Official marks ship in brand colors, but
`docs/BRAND.md` forbids hardcoded hex in components.

Decision: `src/components/platform-icon.tsx` bundles official marks only —
Steam/PlayStation/Google Play from Simple Icons (CC0); Xbox from
`simple-icons@12.4.0` (removed in v13+, brand hex `#107C10`); Apple Game
Center = Apple's official four-circle mark (Wikimedia, sourced from
`developer.apple.com/game-center`; PD-ineligible/trademarked). All render
monochrome `fill="currentColor"` with a per-platform `viewBox` and a
`Record<Platform, …>` map (compile-time coverage guard). Text labels remain
for accessibility.

Alternatives: brand-colored marks (would require hardcoded hex, violating
BRAND.md and clashing with the theme); `next/image` PNGs (hotlinks, larger
payload, no theming); hand-drawn marks (rejected by the user).

Reason: Official provenance, theme-aware, zero hardcoded color, one
component, trademark printed as monochrome glyphs (common nominative use).

Consequences: New platforms must add an official mark + map entry or the
build breaks (by design). Do not recolor marks or hotlink vendor CDNs.

## Decision: Do not bypass Supabase's direct-storage-delete guard

Date: 2026-09-20
Status: ACTIVE

Context: GAP-POST-02 removes one orphaned `post-images` object. A
`DELETE FROM storage.objects` migration failed with
`storage.protect_delete()`: "Direct deletion from storage tables is not
allowed. Use the Storage API instead." The guard can be disabled via the
`storage.allow_delete_query` GUC, and only `DATABASE_URL` is provisioned
(no service-role key).

Decision: Do not disable the guard and delete via SQL. A metadata delete
leaves the underlying S3 object dangling, so it would not actually fix the
orphan. Remediation is a Dashboard → Storage delete or a service-role
Storage API `remove()` call.

Alternatives: `SET storage.allow_delete_query = 'true'` then delete (rejected
— incomplete cleanup, silently creates a worse orphan); direct S3 access (no
credentials).

Reason: The guard exists to keep the object store and its metadata in sync;
subverting it trades a visible, harmless orphan for an invisible one.

Consequences: Storage hygiene gaps are BLOCKED-ENVIRONMENT for this agent
until either dashboard access or a service-role key is provided. New cleanup
needs must use the Storage API, never `storage.objects` DML.

## Decision: Extend the pre-hydration submit gate to post create/edit forms

Date: 2026-09-20
Status: ACTIVE

Context: GAP-POST-01 (first Save/Publish click swallowed) shares the root
cause of the 2026-09-19 messaging decision — `action={onSubmit}` forms can
submit natively before React hydrates.

Decision: Apply the house hydration gate (`hydrated` state via
`useEffect` + `queueMicrotask`; submit control `disabled={pending || uploading
|| !hydrated}`) to `CreatePostForm.tsx` and the `EditForm` in
`PostActions.tsx`, per the existing decision's consequence note.

Reason: Same minimal diff and contract; removes the native-GET path.

Consequences: Any remaining client-component form with a submit control must
adopt the gate or be proven to render no uncontrolled submit control.

## Decision: Rate limiting uses an in-process backend by default, KV as the shared upgrade

Date: 2026-09-20
Status: ACTIVE

Context: GAP-RATE-01 — the app-side limiter (`44d7cde`) was a no-op unless
Vercel KV env vars were configured, so account-spam and message-flood guards
were dormant in production.

Decision: `src/lib/rate-limit.ts` now ships two backends. The in-process
fixed-window limiter is the default, so limits are active on any deployment
out of the box (per-instance counters). When `KV_REST_API_URL` +
`KV_REST_API_TOKEN` are both set, the shared Upstash/Vercel-KV backend is used
instead (counters shared across instances). `RATE_LIMIT_BACKEND=memory|kv`
forces a backend. All infra/forced-KV failures fail open and log — a store
outage is never a self-inflicted outage. Limits: `msg-send:<uid>` 60/60s,
`signup:<username>` 5/3600.

Alternatives: keep limits dormant until KV is provisioned (rejected — the gap
was exactly that nothing was configured, and unset env is the common case);
dependency-inject a Redis/Postgres limiter (heavier infra than the launch
surface needs; KV / in-process cover single- and multi-instance today).

Reason: Working limits by default with a documented, zero-code switch to a
shared store at scale; fail-open preserves availability.

Consequences: In-process counters reset per instance and on restarts — not a
hard security boundary for multi-instance traffic; configure KV (or enforce
Supabase-side limits) before relying on them at scale. New limit surfaces
should reuse `rateLimit` with per-user keys and clearly named windows.

## Decision: DM calls reuse `webrtc_signals` addressed by `conversation_id`, over SECURITY DEFINER RPCs

Date: 2026-09-21
Status: ACTIVE

Context: GAP-MSG-CALL-01 — 1:1 calls from the messages UI. The live database
already carried a complete call feature (`call_sessions`, six call RPCs,
conversation-scoped `webrtc_signals`, `messages.attachment_type='call'`) that
was never committed to the migration tree, so the repo and live DB had
diverged.

Decision: adopt the live design rather than redesign it. `webrtc_signals` is
now dual-target — `room_id` for community voice rooms (unchanged) and a new
`conversation_id` for DM calls; RLS authorizes the sender/reader as either a
room participant or a conversation member. Call lifecycle lives in
`call_sessions` and is mutated only through `start/answer/decline/cancel/end/
timeout_dm_call`, all SECURITY DEFINER with the caller resolved from
`auth.uid()`. The caller is the deterministic offerer (no lexicographic
glare rule, unlike the room peer). Signaling rows carry SDP/ICE only; audio is
peer-to-peer and never stored. `docs/database/049_dm_calls.sql` is the
idempotent reconciliation (applied to live).

Alternatives: separate `dm_call_signals` table (rejected — duplicates the
transport and its RLS); client-driven writes to `call_sessions` (rejected —
identity/outcome forgery and no atomic pair/block guards); WebSocket server
(rejected — adds infra for a 1:1 feature the DB already supports).

Reason: keeps a single auditable signaling transport, keeps caller identity
and business guards server-side, and closes the drift without a destructive
migration replay.

Consequences: `webrtc_signals.room_id` is nullable, so every room-scoped
query must now tolerate `NULL`; the room peer is unaffected because it
filters on `room_id=eq.<id>`. Video is not implemented yet (`media` supports
`'video'` but the UI is audio-only). Two-peer audio still needs the
`GAP-WEBRTC-01` live test.
