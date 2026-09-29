import { describe, expect, it } from "vitest";
import {
  getUrgency,
  urgencyButtonStyles,
  urgencyTextStyles,
} from "./urgencyStyles";

const today = "2026-09-29";

describe("getUrgency", () => {
  it("is done when the review is completed, even if the date passed", () => {
    expect(getUrgency(true, "2026-09-01", today)).toBe("done");
    expect(getUrgency(true, "2026-10-01", today)).toBe("done");
  });

  it("is overdue before today", () => {
    expect(getUrgency(false, "2026-09-28", today)).toBe("overdue");
  });

  it("is today on the same date", () => {
    expect(getUrgency(false, today, today)).toBe("today");
  });

  it("is upcoming after today", () => {
    expect(getUrgency(false, "2026-09-30", today)).toBe("upcoming");
  });

  it("treats a missing completed flag as pending", () => {
    expect(getUrgency(undefined, "2026-09-28", today)).toBe("overdue");
  });
});

describe("styles", () => {
  it("define classes for every urgency level", () => {
    for (const level of ["done", "overdue", "today", "upcoming"]) {
      expect(urgencyButtonStyles[level]).toBeTruthy();
      expect(urgencyTextStyles[level]).toBeTruthy();
    }
  });
});
