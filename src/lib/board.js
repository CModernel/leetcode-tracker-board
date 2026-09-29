import { getSchedule } from "./schedule";
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
      stage,
      nextDue,
      urgency: nextDue ? getUrgency(false, nextDue, today) : null,
    };
    columns.find((column) => column.id === columnOf(stage)).cards.push(card);
  }
  return columns.map((column) => ({ ...column, count: column.cards.length }));
};
