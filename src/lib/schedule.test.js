import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERVALS,
  GAPS,
  addDays,
  formatShortDate,
  getSchedule,
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

// The fixed 1/3/7/14/30 days after solving, used as the on-time reference.
const fixedDates = (solved) => INTERVALS.map((days) => addDays(solved, days));

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

    it("uses the real review date: a late R1 pushes R2 out of today", () => {
      // R1 done 09-27 (due 09-24); R2 is now 09-29, so it is due today...
      const onTime = {
        solved: true,
        solvedDate: "2026-09-23",
        reviews: [true, false, false, false, false],
        dates: { review1: "2026-09-27" },
      };
      expect(isDue(onTime, today)).toBe(true);
      // ...but if R1 was done today, R2 is only due on 10-01.
      const late = { ...onTime, dates: { review1: today } };
      expect(isDue(late, today)).toBe(false);
      expect(isDue(late, "2026-10-01")).toBe(true);
    });
  });
});

describe("getSchedule", () => {
  const solvedDate = "2026-10-01";
  const none = [false, false, false, false, false];

  it("is empty without a solved date", () => {
    expect(getSchedule(undefined)).toEqual([]);
    expect(getSchedule({ solved: false })).toEqual([]);
  });

  it("matches the fixed 1/3/7/14/30 days when nothing is completed", () => {
    expect(getSchedule({ solvedDate, reviews: none })).toEqual(
      fixedDates(solvedDate)
    );
  });

  it("matches the fixed days when every review is done on time", () => {
    const prob = {
      solvedDate,
      reviews: [true, true, true, true, true],
      dates: {
        review1: "2026-10-02",
        review2: "2026-10-04",
        review3: "2026-10-08",
        review4: "2026-10-15",
        review5: "2026-10-31",
      },
    };
    expect(getSchedule(prob)).toEqual(fixedDates(solvedDate));
  });

  it("shifts the next reviews after a late completion", () => {
    // R1 was due 10-02 but done 10-06: R2 = 10-08, then R3..R5 follow it.
    const prob = {
      solvedDate,
      reviews: [true, false, false, false, false],
      dates: { review1: "2026-10-06" },
    };
    expect(getSchedule(prob)).toEqual([
      "2026-10-02",
      "2026-10-08",
      "2026-10-12",
      "2026-10-19",
      "2026-11-04",
    ]);
  });

  it("keeps earlier reviews fixed when a later one is late", () => {
    const prob = {
      solvedDate,
      reviews: [true, true, false, false, false],
      dates: { review1: "2026-10-02", review2: "2026-10-10" },
    };
    expect(getSchedule(prob).slice(0, 2)).toEqual(["2026-10-02", "2026-10-04"]);
    expect(getSchedule(prob).slice(2)).toEqual([
      "2026-10-14",
      "2026-10-21",
      "2026-11-06",
    ]);
  });

  it("falls back to the projected date when a completed review has no date", () => {
    const prob = { solvedDate, reviews: [true, false, false, false, false] };
    expect(getSchedule(prob)).toEqual(fixedDates(solvedDate));
  });
});

describe("getSchedule edge cases", () => {
  const solvedDate = "2026-10-01";

  it("ignores a leftover date when the review is not marked done (un-complete)", () => {
    const prob = {
      solvedDate,
      reviews: [false, false, false, false, false],
      dates: { review1: "2026-10-09" },
    };
    expect(getSchedule(prob)).toEqual(fixedDates(solvedDate));
  });

  it("moves the next reviews earlier when a review is done early", () => {
    // R1 was due 10-02 but done on 10-01: R2 = 10-03 and the rest follow it.
    const prob = {
      solvedDate,
      reviews: [true, false, false, false, false],
      dates: { review1: "2026-10-01" },
    };
    expect(getSchedule(prob)).toEqual([
      "2026-10-02",
      "2026-10-03",
      "2026-10-07",
      "2026-10-14",
      "2026-10-30",
    ]);
  });

  it("handles reviews completed out of order", () => {
    // Only R3 is done (10-05). R1 and R2 stay projected; R3 keeps its own due
    // date; R4 and R5 follow the real R3 date.
    const prob = {
      solvedDate,
      reviews: [false, false, true, false, false],
      dates: { review3: "2026-10-05" },
    };
    expect(getSchedule(prob)).toEqual([
      "2026-10-02",
      "2026-10-04",
      "2026-10-08",
      "2026-10-12",
      "2026-10-28",
    ]);
  });

  it("accumulates the delay when every review is done a day late", () => {
    const prob = {
      solvedDate,
      reviews: [true, true, true, true, false],
      dates: {
        review1: "2026-10-03",
        review2: "2026-10-06",
        review3: "2026-10-11",
        review4: "2026-10-19",
      },
    };
    expect(getSchedule(prob)).toEqual([
      "2026-10-02",
      "2026-10-05",
      "2026-10-10",
      "2026-10-18",
      "2026-11-04",
    ]);
  });

  it("does not fail when the dates object is missing", () => {
    const prob = { solvedDate, reviews: [true, true, false, false, false] };
    expect(getSchedule(prob)).toEqual(fixedDates(solvedDate));
  });

  it("is due again right after a completed review is un-completed", () => {
    const today = "2026-10-06";
    const done = {
      solved: true,
      solvedDate,
      reviews: [true, false, false, false, false],
      dates: { review1: today },
    };
    const undone = { ...done, reviews: [false, false, false, false, false] };
    expect(isDue(done, today)).toBe(false); // R2 moved to 10-08
    expect(isDue(undone, today)).toBe(true); // R1 pending again, overdue
  });
});
