import { describe, expect, it } from "vitest";
import { computeStats } from "./stats";

const today = "2026-09-29";
const none = [false, false, false, false, false];

const problems = [
  { id: 1, difficulty: "Easy" },
  { id: 2, difficulty: "Easy" },
  { id: 3, difficulty: "Medium" },
  { id: 4, difficulty: "Hard" },
  { id: 5, difficulty: "Hard" },
];

describe("computeStats", () => {
  it("counts nothing solved on an empty progress", () => {
    expect(computeStats(problems, {}, today)).toEqual({
      total: 5,
      solved: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      dueToday: 0,
    });
  });

  it("counts solved problems in total and by difficulty", () => {
    const progress = {
      1: { solved: true, solvedDate: today, reviews: none },
      3: { solved: true, solvedDate: today, reviews: none },
      4: { solved: true, solvedDate: today, reviews: none },
      5: { solved: false },
    };
    expect(computeStats(problems, progress, today)).toMatchObject({
      total: 5,
      solved: 3,
      easy: 1,
      medium: 1,
      hard: 1,
    });
  });

  it("counts problems with a review due today or overdue", () => {
    const progress = {
      1: { solved: true, solvedDate: "2026-09-28", reviews: none }, // R1 today
      2: { solved: true, solvedDate: "2026-09-01", reviews: none }, // overdue
      3: { solved: true, solvedDate: today, reviews: none }, // R1 tomorrow
      4: { solved: false },
    };
    expect(computeStats(problems, progress, today).dueToday).toBe(2);
  });

  it("ignores progress of problems that are not in the list", () => {
    const progress = { 99: { solved: true, solvedDate: today, reviews: none } };
    expect(computeStats(problems, progress, today).solved).toBe(0);
  });

  it("handles an empty list", () => {
    expect(computeStats([], {}, today)).toEqual({
      total: 0,
      solved: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      dueToday: 0,
    });
  });
});
