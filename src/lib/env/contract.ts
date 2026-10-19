// ============================================================================
// src/lib/env/contract.ts
// THE environment configuration contract: variable names, classification,
// required-ness, and shape validation.
//
// Why one self-contained module: `next.config.ts` imports this file directly at
// the build boundary, and the Next.js 16 TS config loader transpiles only the
// config file itself — it cannot resolve relative imports from it. So this
// module must stay dependency-free (no relative imports, no framework imports).
//
// HARD RULES enforced here:
//  - Diagnostics carry the VARIABLE NAME and the KIND of problem only. A
//    rejected or accepted value is never formatted into a message, a log line,
//    or an Error, because those end up in build logs, CI output, error
//    reports, and the browser console when a Server Component throws.
//  - Optional integrations are never required when their feature is off.
//  - No default or dummy production credentials are ever substituted.
// ============================================================================

// ── Classification ──────────────────────────────────────────────────────────
// A — PUBLIC: intentionally inlined into the browser bundle by the NEXT_PUBLIC_
//     prefix. Safe to ship; authorization is enforced by RLS / short TTLs, never
//     by secrecy of the value.
// B — SERVER-ONLY SECRET: must never reach a client bundle, an API response,
//     browser storage, or a log.
// C — NON-SECRET CONFIGURATION: environment-specific settings that grant no
//     access and reveal nothing sensitive.

export type Classification = "A-public" | "B-server-secret" | "C-config";

export interface VarSpec {
  readonly name: string;
  readonly classification: Classification;
  /** Required for the feature to work at all. */
  readonly required: boolean;
  readonly where: "client+server" | "server-only" | "test-only";
  readonly purpose: string;
}

export const ENV_CONTRACT: readonly VarSpec[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    classification: "A-public",
    required: true,
    where: "client+server",
    purpose: "Supabase project URL. Also the storage-host allowlist for post images.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    classification: "A-public",
    required: true,
    where: "client+server",
    purpose:
      "Supabase anon/publishable key. Not a credential: every request is constrained by RLS.",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    classification: "A-public",
    required: false,
    where: "client+server",
    purpose:
      "Canonical site origin for auth callbacks, robots.txt, sitemap, metadata. Defaults to the known deployment URL in production.",
  },
  {
    name: "NEXT_PUBLIC_TURN_URL",
    classification: "A-public",
    required: false,
    where: "client+server",
    purpose: "Comma-separated TURN relay URLs. Without them calls degrade to STUN-only.",
  },
  {
    name: "NEXT_PUBLIC_TURN_USERNAME",
    classification: "A-public",
    required: false,
    where: "client+server",
    purpose: "TURN credential user. Inherently client-visible; must be short-lived.",
  },
  {
    name: "NEXT_PUBLIC_TURN_CREDENTIAL",
    classification: "A-public",
    required: false,
    where: "client+server",
    purpose: "TURN credential secret. Inherently client-visible; must be short-lived.",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    classification: "B-server-secret",
    required: true,
    where: "server-only",
    purpose: "RLS-bypassing key for createAdminClient(). Never client-visible.",
  },
  {
    name: "KV_REST_API_URL",
    classification: "B-server-secret",
    required: false,
    where: "server-only",
    purpose: "Shared rate-limit store endpoint (Upstash/Vercel KV REST).",
  },
  {
    name: "KV_REST_API_TOKEN",
    classification: "B-server-secret",
    required: false,
    where: "server-only",
    purpose: "Shared rate-limit store bearer token.",
  },
  {
    name: "TENOR_API_KEY",
    classification: "B-server-secret",
    required: false,
    where: "server-only",
    purpose: "Tenor GIF search via /api/gifs. Without it the picker shows an empty state.",
  },
  {
    name: "RATE_LIMIT_BACKEND",
    classification: "C-config",
    required: false,
    where: "server-only",
    purpose: "memory | kv. Empty means auto (kv when configured, else in-process).",
  },
  {
    name: "TEST_BASE_URL",
    classification: "C-config",
    required: false,
    where: "test-only",
    purpose: "Base URL for the browser smoke suite (npm run test:browser).",
  },
];

