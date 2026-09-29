import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, applyFilter, filterProblems } from "./filters";

const today = "2026-09-29";

const problems = [
  { id: 1, difficulty: "Easy", topics: ["Arrays", "Hashing"] },
  { id: 2, difficulty: "Medium", topics: ["Arrays"] },
  { id: 3, difficulty: "Hard", topics: ["Graphs"] },
  { id: 4, difficulty: "Easy" },
];

const progress = {
  // R1 due 2026-09-29 -> due today
  1: {
    solved: true,
    solvedDate: "2026-09-28",
    reviews: [false, false, false, false, false],
  },
  // solved today -> R1 tomorrow, not due
  2: {
    solved: true,
    solvedDate: "2026-09-29",
    reviews: [false, false, false, false, false],
  },
  // not solved
  3: { solved: false },
};

const ids = (list) => list.map((p) => p.id);
const filter = (overrides) =>
  ids(
    filterProblems(problems, progress, { ...DEFAULT_FILTERS, ...overrides }, today)
  );

describe("filterProblems", () => {
  it("returns everything with the default filters", () => {
    expect(filter({})).toEqual([1, 2, 3, 4]);
  });

  it("filters by category, including problems without topics", () => {
    expect(filter({ category: "Arrays" })).toEqual([1, 2]);
    expect(filter({ category: "Graphs" })).toEqual([3]);
    expect(filter({ category: "Nothing" })).toEqual([]);
  });

  it("filters by difficulty", () => {
    expect(filter({ difficulty: "Easy" })).toEqual([1, 4]);
    expect(filter({ difficulty: "Hard" })).toEqual([3]);
  });

  it("combines category and difficulty", () => {
    expect(filter({ category: "Arrays", difficulty: "Easy" })).toEqual([1]);
    expect(filter({ category: "Graphs", difficulty: "Easy" })).toEqual([]);
  });

  it("keeps only problems due today or overdue with dueToday", () => {
    expect(filter({ dueToday: true })).toEqual([1]);
  });

  it("combines dueToday with the other filters", () => {
    expect(filter({ dueToday: true, difficulty: "Easy" })).toEqual([1]);
    expect(filter({ dueToday: true, difficulty: "Medium" })).toEqual([]);
    expect(filter({ dueToday: true, category: "Graphs" })).toEqual([]);
  });

  it("handles an empty list of problems", () => {
    expect(filterProblems([], {}, DEFAULT_FILTERS, today)).toEqual([]);
  });
});

describe("applyFilter", () => {
  it("sets a value without touching the other filters", () => {
    expect(applyFilter(DEFAULT_FILTERS, "difficulty", "Easy")).toEqual({
      ...DEFAULT_FILTERS,
      difficulty: "Easy",
    });
  });

  it("accepts an updater function, so the checkbox can toggle", () => {
    const on = applyFilter(DEFAULT_FILTERS, "dueToday", (prev) => !prev);
    expect(on.dueToday).toBe(true);
    const off = applyFilter(on, "dueToday", (prev) => !prev);
    expect(off.dueToday).toBe(false);
  });

  it("does not mutate the previous filters", () => {
    applyFilter(DEFAULT_FILTERS, "dueToday", true);
    expect(DEFAULT_FILTERS.dueToday).toBe(false);
  });
});
