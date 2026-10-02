import { describe, expect, it } from "vitest";
import { HELP, attemptsOf, isHelp, suggestedHelp } from "./attempts";

describe("isHelp", () => {
  it("accepts the three levels only", () => {
    expect([0, 1, 2].every(isHelp)).toBe(true);
    expect([-1, 3, 1.5, "1", null, undefined].some(isHelp)).toBe(false);
  });

  it("names the levels", () => {
    expect(HELP).toEqual({ ALONE: 0, NOTE: 1, SOLUTION: 2 });
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

  it("suggests nothing when nothing was opened", () => {
    expect(suggestedHelp({}, TODAY)).toBeNull();
    expect(suggestedHelp(undefined, TODAY)).toBeNull();
    expect(suggestedHelp({ helpViewed: {} }, TODAY)).toBeNull();
  });

  it("suggests the note when it was opened today", () => {
    expect(suggestedHelp({ helpViewed: { note: TODAY } }, TODAY)).toBe(HELP.NOTE);
  });

  it("suggests solved alone when the note opened today was also written or edited today: that is not help", () => {
    const entry = { helpViewed: { note: TODAY }, noteEditedOn: TODAY };
    expect(suggestedHelp(entry, TODAY)).toBe(HELP.ALONE);
  });

  it("still suggests the note when it was last edited on another day, or when the day is unknown (old data)", () => {
    expect(suggestedHelp({ helpViewed: { note: TODAY }, noteEditedOn: "2026-10-04" }, TODAY)).toBe(HELP.NOTE);
    expect(suggestedHelp({ helpViewed: { note: TODAY } }, TODAY)).toBe(HELP.NOTE);
  });

  it("a note added today does not hide the solution being opened, and suggests nothing when it was not opened", () => {
    expect(
      suggestedHelp({ helpViewed: { note: TODAY, solution: TODAY }, noteEditedOn: TODAY }, TODAY)
    ).toBe(HELP.SOLUTION);
    expect(suggestedHelp({ noteEditedOn: TODAY }, TODAY)).toBeNull();
  });

  it("suggests the solution when it was opened today, even if the note was too", () => {
    expect(suggestedHelp({ helpViewed: { solution: TODAY } }, TODAY)).toBe(HELP.SOLUTION);
    expect(suggestedHelp({ helpViewed: { note: TODAY, solution: TODAY } }, TODAY)).toBe(HELP.SOLUTION);
  });

  it("ignores what was opened on another day", () => {
    expect(suggestedHelp({ helpViewed: { note: "2026-10-04" } }, TODAY)).toBeNull();
    expect(suggestedHelp({ helpViewed: { note: "2026-10-04", solution: TODAY } }, TODAY)).toBe(HELP.SOLUTION);
  });
});
