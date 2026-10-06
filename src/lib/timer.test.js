import { describe, expect, it } from "vitest";
import {
  LIMITS_MIN,
  activityOf,
  elapsedMs,
  formatDuration,
  limitMsFor,
  normalizeTimer,
  timeScore,
  timeState,
} from "./timer";

const min = (n) => n * 60 * 1000;

describe("limitMsFor", () => {
  it("has the agreed limits by kind and difficulty", () => {
    expect(LIMITS_MIN).toEqual({
      first: { Easy: 20, Medium: 35, Hard: 50 },
      review: { Easy: 10, Medium: 20, Hard: 30 },
    });
    expect(limitMsFor("first", "Easy")).toBe(min(20));
    expect(limitMsFor("first", "Hard")).toBe(min(50));
    expect(limitMsFor("review", "Medium")).toBe(min(20));
  });

  it("treats an unknown difficulty as Medium and an unknown kind as no limit", () => {
    expect(limitMsFor("first", undefined)).toBe(min(35));
    expect(limitMsFor("review", "Insane")).toBe(min(20));
    expect(limitMsFor("other", "Easy")).toBeNull();
  });
});

describe("normalizeTimer", () => {
  it("keeps a valid running or paused timer", () => {
    expect(normalizeTimer({ elapsedMs: 5, runningSince: 10 })).toEqual({ elapsedMs: 5, runningSince: 10 });
    expect(normalizeTimer({ elapsedMs: 5, runningSince: null })).toEqual({ elapsedMs: 5, runningSince: null });
    expect(normalizeTimer({ elapsedMs: 0 })).toEqual({ elapsedMs: 0, runningSince: null });
  });

  it("counts bad data as no timer", () => {
    for (const bad of [
      null,
      undefined,
      "5",
      5,
      {},
      { elapsedMs: -1, runningSince: null },
      { elapsedMs: NaN, runningSince: null },
      { elapsedMs: "5", runningSince: null },
      { elapsedMs: 5, runningSince: "now" },
      { elapsedMs: 5, runningSince: -3 },
    ]) {
      expect(normalizeTimer(bad)).toBeNull();
    }
  });
});

describe("elapsedMs", () => {
  it("is the saved time when paused", () => {
    expect(elapsedMs({ elapsedMs: 1000, runningSince: null }, 999999)).toBe(1000);
  });

  it("adds the time since it started running", () => {
    expect(elapsedMs({ elapsedMs: 1000, runningSince: 5000 }, 8000)).toBe(4000);
  });

  it("adds nothing when the clock went backwards", () => {
    expect(elapsedMs({ elapsedMs: 1000, runningSince: 5000 }, 2000)).toBe(1000);
  });

  it("is 0 without a valid timer", () => {
    expect(elapsedMs(null, 1)).toBe(0);
    expect(elapsedMs({ elapsedMs: -5 }, 1)).toBe(0);
  });
});

describe("timeState and timeScore with a 20 minute limit", () => {
  const limit = min(20);

  it("is on time up to the limit", () => {
    expect(timeState(min(1), limit)).toBe("ontime");
    expect(timeState(min(20), limit)).toBe("ontime");
    expect(timeScore(min(20), limit)).toBe(100);
  });

  it("21 and 25 minutes are as good as 20", () => {
    expect(timeState(min(21), limit)).toBe("grace");
    expect(timeState(min(25), limit)).toBe("grace");
    expect(timeScore(min(21), limit)).toBe(100);
    expect(timeScore(min(25), limit)).toBe(100);
  });

  it("after 25 minutes the score falls in a straight line to 50 at the cap", () => {
    expect(timeState(min(26), limit)).toBe("late");
    expect(timeScore(min(26), limit)).toBe(97);
    expect(timeScore(min(30), limit)).toBe(83);
    expect(timeScore(min(35), limit)).toBe(67);
    expect(timeScore(min(39), limit)).toBe(53);
    expect(timeScore(min(39.99), limit)).toBe(50);
  });

  it("at twice the limit it is forgotten, and stays 0", () => {
    expect(timeState(min(40), limit)).toBe("timeout");
    expect(timeScore(min(40), limit)).toBe(0);
    expect(timeScore(min(600), limit)).toBe(0);
  });

  it("never rises as the time grows", () => {
    let last = 101;
    for (let m = 0; m <= 90; m += 0.5) {
      const score = timeScore(min(m), limit);
      expect(score).toBeLessThanOrEqual(last);
      last = score;
    }
  });
});

describe("no limit and unknown time", () => {
  it("has full score without a limit", () => {
    expect(timeState(min(500), null)).toBe("ontime");
    expect(timeScore(min(500), null)).toBe(100);
    expect(timeScore(min(500), 0)).toBe(100);
  });

  it("has no score (not 0) when the time is unknown", () => {
    expect(timeScore(undefined, min(20))).toBeNull();
    expect(timeScore(null, min(20))).toBeNull();
    expect(timeScore(-5, min(20))).toBeNull();
    expect(timeScore(NaN, min(20))).toBeNull();
  });

  it("the caps are the double of each limit", () => {
    expect(timeState(min(69), limitMsFor("first", "Medium"))).toBe("late");
    expect(timeState(min(70), limitMsFor("first", "Medium"))).toBe("timeout");
    expect(timeState(min(100), limitMsFor("first", "Hard"))).toBe("timeout");
    expect(timeState(min(20), limitMsFor("review", "Easy"))).toBe("timeout");
    expect(timeState(min(59), limitMsFor("review", "Hard"))).toBe("late");
  });
});

describe("formatDuration", () => {
  it("shows m:ss and h:mm:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(5000)).toBe("0:05");
    expect(formatDuration(min(12) + 30000)).toBe("12:30");
    expect(formatDuration(min(59) + 59000)).toBe("59:59");
    expect(formatDuration(min(60))).toBe("1:00:00");
    expect(formatDuration(min(125) + 7000)).toBe("2:05:07");
  });

  it("is 0:00 for invalid or negative", () => {
    expect(formatDuration(-1000)).toBe("0:00");
    expect(formatDuration(NaN)).toBe("0:00");
    expect(formatDuration(undefined)).toBe("0:00");
  });
});

describe("activityOf", () => {
  it("is the first solve while the problem is not solved", () => {
    expect(activityOf(undefined)).toEqual({ kind: "first", label: "First solve" });
    expect(activityOf({ status: "in-progress", solved: false })).toEqual({ kind: "first", label: "First solve" });
  });

  it("is the next pending review once solved", () => {
    const entry = (done) => ({ solved: true, reviews: [0, 1, 2, 3, 4].map((i) => i < done) });
    expect(activityOf(entry(0))).toEqual({ kind: "review", review: 1, label: "R1" });
    expect(activityOf(entry(2))).toEqual({ kind: "review", review: 3, label: "R3" });
    expect(activityOf(entry(4))).toEqual({ kind: "review", review: 5, label: "R5" });
  });

  it("is nothing when every review is done (mastered)", () => {
    expect(activityOf({ solved: true, reviews: [true, true, true, true, true] })).toBeNull();
  });

  it("copes with a missing reviews list", () => {
    expect(activityOf({ solved: true })).toEqual({ kind: "review", review: 1, label: "R1" });
  });
});
