import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  UNSOLVE_CONFIRM,
  buildColumns,
  getCardActions,
  getNextDue,
  getStage,
  runCardAction,
} from "./board";
import { computeStats } from "./stats";

const today = "2026-09-29";
const none = [false, false, false, false, false];

const solved = (reviews, extra = {}) => ({
  status: "solved",
  solved: true,
  solvedDate: "2026-09-28",
  reviews,
  dates: {},
  ...extra,
});

describe("COLUMNS", () => {
  it("has the four columns in order, each with an id and a title", () => {
    expect(COLUMNS.map((c) => c.id)).toEqual([
      "todo",
      "in-progress",
      "reviewing",
      "mastered",
    ]);
    for (const column of COLUMNS) expect(column.title).toBeTruthy();
  });

  it("has unique ids", () => {
    expect(new Set(COLUMNS.map((c) => c.id)).size).toBe(COLUMNS.length);
  });
});

describe("getStage", () => {
  it("is todo or in-progress for problems that are not solved", () => {
    expect(getStage(undefined)).toBe("todo");
    expect(getStage({})).toBe("todo");
    expect(getStage({ status: "todo", solved: false })).toBe("todo");
    expect(getStage({ status: "in-progress", solved: false })).toBe("in-progress");
  });

  it("is the review a solved problem is waiting for", () => {
    expect(getStage(solved(none))).toBe("R1");
    expect(getStage(solved([true, false, false, false, false]))).toBe("R2");
    expect(getStage(solved([true, true, true, false, false]))).toBe("R4");
    expect(getStage(solved([true, true, true, true, false]))).toBe("R5");
  });

  it("is mastered when all five reviews are done", () => {
    expect(getStage(solved([true, true, true, true, true]))).toBe("mastered");
  });

  it("works with entries saved before statuses existed", () => {
    expect(getStage({ solved: true, reviews: none })).toBe("R1");
    expect(getStage({ solved: false })).toBe("todo");
  });

  it("uses the first review not done for old out-of-order data", () => {
    expect(getStage(solved([true, false, false, true, false]))).toBe("R2");
  });

  it("treats a missing reviews list as no review done", () => {
    expect(getStage({ status: "solved", solved: true })).toBe("R1");
  });
});

describe("getNextDue", () => {
  it("is null when the problem is not solved", () => {
    expect(getNextDue(undefined)).toBe(null);
    expect(getNextDue({ status: "todo", solved: false })).toBe(null);
    expect(getNextDue({ status: "in-progress", solved: false })).toBe(null);
  });

  it("is null when mastered", () => {
    expect(getNextDue(solved([true, true, true, true, true]))).toBe(null);
  });

  it("is the due date of the review it waits for", () => {
    expect(getNextDue(solved(none))).toBe("2026-09-29"); // solved 28th + 1
    const r2 = solved([true, false, false, false, false], {
      dates: { review1: "2026-09-29" },
    });
    expect(getNextDue(r2)).toBe("2026-10-01"); // review1 + 2
  });

  it("follows a late review", () => {
    const late = solved([true, false, false, false, false], {
      solvedDate: "2026-09-01",
      dates: { review1: "2026-09-20" },
    });
    expect(getNextDue(late)).toBe("2026-09-22");
  });
});

