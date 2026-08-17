// ============================================================================
// src/app/auth/callback/route.ts
// Auth callback handler. Supabase redirects the user here after they click the
// confirmation link in their email. We exchange the auth code for a session
// cookie, ensure a profile row exists (RLS-protected insert using the new
// session), then redirect to ?next=.
// ============================================================================

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/home";

  if (!code) {
    return Response.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth/callback exchange failed:", error);
    return Response.redirect(
      new URL("/login?error=exchange_failed", url.origin)
    );
  }

  // Session is now established via the cookie set by exchangeCodeForSession.
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
      // signup time. Using the cookie-bound client so RLS WITH CHECK
      // (auth.uid() = id) enforces ownership.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fallbackUsername =
        (typeof meta.username === "string" && meta.username.trim()) ||
        (user.email ? user.email.split("@")[0] : user.id);
      const fallbackDisplay =
        (typeof meta.display_name === "string" && meta.display_name.trim()) ||
        fallbackUsername;

      // Sanitize the username to match our policy in case of garbage in metadata.
      const safeUsername =
        String(fallbackUsername)
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .slice(0, 30) || `user_${user.id.slice(0, 8)}`;

      const { error: insertErr } = await supabase.from("profiles").insert({
              id: user.id,
              username: safeUsername,
              display_name: String(fallbackDisplay).slice(0, 80),
              terms_version: typeof meta.terms_version === "string" ? meta.terms_version : null,
              terms_accepted_at:
                typeof meta.terms_accepted_at === "string" ? meta.terms_accepted_at : null,
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
            new URL(
              "/settings?error=username_taken",
              url.origin
            )
          );
        }
        // Other errors: log and continue — the user is authenticated.
        // They can finish profile setup at /settings later.
      }
    }
  }

  return Response.redirect(new URL(next, url.origin));
}
