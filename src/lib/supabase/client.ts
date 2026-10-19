// ============================================================================
// src/lib/supabase/client.ts
// Browser-side Supabase singleton. Safe to import from Client Components.
//
// Fail-soft parity with server.ts (stub client there): when the NEXT_PUBLIC
// env vars are absent the returned client is a benign no-op whose every call
// resolves to `{ data: null, error: null }` instead of throwing. This matters
// because client components mount unconditionally (NotificationBell, unread
// badges, presence…) — a hard throw at mount crashes hydration for the whole
// page ("This page couldn't load"). With the stub the page renders signed-out
// gracefully; a warn is emitted once so misconfiguration stays visible in dev.
// ============================================================================

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env/public";

export function createClient() {
  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();

  if (url && anonKey) {
    return createBrowserClient(url, anonKey) as SupabaseClient;
  }

  warnOnce();
  return makeClientStub() as unknown as SupabaseClient;
}

let warned = false;
function warnOnce() {
  if (warned || typeof console === "undefined") return;
  warned = true;
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or " +
      "malformed — using the no-op browser stub (pages render signed-out). " +
      "See .env.example and docs/ENVIRONMENT_VARIABLES.md.",
  );
}

/** Benign chainable stub: every property access returns a function, every
 * function call returns a stub that is both chainable and awaitable, and an
 * awaited stub resolves to `{ data: null, error: null }`. Covers the shapes
 * the app uses: `from(...).select(...).eq(...).maybeSingle()`, `rpc(...)`,
 * `auth.getUser(...)`, `channel(...).on(...).subscribe()`, `removeChannel(...)`. */
function makeClientStub(): unknown {
  interface StubNode {
    ( ..._args: unknown[] ): unknown;
    then(
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ): Promise<unknown>;
    catch(onRejected: (e: unknown) => unknown): Promise<unknown>;
    finally(onFinally?: () => void): Promise<unknown>;
  }
  function makeNode(): StubNode {
    const node = (function call() {
      return makeNode();
    } as unknown) as StubNode;
    node.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(resolve, reject);
    node.catch = (onRejected: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected);
    node.finally = (onFinally?: () => void) =>
      Promise.resolve({ data: null, error: null }).finally(onFinally);
    return new Proxy(node, {
      get(target, prop) {
        if (prop in target) {
          return (target as unknown as Record<string | symbol, unknown>)[prop];
        }
        return makeNode();
      },
      apply(target, _thisArg, args) {
        return Reflect.apply(node, target, args);
      },
    });
  }
  return makeNode()();
}
