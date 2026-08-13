// ============================================================================
// src/app/auth/callback/route.ts
// Auth callback handler. Supabase redirects the user here after they click the
// confirmation link in their email. We exchange the auth code for a session
// cookie, ensure a profile exists, then redirect to ?next= (or / by default).
// ============================================================================

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

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

  // Confirm the session is now valid and ensure a profile row exists.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();

    const { data: existing, error: lookupErr } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (lookupErr) {
      console.error("auth/callback profile lookup failed:", lookupErr);
    }

    if (!existing) {
      // Profile wasn't created during signup (e.g. signup happened before this
      // confirmation flow). Create one now using metadata collected at sign-up.
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fallbackUsername =
        (typeof meta.username === "string" && meta.username) ||
        (user.email ? user.email.split("@")[0] : user.id);
      const fallbackDisplay =
        (typeof meta.display_name === "string" && meta.display_name) ||
        fallbackUsername;

      // Sanitize the username to match our policy in case of garbage in metadata.
      const safeUsername = String(fallbackUsername)
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 30) || `user_${user.id.slice(0, 8)}`;

      const { error: insertErr } = await admin.from("profiles").insert({
        id: user.id,
        username: safeUsername,
        display_name: String(fallbackDisplay).slice(0, 80),
      });

      if (insertErr) {
        console.error("auth/callback profile insert failed:", insertErr);
        // Non-fatal — the user is authenticated. They can finish setup at /settings.
      }
    }
  }

  return Response.redirect(new URL(next, url.origin));
}
