import { describe, expect, it } from "vitest";
import {
  getUrgency,
  urgencyBadgeStyles,
  urgencyButtonStyles,
  urgencyStripeStyles,
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

describe("stripe and badge styles", () => {
  it("has a stripe for every urgency and for cards with none", () => {
    for (const level of ["overdue", "today", "upcoming", "none"]) {
      expect(urgencyStripeStyles[level]).toContain("border-l-4");
    }
  });

  it("uses the same colors as the rest: red overdue, yellow today", () => {
    expect(urgencyStripeStyles.overdue).toContain("red");
    expect(urgencyStripeStyles.today).toContain("yellow");
    expect(urgencyBadgeStyles.overdue).toContain("red");
    expect(urgencyBadgeStyles.today).toContain("yellow");
  });

  it("keeps the space for cards without a review, but invisible", () => {
    expect(urgencyStripeStyles.none).toContain("transparent");
  });
});
