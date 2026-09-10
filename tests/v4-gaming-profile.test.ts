import { describe, it, expect } from "vitest";
import { updateGamingProfile, __v4Gaming } from "@/lib/profiles/service-v4";
describe("V4 gaming profile", () => {
  it("cleanTags filters", () => {
    expect(__v4Gaming.cleanTags(["pc", "playstation", "bad!!!"], 6)).toEqual(["pc", "playstation"]);
  });
  it("cleanEnum validates", () => {
    expect(__v4Gaming.cleanEnum("competitive", __v4Gaming.PLAY_STYLES)).toBe("competitive");
    expect(__v4Gaming.cleanEnum("fake", __v4Gaming.PLAY_STYLES)).toBeNull();
  });
});
