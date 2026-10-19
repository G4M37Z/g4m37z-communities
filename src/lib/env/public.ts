// ============================================================================
// src/lib/env/public.ts
// The single source of truth for BROWSER-SAFE configuration.
//
// Every value read here is `NEXT_PUBLIC_*`, i.e. inlined into the client bundle
// by Next at build time. Nothing in this file may read a non-public variable:
// this module is imported from Client Components (see src/lib/ice-servers.ts)
// and must therefore stay free of server-only secrets.
//
// Values are read fail-soft (`string | undefined`) because client components
// mount unconditionally. Hard validation happens on the server at the build
// boundary (src/lib/env/build.ts) and on first privileged use
// (src/lib/env/server.ts) — never by crashing a client render.
// ============================================================================

// Values are read through getters so `process.env` is consulted at call time,
// not captured once at module import. Next still inlines each literal
// `process.env.NEXT_PUBLIC_*` expression at build time, so the client bundle
// behavior is unchanged; tests, however, can stub env vars after import.
export const publicEnv = {
  /** Supabase project URL — public, also used as the storage-host allowlist. */
  get supabaseUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
  },
  /**
   * Supabase anon / publishable key. Public BY DESIGN: every read and write is
   * still constrained by Row Level Security, which is the actual authorization
   * boundary — the key is not a credential on its own.
   */
  get supabaseAnonKey(): string | undefined {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;
  },
  /** Canonical origin used for auth callbacks, robots.txt, sitemap, metadata. */
  get siteUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined;
  },
  /**
   * TURN relay URLs (comma-separated). TURN credentials are unavoidably
   * client-visible — the browser needs them inside every SDP offer — so they
   * are NOT secrets; they must be short-lived and provider-rotating, and the
   * relay must be protected by auth, not by secrecy.
   */
  get turnUrl(): string | undefined {
    return process.env.NEXT_PUBLIC_TURN_URL?.trim() || undefined;
  },
  get turnUsername(): string | undefined {
    return process.env.NEXT_PUBLIC_TURN_USERNAME?.trim() || undefined;
  },
  get turnCredential(): string | undefined {
    return process.env.NEXT_PUBLIC_TURN_CREDENTIAL?.trim() || undefined;
  },
} as const;

/** True when the browser client can talk to Supabase at all. */
export function isSupabasePublicConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** True when a TURN relay is fully configured (URL + username + credential). */
export function isTurnConfigured(): boolean {
  return Boolean(publicEnv.turnUrl && publicEnv.turnUsername && publicEnv.turnCredential);
}

export { PUBLIC_ENV_NAMES } from "./contract";
/**
 * Shape-validated Supabase URL. Returns `undefined` when the variable is
 * absent OR malformed, so a typo degrades to the fail-soft stub client instead
 * of throwing "Invalid supabaseUrl" inside a render and 500ing the page.
 */
export function supabaseUrl(): string | undefined {
  const raw = publicEnv.supabaseUrl;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/** Shape-validated Supabase anon / publishable key (absent or malformed → undefined). */
export function supabaseAnonKey(): string | undefined {
  const raw = publicEnv.supabaseAnonKey;
  if (!raw) return undefined;
  return /^[A-Za-z0-9._-]{20,}$/.test(raw) ? raw : undefined;
}

/**
 * Shape-validated site origin. Returns `undefined` when NEXT_PUBLIC_SITE_URL is
 * absent or malformed, so metadata/robots/sitemap fall back to their documented
 * defaults instead of throwing inside a render (`new URL()` on a bad value).
 */
export function siteOrigin(): string | undefined {
  const raw = publicEnv.siteUrl;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
