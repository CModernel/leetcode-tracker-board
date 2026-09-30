import { describe, expect, it } from "vitest";
import { titleWithCount } from "./title";

describe("titleWithCount", () => {
  it("puts the number in parentheses before the title", () => {
    expect(titleWithCount("CodeTrack Pro", 3)).toBe("(3) CodeTrack Pro");
    expect(titleWithCount("CodeTrack Pro", 1)).toBe("(1) CodeTrack Pro");
    expect(titleWithCount("CodeTrack Pro", 120)).toBe("(120) CodeTrack Pro");
  });

  it("is the plain title when nothing is due", () => {
    expect(titleWithCount("CodeTrack Pro", 0)).toBe("CodeTrack Pro");
  });

  it("ignores a negative or missing number", () => {
    expect(titleWithCount("CodeTrack Pro", -2)).toBe("CodeTrack Pro");
    expect(titleWithCount("CodeTrack Pro", undefined)).toBe("CodeTrack Pro");
  });
});
