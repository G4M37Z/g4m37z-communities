import { describe, it, expect } from "vitest";
import { __test } from "@/lib/social/service";
describe("social validation", () => {
  it("isUuid validates UUID", () => { expect(__test.isUuid("00000000-0000-4000-8000-000000000001")).toBe(true); });
  it("clamp bounds", () => { expect(__test.clamp(999,1,400)).toBe(400); });
});
