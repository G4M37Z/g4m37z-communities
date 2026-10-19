// Deterministic tests for the environment configuration contract.
//
// Every credential below is SYNTHETIC and deliberately fake. These values are
// not valid keys and grant no access to anything. The assertions that matter
// most are the negative ones: a rejected value must never appear in a
// diagnostic, an Error, or any rendered output.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  EnvConfigError,
  collectEnvIssues,
  collectPublicEnvIssues,
  formatIssues,
  hasValue,
  missingRequiredEnvNames,
  readOptional,
  requireValue,
  validateEnum,
  validatePublicUrl,
  ENV_CONTRACT,
  PUBLIC_ENV_NAMES,
  REQUIRED_ENV_NAMES,
  SERVER_ONLY_SECRET_NAMES,
} from "@/lib/env/contract";
import { checkBuildEnv, assertBuildEnv } from "@/lib/env/build";
import {
  kvCredentials,
  rateLimitBackend,
  supabaseServiceRoleKey,
  tenorApiKey,
} from "@/lib/env/server";

// ── Synthetic fixtures (fake, non-functional, not real credentials) ─────────
const FAKE_URL = "https://fake-project.supabase.co";
const FAKE_ANON = "eyJhbGciOiJIUzI1NiJ9.fake-anon-payload-not-a-real-key.fake-signature";
const FAKE_SERVICE =
  "eyJhbGciOiJIUzI1NiJ9.fake-service-role-payload-not-real.deadbeefcafe";
const FAKE_SECRET = "fake-secret-value-must-never-be-echoed-0123456789";

const healthy = () => ({
  NEXT_PUBLIC_SUPABASE_URL: FAKE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: FAKE_ANON,
  NEXT_PUBLIC_SITE_URL: "https://fake-site.example",
  SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE,
});

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("contract inventory", () => {
  it("classifies every referenced variable exactly once", () => {
    const names = ENV_CONTRACT.map((v) => v.name);
    expect(new Set(names).size).toBe(names.length);
    for (const spec of ENV_CONTRACT) {
      expect(["A-public", "B-server-secret", "C-config"]).toContain(spec.classification);
      expect(spec.purpose.length).toBeGreaterThan(10);
    }
  });

  it("only classifies NEXT_PUBLIC_-prefixed variables as public", () => {
    for (const spec of ENV_CONTRACT) {
      if (spec.classification === "A-public") {
        expect(spec.name.startsWith("NEXT_PUBLIC_")).toBe(true);
      }
      if (spec.classification === "B-server-secret") {
        expect(spec.name.startsWith("NEXT_PUBLIC_")).toBe(false);
      }
    }
  });

  it("lists required and server-only names without any values", () => {
    expect(REQUIRED_ENV_NAMES).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(REQUIRED_ENV_NAMES).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(SERVER_ONLY_SECRET_NAMES).toContain("SUPABASE_SERVICE_ROLE_KEY");
    for (const name of SERVER_ONLY_SECRET_NAMES) {
      expect(name.startsWith("NEXT_PUBLIC_")).toBe(false);
    }
    expect(PUBLIC_ENV_NAMES.every((n) => n.startsWith("NEXT_PUBLIC_"))).toBe(true);
  });
});

describe("diagnostics never echo values", () => {
  it("reports missing vs empty distinctly, by name only", () => {
    const issues: ReturnType<typeof collectEnvIssues> = [];
    const source = { SOME_KEY: "   " };
    expect(readOptional(source, "SOME_KEY")).toBeUndefined();
    requireValue(source, "SOME_KEY", issues);
    requireValue({}, "ABSENT_KEY", issues);
    expect(issues.map((i) => [i.name, i.kind])).toEqual([
      ["SOME_KEY", "empty"],
      ["ABSENT_KEY", "missing"],
    ]);
  });

  it("keeps a rejected secret value out of the thrown error", () => {
    let caught: unknown;
    try {
      supabaseServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: "   " });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(EnvConfigError);
    const message = (caught as Error).message;
    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(message).not.toContain(FAKE_SECRET);
    expect((caught as EnvConfigError).issues[0].kind).toBe("empty");
  });

  it("keeps every formatIssue rendering value-free", () => {
    const rendered = formatIssues([
      { name: "SUPABASE_SERVICE_ROLE_KEY", kind: "malformed", requirement: "a key" },
    ]);
    expect(rendered).toBe("  - SUPABASE_SERVICE_ROLE_KEY: malformed — expected a key");
    expect(rendered).not.toMatch(/eyJ|secret|token/i);
  });
});

