import { describe, expect, it } from "vitest";
import { SHOW_NOTES_KEY, parseShowNotes } from "./preferences";

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
