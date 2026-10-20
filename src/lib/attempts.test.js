import { describe, expect, it } from "vitest";
import { HELP, VIEW_KINDS, attemptsOf, isHelp, lastTimedRecord, suggestedHelp } from "./attempts";

describe("isHelp", () => {
  it("accepts the two levels only", () => {
    expect([0, 1].every(isHelp)).toBe(true);
    expect([-1, 2, 3, 1.5, "1", null, undefined].some(isHelp)).toBe(false);
  });

  it("names the levels", () => {
    expect(HELP).toEqual({ ALONE: 0, NOTE: 1 });
  });

  it("only the note can be opened as help", () => {
    expect(VIEW_KINDS).toEqual({ note: "note" });
  });
});

describe("attemptsOf", () => {
  it("returns the saved attempts", () => {
    const attempts = [{ date: "2026-10-02", review: 0, help: 0 }];
    expect(attemptsOf({ attempts })).toBe(attempts);
  });

  it("is empty when there are none or the data is not a list", () => {
    expect(attemptsOf({})).toEqual([]);
    expect(attemptsOf(undefined)).toEqual([]);
    expect(attemptsOf({ attempts: "x" })).toEqual([]);
    expect(attemptsOf({ attempts: { 0: 1 } })).toEqual([]);
  });
});

describe("suggestedHelp", () => {
  const TODAY = "2026-10-05";

  it("suggests help for a timed-out review, whatever was opened", () => {
    expect(suggestedHelp({}, TODAY, { timedOut: true })).toBe(HELP.NOTE);
    expect(suggestedHelp({ helpViewed: { note: TODAY } }, TODAY, { timedOut: true })).toBe(HELP.NOTE);
    expect(
      suggestedHelp({ helpViewed: { note: TODAY }, noteEditedOn: TODAY }, TODAY, { timedOut: true }),
    ).toBe(HELP.NOTE);
    expect(suggestedHelp({}, TODAY, { timedOut: false })).toBeNull();
  });

  it("suggests nothing when nothing was opened", () => {
    expect(suggestedHelp({}, TODAY)).toBeNull();
    expect(suggestedHelp(undefined, TODAY)).toBeNull();
    expect(suggestedHelp({ helpViewed: {} }, TODAY)).toBeNull();
  });

  it("suggests help when the note was opened today", () => {
    expect(suggestedHelp({ helpViewed: { note: TODAY } }, TODAY)).toBe(HELP.NOTE);
  });

  it("suggests solved alone when the note opened today was also written or edited today: that is not help", () => {
    const entry = { helpViewed: { note: TODAY }, noteEditedOn: TODAY };
    expect(suggestedHelp(entry, TODAY)).toBe(HELP.ALONE);
  });

  it("still suggests help when the note was last edited on another day, or when the day is unknown (old data)", () => {
    expect(suggestedHelp({ helpViewed: { note: TODAY }, noteEditedOn: "2026-10-04" }, TODAY)).toBe(HELP.NOTE);
    expect(suggestedHelp({ helpViewed: { note: TODAY } }, TODAY)).toBe(HELP.NOTE);
  });

  it("a note written today but not opened as help suggests nothing", () => {
    expect(suggestedHelp({ noteEditedOn: TODAY }, TODAY)).toBeNull();
  });

  it("ignores what was opened on another day", () => {
    expect(suggestedHelp({ helpViewed: { note: "2026-10-04" } }, TODAY)).toBeNull();
  });

  it("ignores a solution marker left by old data", () => {
    expect(suggestedHelp({ helpViewed: { solution: TODAY } }, TODAY)).toBeNull();
  });
});

describe("lastTimedRecord", () => {
  it("is the last review attempt that has a time, with its place in the history", () => {
    const entry = {
      firstSolve: { date: "2026-10-01", ms: 9000, limitMs: 20000 },
      attempts: [
        { date: "2026-10-02", review: 0, help: 0, ms: 1000, limitMs: 5000 },
        { date: "2026-10-04", review: 1, help: 0 },
        { date: "2026-10-08", review: 2, help: 1, ms: 3000, limitMs: 5000 },
        { date: "2026-10-09", review: 2, help: 0 },
      ],
    };
    expect(lastTimedRecord(entry)).toEqual({ kind: "attempt", index: 2, review: 2, ms: 3000, limitMs: 5000 });
  });

  it("falls back to the time of the first solve", () => {
    const entry = { firstSolve: { date: "2026-10-01", ms: 9000, limitMs: 20000 }, attempts: [{ date: "x", review: 0, help: 0 }] };
    expect(lastTimedRecord(entry)).toEqual({ kind: "first", ms: 9000, limitMs: 20000 });
  });

  it("is null when no time was recorded (unknown, not zero) or the data is damaged", () => {
    expect(lastTimedRecord({})).toBeNull();
    expect(lastTimedRecord(undefined)).toBeNull();
    expect(lastTimedRecord({ firstSolve: { date: "2026-10-01" }, attempts: [{ review: 0, help: 0 }] })).toBeNull();
    expect(lastTimedRecord({ attempts: [null, { ms: "x" }], firstSolve: { ms: -1 / 0 } })).toBeNull();
  });

  it("counts a recorded time of 0 as a time", () => {
    expect(lastTimedRecord({ attempts: [{ review: 0, help: 0, ms: 0 }] })).toMatchObject({ kind: "attempt", ms: 0 });
  });
});
