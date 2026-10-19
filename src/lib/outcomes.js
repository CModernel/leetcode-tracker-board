import { HELP } from "./attempts";
import { completeReviewWithHelp } from "../context/progressReducers";
import {
  canCompleteReview,
  daysBetween,
  formatShortDate,
  getSchedule,
} from "./schedule";

export const OUTCOME_LABELS = {
  [HELP.ALONE]: "Solved it myself",
  [HELP.NOTE]: "Needed help",
};

// "today", "tomorrow", "in 4 days"
const when = (days) =>
  days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

// What the calendar would look like after completing review `index` (0-based)
// with `help`: which review is pending next and its due date, or that the
// problem is mastered. It runs the real action on a copy, so what is shown is
// exactly what will happen. null when that review cannot be completed.
export const previewOutcome = (entry, index, help, today) => {
  if (!canCompleteReview(entry, index)) return null;
  const list = "preview";
  const id = "problem";
  const after = completeReviewWithHelp(
    { [list]: { [id]: entry } },
    list,
    id,
    index,
    help,
    today
  )[list][id];
  const pending = after.reviews.indexOf(false);
  if (pending === -1) return { mastered: true };
  const due = getSchedule(after)[pending];
  return { mastered: false, review: pending, due, days: daysBetween(today, due) };
};

// Short texts for a preview. `detail` says it all with the real date; `message`
// is for the notice shown after the choice.
const texts = (preview, index, help) => {
  if (preview.mastered) {
    return { detail: "Mastered: all reviews done", message: `Completed R${index + 1}` };
  }
  const name = `R${preview.review + 1}`;
  const date = `${when(preview.days)} (${formatShortDate(preview.due)})`;
  if (help === HELP.ALONE) {
    return { detail: `Next review: ${name} ${date}`, message: `Completed R${index + 1}` };
  }
  // Needed help: the same review is repeated
  return { detail: `Repeat ${name} ${date}`, message: `${name} again ${when(preview.days)}` };
};

// The choices for a review with what each one does, in order.
// Empty when the review cannot be completed.
export const outcomeOptions = (entry, index, today) =>
  Object.values(HELP).flatMap((help) => {
    const preview = previewOutcome(entry, index, help, today);
    if (!preview) return [];
    const { detail, message } = texts(preview, index, help);
    return [{ help, label: OUTCOME_LABELS[help], detail, message }];
  });
