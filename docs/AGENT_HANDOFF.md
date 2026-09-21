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
  npx next build --webpack    # DO NOT use `npm run build` — Turbopack is WASM-only on this host
  npx vitest run              # 120/120 expected (incl. browser smoke; requires Chromedriver + app running — see ARCHITECTURE.md)
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
  `~/.local/bin/run-sql <path-to-sql-file>` (Termux/Android host).
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
- Use **exact test counts** when verified (e.g. "120 passed across 15
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
| "Browser smoke tests failing?" | ChromeDriver @ 9515 + app @ :3000 must be running first (see docs/ARCHITECTURE.md → Testing) |
| "What's the security state?" | `docs/PROJECT_STATE.md` (Security State section) |
| "What's the build status?" | `git log -1` + run `npx next build --webpack` |
| "What's the live DB state?" | Run a `run-sql` read-only inspection |

---

## FINAL REMINDER

The objective is to leave the repository in a state where the next agent
can pick up where you left off without losing any context.

- Update `PROJECT_STATE.md` last, after every other change.
- Commit before you stop.
- Do not push unless explicitly instructed.
- If something is broken, document the exact failure and stop.

NOTE — SQL interface (this host):
- Termux (current agent): `run-sql <file>` sources `~/.supabase_env` (NEVER printed/committed). SELECT/information_schema verification. Never expose DB credentials.
- Windows (Hermes host): `C:/Users/KKF/bin/run-sql.cmd <file>` — same contract.

---

## HANDOFF LOG

Most recent first. Add an entry at the end of every substantial session.

### 2026-09-21 — DM voice calls + live/repo drift reconciliation

```text
Agent: opencode (big-pickle)
Environment: Termux Android arm64; repo /data/data/com.termux/files/home/g4m37z-communities
Branch: main
Starting HEAD: 8d6f982
Task: Audit and close the live-DB/repo drift, build the missing DM-call app
  code, and update governance docs.
Changes:
  - drift audit: live DB was ahead with an undocumented DM-call feature
    (call_sessions, 6 call RPCs + helpers, conversation-scoped webrtc_signals,
    messages.attachment_type='call'); repo source had zero references to it.
  - docs/database/049_dm_calls.sql — idempotent reconciliation of that feature
    (guarded DDL, CREATE OR REPLACE, dynamic policies, explicit grants, anon
    revoked). Applied to live (no-op). Verified every migration object m001->m049
    via a read-only probe. Deliberately did NOT re-run 001-048 because
    002c_cleanup.sql DROPs live tables.
  - src/lib/messaging/call-utils.ts (client-safe helpers/types/constants),
    calls.ts (server service: RPC wrappers + getCallContext),
    call-actions.ts (server actions).
  - src/components/dm-call.tsx — Call button + send/receive overlay
    (Accept/Decline/Cancel/End/Mute), mic + RTCPeerConnection, caller as sole
    offerer, ICE buffering, signal replay after subscribe, 45s ring timeout.
  - src/lib/webrtc-signaling.ts — dual target (roomId | conversationId);
    SignalingMessage gains conversation_id (nullable room_id).
  - wired into src/app/messages/[conversationId]/page.tsx; call-log rows
    render as a centred system pill in ThreadClient.tsx.
  - tests/dm-calls.test.ts (22) — duration, pre-flight guards, error mapping,
    outcome labels, 049 authorization contract.
  - docs: GAP_REGISTER (GAP-MSG-CALL-01 -> PARTIAL), PROJECT_STATE, DECISIONS,
    AGENT_HANDOFF.
Tests: tsc PASS; eslint PASS (0 errors, 15 pre-existing warnings);
  vitest 307/307 (unit, browser excluded).
Blocked/owed: live two-peer audio (GAP-WEBRTC-01: env has one audio endpoint);
  video (media='video' supported by schema, UI audio-only).
Next recommended action: two-device audio smoke test on a Vercel preview, then
  video-track support if desired. GAP-EMAIL-01 (dashboard) still the launch
  blocker.
```

### 2026-09-20 — Feature-gap closure (stickers, covers, platform logos, post gate, brand)

```text
Agent: opencode (big-pickle)
Environment: Termux Android arm64; repo /data/data/com.termux/files/home/g4m37z-communities
Branch: main
Starting HEAD: cfc66ef (feat(messaging): image and GIF attachments)
Task: Close the user-highlighted feature gaps, update the governance docs, push.
Changes:
  - stickers (GAP-MSG-RICH-01): public/stickers/*.svg (10), src/lib/messaging/
    stickers.ts, MessageForm picker, ThreadClient renderer, database.ts
    attachment_type widened; tests/messaging-stickers.test.ts (8)
  - game covers (GAP-GAMES-01): docs/database/048_game_covers.sql,
    src/lib/games/cover-url.ts, src/components/games/GameCover.tsx,
    tests/game-cover-url.test.ts (5); wired into discover + game/[slug]
  - official platform logos (GAP-PLATFORM-01): src/components/platform-icon.tsx
    (Simple Icons CC0; Xbox simple-icons@12.4.0; Apple Game Center official),
    monochrome currentColor; wired into profile + platform-links form
  - post hydration gate (GAP-POST-01): CreatePostForm.tsx + PostActions.tsx
    EditForm
  - brand placement (GAP-BRAND-01): Logo on 4 auth headers, BrandMark on
    BottomNav Home + 404 + error
  - docs: GAP_REGISTER, PROJECT_STATE, AGENT_HANDOFF, TEST_MATRIX, DECISIONS
  - server-side sticker guard (GAP-MSG-RICH-02): attachmentVerdict helper in
    src/lib/messaging/service.ts + tests/messaging-service.test.ts (5)
  - reconciled GAP-MSG-UI-01: already shipped in 2984c3e (day dividers,
    5-min grouping, empty state) — register entry closed, no code change
  - rate limiting (GAP-RATE-01): src/lib/rate-limit.ts reworked — in-process
    fixed-window backend is now the default (active out of the box), shared
    Vercel KV backend auto-selected when configured, lazy env reads,
    RATE_LIMIT_BACKEND=memory|kv; tests/rate-limit.test.ts (8), launch
    hardening test updated
Tests: tsc PASS; eslint PASS (0 errors, 15 pre-existing warnings);
  vitest 276/276 (unit, browser excluded). Live DB: 048 idempotent
  (UPDATE 0 x8), all 8 games has_cover=t.
Blocked: GAP-POST-02 — Supabase storage.protect_delete() rejects direct
  storage.objects DELETE; no service-role key provisioned; needs Dashboard
  -> Storage or a service-role Storage API remove(). No guard bypass applied.
Runtime verification owed: live visual pass (logos/brand), post-form click
  timing, and a browser pass on the new sticker picker.
Next recommended action: the pre-launch punch list (email confirmation last,
  two-device voice test). Remaining feature work: GAP-MSG-UI-01, GAP-MSG-CALL-01,
  GIF picker (API-key decision).
```

### 2026-09-19 — Launch-hardening acceptance + messaging send fix (Buffy/Codebuff)

```text
Agent: Buffy (Codebuff)
Environment: Windows host, Git Bash; repo C:/Users/KKF/Projects/g4m37z-communities
Branch: main
Starting HEAD: 487dfcb
Ending HEAD: 8a32bf3
Task: Resume interrupted acceptance of migration 045; root-cause and fix the
      messaging send defect; establish the governance doc layer.
Changes:
  - aee3494 test(db): transaction-scoped 045 acceptance harnesses
    (sql/resume-verify.sql, sql/accept-045-messaging.sql,
    sql/accept-045-leave-rejoin.sql)
  - 8a32bf3 fix(messaging): hydration-gate submit on both messaging forms
    (NewConversationForm, MessageForm); text-red -> text-red-500
  - docs: PROJECT_STATE.md checkpoint v5; DATABASE.md Windows run-sql note;
    NEW docs/DECISIONS.md, docs/DATA_SOURCES.md, docs/TEST_MATRIX.md,
    docs/SECURITY_MODEL.md, docs/GAP_REGISTER.md
Root cause (messaging): client-component forms with React onSubmit as the
  only submit path fall through to a native form GET when submitted before
  hydration — body leaks into URL, action POST aborts client-side, no rows.
  The ERR_ABORTED entries in the network log are benign aborted RSC
  prefetches (red herring). Fix: submit disabled until mounted
  (queueMicrotask-deferred per house set-state-in-effect rule).
Tests: tsc PASS; eslint PASS (0 errors); vitest 258/258 (unit);
  next build --webpack PASS (49 routes). Live DB (run-sql.cmd, all
  transaction-scoped ROLLBACK): join/leave/rejoin soft-leave + role
  preservation PASS; create_direct_conversation new/reuse PASS; block
  enforcement P0002 PASS.
Runtime verification: TWO-USER messaging on the production build — autotest
  sent via UI (1 action POST, no native GET, rows confirmed by
  sql/verify-surface-send.sql, redirect + checkmark), autotest2 saw the
  thread with unread badge and both messages. Logged in as both seeded users.
Known limitations: email confirmation disabled (GAP-EMAIL-01, dashboard
  action pre-launch); WebRTC two-peer audio environment-blocked
  (GAP-WEBRTC-01); 2 non-messaging files still use bare text-red
  (GAP-UI-01); ~35 untracked diagnostic SQL scripts to triage (GAP-SQL-01);
  rate limits env-gated dormant (GAP-RATE-01, needs pre-launch decision).
Next recommended action: pre-launch punch list in docs/GAP_REGISTER.md —
  re-enable email confirmation last (it re-triggers the 429), run the
  two-device voice test, triage sql/.
```
- Migrations 022–030 are applied to the live DB and are the source of truth. `docs/database/` files are the canonical migration log.
- **PostgREST embeds** (`?select=...,author:profiles!posts_author_id_fkey`): the FK hint name must match a real FK that targets the embedded table. Do not add bare inline `REFERENCES auth.users(id)` on user columns — see `docs/DATABASE.md` warning and `030_fix_posts_profiles_relationship.sql`.
