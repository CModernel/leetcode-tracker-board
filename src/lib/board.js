import { canCompleteReview, canUncompleteReview, getSchedule } from "./schedule";
import { getStatus } from "./status";
import { getUrgency } from "./urgencyStyles";

// Board columns, left to right.
export const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "reviewing", title: "Reviewing" },
  { id: "mastered", title: "Mastered" },
];

// Index (0..4) of the first review not done, or -1 when all five are done.
const firstPendingReview = (entry) => {
  for (let i = 0; i < 5; i++) if (!entry.reviews?.[i]) return i;
  return -1;
};

// Where a problem is: "todo", "in-progress", "R1".."R5" (the review it is
// waiting for) or "mastered" (all five reviews done).
export const getStage = (entry) => {
  const status = getStatus(entry);
  if (status !== "solved") return status;
  const pending = firstPendingReview(entry);
  return pending === -1 ? "mastered" : `R${pending + 1}`;
};

// Due date of the review the problem is waiting for, or null when there is
// none (not solved, or mastered).
export const getNextDue = (entry) => {
  if (getStatus(entry) !== "solved") return null;
  const pending = firstPendingReview(entry);
  if (pending === -1) return null;
  return getSchedule(entry)[pending] ?? null;
};

const columnOf = (stage) => {
  if (stage === "todo" || stage === "in-progress" || stage === "mastered") {
    return stage;
  }
  return "reviewing";
};

// The four columns with a card per problem. `progress` is the selected list's
// progress ({ [problemId]: entry }); `today` is "YYYY-MM-DD". Cards keep the
// order of `problems`. `urgency` is set only for problems waiting for a
// review: "overdue", "today" or "upcoming".
export const buildColumns = (problems, progress, today) => {
  const columns = COLUMNS.map((column) => ({ ...column, cards: [] }));
  for (const problem of problems) {
    const entry = progress[problem.id] || {};
    const stage = getStage(entry);
    const nextDue = getNextDue(entry);
    const card = {
      problem,
      entry,
      stage,
      nextDue,
      urgency: nextDue ? getUrgency(false, nextDue, today) : null,
    };
    columns.find((column) => column.id === columnOf(stage)).cards.push(card);
  }
  return columns.map((column) => ({ ...column, count: column.cards.length }));
};

export const UNSOLVE_CONFIRM =
  "Unsolve this problem? Its reviews and dates will be erased.";

// Index of the last completed review, or -1 when none is done.
const lastDoneReview = (entry) => {
  for (let i = 4; i >= 0; i--) if (entry.reviews?.[i]) return i;
  return -1;
};

// Actions offered in a card's menu, from its stage and saved entry. Each is
// { type, label, index?, confirm? }; `confirm` is a question to ask first.
export const getCardActions = (stage, entry = {}) => {
  if (stage === "todo") {
    return [
      { type: "start", label: "Start" },
      { type: "markSolved", label: "Mark as solved" },
    ];
  }
  if (stage === "in-progress") {
    return [
      { type: "markSolved", label: "Mark as solved" },
      { type: "backToTodo", label: "Back to To Do" },
    ];
  }
  const actions = [];
  const pending = stage.startsWith("R") ? Number(stage.slice(1)) - 1 : -1;
  if (pending >= 0 && canCompleteReview(entry, pending)) {
    actions.push({
      type: "completeReview",
      label: `Complete R${pending + 1}`,
      index: pending,
    });
  }
  const last = lastDoneReview(entry);
  if (last >= 0 && canUncompleteReview(entry, last)) {
    actions.push({
      type: "undoReview",
      label: `Undo R${last + 1}`,
      index: last,
    });
  }
  actions.push({
    type: "unsolve",
    label: "Unsolve",
    confirm: UNSOLVE_CONFIRM,
  });
  return actions;
};

// Runs a menu action through the shared progress actions, so the tracker and
// the board always change the same data.
export const runCardAction = (action, problemId, actions) => {
  switch (action.type) {
    case "start":
      return actions.setStatus(problemId, "in-progress");
    case "backToTodo":
      return actions.setStatus(problemId, "todo");
    case "markSolved":
      return actions.markSolved(problemId);
    case "completeReview":
      return actions.completeReview(problemId, action.index);
    case "undoReview":
      return actions.uncompleteReview(problemId, action.index);
    case "unsolve":
      return actions.unsolve(problemId);
    default:
      return undefined;
  }
};

// Can a card be dropped on a column? Returns { allowed: true, action } with
// an action that runCardAction understands (it may carry a `confirm`
// question), or { allowed: false, reason }. `reason` is null when nothing
// should be said (dropped on its own column). Rules, from where the card is:
// - To Do / In Progress -> Reviewing: solve it (the schedule starts).
// - To Do <-> In Progress: change the status only.
// - Anything solved -> To Do / In Progress: unsolve, which erases reviews, so
//   it asks first.
// - Reviewing -> Mastered: only from R5 (completes the last review).
// - Mastered -> Reviewing and To Do / In Progress -> Mastered: not allowed.
//   Going back one review is done from the card menu.
export const canDrop = (card, targetColumnId) => {
  const from = columnOf(card.stage);
  const reject = (reason) => ({ allowed: false, reason });
  const allow = (action) => ({ allowed: true, action });

  if (!COLUMNS.some((column) => column.id === targetColumnId)) {
    return reject(null);
  }
  if (from === targetColumnId) return reject(null);

  const solved = from === "reviewing" || from === "mastered";

  switch (targetColumnId) {
    case "todo":
      return allow(
        solved
          ? { type: "unsolve", confirm: UNSOLVE_CONFIRM }
          : { type: "backToTodo" }
      );
    case "in-progress":
      return allow(
        solved
          ? { type: "start", confirm: UNSOLVE_CONFIRM }
          : { type: "start" }
      );
    case "reviewing":
      if (solved) {
        return reject("Use the card menu to undo a review one at a time.");
      }
      return allow({ type: "markSolved" });
    case "mastered":
      if (from === "reviewing" && card.stage === "R5") {
        return canCompleteReview(card.entry, 4)
          ? allow({ type: "completeReview", index: 4 })
          : reject("Complete the earlier reviews first.");
      }
      return reject(
        from === "reviewing"
          ? `Finish all five reviews first (this one is waiting for ${card.stage}).`
          : "Solve it and finish all five reviews first."
      );
    default:
      return reject(null);
  }
};

// Drops a card on a column. Runs the action through the shared progress
// actions (the ones the table uses) and asks first when the action erases
// reviews. `confirm` is a function that returns true or false (for example
// window.confirm). Returns { status, reason? } with status "moved",
// "cancelled" (the person said no), "rejected" (with the reason) or "ignored"
// (same column, nothing to say).
export const applyDrop = (card, targetColumnId, actions, confirm) => {
  const result = canDrop(card, targetColumnId);
  if (!result.allowed) {
    return result.reason
      ? { status: "rejected", reason: result.reason }
      : { status: "ignored" };
  }
  if (result.action.confirm && !confirm(result.action.confirm)) {
    return { status: "cancelled" };
  }
  runCardAction(result.action, card.problem.id, actions);
  return { status: "moved" };
};
