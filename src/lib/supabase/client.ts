// ============================================================================
// src/lib/supabase/client.ts
// Browser-side Supabase singleton. Safe to import from Client Components.
// ============================================================================

"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.local)."
    );
  }

  return createBrowserClient(url, anonKey);
}
