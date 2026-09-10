import { describe, it, expect } from "vitest";
import { __test } from "@/lib/messaging/service";
describe("messaging validation", () => {
  it("clamp bounds", () => { expect(__test.clamp(5, 1, 4000)).toBe(5); expect(__test.clamp(5000, 1, 4000)).toBe(4000); });
  it("isUuid validates UUID", () => { expect(__test.isUuid("00000000-0000-4000-8000-000000000001")).toBe(true); expect(__test.isUuid("not-uuid")).toBe(false); });
  it("body cap is 4000", () => { expect(__test.MAX_BODY).toBe(4000); });
});
