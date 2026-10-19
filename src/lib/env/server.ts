// ============================================================================
// src/lib/env/server.ts
// The single source of truth for SERVER-ONLY configuration.
//
// SERVER-ONLY SECRET variables (Supabase service-role/secret key, KV token,
// Tenor API key) may only be read through this module. Every accessor asserts
// it is not executing in a browser and throws errors that name the VARIABLE
// only — never the rejected or accepted value.
//
// Accessors are lazy on purpose: a build, a preview, or a test that never
// touches the privileged surface must not fail because an optional secret is
// absent, and validation must never run while a client component renders.
// ============================================================================

import {
  EnvConfigError,
  hasValue,
  readOptional,
  requireValue,
  validateEnum,
  validatePublicUrl,
  type EnvIssue,
  type EnvSource,
} from "./contract";

/** Throws if these accessors are ever reached from a browser bundle. */
function assertServerOnly(name: string): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `Server-only environment access (${name}) was reached in the browser. ` +
        `Move the call into a Server Component, Server Action, or Route Handler.`,
    );
  }
}

export type RateLimitBackend = "memory" | "kv";

/**
 * Supabase service_role / secret key. REQUIRED for `createAdminClient()`.
 * Bypasses Row Level Security — treat it as the most privileged credential in
 * the project and never let it near a client bundle.
 */
export function supabaseServiceRoleKey(source: EnvSource = process.env): string {
  assertServerOnly("SUPABASE_SERVICE_ROLE_KEY");
  const issues: EnvIssue[] = [];
  const key = requireValue(
    source,
    "SUPABASE_SERVICE_ROLE_KEY",
    issues,
    "the Supabase service_role / secret key (server-only)",
  );
  if (!key) throw new EnvConfigError("server", issues);
  return key;
}

/**
 * Shared rate-limit store credentials. Optional, and all-or-nothing: half a
 * pair is a misconfiguration, not an absent feature.
 */
export function kvCredentials(
  source: EnvSource = process.env,
): { url: string; token: string } | null {
  assertServerOnly("KV_REST_API_TOKEN");
  const hasUrl = hasValue(source, "KV_REST_API_URL");
  const hasToken = hasValue(source, "KV_REST_API_TOKEN");
  if (!hasUrl && !hasToken) return null;
  if (hasUrl !== hasToken) {
    throw new EnvConfigError("server", [
      {
        name: hasUrl ? "KV_REST_API_TOKEN" : "KV_REST_API_URL",
        kind: "missing",
        requirement: "set together with its pair to enable the shared KV backend",
      },
    ]);
  }
  const issues: EnvIssue[] = [];
  const url = requireValue(source, "KV_REST_API_URL", issues, "an absolute https:// URL");
  const token = requireValue(source, "KV_REST_API_TOKEN", issues, "a non-empty token");
  const urlIssue = validatePublicUrl(
    "KV_REST_API_URL",
    url,
    process.env.NODE_ENV,
  );
  if (urlIssue) issues.push(urlIssue);
  if (!url || !token) throw new EnvConfigError("server", issues);
  return { url, token };
}

/** Explicit backend override. `""` means "auto". */
export function rateLimitBackend(source: EnvSource = process.env): RateLimitBackend | "" {
  assertServerOnly("RATE_LIMIT_BACKEND");
  const value = readOptional(source, "RATE_LIMIT_BACKEND") ?? "";
  const issue = validateEnum("RATE_LIMIT_BACKEND", value || undefined, ["memory", "kv"]);
  if (issue) throw new EnvConfigError("server", [issue]);
  return value as RateLimitBackend | "";
}

/**
 * Tenor API key for the server-proxied GIF search. Optional: the feature
 * degrades to an explanatory empty state rather than requiring the key.
 */
export function tenorApiKey(source: EnvSource = process.env): string | undefined {
  assertServerOnly("TENOR_API_KEY");
  return readOptional(source, "TENOR_API_KEY");
}

export { SERVER_ONLY_SECRET_NAMES } from "./contract";