describe("required server-only secrets", () => {
  it("returns the key when present", () => {
    expect(
      supabaseServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE }),
    ).toBe(FAKE_SERVICE);
  });

  it("throws a names-only error when absent", () => {
    expect(() => supabaseServiceRoleKey({})).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("refuses a half-configured KV pair instead of silently degrading", () => {
    expect(() => kvCredentials({ KV_REST_API_URL: FAKE_URL })).toThrow(
      /KV_REST_API_TOKEN/,
    );
    try {
      kvCredentials({ KV_REST_API_URL: FAKE_URL });
    } catch (err) {
      expect((err as Error).message).not.toContain(FAKE_URL);
    }
  });

  it("returns KV credentials only when the pair is complete", () => {
    expect(kvCredentials({})).toBeNull();
    expect(
      kvCredentials({ KV_REST_API_URL: FAKE_URL, KV_REST_API_TOKEN: FAKE_SECRET }),
    ).toEqual({ url: FAKE_URL, token: FAKE_SECRET });
  });

  it("validates RATE_LIMIT_BACKEND as an enum and treats unset as auto", () => {
    expect(rateLimitBackend({})).toBe("");
    expect(rateLimitBackend({ RATE_LIMIT_BACKEND: "kv" })).toBe("kv");
    expect(() => rateLimitBackend({ RATE_LIMIT_BACKEND: "redis" })).toThrow(
      /RATE_LIMIT_BACKEND/,
    );
  });

  it("treats optional integrations as optional", () => {
    expect(tenorApiKey({})).toBeUndefined();
    expect(tenorApiKey({ TENOR_API_KEY: FAKE_SECRET })).toBe(FAKE_SECRET);
    expect(collectEnvIssues({}, "production")).toEqual([]);
  });
});

describe("shape validation", () => {
  it("requires an absolute http(s) URL", () => {
    expect(validatePublicUrl("X", "not a url", "development")).toEqual({
      name: "X",
      kind: "malformed",
      requirement: expect.stringContaining("http(s)"),
    });
    expect(validatePublicUrl("X", FAKE_URL, "production")).toBeNull();
  });

  it("requires https for production URLs", () => {
    expect(validatePublicUrl("X", "http://fake.example", "production")).not.toBeNull();
    expect(validatePublicUrl("X", "http://localhost:3000", "development")).toBeNull();
  });

  it("accepts only known enum values", () => {
    expect(validateEnum("E", "a", ["a", "b"])).toBeNull();
    expect(validateEnum("E", "c", ["a", "b"])).not.toBeNull();
  });

  it("flags malformed public values by name", () => {
    const issues = collectPublicEnvIssues(
      { NEXT_PUBLIC_SUPABASE_URL: FAKE_SECRET, NEXT_PUBLIC_TURN_URL: "https://x" },
      "production",
    );
    const names = issues.map((i) => i.name);
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(names).toContain("NEXT_PUBLIC_TURN_URL");
    for (const issue of issues) {
      expect(issue.kind).toBe("malformed");
    }
    expect(formatIssues(issues)).not.toContain(FAKE_SECRET);
  });

  it("accepts the documented healthy configuration", () => {
    expect(collectEnvIssues(healthy(), "production")).toEqual([]);
    expect(checkBuildEnv({ ...healthy(), NODE_ENV: "production" }).ok).toBe(true);
  });
});

