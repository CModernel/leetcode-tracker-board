import { describe, expect, it } from "vitest";
import { getProblems, problemLabel, problemLists } from "./lists";

describe("problemLabel", () => {
  it("puts the number before the title", () => {
    expect(
      problemLabel({ title: "Two Sum", listMeta: { originalIndex: 1 } })
    ).toBe("1 - Two Sum");
    expect(
      problemLabel({ title: "Merge Intervals", listMeta: { originalIndex: 128 } })
    ).toBe("128 - Merge Intervals");
  });

  it("is just the title when there is no number", () => {
    expect(problemLabel({ title: "Two Sum" })).toBe("Two Sum");
    expect(problemLabel({ title: "Two Sum", listMeta: {} })).toBe("Two Sum");
    expect(
      problemLabel({ title: "Two Sum", listMeta: { originalIndex: "1" } })
    ).toBe("Two Sum");
  });

  it("works for every problem in every list, with a number", () => {
    for (const [name, problems] of Object.entries(problemLists)) {
      for (const problem of problems) {
        expect(problemLabel(problem), `${name}: ${problem.id}`).toMatch(/^\d+ - .+/);
      }
    }
  });

  it("numbers each list from 1 in order", () => {
    for (const name of Object.keys(problemLists)) {
      const numbers = getProblems(name).map((p) => p.listMeta.originalIndex);
      expect(numbers).toEqual(numbers.map((_, i) => i + 1));
    }
  });
});
