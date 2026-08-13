// ============================================================================
// src/lib/supabase/admin.ts
// Privileged Supabase client for server-only use.
//
// Uses the service_role key, which BYPASSES Row Level Security. Only use this
// from trusted server code (Route Handlers, Server Actions, webhooks) — never
// import it into a Client Component.
//
// We use `@supabase/supabase-js` (NOT `@supabase/ssr`) because we don't need
// cookie-bound sessions here; the service role authenticates by API key.
// ============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client authenticated with the service_role key.
 *
 * The service_role key is server-side only — it bypasses RLS so we can
 * perform platform-level operations (e.g. backfilling a missing profile
 * from /auth/callback, or admin moderation actions later in the project)
 * regardless of the caller's auth state.
 *
 * No session persistence — we never need to refresh tokens, and we want
 * to make absolutely sure no service_role cookie leaks to the browser.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL — check your .env.local file."
    );
  }
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — this server-only key is " +
        "required for service-level operations. Never expose this key to " +
        "the browser."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
