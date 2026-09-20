// ============================================================================
// src/lib/rate-limit.ts
//
// Rate limiting with two backends (GAP-RATE-01):
//   - In-process fixed-window limiter (default). Active out of the box on any
//     single process/deployment; buckets are per-instance only.
//   - Vercel KV REST API (Upstash protocol, shared across instances). Used
//     automatically when KV_REST_API_URL / KV_REST_API_TOKEN are configured.
//   - RATE_LIMIT_BACKEND=memory|kv forces a backend. "kv" with no config, and
//     any infra error, fail open (allow) so a KV outage never becomes a
//     self-inflicted outage; it is still logged.
//
// Trade-off: the in-process backend is per-instance, so on a multi-instance
// deployment each warm instance keeps its own counters. Configure a shared KV
// store before relying on limits at scale.
// ============================================================================

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const MEM_BUCKETS = new Map<string, MemoryBucket>();
const MEM_MAX_BUCKETS = 10_000;

function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL ?? "";
  const token = process.env.KV_REST_API_TOKEN ?? "";
  return url && token ? { url, token } : null;
}

export function rateLimitEnabled(): boolean {
  return kvConfig() !== null;
}

function forcedBackend(): "memory" | "kv" | "" {
  const v = process.env.RATE_LIMIT_BACKEND ?? "";
  return v === "memory" || v === "kv" ? v : "";
}

export function activeBackend(): "memory" | "kv" | "off" {
  const forced = forcedBackend();
  if (forced === "memory") return "memory";
  if (forced === "kv") return kvConfig() ? "kv" : "off";
  return kvConfig() ? "kv" : "memory";
}

function sweepMemory(now: number): void {
  if (MEM_BUCKETS.size < MEM_MAX_BUCKETS) return;
  for (const [key, bucket] of MEM_BUCKETS) {
    if (bucket.resetAt <= now) MEM_BUCKETS.delete(key);
  }
}

/** Fixed-window counter keyed by `key`, per process. */
function memoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweepMemory(now);
  const rk = `rl:${key}`;
  let bucket = MEM_BUCKETS.get(rk);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
    MEM_BUCKETS.set(rk, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds:
      bucket.count > limit ? Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) : 0,
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** Sliding fixed-window counter keyed by `key`. Rejects once `limit` is
 * exceeded within `windowSeconds`. Fails open when forced-KV is unconfigured
 * or the shared store is unavailable. */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const backend = activeBackend();
  if (backend === "memory") {
    return memoryRateLimit(key, limit, windowSeconds);
  }

  const kv = kvConfig();
  if (backend === "off" || !kv) {
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }

  const rk = `rl:${key}`;
  try {
    const res = await fetch(`${kv.url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${kv.token}`,
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

/** Test hook: drop all in-process buckets (call between tests). */
export function resetRateLimitMemory(): void {
  MEM_BUCKETS.clear();
}

export const __test = { rateLimitEnabled, activeBackend };