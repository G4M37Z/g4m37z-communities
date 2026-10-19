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
import { supabaseUrl } from "@/lib/env/public";
import { supabaseServiceRoleKey } from "@/lib/env/server";

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
  const url = supabaseUrl();
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL — check your .env.local file " +
        "(see .env.example)."
    );
  }
  // Server-only secret. Throws a names-only diagnostic when unset.
  const serviceKey = supabaseServiceRoleKey();

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
