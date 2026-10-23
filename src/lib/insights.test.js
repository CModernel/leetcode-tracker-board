import { describe, expect, it } from "vitest";
import { HELP } from "./attempts";
import {
  HELP_WEAK,
  MIN_ATTEMPTS,
  categoryOf,
  categoryStats,
  activeDaysThisWeek,
  activityDays,
  classifyCategory,
  HARDER_MIN,
  HARDER_SHARE,
  attemptDue,
  harderThanTheyLook,
  notesEffect,
  notPracticedLately,
  heatMap,
  punctuality,
  retentionByReview,
  rankCategories,
  streak,
  suggestNew,
  timeSummary,
  todayList,
  upcomingLoad,
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

  it("counts attempts by help and the help rate", () => {
    const progress = {
      p1: solved({ attempts: [attempt(HELP.ALONE), attempt(HELP.NOTE), attempt(HELP.NOTE)] }),
      p2: solved({ attempts: [attempt(HELP.ALONE)] }),
    };
    const [arrays] = categoryStats(problems, progress);
    expect(arrays).toMatchObject({ solved: 2, attempts: 4, alone: 2, helped: 2 });
    expect(arrays.helpRate).toBe(0.5);
    expect(arrays).not.toHaveProperty("stepBacks");
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
    timed: 0,
    overLimitShare: null,
    ...extra,
  });

  it("puts weak and slow first, then weak, then slow, then the rest, then no data", () => {
    const ranked = rankCategories([
      row("none", { attempts: 0, helpRate: null }),
      row("fine"),
      row("slow", { timed: 3, overLimitShare: 1 }),
      row("weak", { helpRate: 0.5 }),
      row("both", { helpRate: 0.5, timed: 3, overLimitShare: 1 }),
    ]);
    expect(ranked.map((r) => r.category)).toEqual(["both", "weak", "slow", "fine", "none"]);
    expect(ranked[0]).toMatchObject({ weak: true, slow: true });
  });

  it("orders inside a group by help level, then keeps list order", () => {
    const ranked = rankCategories([
      row("a", { helpRate: 0.5 }),
      row("b", { helpRate: 0.8 }),
      row("c", { attempts: 0, helpRate: null }),
      row("d", { attempts: 0, helpRate: null }),
    ]);
    expect(ranked.map((r) => r.category)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("activityDays", () => {
  it("counts attempts, solves and completed reviews without their own attempt, once each", () => {
    const progress = {
      p1: solved({
        solvedDate: "2026-10-01",
        reviews: [true, true, false, false, false],
        dates: { initial: "2026-10-01", review1: "2026-10-02", review2: "2026-10-05" },
        attempts: [{ date: "2026-10-05", review: 1, help: 0 }],
      }),
      p2: { status: "todo", solved: false, reviews: [], dates: {} },
      p3: null,
    };
    expect(activityDays(progress)).toEqual({ "2026-10-01": 1, "2026-10-02": 1, "2026-10-05": 1 });
  });

  it("uses the first solve date when there is one, and ignores bad dates", () => {
    const progress = {
      p1: solved({ solvedDate: "2026-10-01", firstSolve: { date: "2026-10-01", ms: 1 }, reviews: [], dates: {} }),
      p2: solved({ reviews: [], dates: {}, attempts: [{ date: "nope", review: 0, help: 0 }] }),
    };
    expect(activityDays(progress)).toEqual({ "2026-10-01": 2 });
  });
});

describe("streak and week", () => {
  const days = { "2026-10-17": 1, "2026-10-18": 2, "2026-10-19": 1, "2026-10-14": 1 };

  it("counts the days in a row up to today", () => {
    expect(streak(days, "2026-10-19")).toBe(3);
  });
  it("is not lost before studying today: it counts up to yesterday", () => {
    expect(streak(days, "2026-10-20")).toBe(3);
    expect(streak(days, "2026-10-21")).toBe(0);
  });
  it("counts the active days of this week (Monday to today)", () => {
    // 2026-10-19 is a Monday
    expect(activeDaysThisWeek(days, "2026-10-19")).toBe(1);
    expect(activeDaysThisWeek(days, "2026-10-18")).toBe(3);
  });
});

describe("heatMap", () => {
  it("has the asked weeks of 7 days, starting on a Monday and ending with this week", () => {
    const grid = heatMap({ "2026-10-14": 2 }, "2026-10-15", 3);
    expect(grid).toHaveLength(3);
    expect(grid[0][0].date).toBe("2026-09-28");
    expect(grid[2][2]).toEqual({ date: "2026-10-14", count: 2 });
    expect(grid[2][3]).toEqual({ date: "2026-10-15", count: 0 });
    expect(grid[2][4]).toBeNull();
  });
});

describe("upcomingLoad", () => {
  const problems = [problem("p1", "A"), problem("p2", "A"), problem("p3", "A"), problem("p4", "A")];

  it("counts only the next review of each problem: overdue and per day", () => {
    const progress = {
      // R2 due 2026-10-02 + 2 = 2026-10-04: overdue
      p1: solved(),
      // solved today: R1 tomorrow
      p2: solved({ solvedDate: "2026-10-19", reviews: [false, false, false, false, false], dates: { initial: "2026-10-19" } }),
      p3: solved({ reviews: [true, true, true, true, true] }),
      p4: { status: "todo", solved: false },
    };
    const load = upcomingLoad(problems, progress, "2026-10-19", 3);
    expect(load.overdue).toBe(1);
    expect(load.days).toEqual([
      { date: "2026-10-19", count: 0 },
      { date: "2026-10-20", count: 1 },
      { date: "2026-10-21", count: 0 },
    ]);
  });
});

describe("todayList", () => {
  const problems = [problem("p1", "A"), problem("p2", "B"), problem("p3", "A"), problem("p4", "B")];
  const due = (solvedDate) =>
    solved({ solvedDate, reviews: [false, false, false, false, false], dates: { initial: solvedDate } });

  it("lists due and overdue reviews, weak categories first, then the most overdue", () => {
    const progress = {
      p1: due("2026-10-10"),
      p2: due("2026-10-01"),
      p3: due("2026-10-18"),
      p4: due("2026-10-19"),
    };
    const list = todayList(problems, progress, "2026-10-19", new Set(["A"]));
    expect(list.map((item) => item.problem.id)).toEqual(["p1", "p3", "p2"]);
    expect(list[0]).toMatchObject({ stage: "R1", daysLate: 8, weak: true });
    expect(list[1].daysLate).toBe(0);
  });

  it("is limited", () => {
    const progress = { p1: due("2026-10-01"), p2: due("2026-10-01"), p3: due("2026-10-01") };
    expect(todayList(problems, progress, "2026-10-19", new Set(), 2)).toHaveLength(2);
  });
});

describe("suggestNew", () => {
  const problems = [
    problem("p1", "A", "Hard"),
    problem("p2", "A", "Easy"),
    problem("p3", "B", "Easy"),
    problem("p4", "A", "Medium"),
    problem("p5", "A", "Easy"),
  ];

  it("suggests untouched problems of weak categories, easiest first", () => {
    const progress = { p5: solved(), p4: { status: "in-progress", solved: false } };
    const result = suggestNew(problems, progress, new Set(["A"]));
    expect(result.fromWeak).toBe(true);
    expect(result.problems.map((p) => p.id)).toEqual(["p2", "p4", "p1"]);
  });

  it("without weak categories it gives the next untouched problems in list order", () => {
    const result = suggestNew(problems, { p1: solved() }, new Set(), 2);
    expect(result.fromWeak).toBe(false);
    expect(result.problems.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("a problem with attempts is not new", () => {
    const progress = { p2: { status: "todo", solved: false, attempts: [attempt(HELP.ALONE)] } };
    expect(suggestNew(problems, progress, new Set(["A"])).problems.map((p) => p.id)).not.toContain("p2");
  });
});

describe("timeSummary", () => {
  const problems = [problem("p1", "A"), problem("p2", "A")];

  it("averages the time against the limit over the whole list", () => {
    const progress = {
      p1: solved({
        firstSolve: { date: "2026-10-01", ms: 10 * MIN, limitMs: 20 * MIN },
        attempts: [attempt(0, { ms: 5 * MIN, limitMs: 10 * MIN }), attempt(0, { ms: 15 * MIN, limitMs: 10 * MIN })],
      }),
      p2: solved({ attempts: [attempt(0, { ms: 6 * MIN, limitMs: 10 * MIN })] }),
    };
    const summary = timeSummary(problems, progress);
    expect(summary.count).toBe(4);
    expect(summary.averageRatio).toBeCloseTo((0.5 + 0.5 + 1.5 + 0.6) / 4);
    expect(summary.averageMs).toBeCloseTo((10 + 5 + 15 + 6) * MIN / 4);
    expect(summary.averageLimitMs).toBeCloseTo((20 + 10 + 10 + 10) * MIN / 4);
  });

  it("leaves out records with no time or no limit, and is empty without any", () => {
    const progress = {
      p1: solved({ attempts: [attempt(0), attempt(0, { ms: 5 * MIN })] }),
    };
    expect(timeSummary(problems, progress)).toEqual({
      count: 0,
      averageRatio: null,
      averageMs: null,
      averageLimitMs: null,
    });
  });
});

describe("retentionByReview", () => {
  const problems = [problem("p1", "A"), problem("p2", "A")];
  const at = (review, help) => ({ date: "2026-10-10", review, help });

  it("one row per review with the share solved alone, null with too few attempts", () => {
    const progress = {
      p1: solved({ attempts: [at(0, 0), at(0, 1), at(1, 0)] }),
      p2: solved({ attempts: [at(0, 0), at(0, 0), at(3, 1)] }),
    };
    const rows = retentionByReview(problems, progress);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual({ attempts: 4, alone: 3, rate: 0.75 });
    expect(rows[1]).toEqual({ attempts: 1, alone: 1, rate: null });
    expect(rows[3].rate).toBeNull();
    expect(rows[4]).toEqual({ attempts: 0, alone: 0, rate: null });
  });

  it("ignores unknown reviews and help levels, and works with no progress", () => {
    const progress = { p1: solved({ attempts: [at(7, 0), at(0, 5), { review: 0 }] }) };
    expect(retentionByReview(problems, progress).every((row) => row.attempts === 0)).toBe(true);
    expect(retentionByReview([], {})).toHaveLength(5);
  });
});

describe("attemptDue", () => {
  const entry = (attempts, extra = {}) =>
    solved({ dates: { initial: "2026-10-01", review1: "2026-10-02", review2: "2026-10-05" }, attempts, ...extra });

  it("R1 is due 1 day after solving, the next ones after the review before", () => {
    const e = entry([
      { date: "2026-10-02", review: 0, help: 0 },
      { date: "2026-10-05", review: 1, help: 0 },
      { date: "2026-10-09", review: 2, help: 0 },
    ]);
    expect(attemptDue(e, 0)).toBe("2026-10-02");
    expect(attemptDue(e, 1)).toBe("2026-10-04");
    expect(attemptDue(e, 2)).toBe("2026-10-09");
  });

  it("a review repeated after needing help was due 2 days after that attempt", () => {
    const e = entry([
      { date: "2026-10-02", review: 0, help: 1 },
      { date: "2026-10-06", review: 0, help: 0 },
    ]);
    expect(attemptDue(e, 0)).toBe("2026-10-02");
    expect(attemptDue(e, 1)).toBe("2026-10-04");
  });

  it("is null when a date is missing or the attempt is not valid", () => {
    expect(attemptDue(entry([{ date: "2026-10-10", review: 3, help: 0 }]), 0)).toBeNull();
    expect(attemptDue(entry([{ date: "2026-10-10", review: 9, help: 0 }]), 0)).toBeNull();
    expect(attemptDue(entry([{ date: "2026-10-10", review: 0, help: 0 }], { solvedDate: null }), 0)).toBeNull();
    expect(attemptDue(entry([]), 0)).toBeNull();
    expect(attemptDue(undefined, 0)).toBeNull();
  });
});

describe("punctuality", () => {
  const problems = [problem("p1", "A"), problem("p2", "A")];
  const dates = { initial: "2026-10-01", review1: "2026-10-02" };

  it("splits attempts on time and late, with the help each group needed", () => {
    const progress = {
      // R1 due 10-02: on time (10-02), late (10-05, help); R2 repeated after help
      p1: solved({ dates, attempts: [{ date: "2026-10-02", review: 0, help: 0 }, { date: "2026-10-05", review: 1, help: 0 }] }),
      p2: solved({
        dates,
        attempts: [
          { date: "2026-10-01", review: 0, help: 0 },
          { date: "2026-10-04", review: 0, help: 1 },
        ],
      }),
    };
    const result = punctuality(problems, progress);
    expect(result).toMatchObject({ count: 4, onTime: 2, late: 2, onTimeRate: 0.5 });
    // on time: p1 R1 and p2 R1 early (both alone); late: p1 R2 (due 10-04, done 10-05), p2 R1 help
    expect(result.helpOnTime).toBeNull();
    expect(result.helpLate).toBeNull();
  });

  it("shows rates only with enough attempts in the group", () => {
    // all done on 10-10, long after R1 was due (10-02): three late attempts, one with help
    const late = (help) => ({ date: "2026-10-10", review: 0, help });
    const progress = {
      p1: solved({ dates, attempts: [late(1)] }),
      p2: solved({ dates, attempts: [late(0), late(0)] }),
    };
    expect(punctuality(problems, progress)).toMatchObject({ count: 3, late: 3, onTime: 0, helpLate: 1 / 3, helpOnTime: null });
    const fewer = punctuality(problems, { p1: progress.p1 });
    expect(fewer).toMatchObject({ count: 1, onTimeRate: null, helpLate: null });
  });

  it("leaves out attempts whose due day cannot be rebuilt, and works with nothing", () => {
    const progress = { p1: solved({ solvedDate: null, attempts: [{ date: "2026-10-10", review: 0, help: 0 }] }) };
    expect(punctuality(problems, progress).count).toBe(0);
    expect(punctuality([], {})).toMatchObject({ count: 0, onTimeRate: null });
  });
});

describe("harderThanTheyLook", () => {
  const tries = (...helps) => ({ attempts: helps.map((help) => attempt(help)) });
  const problems = [
    problem("p1", "A", "Medium"),
    problem("p2", "A", "Easy"),
    problem("p3", "A", "Hard"),
    problem("p4", "A", "Easy"),
    problem("p5", "A", "Medium"),
  ];

  it("uses the thresholds of the plan", () => {
    expect(HARDER_MIN).toBe(2);
    expect(HARDER_SHARE).toBe(0.5);
  });

  it("lists Easy and Medium that needed help in at least half of 2+ attempts, Easy first, never Hard", () => {
    const progress = {
      p1: solved(tries(1, 0, 1)),
      p2: solved(tries(1, 0)),
      p3: solved(tries(1, 1, 1)),
      p4: solved(tries(0, 0, 1)),
      p5: solved(tries(1)),
    };
    expect(harderThanTheyLook(problems, progress).map((item) => item.problem.id)).toEqual(["p2", "p1"]);
    expect(harderThanTheyLook(problems, progress)[1]).toMatchObject({ attempts: 3, helped: 2 });
  });

  it("orders by how often help was needed, then attempts, then list order, and cuts at the limit", () => {
    const easy = [problem("p1", "A"), problem("p2", "A"), problem("p3", "A"), problem("p4", "A")];
    const progress = {
      p1: solved(tries(1, 0)),
      p2: solved(tries(1, 1)),
      p3: solved(tries(1, 0)),
      p4: solved(tries(1, 1, 1)),
    };
    expect(harderThanTheyLook(easy, progress).map((i) => i.problem.id)).toEqual(["p4", "p2", "p1"]);
    expect(harderThanTheyLook(easy, progress, 1)).toHaveLength(1);
  });

  it("is empty with no history", () => {
    expect(harderThanTheyLook(problems, {})).toEqual([]);
  });
});

describe("notPracticedLately", () => {
  const problems = [problem("p1", "Trees"), problem("p2", "Trees"), problem("p3", "Graphs"), problem("p4", "Stack"), problem("p5", "Heap")];
  const today = "2026-10-20";
  const done = (day, extra = {}) =>
    solved({ solvedDate: day, firstSolve: { date: day }, reviews: [false, false, false, false, false], dates: { initial: day }, ...extra });

  it("lists the categories with a solved problem, the longest without activity first", () => {
    const progress = {
      p1: done("2026-09-20"),
      p2: done("2026-10-05"),
      p3: done("2026-10-18"),
      p4: done("2026-10-10"),
    };
    expect(notPracticedLately(problems, progress, today)).toEqual([
      { category: "Trees", daysAgo: 15 },
      { category: "Stack", daysAgo: 10 },
      { category: "Graphs", daysAgo: 2 },
    ]);
  });

  it("the last day is the latest thing done on any problem of the category, reviews included", () => {
    const progress = { p1: done("2026-09-01", { attempts: [{ date: "2026-10-12", review: 0, help: 0 }] }) };
    expect(notPracticedLately(problems, progress, today)).toEqual([{ category: "Trees", daysAgo: 8 }]);
  });

  it("leaves out categories with nothing solved, respects the limit and tolerates nothing", () => {
    const progress = {
      p1: { status: "in-progress", solved: false, reviews: [false, false, false, false, false], dates: {} },
      p3: done("2026-10-01"),
      p4: done("2026-10-02"),
      p5: done("2026-10-03"),
    };
    expect(notPracticedLately(problems, progress, today, 2).map((i) => i.category)).toEqual(["Graphs", "Stack"]);
    expect(notPracticedLately(problems, {}, today)).toEqual([]);
  });
});

describe("notesEffect", () => {
  const problems = [problem("p1", "A"), problem("p2", "A"), problem("p3", "A")];
  const tries = (note, ...helps) => ({ ...(note ? { note } : {}), attempts: helps.map((help) => attempt(help)) });

  it("compares the help rate of problems with a note against those without", () => {
    const progress = {
      p1: solved(tries("remember", 0, 0, 1)),
      p2: solved(tries(null, 1, 1, 0)),
      p3: solved(tries("   ", 1)),
    };
    const result = notesEffect(problems, progress);
    expect(result.withNote).toEqual({ attempts: 3, helped: 1, rate: 1 / 3 });
    // a blank note is no note
    expect(result.without).toEqual({ attempts: 4, helped: 3, rate: 3 / 4 });
  });

  it("rates are null below the minimum, and nothing breaks without history", () => {
    const progress = { p1: solved(tries("x", 1)) };
    expect(notesEffect(problems, progress).withNote).toEqual({ attempts: 1, helped: 1, rate: null });
    expect(notesEffect([], {}).without).toEqual({ attempts: 0, helped: 0, rate: null });
  });
});
