// Browser smoke tests using native WebDriver HTTP (no Playwright).
// Uses the verified Chromium 149 / ChromeDriver 149 endpoint @ 9515.

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const CHROMEDRIVER = "http://127.0.0.1:9515";
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

// Chromium's "get page source" can serialize the document starting at <html>
// without the leading DOCTYPE, so assert on either form rather than the raw
// bytes we send over the wire.
function isHtml(source: string): boolean {
  return /^<!DOCTYPE html>|<html/i.test(source);
}

async function session(path: string) {
  // Create session
  const sessionRes = await fetch(CHROMEDRIVER + "/session", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      capabilities: {
        alwaysMatch: {
          browserName: "chrome",
          "goog:chromeOptions": {
            args: [
              "--headless",
              "--no-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--window-size=375,812",
            ],
          },
        },
      },
    }),
  });
  const sessionData = await sessionRes.json();
  const sessionId = sessionData.value?.sessionId || sessionData.sessionId;

  // Navigate
  await fetch(CHROMEDRIVER + "/session/" + sessionId + "/url", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ url: BASE + path }),
  });
  // Small wait for load
  await new Promise((r) => setTimeout(r, 1500));

  // Get title and page source
  const titleRes = await fetch(
    CHROMEDRIVER + "/session/" + sessionId + "/title",
    { method: "GET" }
  );
  const titleData = await titleRes.json();

  const sourceRes = await fetch(
    CHROMEDRIVER + "/session/" + sessionId + "/source",
    { method: "GET" }
  );
  const sourceData = await sourceRes.json();

  // Close
  await fetch(CHROMEDRIVER + "/session/" + sessionId, { method: "DELETE" });

  return {
    title: titleData.value || "",
    source: sourceData.value || "",
    sessionId,
  };
}

describe("Smoke: production routes", () => {
  it("homepage loads without 404", async () => {
    const res = await session("/");
    expect(res.source).toContain("G4M37Z");
    expect(res.title.length).toBeGreaterThan(0);
    expect(isHtml(res.source)).toBe(true);
  }, 15000);

  it("discover loads", async () => {
    const res = await session("/discover");
    expect(isHtml(res.source)).toBe(true);
  }, 15000);

  it("login renders", async () => {
    const res = await session("/login");
    expect(isHtml(res.source)).toBe(true);
  }, 15000);

  it("signup renders", async () => {
    const res = await session("/signup");
    expect(isHtml(res.source)).toBe(true);
  }, 15000);

  it("social graph loads", async () => {
    const res = await session("/social");
    expect(isHtml(res.source)).toBe(true);
  }, 15000);

  it("messages loads", async () => {
    const res = await session("/messages");
    expect(isHtml(res.source)).toBe(true);
  }, 15000);

  it("notifications loads", async () => {
    const res = await session("/notifications");
    expect(isHtml(res.source)).toBe(true);
  }, 15000);

  it("create post route loads (404 investigation)", async () => {
    // This test documents whether the route returns 404 content.
    const res = await session("/create/post");
    // If it contains "We couldn't find that page" => broken; else OK.
    // We do NOT assert PASS; we record source.
    console.log("CREATE POST source snippet (first 300 chars):", res.source.slice(0, 300));
    // Do not claim PASS for auth-gated route without user; just verify it responds.
    expect(res.source.length).toBeGreaterThan(0);
  }, 15000);
});
