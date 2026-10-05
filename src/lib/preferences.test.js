import { describe, expect, it } from "vitest";
import {
  SHOW_NOTES_KEY,
  SHOW_SOLUTIONS_KEY,
  parseShowNotes,
  parseShowSolutions,
  parseSolutionLanguage,
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

describe("parseSolutionLanguage", () => {
  it("keeps a known language", () => {
    expect(parseSolutionLanguage("kotlin")).toBe("kotlin");
    expect(parseSolutionLanguage("c")).toBe("c");
  });

  it("falls back to the default for anything else", () => {
    expect(parseSolutionLanguage(null)).toBe("python");
    expect(parseSolutionLanguage("cobol")).toBe("python");
    expect(parseSolutionLanguage("")).toBe("python");
  });
});

describe("parseShowSolutions", () => {
  it("is hidden unless it was saved as true", () => {
    expect(parseShowSolutions(null)).toBe(false);
    expect(parseShowSolutions("false")).toBe(false);
    expect(parseShowSolutions("true")).toBe(true);
    expect(SHOW_SOLUTIONS_KEY).toBe("leetcode-show-solutions");
  });
});