describe("buildColumns", () => {
  const problems = [
    { id: 1, difficulty: "Easy" },
    { id: 2, difficulty: "Medium" },
    { id: 3, difficulty: "Hard" },
    { id: 4, difficulty: "Easy" },
    { id: 5, difficulty: "Medium" },
    { id: 6, difficulty: "Hard" },
  ];
  const progress = {
    2: { status: "in-progress", solved: false },
    3: solved(none), // R1 due today
    4: solved([true, true, true, true, true]), // mastered
    5: solved(none, { solvedDate: "2026-09-01" }), // R1 overdue
    // 1 and 6 have no progress
  };
  const columns = buildColumns(problems, progress, today);
  const byId = (id) => columns.find((c) => c.id === id);
  const ids = (id) => byId(id).cards.map((card) => card.problem.id);

  it("returns the four columns in order with their titles", () => {
    expect(columns.map((c) => c.id)).toEqual(COLUMNS.map((c) => c.id));
    expect(columns.map((c) => c.title)).toEqual(COLUMNS.map((c) => c.title));
  });

  it("puts each problem in its column, keeping the list order", () => {
    expect(ids("todo")).toEqual([1, 6]);
    expect(ids("in-progress")).toEqual([2]);
    expect(ids("reviewing")).toEqual([3, 5]);
    expect(ids("mastered")).toEqual([4]);
  });

  it("gives each column its count", () => {
    expect(columns.map((c) => c.count)).toEqual([2, 1, 2, 1]);
  });

  it("puts every problem in exactly one column", () => {
    const all = columns.flatMap((c) => c.cards.map((card) => card.problem.id));
    expect(all.sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("matches the tracker stats: reviewing + mastered = solved", () => {
    const stats = computeStats(problems, progress, today);
    expect(byId("reviewing").count + byId("mastered").count).toBe(stats.solved);
    expect(columns.reduce((sum, c) => sum + c.count, 0)).toBe(stats.total);
  });

  it("sets stage, next due date and urgency on the cards", () => {
    const [dueToday, overdue] = byId("reviewing").cards;
    expect(dueToday).toMatchObject({
      stage: "R1",
      nextDue: "2026-09-29",
      urgency: "today",
    });
    expect(overdue).toMatchObject({ stage: "R1", urgency: "overdue" });
    expect(byId("todo").cards[0]).toMatchObject({
      stage: "todo",
      nextDue: null,
      urgency: null,
    });
    expect(byId("mastered").cards[0]).toMatchObject({
      stage: "mastered",
      nextDue: null,
      urgency: null,
    });
  });

  it("marks a review that is not due yet as upcoming", () => {
    const [column] = buildColumns(
      [{ id: 1 }],
      { 1: solved(none, { solvedDate: today }) },
      today
    ).filter((c) => c.id === "reviewing");
    expect(column.cards[0].urgency).toBe("upcoming");
  });

  it("handles an empty list and empty progress", () => {
    expect(buildColumns([], {}, today).map((c) => c.count)).toEqual([0, 0, 0, 0]);
    expect(buildColumns(problems, {}, today)[0].count).toBe(6);
  });

  it("does not mutate its input", () => {
    const before = JSON.stringify(progress);
    buildColumns(problems, progress, today);
    expect(JSON.stringify(progress)).toBe(before);
  });
});

describe("getCardActions", () => {
  const types = (stage, entry) => getCardActions(stage, entry).map((a) => a.type);

  it("offers start and solve for a problem in To Do", () => {
    expect(types("todo", {})).toEqual(["start", "markSolved"]);
  });

  it("offers solve and going back for a problem in progress", () => {
    expect(types("in-progress", { status: "in-progress" })).toEqual([
      "markSolved",
      "backToTodo",
    ]);
  });

  it("offers the pending review and unsolve when no review is done", () => {
    const actions = getCardActions("R1", solved(none));
    expect(actions.map((a) => a.type)).toEqual(["completeReview", "unsolve"]);
    expect(actions[0]).toMatchObject({ label: "Complete R1", index: 0 });
  });

  it("offers completing the next review and undoing the last one", () => {
    const entry = solved([true, true, false, false, false]);
    const actions = getCardActions("R3", entry);
    expect(actions.map((a) => a.type)).toEqual([
      "completeReview",
      "undoReview",
      "unsolve",
    ]);
    expect(actions[0]).toMatchObject({ label: "Complete R3", index: 2 });
    expect(actions[1]).toMatchObject({ label: "Undo R2", index: 1 });
  });

  it("offers only undo and unsolve when mastered", () => {
    const entry = solved([true, true, true, true, true]);
    const actions = getCardActions("mastered", entry);
    expect(actions.map((a) => a.type)).toEqual(["undoReview", "unsolve"]);
    expect(actions[0]).toMatchObject({ label: "Undo R5", index: 4 });
  });

  it("asks for confirmation before unsolving, and only then", () => {
    for (const stage of ["R1", "mastered"]) {
      const entry = stage === "R1" ? solved(none) : solved([true, true, true, true, true]);
      const unsolve = getCardActions(stage, entry).find((a) => a.type === "unsolve");
      expect(unsolve.confirm).toBe(UNSOLVE_CONFIRM);
    }
    const others = [
      ...getCardActions("todo", {}),
      ...getCardActions("in-progress", {}),
      ...getCardActions("R2", solved([true, false, false, false, false])).filter(
        (a) => a.type !== "unsolve"
      ),
    ];
    for (const action of others) expect(action.confirm).toBeUndefined();
  });

  it("undoes the last done review of old out-of-order data", () => {
    const old = solved([true, false, false, true, false]); // stage R2
    const actions = getCardActions("R2", old);
    expect(actions.find((a) => a.type === "undoReview")).toMatchObject({ index: 3 });
    expect(actions.find((a) => a.type === "completeReview")).toMatchObject({ index: 1 });
  });

  it("works without an entry", () => {
    expect(() => getCardActions("R1")).not.toThrow();
  });
});

describe("runCardAction", () => {
  const makeActions = () => {
    const calls = [];
    const record = (name) => (...args) => calls.push([name, ...args]);
    return {
      calls,
      actions: {
        setStatus: record("setStatus"),
        markSolved: record("markSolved"),
        completeReview: record("completeReview"),
        uncompleteReview: record("uncompleteReview"),
        unsolve: record("unsolve"),
      },
    };
  };
  const run = (action) => {
    const { calls, actions } = makeActions();
    runCardAction(action, 7, actions);
    return calls;
  };

  it("maps each menu action to the shared progress action", () => {
    expect(run({ type: "start" })).toEqual([["setStatus", 7, "in-progress"]]);
    expect(run({ type: "backToTodo" })).toEqual([["setStatus", 7, "todo"]]);
    expect(run({ type: "markSolved" })).toEqual([["markSolved", 7]]);
    expect(run({ type: "completeReview", index: 2 })).toEqual([["completeReview", 7, 2]]);
    expect(run({ type: "undoReview", index: 1 })).toEqual([["uncompleteReview", 7, 1]]);
    expect(run({ type: "unsolve" })).toEqual([["unsolve", 7]]);
  });

  it("does nothing for an unknown action", () => {
    expect(run({ type: "explode" })).toEqual([]);
  });
});
