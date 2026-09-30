import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  DONE_ZONE,
  EARLY_HINT,
  UNSOLVE_CONFIRM,
  URGENCY_COLUMNS,
  applyDrop,
  buildColumns,
  buildReviewQueue,
  buildUrgencyColumns,
  canDrop,
  cardForColumn,
  completeButtonFor,
  countByUrgency,
  emptyMessage,
  getCardActions,
  getNextDue,
  getStage,
  moveCardInColumns,
  reorderIds,
  resolveDrop,
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

  it("puts each problem in its column (Reviewing has the overdue one first)", () => {
    expect(ids("todo")).toEqual([1, 6]);
    expect(ids("in-progress")).toEqual([2]);
    expect(ids("reviewing")).toEqual([5, 3]); // 5 is overdue, 3 is due today
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
    const [overdue, dueToday] = byId("reviewing").cards;
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
      "rewind",
      "unsolve",
    ]);
    expect(actions[0]).toMatchObject({ label: "Complete R3", index: 2 });
    expect(actions[1]).toMatchObject({ label: "Undo R2", index: 1 });
    expect(actions[2]).toMatchObject({ label: "Go back to R1", index: 0 });
  });

  it("offers going back further only with two or more reviews done", () => {
    expect(types("R2", solved([true, false, false, false, false]))).not.toContain("rewind");
    const three = getCardActions("R4", solved([true, true, true, false, false]));
    expect(three.filter((a) => a.type === "rewind").map((a) => a.label)).toEqual([
      "Go back to R2",
      "Go back to R1",
    ]);
  });

  it("asks before going back more than one review, never for one", () => {
    const entry = solved([true, true, true, false, false]);
    const [toR2, toR1] = getCardActions("R4", entry).filter((a) => a.type === "rewind");
    expect(toR2.confirm).toMatchObject({ title: "Go back to R2?", message: "R2 and R3 and their dates will be erased." });
    expect(toR1.confirm.message).toBe("R1, R2 and R3 and their dates will be erased.");
    // "Undo R3" is going back one review: no question
    expect(getCardActions("R4", entry).find((a) => a.type === "undoReview").confirm).toBeUndefined();
  });

  it("offers undo, going back and unsolve when mastered", () => {
    const entry = solved([true, true, true, true, true]);
    const actions = getCardActions("mastered", entry);
    expect(actions.map((a) => a.type)).toEqual([
      "undoReview",
      "rewind",
      "rewind",
      "rewind",
      "rewind",
      "unsolve",
    ]);
    expect(actions[0]).toMatchObject({ label: "Undo R5", index: 4 });
    expect(actions[4]).toMatchObject({ label: "Go back to R1", index: 0 });
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
      expect(result.reason).toBe("Solve it first, then complete all five reviews (R1 to R5).");
    }
  });

  it("completes the last review when a card at R5 is dropped on Mastered", () => {
    expect(action(fromR5, "mastered")).toEqual({
      type: "completeReview",
      index: 4,
    });
  });

  it("does not let a card before R5 reach Mastered, and says which reviews are left", () => {
    const say = (c) => drop(c, "mastered").reason;
    expect(drop(fromR1, "mastered").allowed).toBe(false);
    expect(say(fromR1)).toBe("This one is waiting for R1. Complete R1, R2, R3, R4 and R5 first.");
    expect(say(fromR3)).toBe("This one is waiting for R3. Complete R3, R4 and R5 first.");
    const fromR4 = card("R4", solved([true, true, true, false, false]));
    expect(say(fromR4)).toBe("This one is waiting for R4. Complete R4 and R5 first.");
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
    expect(result.reason).toContain("menu on the card");
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

describe("order inside the columns", () => {
  // Ids in list order: 1..8. Each entry decides the column and the order.
  const list = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id }));
  const at = (solvedDate, reviews = none, dates = {}) =>
    solved(reviews, { solvedDate, dates });

  const progress = {
    1: { status: "in-progress", solved: false },
    2: { status: "in-progress", solved: false },
    // Reviewing, next due dates: 3 -> 10-05, 4 -> 09-20, 5 -> 09-29, 6 -> 10-05
    3: at("2026-10-04"),
    4: at("2026-09-19"),
    5: at("2026-09-28"),
    6: at("2026-10-04"),
    // Mastered, R5 done on: 7 -> 09-10, 8 -> 09-25
    7: at("2026-08-01", [true, true, true, true, true], { review5: "2026-09-10" }),
    8: at("2026-08-01", [true, true, true, true, true], { review5: "2026-09-25" }),
  };
  const ids = (columns, id) =>
    columns.find((c) => c.id === id).cards.map((card) => card.problem.id);

  it("keeps the list order in To Do and In Progress", () => {
    const columns = buildColumns(list, progress, today);
    expect(ids(columns, "in-progress")).toEqual([1, 2]);
    const todo = buildColumns(list, {}, today);
    expect(ids(todo, "todo")).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("puts the most urgent review on top of Reviewing", () => {
    const columns = buildColumns(list, progress, today);
    // 4 is overdue (09-20), 5 is due today (09-29), then 3 and 6 (10-05)
    expect(ids(columns, "reviewing")).toEqual([4, 5, 3, 6]);
  });

  it("breaks ties by the list order", () => {
    const columns = buildColumns(list, progress, today);
    const reviewing = ids(columns, "reviewing");
    expect(reviewing.indexOf(3)).toBeLessThan(reviewing.indexOf(6));
  });

  it("sorts by the real next date, so a late review moves the card down", () => {
    const late = {
      ...progress,
      // 4 was overdue; its R1 done today makes the next due 10-01
      4: at("2026-09-19", [true, false, false, false, false], { review1: today }),
    };
    const columns = buildColumns(list, late, today);
    expect(ids(columns, "reviewing")).toEqual([5, 4, 3, 6]);
  });

  it("puts the most recently mastered on top of Mastered", () => {
    const columns = buildColumns(list, progress, today);
    expect(ids(columns, "mastered")).toEqual([8, 7]);
  });

  it("puts mastered problems without a date last, in list order", () => {
    const noDate = {
      7: at("2026-08-01", [true, true, true, true, true], { review5: "2026-09-10" }),
      8: at("2026-08-01", [true, true, true, true, true]),
      6: at("2026-08-01", [true, true, true, true, true]),
    };
    const columns = buildColumns(list, noDate, today);
    expect(ids(columns, "mastered")).toEqual([7, 6, 8]);
  });

  it("does not change the counts", () => {
    const columns = buildColumns(list, progress, today);
    expect(columns.map((c) => c.count)).toEqual(
      columns.map((c) => c.cards.length)
    );
  });

  it("sorts every urgency column by due date, the soonest on top", () => {
    const columns = buildUrgencyColumns(list, {
      // R1 due 10-03, 10-01, 10-06 (all this week), 10-02 (an R2 example below)
      1: at("2026-10-02"),
      2: at("2026-09-30"),
      3: at("2026-10-05"),
      4: at("2026-10-01", [true, false, false, false, false], { review1: "2026-10-02" }), // R2 due 10-04
    }, today);
    expect(ids(columns, "this-week")).toEqual([2, 1, 4, 3]);
  });

  it("orders the urgency view like the stage view for the same cards", () => {
    const urgency = buildUrgencyColumns(list, progress, today).flatMap((c) =>
      c.cards.map((card) => card.problem.id)
    );
    // overdue first, then today, then later ones
    expect(urgency).toEqual([4, 5, 3, 6]);
  });
});

describe("order of In Progress", () => {
  const list = [1, 2, 3, 4].map((id) => ({ id }));
  const inProgress = (startedAt) => ({
    status: "in-progress",
    solved: false,
    ...(startedAt ? { startedAt } : {}),
  });
  const ids = (progress) =>
    buildColumns(list, progress, today)
      .find((c) => c.id === "in-progress")
      .cards.map((card) => card.problem.id);

  it("puts the one started first on top and the latest at the bottom", () => {
    expect(
      ids({
        1: inProgress("2026-10-03T09:00:00.000Z"),
        2: inProgress("2026-10-01T09:00:00.000Z"),
        3: inProgress("2026-10-02T09:00:00.000Z"),
      })
    ).toEqual([2, 3, 1]);
  });

  it("tells apart two problems started the same day", () => {
    expect(
      ids({
        1: inProgress("2026-10-01T15:00:00.000Z"),
        2: inProgress("2026-10-01T09:00:00.000Z"),
      })
    ).toEqual([2, 1]);
  });

  it("puts problems without a start time first, in list order", () => {
    expect(
      ids({
        1: inProgress("2026-10-01T09:00:00.000Z"),
        3: inProgress(),
        4: inProgress(),
      })
    ).toEqual([3, 4, 1]);
  });

  it("keeps the list order when nothing has a start time (old data)", () => {
    expect(ids({ 2: inProgress(), 1: inProgress(), 4: inProgress() })).toEqual([1, 2, 4]);
  });
});

describe("In Progress with a manual order", () => {
  const list = [1, 2, 3, 4].map((id) => ({ id }));
  const item = (extra) => ({ status: "in-progress", solved: false, ...extra });
  const ids = (progress) =>
    buildColumns(list, progress, today)
      .find((c) => c.id === "in-progress")
      .cards.map((card) => card.problem.id);

  it("follows the manual order over the start time", () => {
    expect(
      ids({
        1: item({ order: 2, startedAt: "2026-10-01T01:00:00.000Z" }),
        2: item({ order: 0, startedAt: "2026-10-01T02:00:00.000Z" }),
        3: item({ order: 1, startedAt: "2026-10-01T03:00:00.000Z" }),
      })
    ).toEqual([2, 3, 1]);
  });

  it("puts a problem started after the reorder at the bottom", () => {
    expect(
      ids({
        1: item({ order: 1, startedAt: "2026-10-01T01:00:00.000Z" }),
        2: item({ order: 0, startedAt: "2026-10-01T02:00:00.000Z" }),
        3: item({ startedAt: "2026-10-05T09:00:00.000Z" }),
      })
    ).toEqual([2, 1, 3]);
  });

  it("sorts several problems without an order by start time, after the ordered ones", () => {
    expect(
      ids({
        1: item({ startedAt: "2026-10-07T09:00:00.000Z" }),
        2: item({ startedAt: "2026-10-06T09:00:00.000Z" }),
        3: item({ order: 0 }),
      })
    ).toEqual([3, 2, 1]);
  });

  it("does not use order in other columns", () => {
    const columns = buildColumns(
      list,
      { 1: solved(none, { order: 5 }), 2: solved(none, { order: 0, solvedDate: "2026-09-01" }) },
      today
    );
    // Reviewing stays by due date: 2 is overdue, 1 is due today
    expect(columns.find((c) => c.id === "reviewing").cards.map((c) => c.problem.id)).toEqual([2, 1]);
  });
});

describe("reorderIds", () => {
  it("moves a card down to the position of the card it is dropped on", () => {
    expect(reorderIds([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
  });

  it("moves a card up", () => {
    expect(reorderIds([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
  });

  it("moves to the first and last positions", () => {
    expect(reorderIds([1, 2, 3], 3, 1)).toEqual([3, 1, 2]);
    expect(reorderIds([1, 2, 3], 1, 3)).toEqual([2, 3, 1]);
  });

  it("changes nothing when dropped on itself or with an unknown id", () => {
    const ids = [1, 2, 3];
    expect(reorderIds(ids, 2, 2)).toBe(ids);
    expect(reorderIds(ids, 9, 2)).toBe(ids);
    expect(reorderIds(ids, 2, 9)).toBe(ids);
  });

  it("does not mutate the list", () => {
    const ids = [1, 2, 3];
    reorderIds(ids, 1, 3);
    expect(ids).toEqual([1, 2, 3]);
  });
});

describe("resolveDrop", () => {
  const columns = [
    { id: "todo", cards: [{ problem: { id: 10 } }] },
    { id: "in-progress", cards: [{ problem: { id: 20 } }, { problem: { id: 21 } }] },
  ];

  it("recognizes a column", () => {
    expect(resolveDrop("in-progress", columns)).toEqual({ columnId: "in-progress", overCardId: null });
  });

  it("turns a card into its column and remembers the card", () => {
    expect(resolveDrop(21, columns)).toEqual({ columnId: "in-progress", overCardId: 21 });
    expect(resolveDrop(10, columns)).toEqual({ columnId: "todo", overCardId: 10 });
  });

  it("gives no column for something unknown", () => {
    expect(resolveDrop("nowhere", columns)).toEqual({ columnId: null, overCardId: null });
    expect(resolveDrop(99, columns)).toEqual({ columnId: null, overCardId: null });
  });
});

describe("moveCardInColumns", () => {
  const card = (id) => ({ problem: { id }, stage: "x", entry: {} });
  const columns = [
    { id: "todo", title: "To Do", cards: [card(1), card(2)], count: 2 },
    { id: "in-progress", title: "In Progress", cards: [card(3)], count: 1 },
    { id: "reviewing", title: "Reviewing", cards: [card(4)], count: 1 },
  ];
  const ids = (cols, id) => cols.find((c) => c.id === id).cards.map((c) => c.problem.id);

  it("moves the card to the bottom of the target column", () => {
    const next = moveCardInColumns(columns, 4, "in-progress");
    expect(ids(next, "reviewing")).toEqual([]);
    expect(ids(next, "in-progress")).toEqual([3, 4]);
  });

  it("updates the counts of both columns", () => {
    const next = moveCardInColumns(columns, 1, "reviewing");
    expect(next.map((c) => c.count)).toEqual([1, 1, 2]);
  });

  it("keeps the other columns as they are", () => {
    const next = moveCardInColumns(columns, 4, "in-progress");
    expect(next.find((c) => c.id === "todo")).toBe(columns[0]);
  });

  it("changes nothing for an unknown card or column, or the same column", () => {
    expect(moveCardInColumns(columns, 99, "todo")).toBe(columns);
    expect(moveCardInColumns(columns, 1, "nowhere")).toBe(columns);
    expect(moveCardInColumns(columns, 1, "todo")).toBe(columns);
  });

  it("does not mutate the original columns", () => {
    const before = JSON.stringify(columns);
    moveCardInColumns(columns, 4, "todo");
    expect(JSON.stringify(columns)).toBe(before);
  });

  it("keeps the total number of cards", () => {
    const next = moveCardInColumns(columns, 2, "reviewing");
    expect(next.reduce((sum, c) => sum + c.count, 0)).toBe(4);
  });
});

describe("cardForColumn", () => {
  const waiting = {
    problem: { id: 1 },
    entry: {},
    stage: "R3",
    nextDue: "2026-10-05",
    urgency: "overdue",
  };

  it("drops the review stage and date in To Do, In Progress and Mastered", () => {
    for (const column of ["todo", "in-progress", "mastered"]) {
      expect(cardForColumn(waiting, column)).toEqual({
        ...waiting,
        stage: column,
        nextDue: null,
        urgency: null,
      });
    }
  });

  it("keeps the card as it is in Reviewing and in other columns", () => {
    expect(cardForColumn(waiting, "reviewing")).toBe(waiting);
    expect(cardForColumn(waiting, "overdue")).toBe(waiting);
  });

  it("does not change the original card", () => {
    const before = { ...waiting };
    cardForColumn(waiting, "todo");
    expect(waiting).toEqual(before);
  });
});

describe("a card shown in another column while a move waits", () => {
  const reviewing = {
    problem: { id: 4 },
    entry: {},
    stage: "R3",
    nextDue: "2026-10-05",
    urgency: "overdue",
  };
  const columns = [
    { id: "todo", title: "To Do", cards: [], count: 0 },
    { id: "reviewing", title: "Reviewing", cards: [reviewing], count: 1 },
  ];

  it("has no review stage or date in To Do", () => {
    const shown = moveCardInColumns(columns, 4, "todo")
      .find((c) => c.id === "todo").cards[0];
    expect(shown).toMatchObject({ stage: "todo", nextDue: null, urgency: null });
  });

  it("leaves the card in the original data untouched", () => {
    moveCardInColumns(columns, 4, "todo");
    expect(reviewing.stage).toBe("R3");
    expect(columns[1].cards[0]).toBe(reviewing);
  });
});

describe("countByUrgency and column urgency counts", () => {
  const card = (urgency) => ({ urgency });

  it("counts overdue, today and upcoming cards, ignoring cards without a review", () => {
    expect(
      countByUrgency([card("overdue"), card("overdue"), card("today"), card("upcoming"), card(null)])
    ).toEqual({ overdue: 2, today: 1, upcoming: 1 });
    expect(countByUrgency([])).toEqual({ overdue: 0, today: 0, upcoming: 0 });
  });

  const list = [1, 2, 3, 4, 5].map((id) => ({ id }));
  const progress = {
    1: solved(none, { solvedDate: "2026-09-01" }), // overdue
    2: solved(none, { solvedDate: "2026-09-10" }), // overdue
    3: solved(none, { solvedDate: "2026-09-28" }), // due today
    4: solved(none, { solvedDate: today }), // tomorrow
    5: { status: "in-progress", solved: false },
  };

  it("gives Reviewing its overdue and due-today numbers", () => {
    const reviewing = buildColumns(list, progress, today).find((c) => c.id === "reviewing");
    expect(reviewing.urgencyCounts).toEqual({ overdue: 2, today: 1, upcoming: 1 });
  });

  it("matches the Due Today number of the stats: overdue + today", () => {
    const reviewing = buildColumns(list, progress, today).find((c) => c.id === "reviewing");
    expect(reviewing.urgencyCounts.overdue + reviewing.urgencyCounts.today).toBe(
      computeStats(list, progress, today).dueToday
    );
  });

  it("has zero counts in the other stage columns", () => {
    const columns = buildColumns(list, progress, today);
    for (const id of ["todo", "in-progress", "mastered"]) {
      expect(columns.find((c) => c.id === id).urgencyCounts).toEqual({
        overdue: 0,
        today: 0,
        upcoming: 0,
      });
    }
  });

  it("counts in the urgency view match each column's size", () => {
    const columns = buildUrgencyColumns(list, progress, today);
    expect(columns.find((c) => c.id === "overdue").urgencyCounts.overdue).toBe(2);
    expect(columns.find((c) => c.id === "today").urgencyCounts.today).toBe(1);
    expect(columns.find((c) => c.id === "this-week").urgencyCounts.upcoming).toBe(1);
  });

  it("follows a card shown in another column while a move waits", () => {
    const moved = moveCardInColumns(buildColumns(list, progress, today), 1, "todo");
    expect(moved.find((c) => c.id === "reviewing").urgencyCounts.overdue).toBe(1);
    expect(moved.find((c) => c.id === "todo").urgencyCounts.overdue).toBe(0);
  });
});

describe("buildReviewQueue", () => {
  const list = [1, 2, 3, 4, 5, 6].map((id) => ({ id }));
  const progress = {
    1: solved(none, { solvedDate: "2026-09-28" }), // due today (R1 = 09-29)
    2: solved(none, { solvedDate: "2026-09-10" }), // due 09-11, 18 days late
    3: solved(none, { solvedDate: "2026-09-20" }), // due 09-21, 8 days late
    4: solved(none, { solvedDate: today }), // due tomorrow: not in the queue
    5: { status: "in-progress", solved: false }, // not solved
    6: solved([true, true, true, true, true]), // mastered
  };
  const queue = buildReviewQueue(list, progress, today);

  it("has the reviews that are overdue or due today, the oldest first", () => {
    expect(queue.map((item) => item.problem.id)).toEqual([2, 3, 1]);
  });

  it("leaves out upcoming reviews, unsolved and mastered problems", () => {
    const ids = queue.map((item) => item.problem.id);
    for (const left of [4, 5, 6]) expect(ids).not.toContain(left);
  });

  it("says how many days late each one is (0 for today)", () => {
    expect(queue.map((item) => item.daysLate)).toEqual([18, 8, 0]);
  });

  it("keeps the stage, due date and urgency of each card", () => {
    expect(queue[2]).toMatchObject({ stage: "R1", nextDue: "2026-09-29", urgency: "today" });
    expect(queue[0]).toMatchObject({ urgency: "overdue" });
  });

  it("breaks ties by the list order", () => {
    const tie = {
      1: solved(none, { solvedDate: "2026-09-20" }),
      2: solved(none, { solvedDate: "2026-09-20" }),
    };
    expect(buildReviewQueue(list, tie, today).map((i) => i.problem.id)).toEqual([1, 2]);
  });

  it("has as many items as the Due Today number of the stats", () => {
    expect(queue).toHaveLength(computeStats(list, progress, today).dueToday);
  });

  it("empties as reviews are completed", () => {
    const done = {
      ...progress,
      2: solved([true, false, false, false, false], { solvedDate: "2026-09-10", dates: { review1: today } }),
    };
    // R2 of problem 2 is due 2 days after today: no longer in the queue
    expect(buildReviewQueue(list, done, today).map((i) => i.problem.id)).toEqual([3, 1]);
  });

  it("is empty when nothing is due", () => {
    expect(buildReviewQueue(list, {}, today)).toEqual([]);
    expect(buildReviewQueue([], {}, today)).toEqual([]);
  });

  it("does not change the progress it reads", () => {
    const before = JSON.stringify(progress);
    buildReviewQueue(list, progress, today);
    expect(JSON.stringify(progress)).toBe(before);
  });
});

describe("completeButtonFor", () => {
  const cardFor = (entry) => buildColumns([{ id: 1 }], { 1: entry }, today)
    .flatMap((c) => c.cards)[0];

  it("is a plain Complete button when the review is due today", () => {
    const button = completeButtonFor(cardFor(solved(none, { solvedDate: "2026-09-28" })));
    expect(button).toEqual({ index: 0, early: false, label: "Complete R1", hint: undefined });
  });

  it("is a plain Complete button when the review is overdue", () => {
    const button = completeButtonFor(cardFor(solved(none, { solvedDate: "2026-09-01" })));
    expect(button).toMatchObject({ early: false, label: "Complete R1" });
  });

  it("says early, with the hint, when the review is not due yet", () => {
    const button = completeButtonFor(cardFor(solved(none, { solvedDate: today })));
    expect(button).toEqual({
      index: 0,
      early: true,
      label: "Complete R1 early",
      hint: EARLY_HINT,
    });
  });

  it("is for the review the card waits for, not always R1", () => {
    const entry = solved([true, true, false, false, false], {
      solvedDate: "2026-08-01",
      dates: { review1: "2026-08-02", review2: "2026-08-05" },
    });
    expect(completeButtonFor(cardFor(entry))).toMatchObject({ index: 2, label: "Complete R3" });
  });

  it("is null for To Do, In Progress and Mastered", () => {
    expect(completeButtonFor(cardFor({}))).toBe(null);
    expect(completeButtonFor(cardFor({ status: "in-progress", solved: false }))).toBe(null);
    expect(completeButtonFor(cardFor(solved([true, true, true, true, true])))).toBe(null);
  });

  it("is null for a card shown in another column (no review to complete)", () => {
    const waiting = cardFor(solved(none, { solvedDate: today }));
    expect(completeButtonFor(cardForColumn(waiting, "todo"))).toBe(null);
  });

  it("follows the review order: null when the review cannot be completed", () => {
    const odd = { ...cardFor(solved(none, { solvedDate: today })), stage: "R3" };
    expect(completeButtonFor(odd)).toBe(null);
  });

  it("has a hint that explains why early is less effective", () => {
    expect(EARLY_HINT).toContain("before the due date");
  });
});

describe("emptyMessage", () => {
  it("has a message for every column of both views", () => {
    for (const { id } of [...COLUMNS, ...URGENCY_COLUMNS]) {
      expect(emptyMessage(id, false)).not.toBe("Nothing here.");
    }
  });

  it("says the filters hide problems when some are filtered out", () => {
    expect(emptyMessage("todo", true)).toBe("No problems match the filters.");
  });

  it("falls back for an unknown column", () => {
    expect(emptyMessage("nope", false)).toBe("Nothing here.");
  });
});

describe("runCardAction rewind", () => {
  it("goes back through the shared action", () => {
    const calls = [];
    runCardAction({ type: "rewind", index: 1 }, "p1", {
      rewindReviews: (...args) => calls.push(args),
    });
    expect(calls).toEqual([["p1", 1]]);
  });
});
