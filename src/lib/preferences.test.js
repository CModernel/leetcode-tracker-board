import { describe, expect, it } from "vitest";
import {
  SHOW_NOTES_KEY,
  parseShowNotes,
  parseShowTime,
  SHOW_TIME_KEY,
} from "./preferences";

describe("parseShowNotes", () => {
  it("is hidden when nothing is saved", () => {
    expect(parseShowNotes(null)).toBe(false);
    expect(parseShowNotes(undefined)).toBe(false);
  });

  it("is shown only for the saved text 'true'", () => {
    expect(parseShowNotes("true")).toBe(true);
    expect(parseShowNotes("false")).toBe(false);
    expect(parseShowNotes("1")).toBe(false);
    expect(parseShowNotes("")).toBe(false);
  });

  it("uses its own key, apart from the progress data", () => {
    expect(SHOW_NOTES_KEY).not.toMatch(/progress/);
  });
});

describe("parseShowTime", () => {
  it("is hidden unless it was saved as true", () => {
    expect(parseShowTime(null)).toBe(false);
    expect(parseShowTime("false")).toBe(false);
    expect(parseShowTime("true")).toBe(true);
    expect(SHOW_TIME_KEY).toBe("leetcode-show-time");
  });
});
