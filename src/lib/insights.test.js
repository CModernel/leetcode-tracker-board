import { describe, expect, it } from "vitest";
import { HELP } from "./attempts";
import {
  HELP_WEAK,
  MIN_ATTEMPTS,
  categoryOf,
  categoryStats,
  classifyCategory,
  rankCategories,
} from "./insights";

const MIN = 60_000;
const problem = (id, section, difficulty = "Easy") => ({
  id,
  title: id,
  difficulty,
  listMeta: { section, originalIndex: Number(id.slice(1)) },
});
const attempt = (help, extra = {}) => ({ date: "2026-10-10", review: 0, help, ...extra });
const solved = (extra = {}) => ({
  status: "solved",
  solved: true,
  solvedDate: "2026-10-01",
  reviews: [true, false, false, false, false],
  dates: { initial: "2026-10-01", review1: "2026-10-02" },
  ...extra,
});

describe("categoryOf", () => {
  it("is the section, else the module, else Other", () => {
    expect(categoryOf(problem("p1", "Graphs"))).toBe("Graphs");
    expect(categoryOf({ listMeta: { module: "Stack" } })).toBe("Stack");
    expect(categoryOf({})).toBe("Other");
    expect(categoryOf(undefined)).toBe("Other");
  });
});

describe("categoryStats", () => {
  const problems = [problem("p1", "Arrays"), problem("p2", "Arrays"), problem("p3", "Graphs")];

  it("one row per category in list order, with counts even with no progress", () => {
    const stats = categoryStats(problems, {});
    expect(stats.map((s) => [s.category, s.problems, s.solved, s.attempts])).toEqual([
      ["Arrays", 2, 0, 0],
      ["Graphs", 1, 0, 0],
    ]);
    expect(stats[0].helpRate).toBeNull();
    expect(stats[0].averageRatio).toBeNull();
  });

  it("counts attempts by help, the help rate, the help level and the step-backs", () => {
    const progress = {
      p1: solved({ attempts: [attempt(HELP.ALONE), attempt(HELP.NOTE), attempt(HELP.SOLUTION)] }),
      p2: solved({ attempts: [attempt(HELP.ALONE)] }),
    };
    const [arrays] = categoryStats(problems, progress);
    expect(arrays).toMatchObject({ solved: 2, attempts: 4, alone: 2, note: 1, solution: 1, stepBacks: 1 });
    expect(arrays.helpRate).toBe(0.5);
    expect(arrays.helpLevel).toBe(3 / 8);
  });

  it("ignores damaged attempts", () => {
    const progress = { p1: solved({ attempts: [attempt(7), null, "x", attempt(HELP.ALONE)] }) };
    expect(categoryStats(problems, progress)[0].attempts).toBe(1);
  });

  it("counts mastered problems", () => {
    const progress = { p3: solved({ reviews: [true, true, true, true, true] }) };
    expect(categoryStats(problems, progress)[1].mastered).toBe(1);
  });

  it("uses the times of attempts and first solves, never a missing time", () => {
    const progress = {
      p1: solved({
        firstSolve: { date: "2026-10-01", ms: 20 * MIN, limitMs: 20 * MIN },
        attempts: [
          attempt(HELP.ALONE, { ms: 5 * MIN, limitMs: 10 * MIN }),
          attempt(HELP.ALONE, { ms: 20 * MIN, limitMs: 10 * MIN }),
          attempt(HELP.ALONE),
        ],
      }),
    };
    const [arrays] = categoryStats(problems, progress);
    expect(arrays.timed).toBe(3);
    expect(arrays.averageRatio).toBeCloseTo((1 + 0.5 + 2) / 3);
    // 20 of 10 timed out; 20 of 20 and 5 of 10 are on time
    expect(arrays.overLimit).toBe(1);
    expect(arrays.timedOut).toBe(1);
    expect(arrays.overLimitShare).toBeCloseTo(1 / 3);
    expect(arrays.averageScore).toBeCloseTo((100 + 100 + 0) / 3);
  });

  it("a time with no limit counts but has no ratio, and is never over the limit", () => {
    const progress = { p1: solved({ attempts: [attempt(HELP.ALONE, { ms: 99 * MIN })] }) };
    const [arrays] = categoryStats(problems, progress);
    expect(arrays.timed).toBe(1);
    expect(arrays.averageRatio).toBeNull();
    expect(arrays.overLimit).toBe(0);
    expect(arrays.averageScore).toBe(100);
  });
});

describe("classifyCategory", () => {
  const base = { attempts: MIN_ATTEMPTS, helpRate: 0, timed: 0, overLimitShare: null };

  it("needs enough attempts before judging", () => {
    expect(classifyCategory({ ...base, attempts: MIN_ATTEMPTS - 1, helpRate: 1 })).toMatchObject({
      enough: false,
      needsHelp: false,
      weak: false,
    });
  });

  it("needs practice from the help threshold", () => {
    expect(classifyCategory({ ...base, helpRate: HELP_WEAK }).weak).toBe(true);
    expect(classifyCategory({ ...base, helpRate: HELP_WEAK - 0.01 }).weak).toBe(false);
  });

  it("is slow with enough timed records mostly over the limit", () => {
    expect(classifyCategory({ ...base, timed: 3, overLimitShare: 0.5 }).slow).toBe(true);
    expect(classifyCategory({ ...base, timed: 2, overLimitShare: 1 }).slow).toBe(false);
    expect(classifyCategory({ ...base, timed: 4, overLimitShare: 0.25 }).slow).toBe(false);
  });
});

describe("rankCategories", () => {
  const row = (category, extra) => ({
    category,
    attempts: 5,
    helpRate: 0,
    helpLevel: 0,
    timed: 0,
    overLimitShare: null,
    ...extra,
  });

  it("puts weak and slow first, then weak, then slow, then the rest, then no data", () => {
    const ranked = rankCategories([
      row("none", { attempts: 0, helpRate: null, helpLevel: null }),
      row("fine"),
      row("slow", { timed: 3, overLimitShare: 1 }),
      row("weak", { helpRate: 0.5, helpLevel: 0.3 }),
      row("both", { helpRate: 0.5, helpLevel: 0.3, timed: 3, overLimitShare: 1 }),
    ]);
    expect(ranked.map((r) => r.category)).toEqual(["both", "weak", "slow", "fine", "none"]);
    expect(ranked[0]).toMatchObject({ weak: true, slow: true });
  });

  it("orders inside a group by help level, then keeps list order", () => {
    const ranked = rankCategories([
      row("a", { helpRate: 0.5, helpLevel: 0.3 }),
      row("b", { helpRate: 0.8, helpLevel: 0.6 }),
      row("c", { attempts: 0, helpRate: null, helpLevel: null }),
      row("d", { attempts: 0, helpRate: null, helpLevel: null }),
    ]);
    expect(ranked.map((r) => r.category)).toEqual(["b", "a", "c", "d"]);
  });
});
