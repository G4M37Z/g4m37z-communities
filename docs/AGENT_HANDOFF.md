# G4M37Z Communities — Agent Handoff Protocol

> Read this file first whenever starting work on the repository. It defines
> the protocol both Hermes and Claude Code must follow.

---

## AGENT STARTUP PROTOCOL

Every time an agent (Hermes, Claude Code, or any other) starts work:

1. **Read `docs/AGENT_HANDOFF.md`** (this file).
2. **Read `docs/PROJECT_STATE.md`** — the persistent checkpoint.
3. **Read `docs/ROADMAP.md`** — the authorised sequence.
4. **Read relevant sections of `docs/DATABASE.md`** — for any database work.
5. **Read relevant sections of `docs/ARCHITECTURE.md`** — for any architectural work.
6. **Inspect `git status`** — is the tree clean? What is untracked?
7. **Inspect recent `git log -10 --oneline`** — which milestones are at HEAD?
8. **Reconcile documentation against actual repository state** — the live
   repository is authoritative. If the documentation disagrees with `git log`,
   `git status`, the file tree, or the live database, the documentation is
   wrong, not the repository.
9. **Inspect the live database schema** for any database work
   (`run-sql.cmd` with a read-only inspection file). Do not assume.
10. **Never blindly trust stale documentation.** Documentation is a
    persistent handoff layer, not a substitute for ground truth.

---

## SOURCE OF TRUTH PRIORITY

When sources disagree, use this strict priority:

1. **Actual live database schema** — for any database fact.
2. **Actual source code in the repository** — for any application behaviour.
3. **Git history** — for what was committed and when.
4. **Tests and validation output** — for what is verified.
5. **Project documentation** (`docs/*.md`) — for human-readable context.
6. **Agent memory / session memory** — only as a hint, never as truth.

If lower-priority sources contradict higher-priority sources, **the
higher-priority source wins**. Update the lower-priority sources to match.

---

## MILESTONE PROTOCOL

When implementing a milestone:

- **Implement only the next authorised milestone.** Do not skip ahead. Do
  not invent additional milestones.
- **Preserve the V3 sequence.** The order in `ROADMAP.md` is fixed.
- **Inspect live schema first** before any database work. Do not invent
  columns or relationships.
- **Resolve `user_id`, `host_id`, `captain_id`, `raised_by`, etc. from
  `auth.uid()` server-side.** Never trust a client-supplied value.
- **Preserve RLS.** Every public table must remain RLS-enabled. New
  policies are explicit and ownership-scoped.
- **Keep privileged operations server-side.** Use `createAdminClient`
  inside trusted server code; never expose `SUPABASE_SERVICE_ROLE_KEY` to
  the browser.
- **Do not allow arbitrary client-controlled security-sensitive state**
  (status, winner, resolved_by, role, etc.). Mutations must be validated
  and ownership-scoped.
- **Do not invent relationships absent from the schema.** If the schema
  cannot support a feature, document the limitation rather than adding
  columns or inventing FKs.
- **Avoid destructive migrations.** No `DROP TABLE`, no `TRUNCATE`, no
  irreversible `UPDATE`. Use `IF NOT EXISTS`, `DROP POLICY IF EXISTS`,
  `DO $$ ... EXCEPTION WHEN duplicate_object`, `ON CONFLICT DO NOTHING`.
- **Preserve existing data.** The migration order is cumulative; never
  reset or recreate prior migrations.
- **Run full validation before committing:**
  ```
  npx eslint .
  npx tsc --noEmit
  npm run build
  npx vitest run
  ```
- **Update documentation in the same checkpoint** as the milestone work.
  This is non-negotiable: PROJECT_STATE.md must be updated to reflect the
  new milestone status before the next agent starts.
- **Create exactly one milestone commit** with a message starting
  `feat: ...`, `security: ...`, or `chore: ...`.
- **Never silently skip milestones.** If a milestone fails, STOP at the
  failed checkpoint.

---

## FAILURE PROTOCOL

If a milestone fails any of its gates (lint, typecheck, build, tests,
database inspection, P0 regression, browser verification):

- Do **not** mark it PASS.
- Do **not** advance to the next milestone.
- Document the failure:
  - Which command failed and the exact error output.
  - The current working-tree state (`git status`).
  - What was committed (commit hash) and what was not.
  - What remains to be fixed.
- Stop at the failed checkpoint. The next agent will pick up from there.

The audit trail (Git, docs) is the safety net — never paper over a
failure with "I'll fix it later."

---

## HANDOFF PROTOCOL

When switching agents (Hermes → Claude Code, Claude Code → Hermes, etc.):

1. **The leaving agent** must update `docs/PROJECT_STATE.md` to reflect
   the actual checkpoint, including any uncommitted work, any known
   limitations, and any in-progress debugging.
