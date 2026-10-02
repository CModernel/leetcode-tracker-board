import {
  canCompleteReview,
  daysBetween,
  canUncompleteReview,
  formatShortDate,
  getSchedule,
  localToday,
} from "./schedule";
import { rewindConfirm } from "./rewind";
import { getStatus } from "./status";
import { getUrgency } from "./urgencyStyles";

// Board columns, left to right.
export const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "reviewing", title: "Reviewing" },
  { id: "mastered", title: "Mastered" },
];

// Text for a column with no cards. When filters hide problems the message says
// so, because the column may not really be empty.
const EMPTY_MESSAGES = {
  todo: "Nothing left to start.",
  "in-progress": "Nothing in progress. Drag a card here to start it.",
  reviewing: "No reviews pending.",
  mastered: "Nothing mastered yet.",
};
export const emptyMessage = (columnId, filtered) =>
  filtered
    ? "No problems match the filters."
    : EMPTY_MESSAGES[columnId] ?? "Nothing here.";

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

const makeCard = (problem, entry, today) => {
  const stage = getStage(entry);
  const nextDue = getNextDue(entry);
  return {
    problem,
    entry,
    stage,
    nextDue,
    urgency: nextDue ? getUrgency(false, nextDue, today) : null,
  };
};

// Sorting inside a column. Sorting is stable, so cards that tie keep the order
// of the problem list.
const byNextDue = (a, b) =>
  a.nextDue < b.nextDue ? -1 : a.nextDue > b.nextDue ? 1 : 0;

// In Progress: problems with a manual `order` come first, by that order. The
// rest follow by start time, the latest at the bottom; problems without a
// start time (started before it was saved) go first among them.
const byInProgressOrder = (a, b) => {
  const orderA = a.entry.order;
  const orderB = b.entry.order;
  const hasA = typeof orderA === "number";
  const hasB = typeof orderB === "number";
  if (hasA && hasB) return orderA - orderB;
  if (hasA) return -1;
  if (hasB) return 1;
  const startA = a.entry.startedAt || "";
  const startB = b.entry.startedAt || "";
  return startA < startB ? -1 : startA > startB ? 1 : 0;
};

