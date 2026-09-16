import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getSiteOrigin,
  sanitizeNextPath,
  authCallbackUrl,
  authErrorMessage,
} from "@/lib/supabase/auth-urls";

describe("getSiteOrigin", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to localhost outside production", () => {
    expect(getSiteOrigin()).toBe("http://localhost:3000");
  });

  it("falls back to the production origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getSiteOrigin()).toBe("https://g4m37z-communities.vercel.app");
  });

  it("prefers NEXT_PUBLIC_SITE_URL and normalizes to an origin", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SITE_URL",
      "https://g4m37z-communities.vercel.app/some/path"
    );
    expect(getSiteOrigin()).toBe("https://g4m37z-communities.vercel.app");
  });

  it("ignores an invalid NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not a url");
    expect(getSiteOrigin()).toBe("http://localhost:3000");
  });
});

describe("sanitizeNextPath", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the fallback for non-strings and empty input", () => {
    expect(sanitizeNextPath(undefined)).toBe("/");
    expect(sanitizeNextPath(null)).toBe("/");
    expect(sanitizeNextPath("")).toBe("/");
    expect(sanitizeNextPath(42, "/home")).toBe("/home");
    expect(sanitizeNextPath("x".repeat(3000), "/home")).toBe("/home");
  });

  it("allows relative same-origin paths", () => {
    expect(sanitizeNextPath("/home")).toBe("/home");
    expect(sanitizeNextPath("/home?page=2")).toBe("/home?page=2");
    expect(sanitizeNextPath("/post/abc#comments")).toBe("/post/abc#comments");
  });

  it("allows absolute URLs on the trusted origin and reduces to a path", () => {
    const origin = sanitizeNextPath(
      "https://g4m37z-communities.vercel.app/communities"
    );
    expect(origin).toBe("/communities");
  });

  it("blocks external origins (open-redirect protection)", () => {
    expect(sanitizeNextPath("https://evil.example/phish")).toBe("/");
    expect(sanitizeNextPath("https://evil.example/phish", "/home")).toBe(
      "/home"
    );
    expect(sanitizeNextPath("//evil.example/phish")).toBe("/");
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/");
  });
});

describe("authCallbackUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the callback URL from the trusted origin", () => {
    const url = authCallbackUrl("/home");
    expect(url).toMatch(
      /^https:\/\/g4m37z-communities\.vercel\.app\/auth\/callback\?next=%2Fhome$/
    );
  });

  it("omits ?next= for the default target", () => {
    expect(authCallbackUrl("/")).toBe(
      "https://g4m37z-communities.vercel.app/auth/callback"
    );
  });

  it("never embeds an external target", () => {
    const url = authCallbackUrl("https://evil.example/phish");
    expect(url).toContain("/auth/callback");
    expect(url).not.toContain("evil.example");
  });
});

describe("authErrorMessage", () => {
  const fallback = "Something went wrong. Please try again.";
  it("maps common Supabase failures to clean copy", () => {
    expect(authErrorMessage("Email not confirmed")).toMatch(/verify your email/i);
    expect(authErrorMessage("Invalid login credentials")).toBe(
      "Wrong email or password."
    );
    expect(authErrorMessage("User already registered")).toMatch(/already exists/i);
    expect(authErrorMessage("Email rate limit exceeded")).toMatch(/wait a minute/i);
    expect(authErrorMessage("Link has expired")).toMatch(/expired/i);
    expect(authErrorMessage("Provider access_denied")).toMatch(/cancelled/i);
    expect(authErrorMessage("Failed to fetch")).toMatch(/network/i);
  });

  it("accepts Supabase error objects", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Wrong email or password."
    );
  });

  it("never leaks unknown raw internals", () => {
    const raw = "internal stack: at db.query / pg error 2XD25";
    const out = authErrorMessage(raw, fallback);
    expect(out).toBe(fallback);
    expect(out).not.toContain("pg error");
    expect(out).not.toContain("2XD25");
  });
});