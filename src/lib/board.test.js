import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  EARLY_HINT,
  MASTER_CONFIRM,
  UNSOLVE_CONFIRM,
  applyDrop,
  buildColumns,
  canDrop,
  cardActionMessage,
  cardForColumn,
  completeButtonFor,
  emptyMessage,
  getCardActions,
  getNextDue,
  getStage,
  moveCardInColumns,
  reorderIds,
  resolveDrop,
  reviewSections,
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
    expect(types("todo", {})).toEqual(["start", "markSolved", "markMastered"]);
  });

  it("offers solve and going back for a problem in progress", () => {
    expect(types("in-progress", { status: "in-progress" })).toEqual([
      "markSolved",
      "markMastered",
      "backToTodo",
    ]);
  });

  it("offers the pending review and unsolve when no review is done", () => {
    const actions = getCardActions("R1", solved(none));
    expect(actions.map((a) => a.type)).toEqual(["completeReview", "markMastered", "unsolve"]);
    expect(actions[0]).toMatchObject({ label: "Complete R1", index: 0 });
  });

  it("offers completing the next review and undoing the last one", () => {
    const entry = solved([true, true, false, false, false]);
    const actions = getCardActions("R3", entry);
    expect(actions.map((a) => a.type)).toEqual([
      "completeReview",
      "undoReview",
      "rewind",
      "markMastered",
      "unsolve",
    ]);
    expect(actions[0]).toMatchObject({ label: "Complete R3", index: 2 });
    expect(actions[1]).toMatchObject({ label: "Undo R2", index: 1 });
    expect(actions[2]).toMatchObject({ label: "Go back to R1", index: 0 });
  });

  it("offers Mark as mastered, asking first only when a review is done", () => {
    const find = (stage, entry) => getCardActions(stage, entry).find((a) => a.type === "markMastered");
    expect(find("todo", {}).confirm).toBeUndefined();
    expect(find("in-progress", { status: "in-progress" }).confirm).toBeUndefined();
    expect(find("R1", solved(none)).confirm).toBeUndefined();
    expect(find("R3", solved([true, true, false, false, false])).confirm).toBe(MASTER_CONFIRM);
    // From R5 the way is completing that review; once mastered there is nothing to offer
    expect(find("R5", solved([true, true, true, true, false]))).toBeUndefined();
    expect(find("mastered", solved([true, true, true, true, true]))).toBeUndefined();
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

  it("has no Complete with help entry: how it went is asked only after opening a note", () => {
    for (const [stage, entry] of [
      ["R3", solved([true, true, false, false, false])],
      ["R1", solved(none)],
      ["mastered", solved([true, true, true, true, true])],
    ]) {
      expect(types(stage, entry)).not.toContain("completeWithHelp");
    }
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
        (a) => !["unsolve", "markMastered"].includes(a.type)
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
        markMastered: record("markMastered"),
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
    expect(run({ type: "markMastered" })).toEqual([["markMastered", 7]]);
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

  it("masters a problem from To Do or In Progress without asking", () => {
    for (const c of [fromTodo, fromProgress]) {
      expect(action(c, "mastered")).toEqual({ type: "markMastered" });
    }
  });

  it("completes the last review when a card at R5 is dropped on Mastered", () => {
    expect(action(fromR5, "mastered")).toEqual({
      type: "completeReview",
      index: 4,
    });
  });

  it("masters a card in Reviewing before R5, asking first only when it has reviews done (their dates are lost)", () => {
    const fromR4 = card("R4", solved([true, true, true, false, false]));
    // R1 with nothing done yet: nothing to lose
    expect(action(fromR1, "mastered")).toEqual({ type: "markMastered" });
    for (const c of [fromR3, fromR4]) {
      expect(action(c, "mastered")).toEqual({ type: "markMastered", confirm: MASTER_CONFIRM });
    }
  });

  it("the question is neutral, not a warning", () => {
    expect(MASTER_CONFIRM.tone).toBe("neutral");
  });

  it("does not offer Mastered on a card that is already mastered", () => {
    expect(drop(fromMastered, "mastered")).toEqual({ allowed: false, reason: null });
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
        // Mastering from R1..R4 replaces the schedule, so it asks too
        const masters =
          column.id === "mastered" &&
          /^R[1-4]$/.test(c.stage) &&
          Boolean(c.entry?.reviews?.some(Boolean));
        expect(Boolean(result.action.confirm)).toBe(erases || masters);
      }
    }
  });

  it("only returns actions that runCardAction understands", () => {
    const known = ["start", "backToTodo", "markSolved", "markMastered", "completeReview", "unsolve"];
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
        markMastered: record("markMastered"),
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
    const result = await applyDrop(
      card("mastered", { reviews: [true, true, true, true, true] }),
      "reviewing",
      actions,
      yes
    );
    expect(result.status).toBe("rejected");
    expect(result.reason).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it("masters without asking from To Do, and asks first from Reviewing", async () => {
    const { calls, actions } = makeActions();
    const asked = [];
    const ask = (question) => {
      asked.push(question);
      return true;
    };
    expect(await applyDrop(card("todo"), "mastered", actions, ask)).toEqual({ status: "moved" });
    expect(asked).toEqual([]);
    const reviewing = card("R2", { reviews: [true, false, false, false, false] });
    expect(await applyDrop(reviewing, "mastered", actions, ask)).toEqual({ status: "moved" });
    expect(asked).toEqual([MASTER_CONFIRM]);
    expect(calls).toEqual([["markMastered", 7], ["markMastered", 7]]);
  });

  it("does not master when the question is answered no", async () => {
    const { calls, actions } = makeActions();
    const reviewing = card("R2", { reviews: [true, false, false, false, false] });
    expect(await applyDrop(reviewing, "mastered", actions, () => false)).toEqual({ status: "cancelled" });
    expect(calls).toEqual([]);
  });

  it("ignores a drop on the same column or outside the columns", async () => {
    const { calls, actions } = makeActions();
    expect(await applyDrop(card("todo"), "todo", actions, yes)).toEqual({ status: "ignored" });
    expect(await applyDrop(card("todo"), "nowhere", actions, yes)).toEqual({ status: "ignored" });
    expect(calls).toEqual([]);
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

describe("reviewSections", () => {
  const list = [1, 2, 3, 4, 5].map((id) => ({ id }));
  const progress = {
    1: solved(none, { solvedDate: "2026-09-01" }), // overdue
    2: solved(none, { solvedDate: "2026-09-10" }), // overdue
    3: solved(none, { solvedDate: "2026-09-28" }), // due today
    4: solved(none, { solvedDate: today }), // tomorrow
    5: { status: "in-progress", solved: false },
  };
  const reviewingCards = (prog = progress) =>
    buildColumns(list, prog, today).find((c) => c.id === "reviewing").cards;
  const ids = (section) => section.cards.map((card) => card.problem.id);

  it("splits Reviewing in Overdue, Today and Upcoming, the most urgent first in each", () => {
    const sections = reviewSections(reviewingCards());
    expect(sections.map((s) => s.id)).toEqual(["overdue", "today", "upcoming"]);
    expect(sections.map((s) => s.title)).toEqual(["Overdue", "Today", "Upcoming"]);
    expect(ids(sections[0])).toEqual([1, 2]);
    expect(ids(sections[1])).toEqual([3]);
    expect(ids(sections[2])).toEqual([4]);
  });

  it("leaves out the sections that have no cards", () => {
    const onlyUpcoming = { 4: progress[4] };
    expect(reviewSections(reviewingCards(onlyUpcoming)).map((s) => s.id)).toEqual(["upcoming"]);
    expect(reviewSections([])).toEqual([]);
  });

  it("Overdue and Today together are the Due Today number of the stats", () => {
    const sections = reviewSections(reviewingCards());
    const due = sections
      .filter((s) => s.id !== "upcoming")
      .reduce((total, s) => total + s.cards.length, 0);
    expect(due).toBe(computeStats(list, progress, today).dueToday);
  });

  it("shows every card of Reviewing once", () => {
    const cards = reviewingCards();
    const shown = reviewSections(cards).flatMap(ids);
    expect(shown.sort()).toEqual(cards.map((c) => c.problem.id).sort());
  });

  it("counts a card with no urgency as upcoming (it is only there while a move waits)", () => {
    const sections = reviewSections([{ problem: { id: 9 }, urgency: null }]);
    expect(sections.map((s) => s.id)).toEqual(["upcoming"]);
  });

  it("does not put the urgency in the other columns' data any more", () => {
    for (const column of buildColumns(list, progress, today)) {
      expect(column).not.toHaveProperty("urgencyCounts");
    }
  });
});

describe("completeButtonFor", () => {
  const cardFor = (entry) => buildColumns([{ id: 1 }], { 1: entry }, today)
    .flatMap((c) => c.cards)[0];

  it("is a plain Complete button when the review is due today", () => {
    const button = completeButtonFor(cardFor(solved(none, { solvedDate: "2026-09-28" })), today);
    expect(button).toEqual({
      index: 0,
      early: false,
      label: "Complete R1",
      text: "R1 · today",
      title: "Due today",
      hint: undefined,
    });
  });

  it("is a plain Complete button when the review is overdue", () => {
    const button = completeButtonFor(cardFor(solved(none, { solvedDate: "2026-09-01" })), today);
    expect(button).toMatchObject({
      early: false,
      label: "Complete R1",
      text: "R1 · 27d late",
      title: "Due Sep 2 · 27 days late",
    });
  });

  it("says early, with the hint, when the review is not due yet", () => {
    const button = completeButtonFor(cardFor(solved(none, { solvedDate: today })), today);
    expect(button).toEqual({
      index: 0,
      early: true,
      label: "Complete R1 early",
      text: "R1 · Sep 30",
      title: `Due Sep 30. ${EARLY_HINT}`,
      hint: EARLY_HINT,
    });
  });

  it("says one day, not one days, when it is a day late", () => {
    const button = completeButtonFor(cardFor(solved(none, { solvedDate: "2026-09-27" })), today);
    expect(button.text).toBe("R1 · 1d late");
    expect(button.title).toBe("Due Sep 28 · 1 day late");
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
  it("has a message for every column", () => {
    for (const { id } of COLUMNS) {
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

describe("a chosen due date on the board", () => {
  it("getNextDue and the urgency follow it", () => {
    const entry = {
      ...solved([true, false, false, false, false]),
      solvedDate: "2026-10-01",
      dates: { review1: "2026-10-02" },
      dueOverride: { review: 1, date: "2026-10-09" },
    };
    expect(getNextDue(entry)).toBe("2026-10-09");
    expect(getNextDue({ ...entry, dueOverride: undefined })).toBe("2026-10-04");
  });
});

describe("cardActionMessage", () => {
  it("says what a menu action did, for every action the menu offers", () => {
    const message = (type, index) => cardActionMessage({ type, index });
    expect(message("start")).toBe("Moved to In Progress");
    expect(message("backToTodo")).toBe("Moved to To Do");
    expect(message("markSolved")).toBe("Marked as solved");
    expect(message("markMastered")).toBe("Marked as mastered");
    expect(message("completeReview", 2)).toBe("Completed R3");
    expect(message("undoReview", 0)).toBe("Undid R1");
    expect(message("rewind", 1)).toBe("Went back to R2");
    expect(message("unsolve")).toBe("Unsolved");
  });
});
