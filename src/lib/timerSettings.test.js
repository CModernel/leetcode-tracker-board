import { describe, expect, it } from "vitest";
import { LIMITS_MIN, limitMsFor } from "./timer";
import {
  defaultLimits,
  parseShowTimer,
  parseTimerLimits,
  serializeLimits,
  validateMinutes,
} from "./timerSettings";

describe("parseShowTimer", () => {
  it("is on unless it was switched off", () => {
    expect(parseShowTimer(null)).toBe(true);
    expect(parseShowTimer("true")).toBe(true);
    expect(parseShowTimer("nonsense")).toBe(true);
    expect(parseShowTimer("false")).toBe(false);
  });
});

describe("parseTimerLimits", () => {
  it("gives the defaults when nothing is saved or the text is not JSON", () => {
    expect(parseTimerLimits(null)).toEqual(LIMITS_MIN);
    expect(parseTimerLimits("{not json")).toEqual(LIMITS_MIN);
    expect(parseTimerLimits("42")).toEqual(LIMITS_MIN);
    expect(defaultLimits()).toEqual(LIMITS_MIN);
  });

  it("keeps valid cells, null as no limit, and defaults the bad or missing ones", () => {
    const raw = JSON.stringify({
      first: { Easy: 5, Medium: null, Hard: 0 },
      review: { Easy: 601, Medium: 2.5, Hard: "9" },
    });
    expect(parseTimerLimits(raw)).toEqual({
      first: { Easy: 5, Medium: null, Hard: LIMITS_MIN.first.Hard },
      review: { Easy: LIMITS_MIN.review.Easy, Medium: LIMITS_MIN.review.Medium, Hard: LIMITS_MIN.review.Hard },
    });
  });

  it("round-trips through serializeLimits", () => {
    const limits = { first: { Easy: 1, Medium: 600, Hard: null }, review: { Easy: 7, Medium: 8, Hard: 9 } };
    expect(parseTimerLimits(serializeLimits(limits))).toEqual(limits);
  });

  it("returns a fresh object each time", () => {
    const a = defaultLimits();
    a.first.Easy = 99;
    expect(defaultLimits().first.Easy).toBe(LIMITS_MIN.first.Easy);
  });
});

describe("validateMinutes", () => {
  it("accepts whole minutes from 1 to 600", () => {
    expect(validateMinutes("20")).toBe(20);
    expect(validateMinutes(" 7 ")).toBe(7);
    expect(validateMinutes("1")).toBe(1);
    expect(validateMinutes("600")).toBe(600);
  });
  it("refuses everything else", () => {
    for (const bad of ["", "0", "601", "-5", "2.5", "abc", "1e2", null, undefined]) {
      expect(validateMinutes(bad)).toBeNull();
    }
  });
});

describe("limitMsFor with the person's limits", () => {
  const limits = { first: { Easy: 5, Medium: null, Hard: 50 }, review: { Easy: 1, Medium: 2, Hard: 3 } };
  it("uses the given minutes", () => {
    expect(limitMsFor("first", "Easy", limits)).toBe(5 * 60_000);
    expect(limitMsFor("review", "Hard", limits)).toBe(3 * 60_000);
  });
  it("a null cell is no limit, not the Medium one", () => {
    expect(limitMsFor("first", "Medium", limits)).toBeNull();
  });
  it("an unknown difficulty uses Medium (which may be no limit)", () => {
    expect(limitMsFor("review", "Weird", limits)).toBe(2 * 60_000);
    expect(limitMsFor("first", undefined, limits)).toBeNull();
  });
  it("keeps the defaults when no limits are given", () => {
    expect(limitMsFor("first", "Easy")).toBe(20 * 60_000);
  });
});
