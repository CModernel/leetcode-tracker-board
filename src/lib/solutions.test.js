import { describe, expect, it } from "vitest";
import { canReplace, normalizeSolution, solutionsOf } from "./solutions";
import { importData } from "../context/progressReducers";

describe("normalizeSolution", () => {
  it("returns null without code", () => {
    expect(normalizeSolution(null, "2026-10-04")).toBeNull();
    expect(normalizeSolution({ code: "   " }, "2026-10-04")).toBeNull();
    expect(normalizeSolution({ code: 5 }, "2026-10-04")).toBeNull();
  });

  it("fills defaults and trims trailing space", () => {
    expect(normalizeSolution({ code: "x = 1\n\n" }, "2026-10-04")).toEqual({
      code: "x = 1",
      language: "other",
      source: "manual",
      savedAt: "2026-10-04",
    });
  });

  it("keeps valid fields and meta, drops unknown junk", () => {
    const result = normalizeSolution(
      {
        code: "a",
        language: "python",
        source: "extension",
        savedAt: "2026-01-02",
        meta: { submissionId: 7 },
        junk: true,
      },
      "2026-10-04",
    );
    expect(result).toEqual({
      code: "a",
      language: "python",
      source: "extension",
      savedAt: "2026-01-02",
      meta: { submissionId: 7 },
    });
  });

  it("uses the fallback date when the date is invalid", () => {
    expect(normalizeSolution({ code: "a", savedAt: "yesterday" }, "2026-10-04").savedAt).toBe(
      "2026-10-04",
    );
  });
});

describe("normalizeSolution name", () => {
  it("trims and cuts the name, and leaves it out when empty", () => {
    expect(normalizeSolution({ code: "a", name: "  Optimal " }, "d").name).toBe("Optimal");
    expect(normalizeSolution({ code: "a", name: "x".repeat(60) }, "d").name).toHaveLength(40);
    expect(normalizeSolution({ code: "a", name: "   " }, "d")).not.toHaveProperty("name");
    expect(normalizeSolution({ code: "a", name: 5 }, "d")).not.toHaveProperty("name");
  });
});

describe("solutionsOf", () => {
  it("is a list even when there is nothing or bad data", () => {
    expect(solutionsOf(undefined)).toEqual([]);
    expect(solutionsOf({ solutions: "x" })).toEqual([]);
    expect(solutionsOf({ solutions: [{ code: "a" }] })).toEqual([{ code: "a" }]);
  });
});

describe("canReplace", () => {
  it("allows when nothing is saved", () => {
    expect(canReplace(undefined, { source: "extension" })).toBe(true);
  });
  it("never replaces a manual solution with an automatic one", () => {
    expect(canReplace({ source: "manual" }, { source: "leetcode-api" })).toBe(false);
    expect(canReplace({ source: "manual" }, { source: "manual" })).toBe(true);
  });
  it("lets anything replace an automatic one", () => {
    expect(canReplace({ source: "extension" }, { source: "leetcode-api" })).toBe(true);
    expect(canReplace({ source: "extension" }, { source: "manual" })).toBe(true);
  });
});

describe("export/import", () => {
  it("keeps the solutions of an entry", () => {
    const data = { "Blind 75": { "blind75-1": { solutions: [{ code: "a" }] } } };
    expect(importData(data)["Blind 75"]["blind75-1"].solutions[0].code).toBe("a");
  });
});