describe("build boundary", () => {
  it("fails a production build on malformed configuration", () => {
    expect(() =>
      assertBuildEnv({
        ...healthy(),
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: FAKE_SECRET,
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("never prints the rejected value when refusing to build", () => {
    try {
      assertBuildEnv({
        ...healthy(),
        NODE_ENV: "production",
        RATE_LIMIT_BACKEND: "bogus-backend",
      });
    } catch (err) {
      expect((err as Error).message).not.toContain("bogus-backend");
    }
    expect(console.warn).toHaveBeenCalled();
  });

  it("keeps dev and fork builds fail-soft on missing credentials", () => {
    expect(() => assertBuildEnv({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertBuildEnv({})).not.toThrow();
  });

  it("fails on missing required variables only under STRICT_ENV=1", () => {
    const partial = { NEXT_PUBLIC_SUPABASE_URL: FAKE_URL, NODE_ENV: "production" };
    expect(() => assertBuildEnv(partial)).not.toThrow();
    expect(() => assertBuildEnv({ ...partial, STRICT_ENV: "1" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("reports missing required names without values", () => {
    expect(missingRequiredEnvNames(healthy())).toEqual([]);
    expect(missingRequiredEnvNames({})).toEqual([
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    expect(hasValue({}, "SUPABASE_SERVICE_ROLE_KEY")).toBe(false);
  });
});

describe("public env is fail-soft in the browser", () => {
  it("returns undefined for absent, blank, and malformed values", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "short");
    const pub = await import("@/lib/env/public");

    expect(pub.publicEnv.supabaseUrl).toBeUndefined();
    expect(pub.supabaseUrl()).toBeUndefined();
    expect(pub.supabaseAnonKey()).toBeUndefined();
    expect(pub.isSupabasePublicConfigured()).toBe(false);
    expect(pub.siteOrigin()).toBeUndefined();
    expect(pub.isTurnConfigured()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("exposes valid public values to the browser by design", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", FAKE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", FAKE_ANON);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fake-site.example/path");
    vi.stubEnv("NEXT_PUBLIC_TURN_URL", "turn:turn.fake.example:3478");
    vi.stubEnv("NEXT_PUBLIC_TURN_USERNAME", "fake-user");
    vi.stubEnv("NEXT_PUBLIC_TURN_CREDENTIAL", "fake-credential");
    const pub = await import("@/lib/env/public");

    expect(pub.supabaseUrl()).toBe(FAKE_URL);
    expect(pub.supabaseAnonKey()).toBe(FAKE_ANON);
    expect(pub.siteOrigin()).toBe("https://fake-site.example");
    expect(pub.isSupabasePublicConfigured()).toBe(true);
    expect(pub.isTurnConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("client/server boundary", () => {
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  };

  const files = walk(join(process.cwd(), "src"));

  it("keeps server-only env modules out of Client Components", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/m.test(src)) continue;
      if (/@\/lib\/env\/server|@\/lib\/supabase\/admin/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps server-only secrets out of the public env module", () => {
    const publicSrc = readFileSync(join(process.cwd(), "src/lib/env/public.ts"), "utf8");
    const reads = publicSrc.match(/process\.env\.[A-Za-z_0-9]+/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(read).toMatch(/process\.env\.NEXT_PUBLIC_/);
    }
  });

  it("reads no server-only secret outside the server env module", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith(join("lib", "env", "server.ts"))) continue;
      const src = readFileSync(file, "utf8");
      for (const secret of SERVER_ONLY_SECRET_NAMES) {
        if (src.includes(`process.env.${secret}`)) offenders.push(`${file}: ${secret}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("repository hygiene", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
  const parse = (p: string) =>
    read(p)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => /^(?:export\s+)?([A-Za-z_0-9]+)=(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => ({ name: m[1], value: m[2].trim().replace(/^["']|["']$/g, "") }));

  it(".env.example documents every contract variable", () => {
    const declared = new Set(parse(".env.example").map((v) => v.name));
    for (const spec of ENV_CONTRACT) {
      expect(declared).toContain(spec.name);
    }
  });

  it(".env.example carries no credential-shaped values", () => {
    for (const { name, value } of parse(".env.example")) {
      if (value === "") continue;
      if (name === "NEXT_PUBLIC_SITE_URL") {
        expect(value).toBe("http://localhost:3000");
        continue;
      }
      expect(
        /^(eyJ|sk-|sbp_|sbs_|AIza|Bearer\s)/.test(value),
        `${name} must stay empty or an obvious non-credential placeholder`,
      ).toBe(false);
    }
  });

  it(".env.example is marked as a template", () => {
    expect(read(".env.example")).toMatch(/TEMPLATE/);
  });

  it(".gitignore covers env files but keeps the template", () => {
    const ignore = read(".gitignore");
    expect(ignore).toMatch(/^\.env\*$/m);
    expect(ignore).toMatch(/^!\.env\.example$/m);
  });
});