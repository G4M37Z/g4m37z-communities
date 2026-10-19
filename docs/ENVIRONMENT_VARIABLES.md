# Environment Variables — G4M37Z Communities

Single configuration contract for every environment: local dev, unit tests,
CI, Vercel builds, previews, and production runtime.

- **Machine-readable contract** (names, classification, validators):
  [`src/lib/env/contract.ts`](../src/lib/env/contract.ts)
- **Browser-safe reads**: [`src/lib/env/public.ts`](../src/lib/env/public.ts)
- **Server-only reads**: [`src/lib/env/server.ts`](../src/lib/env/server.ts)
- **Build boundary**: [`src/lib/env/build.ts`](../src/lib/env/build.ts), called from
  [`next.config.ts`](../next.config.ts)
- **Template**: [`.env.example`](../.env.example) (names + requirements, no values)
- **Tests**: [`tests/env-config.test.ts`](../tests/env-config.test.ts) — `npm run env:check`

> Nothing in this document, in `.env.example`, in tests, or in any log ever
> contains a real credential. Diagnostics name VARIABLES only.

---

## 1. Where variables belong

| Where | What goes there | Never |
|---|---|---|
| `.env.local` | your personal dev values (git-ignored, mode `600`) | committing it; pasting values into chat/commits |
| `.env.example` | names + requirements + comments, **no values** | any real or plausible credential |
| Vercel project env store | deployed values, per scope (Development / Preview / Production) | `NEXT_PUBLIC_`-prefixed secrets; production creds in dev/preview without a reason |
| CI (`secrets.*`) | only what the build genuinely needs | dumping env to logs |
| Code | reads through `src/lib/env/public.ts` or `src/lib/env/server.ts` | raw `process.env` reads of contract variables |

Next.js load order (per its docs): `process.env` → `.env.$(NODE_ENV).local` →
`.env.local` (skipped when `NODE_ENV=test`) → `.env.$(NODE_ENV)` → `.env`.
`.env.local` therefore overrides committed defaults locally and is **not** loaded
during `next build` — production values come from the platform, not from disk.

---

## 2. Classification

**A — PUBLIC** (`NEXT_PUBLIC_*`): inlined into the client bundle at build time.
Anyone can read them in DevTools. This is fine and intended: authorization comes
from Row Level Security, not from hiding the key.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build | Supabase project URL; also the post-image storage host allowlist |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | anon/publishable key; RLS is the authorization boundary |
| `NEXT_PUBLIC_SITE_URL` | build | canonical origin for auth callbacks, `robots.txt`, sitemap, metadata |
| `NEXT_PUBLIC_TURN_URL` | build | comma-separated TURN relay URLs (STUN-only fallback) |
| `NEXT_PUBLIC_TURN_USERNAME` | build | TURN credential user |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | build | TURN credential — inherently browser-visible, so it must be short-lived and provider-rotating |

**B — SERVER-ONLY SECRET**: never in a client bundle, API response, browser
storage, or log. Read only via `src/lib/env/server.ts`.

| Variable | Scope | Purpose |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | RLS-bypassing key for `createAdminClient()` |
| `KV_REST_API_URL` | runtime | shared rate-limit store endpoint |
| `KV_REST_API_TOKEN` | runtime | shared rate-limit store bearer token |
| `TENOR_API_KEY` | runtime | Tenor GIF search, proxied through `/api/gifs` |

**C — NON-SECRET CONFIGURATION**: environment-specific settings, no access
granted: `RATE_LIMIT_BACKEND` (`memory` | `kv`, empty = auto), `TEST_BASE_URL`
(browser smoke suite only), `STRICT_ENV` (build switch).

**D — UNKNOWN / REVIEW REQUIRED**: none outstanding. Anything new that is not in
`ENV_CONTRACT` in `src/lib/env/contract.ts` is unclassified until added there.

Notes on the TURN trio: they are `NEXT_PUBLIC_` on purpose. ICE credentials
travel inside every SDP offer, so secrecy is impossible; protect the relay with
auth and short TTLs, never with a hidden variable.

Platform-provided variables (`VERCEL`, `VERCEL_ENV`, `VERCEL_URL`,
`VERCEL_GIT_*`, `VERCEL_OIDC_TOKEN`, `TURBO_*`) are injected by the platform.
They are read-only, out of contract, and must never be written into `.env*`.

---

## 3. How OpenCode (and any agent) may reference variables

Allowed:
- read names, purposes, and classification from this document or
  `src/lib/env/contract.ts`;
- check **presence** with names only:
  `node -e 'console.log(Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY))'`
  or `vercel env ls --project g4m37z-communities --scope <team>` (names/scopes);
- run the validator, which reports names and problem kinds only.

Forbidden:
- printing, echoing, or summarizing values (`env`, `printenv`, `set`, `cat .env*`);
- opening secret files to show contents;
- accepting credentials pasted into chat, or echoing them in commands, logs, or
  diffs;
- copying production secrets into local files, fixtures, or shell history;
- `set -x` around any command touching credentials;
- claiming a credential is "configured" because a name appears in a file —
  verify presence, and only report names;
- rotating, revoking, or deleting credentials without explicit authorization.

---

## 4. Configure a new local environment

```bash
cp .env.example .env.local      # template has no values
chmod 600 .env.local
$EDITOR .env.local              # paste values from your Supabase dashboard yourself
```

Never write values on the command line (`export FOO=real-key` lands in shell
history). Prefer pulling from the platform instead — see §5.

Validate without exposing anything:

```bash
npm run env:check     # contract tests (synthetic values only)
npm run check         # typecheck + lint + unit tests
npm run dev           # config is validated at startup; issues print as names only
```

---

