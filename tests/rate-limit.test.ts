// Deterministic tests for the rate limiter backends (GAP-RATE-01).
//
// The in-process backend is the default so rate limits are active out of the
// box; the Vercel KV (Upstash) backend is used when KV env vars are present
// and fails open on infra errors — never taking the app down with it.

import { describe, it, expect, vi, afterEach } from "vitest";
import { rateLimit, rateLimitEnabled, resetRateLimitMemory, __test } from "@/lib/rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetRateLimitMemory();
});

describe("backend selection", () => {
  it("defaults to the in-process backend when KV is not configured", () => {
    expect(__test.activeBackend()).toBe("memory");
  });

  it("uses KV when KV_REST_API_URL / TOKEN are configured", () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "tok");
    expect(__test.activeBackend()).toBe("kv");
  });

  it("RATE_LIMIT_BACKEND=memory forces in-process even with KV configured", () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "tok");
    vi.stubEnv("RATE_LIMIT_BACKEND", "memory");
    expect(__test.activeBackend()).toBe("memory");
  });

  it("RATE_LIMIT_BACKEND=kv without config is off (fail open)", () => {
    vi.stubEnv("RATE_LIMIT_BACKEND", "kv");
    expect(__test.activeBackend()).toBe("off");
    expect(rateLimitEnabled()).toBe(false);
  });
});

describe("in-process backend enforces windows", () => {
  it("rejects once the limit is exceeded within a window", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await rateLimit("k", 5, 60)).allowed).toBe(true);
    }
    const sixth = await rateLimit("k", 5, 60);
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the counter after the window elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T00:00:00Z"));
    for (let i = 0; i < 5; i += 1) {
      await rateLimit("k2", 5, 60);
    }
    expect((await rateLimit("k2", 5, 60)).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-09-20T00:01:00Z"));
    expect((await rateLimit("k2", 5, 60)).allowed).toBe(true);
  });

  it("keys are independent", async () => {
    for (let i = 0; i < 5; i += 1) {
      await rateLimit("a", 5, 60);
    }
    expect((await rateLimit("blah", 5, 60)).allowed).toBe(true);
  });
});

describe("KV backend fails open on infra errors", () => {
  it("returns allowed when the KV endpoint errors", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "tok");
    const err = new Error("boom");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(err)));
    const r = await rateLimit("k", 5, 60);
    expect(r.allowed).toBe(true);
  });

  it("returns allowed when the KV endpoint returns an HTTP error", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    const r = await rateLimit("k", 5, 60);
    expect(r.allowed).toBe(true);
  });
});