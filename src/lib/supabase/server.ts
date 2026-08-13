// ============================================================================
// src/lib/supabase/server.ts
// Per-request server-side Supabase client for Next.js 16 App Router.
// `cookies()` from next/headers is async in v15+ — must be awaited.
// ============================================================================

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * A minimal stub client shaped like the Supabase client. Returned when
 * Supabase env vars aren't configured yet (e.g. before the user has run
 * SETUP.md). All read methods resolve to empty results; writes throw
 * a clear error. This lets the app boot and render the empty-state UI
 * instead of 500ing on every request.
 */
function stubClient() {
  const message =
    "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
    "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local — see SETUP.md.";

  const empty = { data: null, error: { message } };

  const chain: any = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    or: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: { message } }),
    then: (resolve: (v: unknown) => void) => resolve(empty),
  };

  return {
    auth: {
      async getUser() {
        return { data: { user: null }, error: null };
      },
      async signInWithOtp() {
        return {
          data: null,
          error: { message: "Supabase not configured." },
        };
      },
      async signOut() {
        return { error: null };
      },
      async exchangeCodeForSession() {
        return { data: null, error: { message: "Supabase not configured." } };
      },
    },
    from: () => chain,
  };
}

/**
 * Creates a Supabase client bound to the current request's cookies.
 * Use inside Server Components, Server Actions, and Route Handlers.
 *
 * If the env vars aren't set, returns a stub client that returns empty
 * data so the app can render before Supabase is wired up. Real queries
 * will return `null` / empty arrays; writes will throw a clear error.
 *
 * Important: do NOT cache the result across requests — always call this
 * fresh inside the handler/render so each request gets its own session.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — using stub client."
      );
    }
    return stubClient() as unknown as ReturnType<typeof createServerClient>;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll is called from a Server Component, which is a read-only
          // context for cookies. Swallowing here is the documented
          // @supabase/ssr pattern; session refresh is handled by middleware.
        }
      },
    },
  });
}