## 5. Pull the correct Vercel environment safely

Verify linkage first, then pull into the git-ignored `.env.local`, then tighten
permissions. **Never `cat` the result.**

```bash
# 1. verify the CLI is authenticated and the project exists (names only)
vercel whoami
vercel project ls

# 2. pull Development into .env.local (git-ignored; file mode 600 afterwards)
vercel env pull .env.local --environment development --yes \
  --project g4m37z-communities --scope <team-slug>
chmod 600 .env.local

# 3. verify presence only — names, lengths, shapes; never values
node -e 'const fs=require("fs");for(const l of fs.readFileSync(".env.local","utf8").split("\n")){const m=/^([A-Z_0-9]+)=(.*)$/.exec(l.trim());if(m)console.log(m[1],"set:",m[2].trim().length>0)}'
```

- Use the official CLI only. Do not hand-copy values between machines.
- Development and Preview normally hold no production-only credentials; keep it
  that way unless a task needs them and the owner authorizes it.
- `vercel link` may write a `VERCEL_OIDC_TOKEN` into `.env.local`. That is a live
  build credential: the file stays git-ignored at mode `600`, and you should
  `vercel logout` (or delete the token line) when you no longer need the CLI.
- Any file pulled this way remains ignored by Git — verify with
  `git check-ignore -v .env.local`.

---

## 6. Add a new variable correctly

1. Add it to `ENV_CONTRACT` in `src/lib/env/contract.ts` with classification,
   required-ness, scope, and purpose. Only classify as public if the browser
   genuinely needs it; otherwise keep it server-only.
2. Read it through `src/lib/env/public.ts` (browser-safe, literal
   `process.env.NEXT_PUBLIC_*` access so Next can inline it) or
   `src/lib/env/server.ts` (lazy, server-only, names-only errors). Never add a
   raw `process.env` read for a contract variable.
3. Add shape validation to the appropriate collector if the value is constrained.
4. Document it in `.env.example` (name + requirement, no value) and in §2 above.
5. Set it in Vercel for the scopes that need it.
6. Add a test to `tests/env-config.test.ts` using synthetic values.
7. Run `npm run check` and `npm run env:check`.

---

## 7. Validate locally and in CI

- **Locally**: `npm run env:check`, `npm run check`, then `npm run dev`. Startup
  prints `[env] ...` lines naming variables and problem kinds only.
- **Build boundary**: `next.config.ts` calls `assertBuildEnv()`.
  - malformed values → the **production build fails** with variable names only;
  - missing optional values → warning, build continues (the app is built to
    fail-soft: stub Supabase clients, no-op GIF search, STUN-only calls);
  - `next dev` never fails on malformed values, so a half-finished `.env.local`
    cannot block local work;
  - `STRICT_ENV=1` also fails on missing **required** variables. Set it in Vercel
    once the environment store is complete. Never satisfy it with dummies.
- **CI**: `.github/workflows/ci.yml` injects only the two public Supabase values
  via `secrets.*`, then runs typecheck, lint, unit tests (including the env
  contract suite), and `next build`.

---

## 8. Troubleshoot a missing variable without printing secrets

| Symptom | Meaning | Action |
|---|---|---|
| `[env] … missing — expected …` (warn, build continues) | optional feature not configured | fine; enable the integration if you need it |
| `[env] … malformed` at build start | typo or wrong value shape | fix the value in `.env.local` / Vercel; never paste it into chat |
| `EnvConfigError: Invalid environment configuration (server)` | a required server-only secret is absent or empty | set that variable in the scope that is actually running |
| `Server-only environment access (…) was reached in the browser` | a server accessor was imported into a client component | move the call to a Server Component / Server Action / Route Handler |
| Page renders signed-out / "GIF search is not configured" | fail-soft stub path | expected when the public variables are missing or malformed |
| Empty rate-limit buckets on multi-instance deploys | in-process backend | configure both `KV_REST_API_URL` and `KV_REST_API_TOKEN` |

Confirm presence without revealing values:

```bash
vercel env ls --project g4m37z-communities --scope <team-slug>   # names + scopes
node -e 'console.log("set:", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY))'
npm run env:check
```

---

## 9. Rotate a compromised secret

1. **Revoke/rotate at the provider first** (Supabase → Project Settings → API
   keys; Vercel → Project → Environment Variables; Tenor; the KV store). Never
   edit an old value in place and assume the old one is dead.
2. Update every scope that used it (Production, Preview, Development) and redeploy
   — `NEXT_PUBLIC_*` values are baked in at build time, so a redeploy (not just a
   restart) is required for them.
3. Pull fresh values locally (§5) and restart the dev server.
4. If the value ever reached Git history, removing the file is **not** enough:
   rewrite history (`git filter-repo`) on all clones and forks, force-push
   deliberately, and treat the credential as permanently compromised — rotate
   first, rewrite second.
5. Review access logs at the provider for use you did not initiate.

Agents never rotate, revoke, or delete credentials on their own — report the
exposure and recommend the steps above.

---

## 10. Agent operating policy

- Read names/contracts; never reveal, echo, summarize, or log secret values.
- Prefer the application's own env accessors over opening `.env*` files.
- Never paste credentials into prompts, code, tests, commits, or issues.
- Never run `env`, `printenv`, or `set`; never use `set -x` near credentials.
- Never put a secret in a command-line argument (visible in `ps`/history) when an
  env-file or platform mechanism exists.
- Use scoped access (`process.env.NAME`) and redact diagnostics.
- Renaming a variable means updating every consumer, validator, template,
  deployment config, and this document in the same change.
- Absence of a name is not proof a credential is configured — verify presence.
- Ask for authorization before rotating, deleting, or changing production
  configuration, and before any destructive action.