import { describe, expect, it } from "vitest";
import { HELP, VIEW_KINDS, attemptsOf, isHelp, suggestedHelp } from "./attempts";

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
