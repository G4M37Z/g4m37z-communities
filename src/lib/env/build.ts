// ============================================================================
// src/lib/env/build.ts
// Build-boundary validation, imported by next.config.ts.
//
// This module must stay dependency-free apart from ./contract, because the
// Next.js 16 TS config loader transpiles only next.config.ts and cannot resolve
// relative imports from it.
//
// Policy (deliberate):
//  - MALFORMED values fail the build. A typo'd URL or an unknown enum value is
//    never intentional, and shipping it breaks redirects, images, or rate
//    limiting at runtime.
//  - MISSING values warn loudly but do not fail. The app is built to fail-soft
//    (stub Supabase clients, no-op GIF search, STUN-only calls) so forks,
//    previews, and doc builds still compile without credentials.
//  - `next dev` never fails on malformed values either — a half-finished local
//    .env.local must not block the dev server from booting and rendering the
//    diagnostics that explain what is wrong. NODE_ENV is `development` there.
//  - STRICT_ENV=1 additionally fails on missing REQUIRED variables. Set it once
//    the Vercel environment store is populated; NEVER satisfy it with dummy
//    credentials.
// ============================================================================

import {
  collectEnvIssues,
  formatIssues,
  hasValue,
  missingRequiredEnvNames,
  REQUIRED_ENV_NAMES,
  type EnvIssue,
} from "./contract.ts";

export interface BuildEnvReport {
  readonly ok: boolean;
  readonly issues: readonly EnvIssue[];
}

export function checkBuildEnv(
  source: Record<string, string | undefined> = process.env,
): BuildEnvReport {
  const nodeEnv = source.NODE_ENV;
  const issues: EnvIssue[] = [...collectEnvIssues(source, nodeEnv)];

  if (source.STRICT_ENV === "1") {
    for (const name of missingRequiredEnvNames(source)) {
      issues.push({ name, kind: "missing", requirement: "required when STRICT_ENV=1" });
    }
  }

  return { ok: issues.length === 0, issues };
}

/** Entry point used by next.config.ts. Throws (build fails) on invalid config. */
export function assertBuildEnv(
  source: Record<string, string | undefined> = process.env,
): void {
  const { issues } = checkBuildEnv(source);
  if (issues.length === 0) return;

  const strict = source.STRICT_ENV === "1";
  const isBuild = source.NODE_ENV === "production";
  console.warn(
    `[env] Environment configuration issues (names only, values never logged):\n${formatIssues(issues)}`,
  );

  // Missing-but-optional → warn only. Anything malformed, or any missing
  // REQUIRED variable while STRICT_ENV=1, must not reach a production build.
  const fatal = issues.filter(
    (issue) =>
      isBuild && (issue.kind === "malformed" || (strict && issue.kind === "missing")),
  );
  if (fatal.length > 0) {
    if (!isBuild) {
      console.warn(
        "[env] `next dev` continues with the issues above; they would fail a production build.",
      );
      return;
    }
    throw new Error(
      `[env] Refusing to build with invalid environment configuration:\n${formatIssues(fatal)}\n` +
        `[env] Fix the variables above in .env.local (local) or in the Vercel project ` +
        `environment store (deployed). .env.example lists every name and requirement. ` +
        `Required: ${REQUIRED_ENV_NAMES.join(", ")}.`,
    );
  }
}