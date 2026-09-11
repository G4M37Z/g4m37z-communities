// ============================================================================
// src/proxy.ts
// Next.js 16 request proxy (formerly middleware). Refreshes the Supabase
// session cookie on eligible requests — the pattern referenced by
// src/lib/supabase/server.ts ("session refresh is handled by middleware").
//
// Note: this proxy previously didn't exist; the session was only refreshed
// lazily inside createClient(). With this file, tokens that are close to
// expiring are refreshed centrally and no protected page blacks out.
// ============================================================================

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Not configured — let every page render; the stub client already
    // returns empty data.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh the session (no-op when valid) so cookies stay fresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Refresh the session on all routes except static assets and API internals:
     * - Next.js internals: _next/static, _next/image
     * - public files
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};