export const PUBLIC_ENV_NAMES: readonly string[] = ENV_CONTRACT.filter(
  (v) => v.name.startsWith("NEXT_PUBLIC_"),
).map((v) => v.name);

export const SERVER_ONLY_SECRET_NAMES: readonly string[] = ENV_CONTRACT.filter(
  (v) => v.classification === "B-server-secret",
).map((v) => v.name);

/** Required to run at all (needed by the core product surface). */
export const REQUIRED_ENV_NAMES: readonly string[] = ENV_CONTRACT.filter(
  (v) => v.required,
).map((v) => v.name);

// ── Issue model ─────────────────────────────────────────────────────────────

export type IssueKind =
  | "missing" // variable absent
  | "empty" // present but blank/whitespace only
  | "malformed"; // present but fails its format constraint

export interface EnvIssue {
  /** Variable name — the only identifier ever included in a diagnostic. */
  readonly name: string;
  readonly kind: IssueKind;
  /** Requirement description. Never a value. */
  readonly requirement: string;
}

/** Environment source shape (satisfied by `process.env` and by test maps). */
export type EnvSource = Record<string, string | undefined>;

export class EnvConfigError extends Error {
  readonly issues: readonly EnvIssue[];
  readonly scope: string;

  constructor(scope: string, issues: readonly EnvIssue[]) {
    super(`Invalid environment configuration (${scope}):\n${formatIssues(issues)}`);
    this.name = "EnvConfigError";
    this.scope = scope;
    this.issues = issues;
  }
}

/** Names-only, value-free rendering of a set of issues. */
export function formatIssues(issues: readonly EnvIssue[]): string {
  return issues
    .map((issue) => `  - ${issue.name}: ${issue.kind} — expected ${issue.requirement}`)
    .join("\n");
}

// ── Primitives ──────────────────────────────────────────────────────────────

/** True when the variable is present with a non-blank value. */
export function hasValue(source: EnvSource, name: string): boolean {
  const raw = source[name];
  return typeof raw === "string" && raw.trim().length > 0;
}

/** Trimmed value, or `undefined` when absent/blank. */
export function readOptional(source: EnvSource, name: string): string | undefined {
  const raw = source[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Record an issue for a required variable without ever reading its value into
 * any output. Callers use the return value to decide fail-soft vs fail-fast.
 */
export function requireValue(
  source: EnvSource,
  name: string,
  issues: EnvIssue[],
  requirement = "a non-empty value",
): string | undefined {
  if (hasValue(source, name)) return readOptional(source, name);
  issues.push({
    name,
    kind: source[name] === undefined ? "missing" : "empty",
    requirement,
  });
  return undefined;
}

/** URL check. Rejects anything that is not an absolute http(s) URL. */
export function validateUrl(
  name: string,
  value: string | undefined,
  requirement = "an absolute http(s) URL",
): EnvIssue | null {
  if (value === undefined) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { name, kind: "malformed", requirement };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { name, kind: "malformed", requirement };
  }
  return null;
}

/**
 * URL check for configuration that ends up in shipped output: https is
 * mandatory in production builds, http is tolerated for local development.
 */
export function validatePublicUrl(
  name: string,
  value: string | undefined,
  nodeEnv: string | undefined,
): EnvIssue | null {
  const requirement =
    nodeEnv === "production"
      ? "an absolute https:// URL"
      : "an absolute http(s) URL (https:// in production)";
  const issue = validateUrl(name, value, requirement);
  if (issue || value === undefined) return issue;
  if (nodeEnv === "production" && !value.startsWith("https://")) {
    return { name, kind: "malformed", requirement };
  }
  return null;
}

/** One-of check for constrained settings. Unknown values are malformed. */
export function validateEnum<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
): EnvIssue | null {
  if (value === undefined) return null;
  if (!(allowed as readonly string[]).includes(value)) {
    return { name, kind: "malformed", requirement: `one of: ${allowed.join(", ")}` };
  }
  return null;
}

