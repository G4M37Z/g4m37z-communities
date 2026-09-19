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
