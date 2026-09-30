import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  DONE_ZONE,
  UNSOLVE_CONFIRM,
  URGENCY_COLUMNS,
  applyDrop,
  buildColumns,
  buildUrgencyColumns,
  canDrop,
  getCardActions,
  getNextDue,
  getStage,
  runCardAction,
  urgencyBucket,
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

describe("canDrop", () => {
  const card = (stage, entry = {}) => ({ stage, entry });
  const fromTodo = card("todo", {});
  const fromProgress = card("in-progress", { status: "in-progress" });
  const fromR1 = card("R1", solved(none));
  const fromR3 = card("R3", solved([true, true, false, false, false]));
  const fromR5 = card("R5", solved([true, true, true, true, false]));
  const fromMastered = card("mastered", solved([true, true, true, true, true]));

  const drop = (c, target) => canDrop(c, target);
  const action = (c, target) => drop(c, target).action;

  it("does nothing, silently, when dropped on its own column", () => {
    for (const [c, column] of [
      [fromTodo, "todo"],
      [fromProgress, "in-progress"],
      [fromR3, "reviewing"],
      [fromMastered, "mastered"],
    ]) {
      expect(drop(c, column)).toEqual({ allowed: false, reason: null });
    }
  });

  it("ignores a target that is not a column", () => {
    expect(drop(fromTodo, "nowhere")).toEqual({ allowed: false, reason: null });
    expect(drop(fromTodo, undefined)).toEqual({ allowed: false, reason: null });
  });

  it("moves between To Do and In Progress by changing the status only", () => {
    expect(action(fromTodo, "in-progress")).toEqual({ type: "start" });
    expect(action(fromProgress, "todo")).toEqual({ type: "backToTodo" });
  });

  it("solves a problem dropped on Reviewing, from To Do or In Progress", () => {
    expect(action(fromTodo, "reviewing")).toEqual({ type: "markSolved" });
    expect(action(fromProgress, "reviewing")).toEqual({ type: "markSolved" });
  });

  it("does not let an unsolved problem jump to Mastered", () => {
    for (const c of [fromTodo, fromProgress]) {
      const result = drop(c, "mastered");
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeTruthy();
    }
  });

  it("completes the last review when a card at R5 is dropped on Mastered", () => {
    expect(action(fromR5, "mastered")).toEqual({
      type: "completeReview",
      index: 4,
    });
  });

  it("does not let a card before R5 reach Mastered, and says why", () => {
    for (const c of [fromR1, fromR3]) {
      const result = drop(c, "mastered");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(c.stage);
    }
  });

  it("does not allow Mastered at R5 when the earlier reviews are not done", () => {
    const odd = card("R5", solved([false, false, false, false, false]));
    expect(drop(odd, "mastered").allowed).toBe(false);
  });

  it("asks before sending a solved problem back to To Do (it erases reviews)", () => {
    for (const c of [fromR1, fromR3, fromR5, fromMastered]) {
      expect(action(c, "todo")).toEqual({
        type: "unsolve",
        confirm: UNSOLVE_CONFIRM,
      });
    }
  });

  it("asks before sending a solved problem back to In Progress", () => {
    for (const c of [fromR3, fromMastered]) {
      expect(action(c, "in-progress")).toEqual({
        type: "start",
        confirm: UNSOLVE_CONFIRM,
      });
    }
  });

  it("does not move a mastered problem back to Reviewing", () => {
    const result = drop(fromMastered, "reviewing");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("asks for confirmation only when reviews would be erased", () => {
    const allCards = [fromTodo, fromProgress, fromR1, fromR3, fromR5, fromMastered];
    for (const c of allCards) {
      for (const column of COLUMNS) {
        const result = drop(c, column.id);
        if (!result.allowed) continue;
        const fromSolved = c.stage === "mastered" || c.stage.startsWith("R");
        const erases = fromSolved && ["todo", "in-progress"].includes(column.id);
        expect(Boolean(result.action.confirm)).toBe(erases);
      }
    }
  });

  it("only returns actions that runCardAction understands", () => {
    const known = ["start", "backToTodo", "markSolved", "completeReview", "unsolve"];
    for (const c of [fromTodo, fromProgress, fromR1, fromR5, fromMastered]) {
      for (const column of COLUMNS) {
        const result = drop(c, column.id);
        if (result.allowed) expect(known).toContain(result.action.type);
      }
    }
  });

  it("gives a reason for every rejection except the silent ones", () => {
    for (const c of [fromTodo, fromProgress, fromR1, fromR5, fromMastered]) {
      for (const column of COLUMNS) {
        const result = drop(c, column.id);
        if (!result.allowed && result.reason !== null) {
          expect(result.reason.length).toBeGreaterThan(5);
        }
      }
    }
  });
});

describe("applyDrop", () => {
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
  const card = (stage, entry = {}) => ({ problem: { id: 7 }, stage, entry });
  const yes = () => true;
  const no = () => false;

  it("runs the action for an allowed move", async () => {
    const { calls, actions } = makeActions();
    expect(await applyDrop(card("todo"), "in-progress", actions, yes)).toEqual({
      status: "moved",
    });
    expect(calls).toEqual([["setStatus", 7, "in-progress"]]);
  });

  it("solves a problem dropped on Reviewing", async () => {
    const { calls, actions } = makeActions();
    await applyDrop(card("in-progress"), "reviewing", actions, yes);
    expect(calls).toEqual([["markSolved", 7]]);
  });

  it("completes R5 when a card at R5 is dropped on Mastered", async () => {
    const { calls, actions } = makeActions();
    const entry = solved([true, true, true, true, false]);
    await applyDrop(card("R5", entry), "mastered", actions, yes);
    expect(calls).toEqual([["completeReview", 7, 4]]);
  });

  it("asks first when reviews would be erased, and runs it on yes", async () => {
    const { calls, actions } = makeActions();
    const questions = [];
    const ask = async (q) => (questions.push(q), true);
    const entry = solved([true, false, false, false, false]);
    expect(await applyDrop(card("R2", entry), "todo", actions, ask)).toEqual({
      status: "moved",
    });
    expect(questions).toEqual([UNSOLVE_CONFIRM]);
    expect(calls).toEqual([["unsolve", 7]]);
  });

  it("does nothing when the person says no", async () => {
    const { calls, actions } = makeActions();
    const entry = solved([true, false, false, false, false]);
    expect(await applyDrop(card("R2", entry), "todo", actions, no)).toEqual({
      status: "cancelled",
    });
    expect(calls).toEqual([]);
  });

  it("does not ask when nothing is erased", async () => {
    const { actions } = makeActions();
    const ask = () => {
      throw new Error("should not ask");
    };
    const result = await applyDrop(card("todo"), "reviewing", actions, ask);
    expect(result.status).toBe("moved");
  });

  it("waits for a confirmation that answers later (the dialog)", async () => {
    const { calls, actions } = makeActions();
    const entry = solved([true, false, false, false, false]);
    const later = () => new Promise((resolve) => setTimeout(() => resolve(true), 5));
    const pending = applyDrop(card("R2", entry), "todo", actions, later);
    expect(calls).toEqual([]); // nothing runs before the answer
    expect((await pending).status).toBe("moved");
    expect(calls).toEqual([["unsolve", 7]]);
  });

  it("rejects a move that is not allowed, with the reason, and changes nothing", async () => {
    const { calls, actions } = makeActions();
    const result = await applyDrop(card("todo"), "mastered", actions, yes);
    expect(result.status).toBe("rejected");
    expect(result.reason).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("ignores a drop on the same column or outside the columns", async () => {
    const { calls, actions } = makeActions();
    expect(await applyDrop(card("todo"), "todo", actions, yes)).toEqual({ status: "ignored" });
    expect(await applyDrop(card("todo"), "nowhere", actions, yes)).toEqual({ status: "ignored" });
    expect(calls).toEqual([]);
  });
});

describe("urgencyBucket", () => {
  it("puts a date before today in overdue and today's date in today", () => {
    expect(urgencyBucket("2026-09-28", today)).toBe("overdue");
    expect(urgencyBucket("2026-01-01", today)).toBe("overdue");
    expect(urgencyBucket(today, today)).toBe("today");
  });

  it("puts the next 7 days in this-week and later dates in later", () => {
    expect(urgencyBucket("2026-09-30", today)).toBe("this-week");
    expect(urgencyBucket("2026-10-06", today)).toBe("this-week"); // today + 7
    expect(urgencyBucket("2026-10-07", today)).toBe("later"); // today + 8
  });

  it("works across a month end", () => {
    expect(urgencyBucket("2026-10-01", "2026-09-30")).toBe("this-week");
    expect(urgencyBucket("2026-10-07", "2026-09-30")).toBe("this-week"); // +7
    expect(urgencyBucket("2026-10-08", "2026-09-30")).toBe("later"); // +8
  });
});

describe("buildUrgencyColumns", () => {
  const problems = [
    { id: 1 }, // no progress -> not shown
    { id: 2 }, // in progress -> not shown
    { id: 3 }, // R1 due today
    { id: 4 }, // R1 overdue
    { id: 5 }, // R1 tomorrow
    { id: 6 }, // mastered -> not shown
    { id: 7 }, // R2 far away
  ];
  const progress = {
    2: { status: "in-progress", solved: false },
    3: solved(none, { solvedDate: "2026-09-28" }),
    4: solved(none, { solvedDate: "2026-09-01" }),
    5: solved(none, { solvedDate: today }),
    6: solved([true, true, true, true, true]),
    7: solved([true, false, false, false, false], {
      solvedDate: "2026-09-01",
      dates: { review1: "2026-10-20" },
    }),
  };
  const columns = buildUrgencyColumns(problems, progress, today);
  const ids = (id) =>
    columns.find((c) => c.id === id).cards.map((card) => card.problem.id);

  it("has the four urgency columns in order", () => {
    expect(columns.map((c) => c.id)).toEqual(URGENCY_COLUMNS.map((c) => c.id));
    expect(columns.map((c) => c.title)).toEqual([
      "Overdue",
      "Today",
      "This week",
      "Later",
    ]);
  });

  it("groups problems waiting for a review by their due date", () => {
    expect(ids("overdue")).toEqual([4]);
    expect(ids("today")).toEqual([3]);
    expect(ids("this-week")).toEqual([5]);
    expect(ids("later")).toEqual([7]);
  });

  it("leaves out problems that are not waiting for a review", () => {
    const shown = columns.flatMap((c) => c.cards.map((card) => card.problem.id));
    for (const hidden of [1, 2, 6]) expect(shown).not.toContain(hidden);
  });

  it("counts each column", () => {
    expect(columns.map((c) => c.count)).toEqual([1, 1, 1, 1]);
  });

  it("gives the same cards as the stage view (stage, due date, urgency)", () => {
    const card = columns.find((c) => c.id === "today").cards[0];
    expect(card).toMatchObject({ stage: "R1", nextDue: today, urgency: "today" });
  });

  it("is empty for an empty list", () => {
    expect(buildUrgencyColumns([], {}, today).map((c) => c.count)).toEqual([0, 0, 0, 0]);
  });
});

describe("canDrop by urgency", () => {
  const waiting = {
    problem: { id: 1 },
    stage: "R2",
    entry: solved([true, false, false, false, false]),
  };

  it("completes the review when dropped on the done zone", () => {
    expect(canDrop(waiting, DONE_ZONE, "urgency")).toEqual({
      allowed: true,
      action: { type: "completeReview", index: 1 },
    });
  });

  it("does nothing on any other target (the columns are due dates)", () => {
    for (const target of ["overdue", "today", "this-week", "later", "todo", "mastered"]) {
      expect(canDrop(waiting, target, "urgency")).toEqual({
        allowed: false,
        reason: null,
      });
    }
  });

  it("does nothing for a card that is not waiting for a review", () => {
    const todo = { problem: { id: 2 }, stage: "todo", entry: {} };
    expect(canDrop(todo, DONE_ZONE, "urgency").allowed).toBe(false);
  });

  it("keeps the stage rules by default", () => {
    expect(canDrop({ stage: "todo", entry: {} }, "in-progress").allowed).toBe(true);
    expect(canDrop({ stage: "todo", entry: {} }, DONE_ZONE).allowed).toBe(false);
  });

  it("runs through applyDrop and completes the review", async () => {
    const calls = [];
    const actions = { completeReview: (...args) => calls.push(args) };
    const result = await applyDrop(waiting, DONE_ZONE, actions, () => true, "urgency");
    expect(result).toEqual({ status: "moved" });
    expect(calls).toEqual([[1, 1]]);
  });
});
