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

  // Look up the user, then guarantee a profile row exists.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // ensure_profile() (migration 036) is a SECURITY DEFINER RPC that
    // idempotently creates the CALLER's own profile row from their metadata /
    // email, deriving a unique username (auto-suffixed on collision). This
    // replaces a raw insert whose 23505 branch stranded the user at
    // /settings?error=username_taken — a page that cannot change usernames.
    const { error: ensureErr } = await supabase.rpc("ensure_profile");
    if (ensureErr) {
      // The user is authenticated; a profile hiccup must not block sign-in.
      // ensure_profile also runs on password sign-in and covers existing users.
      console.error("auth/callback ensure_profile failed:", ensureErr);
    }

    // Audit log: every ToS acceptance is recorded (best-effort).
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
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
      const { error: termsErr } = await supabase
        .from("terms_acceptances")
        .insert({
          user_id: user.id,
          terms_version: meta.terms_version,
          accepted_at: meta.terms_accepted_at,
          ip_address: ip,
          user_agent: ua,
        });
      if (termsErr) {
        console.error("auth/callback terms_acceptances insert failed:", termsErr);
      }
    }
  }

  return Response.redirect(new URL(next, url.origin));
}