2. **The leaving agent** must commit any work-in-progress as a single
   checkpoint commit (or split into a checkpoint + the milestone commit
   if both apply).
3. **The arriving agent** must read `docs/AGENT_HANDOFF.md`,
   `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` first.
4. **The arriving agent** must reconcile documentation against actual
   state: `git status`, `git log`, the file tree, and (for DB work) the
   live database.
5. **The arriving agent** must NOT modify the documentation to match
   broken code — the leaving agent must do that. If something is broken,
   the arriving agent reports it and stops.

The repository is the shared persistent memory between agents. The
documentation lives in the repository so it ships with the code.

---

## GIT PROTOCOL

Every completed milestone should:

- Have **one clear milestone commit** with the conventional message
  (`feat: implement v3 X`, `security: ...`, `chore: ...`).
- Have **documentation updated in the same checkpoint** (`PROJECT_STATE.md`
  checkpoint table, milestone commit hash).
- Leave a **clean working tree** where possible. Untracked logs and
  scratch files should be removed before commit.

**Do NOT push unless explicitly instructed.** Pushing requires explicit
human authorisation. Local commits are sufficient for state persistence.

**Never reset or rewrite milestone history** to make the log look
cleaner. The exact commit hashes are recorded in `PROJECT_STATE.md` and
`PROJECT_HISTORY.md`; rewriting them breaks the documented chain of
custody.

---

## DATABASE EXECUTION PROTOCOL

- The **only** authorised SQL execution interface is
  `C:/Users/KKF/bin/run-sql.cmd <path-to-sql-file>`.
- Credentials are read from `~/.supabase_env`. **Never** read or print the
  contents of that file.
- **Never** directly invoke `psql` from terminal with credentials on the
  command line.
- **Never** place credentials in source code, SQL files, or Git history.
- **Never** paste SQL into the Supabase Dashboard manually when the agent
  can execute it via `run-sql`.
- For read-only inspection, create a temporary `.sql` file under `sql/`,
  run via `run-sql`, then delete the file in the same commit.

If `run-sql` fails because the database is unreachable or credentials are
missing, STOP the database operation and report the exact blocker.

---

## SECURITY PROTOCOL

These rules are non-negotiable:

- Never write secrets into documentation, source code, SQL files, or
  Git history.
- Never disable RLS to make a feature work — write a proper policy.
- Never weaken P0 containment (`trg_guard_profile_role` trigger, RPC
  EXECUTE revocations on `create_notification` and
  `admin_set_user_role`).
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Never trust a client-supplied `user_id`, `host_id`, `captain_id`,
  `raised_by`, or `role`.
- Never write SQL that could leak data from one user to another (no
  `USING (true)` for authenticated mutations).
- If a security finding is discovered, STOP and report it before
  implementing any fix.

---

## DOCUMENTATION DISCIPLINE

When the agent updates documentation:

- Use **exact commit hashes**. Never guess.
- Use **exact migration filenames**. Never abbreviate.
- Use **exact test counts** when verified (e.g. "91 passed across 9
  files"). Do not estimate.
- Distinguish **PASS / PARTIAL / BLOCKED / NOT VERIFIED / PLANNED** —
  do not convert "not tested" into "working."
- Use tables where they improve clarity.
- Mark historical gaps explicitly. Do not fabricate.

When the agent finds documentation is wrong:

- Update it. Do not silently defer the correction to the next agent.
- If the documentation is wrong because the implementation is wrong,
  fix the implementation FIRST, then update the documentation.

---

## WHERE TO LOOK WHEN STUCK

| Symptom | First place to look |
|---|---|
| "What's at HEAD?" | `git log -1 --oneline` + `docs/PROJECT_STATE.md` |
| "What's the next milestone?" | `docs/ROADMAP.md` |
| "What migrations exist?" | `ls docs/database/` + `docs/DATABASE.md` |
| "What services exist?" | `ls src/lib/*/service.ts` + `docs/ARCHITECTURE.md` |
| "What tests exist?" | `ls tests/` |
| "What's the security state?" | `docs/PROJECT_STATE.md` (Security State section) |
| "What's the build status?" | `git log -1` + run `npm run build` |
| "What's the live DB state?" | Run a `run-sql` read-only inspection |

---

## FINAL REMINDER

The objective is to leave the repository in a state where the next agent
can pick up where you left off without losing any context.

- Update `PROJECT_STATE.md` last, after every other change.
- Commit before you stop.
- Do not push unless explicitly instructed.
- If something is broken, document the exact failure and stop.

NOTE — Dual-agent SQL interfaces (this session):
- Termux (this agent): psql via ~/.supabase_env; file SQL; SELECT/information_schema verification; never expose DB_URL.
- Windows/Hermes: run-sql.cmd only. SQL inspection ≠ live DB application.
