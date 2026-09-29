import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERVALS,
  GAPS,
  addDays,
  calculateNextReviews,
  formatShortDate,
  isDue,
  localToday,
} from "./schedule";

// A few popular zones: behind UTC (Los Angeles, New York), equal to it in winter
// (London), and ahead of it (Kolkata +5:30, Sydney). Daylight saving included.
const ZONES = [
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Asia/Kolkata",
  "Australia/Sydney",
];

// Independent oracle: the calendar date of an instant in a given zone.
const dateInZone = (instant, timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(instant);

// Pure calendar arithmetic, no time zone involved.
const utcAddDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0];
};

const originalTZ = process.env.TZ;

afterEach(() => {
  vi.useRealTimers();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe("constants", () => {
  it("GAPS add up to INTERVALS", () => {
    let total = 0;
    const sums = GAPS.map((gap) => (total += gap));
    expect(sums).toEqual(INTERVALS);
  });
});

describe.each(ZONES)("in %s", (zone) => {
  beforeEach(() => {
    process.env.TZ = zone;
  });

  describe("addDays", () => {
    it("adds days inside a month", () => {
      expect(addDays("2026-09-29", 1)).toBe("2026-09-30");
    });

    it("crosses month and year ends", () => {
      expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
      expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
    });

    it("handles leap days", () => {
      expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
      expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    });

    it("subtracts days", () => {
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("matches plain calendar arithmetic across a whole year (daylight saving included)", () => {
      for (let day = 0; day < 366; day++) {
        const start = utcAddDays("2026-01-01", day);
        for (const n of INTERVALS) {
          expect(addDays(start, n)).toBe(utcAddDays(start, n));
        }
      }
    });
  });

  describe("localToday", () => {
    it("is the local calendar date around local midnight and UTC midnight", () => {
      vi.useFakeTimers();
      // Instants that straddle midnight in one zone or another, over a
      // summer-time change and a plain day.
      const instants = [
        "2026-06-14T23:30:00Z",
        "2026-06-15T00:30:00Z",
        "2026-06-15T09:59:00Z",
        "2026-06-15T10:01:00Z",
        "2026-06-15T13:30:00Z",
        "2026-06-15T14:30:00Z",
        "2026-06-15T22:00:00Z",
        "2026-10-03T13:59:00Z",
        "2026-10-03T14:01:00Z",
        "2026-12-31T23:59:00Z",
        "2027-01-01T00:01:00Z",
      ];
      for (const iso of instants) {
        vi.setSystemTime(new Date(iso));
        expect(localToday()).toBe(dateInZone(new Date(iso), zone));
      }
    });
  });

  describe("formatShortDate", () => {
    it("shows the stored day, never the previous one", () => {
      expect(formatShortDate("2026-10-05")).toBe("Oct 5");
      expect(formatShortDate("2026-01-01")).toBe("Jan 1");
      expect(formatShortDate("2026-12-31")).toBe("Dec 31");
    });
  });

  describe("calculateNextReviews", () => {
    it("returns R1..R5 at 1, 3, 7, 14 and 30 days", () => {
      expect(calculateNextReviews("2026-10-03")).toEqual([
        "2026-10-04",
        "2026-10-06",
        "2026-10-10",
        "2026-10-17",
        "2026-11-02",
      ]);
    });

    it("returns an empty list without a solved date", () => {
      expect(calculateNextReviews(null)).toEqual([]);
      expect(calculateNextReviews(undefined)).toEqual([]);
    });
  });

  describe("isDue", () => {
    const today = "2026-09-29";
    const pending = [false, false, false, false, false];

    it("is false without progress or when not solved", () => {
      expect(isDue(undefined, today)).toBe(false);
      expect(isDue({ solved: false }, today)).toBe(false);
    });

    it("is false when every review is done", () => {
      const prob = {
        solved: true,
        solvedDate: "2026-08-01",
        reviews: [true, true, true, true, true],
      };
      expect(isDue(prob, today)).toBe(false);
    });

    it("is true when a review is due exactly today", () => {
      const prob = { solved: true, solvedDate: "2026-09-28", reviews: pending };
      expect(isDue(prob, today)).toBe(true);
    });

    it("is true when a review is overdue", () => {
      const prob = { solved: true, solvedDate: "2026-09-01", reviews: pending };
      expect(isDue(prob, today)).toBe(true);
    });

    it("is false when the first review is still in the future", () => {
      const prob = { solved: true, solvedDate: "2026-09-29", reviews: pending };
      expect(isDue(prob, today)).toBe(false);
    });

    it("ignores done reviews and looks at the pending ones", () => {
      // R1 done, R2 (solved + 3 = 2026-09-30) not reached yet.
      const prob = {
        solved: true,
        solvedDate: "2026-09-27",
        reviews: [true, false, false, false, false],
      };
      expect(isDue(prob, today)).toBe(false);
      expect(isDue(prob, "2026-09-30")).toBe(true);
    });

    it("treats a missing reviews array as all pending", () => {
      const prob = { solved: true, solvedDate: "2026-09-28" };
      expect(isDue(prob, today)).toBe(true);
    });
  });
});
