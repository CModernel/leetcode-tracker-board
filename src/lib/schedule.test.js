import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERVALS,
  GAPS,
  addDays,
  canCompleteReview,
  canRewindTo,
  canUncompleteReview,
  daysBetween,
  dueOverrideFor,
  formatShortDate,
  getSchedule,
  isDateString,
  isDue,
  localToday,
  reviewsErasedBy,
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

describe("review order", () => {
  const solved = (reviews) => ({ solved: true, solvedDate: "2026-10-01", reviews });
  const none = [false, false, false, false, false];

  describe("canCompleteReview", () => {
    it("allows only the next pending review", () => {
      const prob = solved([true, true, false, false, false]);
      expect(canCompleteReview(prob, 2)).toBe(true);
      expect(canCompleteReview(prob, 3)).toBe(false);
      expect(canCompleteReview(prob, 4)).toBe(false);
    });

    it("allows R1 on a solved problem and nothing later", () => {
      expect(canCompleteReview(solved(none), 0)).toBe(true);
      for (const i of [1, 2, 3, 4]) {
        expect(canCompleteReview(solved(none), i)).toBe(false);
      }
    });

    it("does not allow a review that is already done", () => {
      expect(canCompleteReview(solved([true, false, false, false, false]), 0)).toBe(false);
    });

    it("does not allow anything on a problem that is not solved", () => {
      expect(canCompleteReview({ solved: false }, 0)).toBe(false);
      expect(canCompleteReview(undefined, 0)).toBe(false);
    });

    it("works with a missing reviews list", () => {
      expect(canCompleteReview({ solved: true, solvedDate: "2026-10-01" }, 0)).toBe(true);
      expect(canCompleteReview({ solved: true, solvedDate: "2026-10-01" }, 1)).toBe(false);
    });

    it("rejects indexes outside R1..R5", () => {
      const prob = solved([true, true, true, true, true]);
      for (const i of [-1, 5, 1.5, NaN, undefined]) {
        expect(canCompleteReview(prob, i)).toBe(false);
      }
    });
  });

  describe("canUncompleteReview", () => {
    it("allows only the last completed review", () => {
      const prob = solved([true, true, true, false, false]);
      expect(canUncompleteReview(prob, 2)).toBe(true);
      expect(canUncompleteReview(prob, 1)).toBe(false);
      expect(canUncompleteReview(prob, 0)).toBe(false);
    });

    it("does not allow a review that is not done", () => {
      const prob = solved([true, false, false, false, false]);
      expect(canUncompleteReview(prob, 1)).toBe(false);
      expect(canUncompleteReview(solved(none), 0)).toBe(false);
    });

    it("handles old data with skipped reviews", () => {
      const prob = solved([true, false, false, true, false]);
      expect(canUncompleteReview(prob, 3)).toBe(true);
      expect(canUncompleteReview(prob, 0)).toBe(false);
    });

    it("rejects missing data and indexes outside R1..R5", () => {
      expect(canUncompleteReview(undefined, 0)).toBe(false);
      expect(canUncompleteReview({ solved: true }, 0)).toBe(false);
      const prob = solved([true, true, true, true, true]);
      for (const i of [-1, 5, 2.5, undefined]) {
        expect(canUncompleteReview(prob, i)).toBe(false);
      }
      expect(canUncompleteReview(prob, 4)).toBe(true);
    });
  });
});

