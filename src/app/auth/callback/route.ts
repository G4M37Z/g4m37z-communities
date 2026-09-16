// ============================================================================
// src/app/auth/callback/route.ts
// Auth callback handler. Supabase redirects the user here after they click the
// confirmation link in their email, or after Google OAuth returns. We exchange
// the auth code for a session cookie, ensure a profile row exists (RLS-protected
// insert using the new session), then route onward:
//   - type=recovery  → /reset-password (set-new-password UI)
//   - signup / OAuth → sanitized ?next= (default "/")
// Behavior is verified on the server; every redirect target is same-origin.
// ============================================================================

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/supabase/auth-urls";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const next = sanitizeNextPath(url.searchParams.get("next"), "/");
  const supabaseError = url.searchParams.get("error");

  // Supabase failed before we ever got a code (e.g. Google OAuth denied).
  if (supabaseError) {
    console.warn("auth/callback provider error:", supabaseError);
    return Response.redirect(
      new URL("/login?error=oauth_failed", url.origin)
    );
  }

  if (!code) {
    return Response.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth/callback exchange failed:", error);
    const message = error.message ?? "";
    const expiredOrUsed =
      /expired|otp_expired|already used|flow_state_not_found|invalid.*code|code.*invalid|not found/i.test(
        message
      );
    return Response.redirect(
      new URL(
        `/login?error=${expiredOrUsed ? "link_expired" : "exchange_failed"}`,
        url.origin
      )
    );
  }

  // Session is now established via the cookie set by exchangeCodeForSession.
  // Password recovery links arrive with type=recovery — route them to the
  // set-new-password page instead of the normal post-login target.
  if (type === "recovery") {
    return Response.redirect(new URL("/reset-password", url.origin));
  }

  // Look up the user, then ensure a profile row exists.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Look up using the cookie-bound client — RLS allows SELECT for everyone.
    const { data: existing, error: lookupErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (lookupErr) {
      console.error("auth/callback profile lookup failed:", lookupErr);
    }

    if (!existing) {
      // No profile yet — create one from the user_metadata collected at
      // signup (or returned by the OAuth provider). Using the cookie-bound
      // client so RLS WITH CHECK (auth.uid() = id) enforces ownership.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const str = (v: unknown) =>
        typeof v === "string" && v.trim() ? v.trim() : "";

      const fallbackUsername =
        str(meta.username) ||
        str(meta.user_name) ||
        (user.email ? user.email.split("@")[0] : user.id);
      const fallbackDisplay =
        str(meta.display_name) ||
        str(meta.full_name) ||
        str(meta.name) ||
        fallbackUsername;

      // Sanitize the username to match our policy in case of garbage in metadata.
      const safeUsername =
        String(fallbackUsername)
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .slice(0, 30) || `user_${user.id.slice(0, 8)}`;

      const avatar = str(meta.avatar_url) || str(meta.picture) || null;

      const { error: insertErr } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username: safeUsername,
          display_name: String(fallbackDisplay).slice(0, 80),
          avatar_url: avatar,
          terms_version:
            typeof meta.terms_version === "string"
              ? meta.terms_version
              : null,
          terms_accepted_at:
            typeof meta.terms_accepted_at === "string"
              ? meta.terms_accepted_at
              : null,
        });

      // Audit log: every ToS acceptance is recorded.
      if (
        typeof meta.terms_version === "string" &&
        typeof meta.terms_accepted_at === "string"
      ) {
        const headers = request.headers;
        const ip =
          headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          headers.get("x-real-ip") ??
          null;
        const ua = headers.get("user-agent") ?? null;
        await supabase.from("terms_acceptances").insert({
          user_id: user.id,
          terms_version: meta.terms_version,
          accepted_at: meta.terms_accepted_at,
          ip_address: ip,
          user_agent: ua,
        });
      }

      if (insertErr) {
        // Most common cause: username collision (the user picked a name
        // someone else grabbed between signup and confirmation).
        console.error("auth/callback profile insert failed:", insertErr);
        if (insertErr.code === "23505") {
          // Redirect to settings so they can pick a new username.
          return Response.redirect(
            new URL("/settings?error=username_taken", url.origin)
          );
        }
        // Other errors: log and continue — the user is authenticated.
        // They can finish profile setup at /settings later.
      }
    }
  }

  return Response.redirect(new URL(next, url.origin));
}