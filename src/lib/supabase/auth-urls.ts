// ============================================================================
// src/lib/supabase/auth-urls.ts
// Auth-flow URL + error helpers shared by server actions, route handlers,
// server components, and client components.
//
// Safety rules enforced here (see task requirements):
//  - All auth redirects are built from a TRUSTED origin (NEXT_PUBLIC_SITE_URL
//    in prod), never from an attacker-controllable Host header or raw input.
//  - The `?next=` parameter is sanitized to a same-origin relative path so no
//    Open Redirect can be exploited (e.g. `/login?next=https://evil.example`).
//  - Supabase error messages are mapped to clean, human-readable copy; raw DB
//    errors, stack traces, and tokens are never surfaced to the user.
// ============================================================================

/**
 * The application's trusted origin.
 *
 * Priority: `NEXT_PUBLIC_SITE_URL` → (in production only) the known Vercel
 * deployment URL → `http://localhost:3000` for local development.
 */
export function getSiteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // Fall through to the defaults below.
    }
  }
  return process.env.NODE_ENV === "production"
    ? "https://g4m37z-communities.vercel.app"
    : "http://localhost:3000";
}

/**
 * Sanitize a `?next=` target into a same-origin path (or `fallback`).
 *
 * Any value that resolves to a different origin — `https://evil.example`,
 * `//evil.example`, `javascript:…` — falls back. Output is always a relative
 * path (pathname + search + hash).
 */
export function sanitizeNextPath(
  next: unknown,
  fallback = "/",
): string {
  const fallbackPath = fallback.startsWith("/") ? fallback : `/${fallback}`;
  if (typeof next !== "string" || next.length === 0 || next.length > 2048) {
    return fallbackPath;
  }
  try {
    const url = new URL(next, getSiteOrigin());
    if (url.origin !== getSiteOrigin()) return fallbackPath;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallbackPath;
  }
}

/**
 * Build the Supabase auth callback URL used as `redirectTo` for email
 * confirmation, OAuth, and password recovery links. Always points at the
 * trusted origin's `/auth/callback`, optionally carrying a sanitized `?next=`.
 */
export function authCallbackUrl(next = "/"): string {
  const safe = sanitizeNextPath(next, "/");
  const base = `${getSiteOrigin()}/auth/callback`;
  return safe === "/" ? base : `${base}?next=${encodeURIComponent(safe)}`;
}

/**
 * Map common Supabase / GoTrue / network errors into clean, user-safe copy.
 * Never returns raw internals. Falls back to `fallback` for anything unknown.
 */
export function authErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  let message = "";
  if (typeof error === "string") message = error;
  else if (error && typeof error === "object" && "message" in error) {
    message = String((error as { message: unknown }).message ?? "");
  }
  const m = message.toLowerCase();

  if (m.includes("email not confirmed") || m.includes("confirm your email")) {
    return "Please verify your email first — check your inbox for the confirmation link.";
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Wrong email or password.";
  }
  if (m.includes("already registered") || m.includes("already an account")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("over_request_rate_limit")
  ) {
    return "Too many attempts right now. Please wait a minute and try again.";
  }
  if (
    m.includes("expired") ||
    m.includes("otp_expired") ||
    m.includes("invalid otp") ||
    m.includes("link has expired")
  ) {
    return "That link has expired or is no longer valid. Please request a new one.";
  }
  if (
    m.includes("flow_state_not_found") ||
    m.includes("invalid state") ||
    m.includes("exchange code")
  ) {
    return "That link is incomplete or has already been used. Please request a new one.";
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("fetch failed") ||
    m.includes("temporarily_unavailable")
  ) {
    return "A network problem stopped us. Check your connection and try again.";
  }
  if (
    m.includes("access_denied") ||
    m.includes("cancelled") ||
    m.includes("popup")
  ) {
    return "Sign-in was cancelled. Please try again.";
  }
  if (
    m.includes("provider") ||
    m.includes("oauth") ||
    m.includes("no provider")
  ) {
    return "Sign-in with that provider didn't complete. Please try again.";
  }
  if (
    m.includes("token") ||
    m.includes("session") ||
    m.includes("authentication failed")
  ) {
    return "Your session has expired. Please sign in again.";
  }

  return fallback;
}