describe.each(ZONES)("daysBetween in %s", (zone) => {
  beforeEach(() => {
    process.env.TZ = zone;
  });

  it("counts calendar days, forward and backward", () => {
    expect(daysBetween("2026-09-29", "2026-09-29")).toBe(0);
    expect(daysBetween("2026-09-29", "2026-10-02")).toBe(3);
    expect(daysBetween("2026-10-02", "2026-09-29")).toBe(-3);
  });

  it("crosses month, year and leap day", () => {
    expect(daysBetween("2026-01-31", "2026-02-01")).toBe(1);
    expect(daysBetween("2026-12-25", "2027-01-04")).toBe(10);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("is not affected by daylight saving changes", () => {
    for (let day = 0; day < 366; day++) {
      const start = utcAddDays("2026-01-01", day);
      expect(daysBetween(start, utcAddDays(start, 7))).toBe(7);
    }
  });
});

describe("going back to an earlier review", () => {
  const prob = (reviews) => ({ solved: true, reviews });

  it("is possible for any review that is done", () => {
    const p = prob([true, true, true, false, false]);
    expect([0, 1, 2].map((i) => canRewindTo(p, i))).toEqual([true, true, true]);
    expect([3, 4].map((i) => canRewindTo(p, i))).toEqual([false, false]);
  });

  it("is not possible for an unsolved problem or a bad index", () => {
    expect(canRewindTo({ solved: false, reviews: [true] }, 0)).toBe(false);
    expect(canRewindTo(prob([true, false, false, false, false]), -1)).toBe(false);
    expect(canRewindTo(prob([true, false, false, false, false]), 5)).toBe(false);
    expect(canRewindTo(undefined, 0)).toBe(false);
  });

  it("lists the done reviews it erases", () => {
    const p = prob([true, true, true, false, false]);
    expect(reviewsErasedBy(p, 0)).toEqual([0, 1, 2]);
    expect(reviewsErasedBy(p, 2)).toEqual([2]);
    expect(reviewsErasedBy(p, 3)).toEqual([]);
  });

  it("only counts reviews that are done in old out-of-order data", () => {
    expect(reviewsErasedBy(prob([true, false, false, true, false]), 0)).toEqual([0, 3]);
  });
});

describe("isDateString", () => {
  it("accepts real days and rejects everything else", () => {
    expect(isDateString("2026-10-05")).toBe(true);
    expect(isDateString("2028-02-29")).toBe(true);
    for (const bad of ["2026-02-30", "2026-13-01", "2026-10-5", "10/05/2026", "", null, undefined, 20261005, "2026-10-05T10:00"]) {
      expect(isDateString(bad)).toBe(false);
    }
  });
});

describe("getSchedule with a chosen due date (dueOverride)", () => {
  const base = {
    solved: true,
    solvedDate: "2026-10-01",
    reviews: [true, true, false, false, false],
    dates: { review1: "2026-10-02", review2: "2026-10-04" },
  };
  const usual = getSchedule(base); // R3 2026-10-08, R4 10-15, R5 10-31

  it("changes nothing without an override", () => {
    expect(usual).toEqual([
      "2026-10-02",
      "2026-10-04",
      "2026-10-08",
      "2026-10-15",
      "2026-10-31",
    ]);
  });

  it("uses the chosen date for the pending review", () => {
    const prob = { ...base, dueOverride: { review: 2, date: "2026-10-06" } };
    expect(getSchedule(prob)[2]).toBe("2026-10-06");
  });

  it("moves the later reviews with it, counting their gaps from it", () => {
    const prob = { ...base, dueOverride: { review: 2, date: "2026-10-06" } };
    // R4 = R3 + 7, R5 = R4 + 16
    expect(getSchedule(prob)).toEqual([
      "2026-10-02",
      "2026-10-04",
      "2026-10-06",
      "2026-10-13",
      "2026-10-29",
    ]);
  });

  it("can move a review later as well as earlier", () => {
    const prob = { ...base, dueOverride: { review: 2, date: "2026-10-20" } };
    expect(getSchedule(prob).slice(2)).toEqual(["2026-10-20", "2026-10-27", "2026-11-12"]);
  });

  it("does not touch the reviews that are done", () => {
    const prob = { ...base, dueOverride: { review: 2, date: "2026-10-06" } };
    expect(getSchedule(prob).slice(0, 2)).toEqual(usual.slice(0, 2));
  });

  it("ignores an override for a review that is already done", () => {
    const prob = { ...base, dueOverride: { review: 1, date: "2026-12-01" } };
    expect(getSchedule(prob)).toEqual(usual);
  });

  it("applies only to the review it names", () => {
    const prob = { ...base, dueOverride: { review: 3, date: "2026-12-01" } };
    const schedule = getSchedule(prob);
    expect(schedule.slice(0, 3)).toEqual(usual.slice(0, 3));
    expect(schedule[3]).toBe("2026-12-01");
  });

  it("ignores a bad override (not a date, wrong shape)", () => {
    for (const dueOverride of [
      { review: 2, date: "2026-02-30" },
      { review: 2, date: "soon" },
      { review: 2 },
      { review: "2", date: "2026-10-06" },
      "2026-10-06",
      null,
    ]) {
      expect(getSchedule({ ...base, dueOverride })).toEqual(usual);
    }
  });

  it("works for the first review", () => {
    const prob = {
      solved: true,
      solvedDate: "2026-10-01",
      reviews: [false, false, false, false, false],
      dueOverride: { review: 0, date: "2026-10-09" },
    };
    expect(getSchedule(prob)).toEqual([
      "2026-10-09",
      "2026-10-11",
      "2026-10-15",
      "2026-10-22",
      "2026-11-07",
    ]);
  });

  it("makes isDue follow the chosen date", () => {
    const prob = { ...base, dueOverride: { review: 2, date: "2026-10-06" } };
    expect(isDue(prob, "2026-10-05")).toBe(false);
    expect(isDue(prob, "2026-10-06")).toBe(true);
    expect(isDue({ ...base }, "2026-10-06")).toBe(false);
  });

  it("dueOverrideFor returns the date only for the pending review it names", () => {
    const prob = { ...base, dueOverride: { review: 2, date: "2026-10-06" } };
    expect(dueOverrideFor(prob, 2)).toBe("2026-10-06");
    expect(dueOverrideFor(prob, 1)).toBeNull();
    expect(dueOverrideFor(prob, 3)).toBeNull();
    expect(dueOverrideFor(undefined, 0)).toBeNull();
  });
});

describe("the same R2 date from different solved dates", () => {
  // R2 is counted from the day R1 was really done, not from the solved date.
  // So two problems solved on different days can both have R2 on the same day,
  // and after undoing R1 each one goes back to its own R1 date (solved + 1).
  const done = (solvedDate) => ({
    solved: true,
    solvedDate,
    reviews: [true, false, false, false, false],
    dates: { initial: solvedDate, review1: "2026-10-01" },
  });
  const undone = (solvedDate) => ({
    solved: true,
    solvedDate,
    reviews: [false, false, false, false, false],
    dates: { initial: solvedDate },
  });

  it("R2 is the same day when R1 was done the same day", () => {
    expect(getSchedule(done("2026-09-28"))[1]).toBe("2026-10-03");
    expect(getSchedule(done("2026-09-30"))[1]).toBe("2026-10-03");
  });

  it("after undoing R1, each problem goes back to its own R1 date", () => {
    expect(getSchedule(undone("2026-09-28"))[0]).toBe("2026-09-29");
    expect(getSchedule(undone("2026-09-30"))[0]).toBe("2026-10-01");
  });
});
