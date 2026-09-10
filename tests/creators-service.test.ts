import { describe, it, expect } from "vitest";
import { __test } from "@/lib/creators/service";
describe("creators validation", () => {
  it("isUuid validates UUID format", () => { expect(__test.isUuid("00000000-0000-4000-8000-000000000001")).toBe(true); });
  it("clamp bounds integer", () => { expect(__test.clamp(150, 1, 100)).toBe(100); });
});
