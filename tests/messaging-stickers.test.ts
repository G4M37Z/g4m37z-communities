// Deterministic tests for the DM sticker catalog (GAP-MSG-RICH-01).
// Covers the catalog shape/invariants and the stickerVerdict guard that
// rejects arbitrary attachment_url injection for sticker-kind messages.

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  STICKERS,
  stickerById,
  stickerVerdict,
} from "@/lib/messaging/stickers";

describe("sticker catalog invariants", () => {
  it("is non-empty and every sticker has an id, name and /stickers/ asset url", () => {
    expect(STICKERS.length).toBeGreaterThan(0);
    for (const s of STICKERS) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^\/stickers\/[a-z0-9-]+\.svg$/);
    }
  });

  it("has unique ids and unique urls", () => {
    const ids = new Set(STICKERS.map((s) => s.id));
    const urls = new Set(STICKERS.map((s) => s.url));
    expect(ids.size).toBe(STICKERS.length);
    expect(urls.size).toBe(STICKERS.length);
  });

  it("every sticker asset exists under /public/stickers", () => {
    for (const s of STICKERS) {
      const path = join(process.cwd(), "public", s.url);
      expect(existsSync(path)).toBe(true);
    }
  });
});

describe("stickerById", () => {
  it("resolves known ids and misses unknown ids", () => {
    expect(stickerById("fire")?.url).toBe("/stickers/fire.svg");
    expect(stickerById("not-a-sticker")).toBeUndefined();
  });
});

describe("stickerVerdict", () => {
  it("accepts a catalog sticker by its exact public path", () => {
    const v = stickerVerdict("/stickers/fire.svg");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.sticker.name).toBe("Fire");
  });

  it("rejects null / undefined", () => {
    expect(stickerVerdict(null).ok).toBe(false);
    expect(stickerVerdict(undefined).ok).toBe(false);
  });

  it("rejects non-sticker or external URLs", () => {
    expect(stickerVerdict("https://evil.example/x.svg").ok).toBe(false);
    expect(stickerVerdict("/images/foo.png").ok).toBe(false);
    expect(stickerVerdict("javascript:alert(1)").ok).toBe(false);
  });

  it("rejects a catalog-shaped path with an unknown id", () => {
    expect(stickerVerdict("/stickers/definitely-not-real.svg").ok).toBe(false);
  });
});