// ── Collectors ──────────────────────────────────────────────────────────────

/**
 * Shape checks for the PUBLIC contract. Only flags values that are PRESENT and
 * wrong: optional integrations stay optional and missing public values are
 * reported as a configuration warning, never as a broken build by default.
 */
export function collectPublicEnvIssues(
  source: EnvSource,
  nodeEnv?: string,
): EnvIssue[] {
  const issues: EnvIssue[] = [];

  const url = readOptional(source, "NEXT_PUBLIC_SUPABASE_URL");
  if (url) {
    const issue = validatePublicUrl("NEXT_PUBLIC_SUPABASE_URL", url, nodeEnv);
    if (issue) issues.push(issue);
  }

  const siteUrl = readOptional(source, "NEXT_PUBLIC_SITE_URL");
  if (siteUrl) {
    const issue = validatePublicUrl("NEXT_PUBLIC_SITE_URL", siteUrl, nodeEnv);
    if (issue) issues.push(issue);
  }

  // An anon key that is set must at least look like a Supabase key. Only the
  // variable name is ever reported.
  const anonKey = readOptional(source, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (anonKey && !/^[A-Za-z0-9._-]{20,}$/.test(anonKey)) {
    issues.push({
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      kind: "malformed",
      requirement: "the Supabase anon/publishable key (JWT or sb_publishable_*)",
    });
  }

  const turnUrl = readOptional(source, "NEXT_PUBLIC_TURN_URL");
  if (turnUrl) {
    for (const candidate of turnUrl.split(",")) {
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      if (!/^turns?:[a-z0-9.-]+(:\d+)?$/i.test(trimmed)) {
        issues.push({
          name: "NEXT_PUBLIC_TURN_URL",
          kind: "malformed",
          requirement: "comma-separated turn:/turns: URLs (host[:port])",
        });
        break;
      }
    }
  }

  const kvUrl = readOptional(source, "KV_REST_API_URL");
  if (kvUrl) {
    const issue = validatePublicUrl("KV_REST_API_URL", kvUrl, nodeEnv);
    if (issue) issues.push(issue);
  }

  return issues;
}

/**
 * Shape checks for SERVER-ONLY configuration. Presence is only reported for
 * partial pairs (a half-configured KV store is a misconfiguration, not an
 * absent feature).
 */
export function collectServerEnvIssues(
  source: EnvSource,
  nodeEnv?: string,
): EnvIssue[] {
  const issues: EnvIssue[] = [];

  const kvUrl = readOptional(source, "KV_REST_API_URL");
  const kvToken = readOptional(source, "KV_REST_API_TOKEN");
  if (Boolean(kvUrl) !== Boolean(kvToken)) {
    issues.push({
      name: kvUrl ? "KV_REST_API_TOKEN" : "KV_REST_API_URL",
      kind: "missing",
      requirement: "set together with its pair to enable the shared KV backend",
    });
  }

  const backend = readOptional(source, "RATE_LIMIT_BACKEND");
  if (backend) {
    const issue = validateEnum("RATE_LIMIT_BACKEND", backend, ["memory", "kv"]);
    if (issue) issues.push(issue);
  }

  const testBaseUrl = readOptional(source, "TEST_BASE_URL");
  if (testBaseUrl) {
    const issue = validatePublicUrl("TEST_BASE_URL", testBaseUrl, nodeEnv);
    if (issue) issues.push(issue);
  }

  return issues;
}

/** Full contract check (public + server), used by the build boundary and tests. */
export function collectEnvIssues(source: EnvSource, nodeEnv?: string): EnvIssue[] {
  return [
    ...collectPublicEnvIssues(source, nodeEnv),
    ...collectServerEnvIssues(source, nodeEnv),
  ];
}

/**
 * Names-only availability report. Returns the NAMES of required variables that
 * are absent — never their values. Use this to check "is it configured?"
 * without exposing anything.
 */
export function missingRequiredEnvNames(source: EnvSource): string[] {
  return REQUIRED_ENV_NAMES.filter((name) => !hasValue(source, name));
}