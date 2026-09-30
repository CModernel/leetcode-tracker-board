import { describe, expect, it } from "vitest";
import { HELP, attemptsOf, isHelp } from "./attempts";

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