// Most recently mastered first (the date of the last review). Problems
// without that date go last.
const byMasteredDate = (a, b) => {
  const dateA = a.entry.dates?.review5;
  const dateB = b.entry.dates?.review5;
  if (dateA === dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  return dateA < dateB ? 1 : -1;
};

// The four columns with a card per problem. `progress` is the selected list's
// progress ({ [problemId]: entry }); `today` is "YYYY-MM-DD". Cards keep the
// order of `problems` in To Do; In Progress is by manual order and then by
// start time (the latest at the bottom), Reviewing by next due date (the most urgent on top) and Mastered
// has the most recent on top. `urgency`
// is set only for problems waiting for a review: "overdue", "today" or
// "upcoming".
export const buildColumns = (problems, progress, today) => {
  const columns = COLUMNS.map((column) => ({ ...column, cards: [] }));
  for (const problem of problems) {
    const card = makeCard(problem, progress[problem.id] || {}, today);
    columns.find((column) => column.id === columnOf(card.stage)).cards.push(card);
  }
  const sorters = {
    "in-progress": byInProgressOrder,
    reviewing: byNextDue,
    mastered: byMasteredDate,
  };
  return columns.map((column) => ({
    ...column,
    cards: sorters[column.id]
      ? [...column.cards].sort(sorters[column.id])
      : column.cards,
    count: column.cards.length,
  }));
};

// Reviewing is split inside into these sections, by how urgent the next review
// is (the same three states as a card's color and button).
export const REVIEW_SECTIONS = [
  { id: "overdue", title: "Overdue" },
  { id: "today", title: "Today" },
  { id: "upcoming", title: "Upcoming" },
];

// The cards of Reviewing grouped in REVIEW_SECTIONS, keeping the order they
// come in (already by due date, the most urgent first). Empty sections are left
// out. A card with no urgency (only shown there while a move waits) counts as
// upcoming.
export const reviewSections = (cards) =>
  REVIEW_SECTIONS.map((section) => ({
    ...section,
    cards: cards.filter((card) => (card.urgency ?? "upcoming") === section.id),
  })).filter((section) => section.cards.length > 0);

// What the confirmation dialog shows before a problem is reset.
export const UNSOLVE_CONFIRM = {
  title: "Reset this problem?",
  message: "You'll lose its reviews and dates.",
  confirmLabel: "Reset",
};

// Asked before mastering a problem that already has reviews done: mastering
// replaces their dates. It is not a bad thing, so the dialog is neutral. With no
// review done (To Do, In Progress, or a solved problem still at R1) nothing is
// lost and nothing is asked: the message with Undo is enough.
export const MASTER_CONFIRM = {
  title: "Mark as mastered?",
  message:
    "This skips the rest of the review schedule, and the dates of the reviews you completed will be lost.",
  confirmLabel: "Mark as mastered",
  tone: "neutral",
};

// The question to ask before mastering `entry`, or undefined when it has no
// review done.
export const masterConfirmFor = (entry) =>
  entry?.reviews?.some(Boolean) ? MASTER_CONFIRM : undefined;

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
      { type: "markMastered", label: "Mark as mastered" },
    ];
  }
  if (stage === "in-progress") {
    return [
      { type: "markSolved", label: "Mark as solved" },
      { type: "markMastered", label: "Mark as mastered" },
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
  // Going back further than one review: the nearest first
  for (let i = last - 1; i >= 0; i--) {
    actions.push({
      type: "rewind",
      label: `Go back to R${i + 1}`,
      index: i,
      confirm: rewindConfirm(entry, i),
    });
  }
  // From R5 the way to master it is completing that review
  if (pending >= 0 && pending < 4) {
    actions.push({
      type: "markMastered",
      label: "Mark as mastered",
      confirm: masterConfirmFor(entry),
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
    case "markMastered":
      return actions.markMastered(problemId);
    case "completeReview":
      return actions.completeReview(problemId, action.index);
    case "undoReview":
      return actions.uncompleteReview(problemId, action.index);
    case "rewind":
      return actions.rewindReviews(problemId, action.index);
    case "unsolve":
      return actions.unsolve(problemId);
    default:
      return undefined;
  }
};

// What the message with Undo says after a menu action ("Marked as solved").
export const cardActionMessage = (action) => {
  switch (action.type) {
    case "start":
      return "Moved to In Progress";
    case "backToTodo":
      return "Moved to To Do";
    case "markSolved":
      return "Marked as solved";
    case "markMastered":
      return "Marked as mastered";
    case "completeReview":
      return `Completed R${action.index + 1}`;
    case "undoReview":
      return `Undid R${action.index + 1}`;
    case "rewind":
      return `Went back to R${action.index + 1}`;
    case "unsolve":
      return "Unsolved";
    default:
      return "Done";
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
// - Reviewing at R5 -> Mastered: completes the last review.
// - Anything else -> Mastered: marked as mastered without the reviews. It asks
//   first only when it has reviews done (their dates are lost).
// - Mastered -> Reviewing: not allowed. Going back one review is done from the
//   card menu.
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
        return reject("Use the ⋯ menu on the card to undo reviews one at a time.");
      }
      return allow({ type: "markSolved" });
    case "mastered":
      if (from === "reviewing" && card.stage === "R5") {
        return canCompleteReview(card.entry, 4)
          ? allow({ type: "completeReview", index: 4 })
          : reject("Complete the earlier reviews first.");
      }
      // Any other problem can be mastered without the reviews (someone who
      // already knows it). It asks first only when it has reviews done, whose
      // dates would be lost.
      return allow({
        type: "markMastered",
        confirm: masterConfirmFor(card.entry),
      });
    default:
      return reject(null);
  }
};

// Drops a card on a column. Runs the action through the shared progress
// actions (the ones the table uses) and asks first when the action erases
// reviews. `confirm` gets the question and returns true or false, or a
// promise of one (the confirmation dialog). Returns a promise of
// { status, reason? } with status "moved",
// "cancelled" (the person said no), "rejected" (with the reason) or "ignored"
// (same column, nothing to say).
export const applyDrop = async (
  card,
  targetColumnId,
  actions,
  confirm
) => {
  const result = canDrop(card, targetColumnId);
  if (!result.allowed) {
    return result.reason
      ? { status: "rejected", reason: result.reason }
      : { status: "ignored" };
  }
  if (result.action.confirm && !(await confirm(result.action.confirm))) {
    return { status: "cancelled" };
  }
  runCardAction(result.action, card.problem.id, actions);
  return { status: "moved" };
};

// Moves `activeId` to the position `overId` has in `ids` (what dragging a card
// over another one does). Returns a new list; the same order when either id is
// missing or they are the same.
export const reorderIds = (ids, activeId, overId) => {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
};

// Where a drop lands. `overId` is a column or, for cards that can be sorted,
// another card. Returns { columnId, overCardId }: the column it is over (null
// if none) and, when it is over a card, that card's id.
export const resolveDrop = (overId, columns) => {
  const column = columns.find((c) => c.id === overId);
  if (column) return { columnId: column.id, overCardId: null };
  const holder = columns.find((c) => c.cards.some((card) => card.problem.id === overId));
  return holder
    ? { columnId: holder.id, overCardId: overId }
    : { columnId: null, overCardId: null };
};

// How a card looks in a column it is only being shown in (dragged over it, or
// waiting for a confirmation): in To Do, In Progress and Mastered it has no
// review to wait for, so no review stage or date. A new card; nothing saved.
export const cardForColumn = (card, columnId) =>
  ["todo", "in-progress", "mastered"].includes(columnId)
    ? { ...card, stage: columnId, nextDue: null, urgency: null }
    : card;

// The columns as they look while a move waits for a confirmation: the card is
// already in the column it was dropped on (at the bottom), and the counts
// follow it. Only for showing; nothing is saved. Unknown ids change nothing.
export const moveCardInColumns = (columns, cardId, targetColumnId) => {
  const source = columns.find((c) => c.cards.some((card) => card.problem.id === cardId));
  const target = columns.find((c) => c.id === targetColumnId);
  if (!source || !target || source.id === target.id) return columns;
  const found = source.cards.find((c) => c.problem.id === cardId);
  const card = cardForColumn(found, target.id);
  return columns.map((column) => {
    if (column.id === source.id) {
      const cards = column.cards.filter((c) => c !== found);
      return { ...column, cards, count: cards.length };
    }
    if (column.id === target.id) {
      const cards = [...column.cards, card];
      return { ...column, cards, count: cards.length };
    }
    return column;
  });
};

export const EARLY_HINT =
  "Reviewing before the due date is easier and helps your long-term memory less.";

// The button on a card that is waiting for a review: "Complete R3" when it is
// overdue or due today, "Complete R3 early" when it is not due yet. Null when
// the card has no review to complete.
export const completeButtonFor = (card, today = localToday()) => {
  if (!card.urgency || !card.stage.startsWith("R")) return null;
  const index = Number(card.stage.slice(1)) - 1;
  if (!canCompleteReview(card.entry, index)) return null;
  const early = card.urgency === "upcoming";
  const date = formatShortDate(card.nextDue);
  const late = daysBetween(card.nextDue, today);
  // The button is the review chip and the action in one. `text` is what it
  // shows: how late when it is due or overdue, the date when it is not due yet.
  // `label` is its accessible name and `title` the tooltip.
  const text =
    card.urgency === "overdue"
      ? `${card.stage} · ${late}d late`
      : card.urgency === "today"
      ? `${card.stage} · today`
      : `${card.stage} · ${date}`;
  const title =
    card.urgency === "overdue"
      ? `Due ${date} · ${late} ${late === 1 ? "day" : "days"} late`
      : card.urgency === "today"
      ? "Due today"
      : `Due ${date}. ${EARLY_HINT}`;
  return {
    index,
    early,
    label: early ? `Complete ${card.stage} early` : `Complete ${card.stage}`,
    text,
    title,
    hint: early ? EARLY_HINT : undefined,
  };
};
