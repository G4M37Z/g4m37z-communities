// ============================================================================
// src/lib/rate-limit.ts
//
// Env-gated rate limiting over the Vercel KV REST API (Upstash protocol).
// When KV_REST_API_URL / KV_REST_API_TOKEN are not configured the limiter is
// a no-op that allows everything (fail-open), which keeps the app fully
// functional on hosts without KV. On infra errors it also fails open but
// logs, so a KV outage never turns into a self-inflicted outage.
// ============================================================================

const KV_URL = process.env.KV_REST_API_URL ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? "";

export function rateLimitEnabled(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Sliding fixed-window counter keyed by `key`. Rejects once `limit` is
 * exceeded within `windowSeconds`. Fails open when unconfigured/unavailable. */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!rateLimitEnabled()) {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
  const rk = `rl:${key}`;
  try {
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${KV_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", rk],
        ["EXPIRE", rk, windowSeconds, "NX"],
        ["TTL", rk],
      ]),
    });
    if (!res.ok) {
      console.error("rateLimit KV request failed:", res.status);
      return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
    }
    const body = (await res.json()) as unknown[];
    const count = Number((body[0] as unknown[])?.[0] ?? 0);
    const ttl = Number((body[2] as unknown[])?.[0] ?? windowSeconds);
    const remaining = Math.max(0, limit - count);
    return {
      allowed: count <= limit,
      remaining,
      retryAfterSeconds: count > limit ? Math.max(1, ttl) : 0,
    };
  } catch (err) {
    console.error("rateLimit failed open:", err);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

export const __test = { rateLimitEnabled };