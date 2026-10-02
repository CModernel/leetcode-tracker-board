import {
  GAPS,
  addDays,
  canCompleteReview,
  canRewindTo,
  canUncompleteReview,
  isDateString,
} from "../lib/schedule";
import { HELP, REPEAT_DAYS, VIEW_KINDS, attemptsOf, isHelp } from "../lib/attempts";
import { isStatus } from "../lib/status";

// Pure functions that return the next `progress` object. `progress` is
// { [listName]: { [problemId]: { status, solved, solvedDate, reviews, dates, note?, attempts?, helpViewed? } } }.
// `today` is passed in ("YYYY-MM-DD") so these stay easy to test.

export const emptyProgress = () => ({
  "Blind 75": {},
  "LeetCode 75": {},
  "NeetCode 150": {},
});

const emptyEntry = () => ({
  status: "todo",
  solved: false,
  reviews: Array(5).fill(false),
  dates: {},
});

// A chosen due date (`dueOverride`) belongs to the review that was pending
// when it was set. Whenever the reviews change, it is dropped so it can never
// land on a different review later. `masteredBy` (see markMastered) describes
// the reviews being all done, so it goes the same way as soon as they change.
const withoutOverride = (entry) => {
  const { dueOverride, masteredBy, ...rest } = entry;
  void dueOverride;
  void masteredBy;
  return rest;
};

const updateEntry = (progress, list, problemId, update) => {
  const listProgress = progress[list] || {};
  const current = listProgress[problemId] || emptyEntry();
  return {
    ...progress,
    [list]: { ...listProgress, [problemId]: update(current) },
  };
};

export const markSolved = (progress, list, problemId, today) => {
  if (progress[list]?.[problemId]?.solved) return progress;
  return updateEntry(progress, list, problemId, (current) => ({
    ...current,
    status: "solved",
    solved: true,
    solvedDate: today,
    dates: { ...current.dates, initial: today },
  }));
};

// Marks a problem as mastered without going through the five reviews (someone
// who already knows it). It becomes solved if it was not, every review is done
// (the ones still pending get `today` as their date) and `masteredBy: "manual"`
// tells it apart from one that earned it. Attempts are NOT invented: the
// history only holds real attempts. Notes and attempts stay; the chosen due
// date, the "opened today" reminders and the In Progress position go. Does
// nothing when all the reviews are already done.
export const markMastered = (progress, list, problemId, today) => {
  const current = progress[list]?.[problemId];
  if (current?.reviews?.length === 5 && current.reviews.every(Boolean)) return progress;
  return updateEntry(progress, list, problemId, (entry) => {
    const next = withoutOverride(entry);
    delete next.helpViewed;
    delete next.startedAt;
    delete next.order;
    const solvedDate = entry.solvedDate || today;
    const dates = { ...entry.dates, initial: entry.dates?.initial || solvedDate };
    for (let i = 0; i < 5; i++) {
      if (!entry.reviews?.[i]) dates[`review${i + 1}`] = today;
    }
    return {
      ...next,
      status: "solved",
      solved: true,
      solvedDate,
      reviews: Array(5).fill(true),
      dates,
      masteredBy: "manual",
    };
  });
};

// Un-solving wipes the reviews and their dates.
export const unsolve = (progress, list, problemId) =>
  updateEntry(progress, list, problemId, (current) => ({
    ...withoutOverride(current),
    status: "todo",
    solved: false,
    solvedDate: null,
    reviews: Array(5).fill(false),
    dates: {},
  }));

// Moves a problem to a status. Going to "solved" is markSolved. Leaving
// "solved" is unsolve, so its reviews and dates are wiped. Between "todo" and
// "in-progress" only the status changes. An unknown status does nothing.
// Entering "in-progress" saves `startedAt` (`now`, a timestamp; it defaults to
// `today`), which the board uses to keep the latest started at the bottom.
// Going back to "todo" removes it.
export const setStatus = (
  progress,
  list,
  problemId,
  status,
  today,
  now = today
) => {
  if (!isStatus(status)) return progress;
  const current = progress[list]?.[problemId];
  if (status === "solved") return markSolved(progress, list, problemId, today);

  // A problem that (re)enters In Progress goes to the bottom, so any manual
  // position from an earlier time in this column is dropped.
  const change = (entry) => {
    const next = { ...entry, status };
    delete next.order;
    if (status === "in-progress") next.startedAt = now;
    else delete next.startedAt;
    return next;
  };
  if (current?.solved) {
    return updateEntry(unsolve(progress, list, problemId), list, problemId, change);
  }
  if (current?.status === status) return progress;
  return updateEntry(progress, list, problemId, change);
};

// Reviews go in order (see canCompleteReview); anything else does nothing.
export const completeReview = (progress, list, problemId, index, today) => {
  if (!canCompleteReview(progress[list]?.[problemId], index)) return progress;
  return updateEntry(progress, list, problemId, (current) => {
    const reviews = [...current.reviews];
    reviews[index] = true;
    return {
      ...withoutOverride(current),
      reviews,
      dates: { ...current.dates, [`review${index + 1}`]: today },
    };
  });
};

// Only the last completed review can be undone; anything else does nothing.
export const uncompleteReview = (progress, list, problemId, index) => {
  if (!canUncompleteReview(progress[list]?.[problemId], index)) return progress;
  return updateEntry(progress, list, problemId, (current) => {
    const reviews = [...current.reviews];
    reviews[index] = false;
    const dates = { ...current.dates };
    delete dates[`review${index + 1}`];
    return { ...withoutOverride(current), reviews, dates };
  });
};

// Saves the note of a problem (one note per problem, plain text). A note with
// only spaces removes it, so the entry has no empty `note`. The note is not
// part of the schedule: unsolving and moving the problem keep it. Nothing else
// in the entry changes, and nothing is created for an empty note.
export const setNote = (progress, list, problemId, note) => {
  const text = typeof note === "string" && note.trim() !== "" ? note : null;
  const current = progress[list]?.[problemId];
  if (text === null && current?.note === undefined) return progress;
  if (text !== null && current?.note === text) return progress;
  return updateEntry(progress, list, problemId, (entry) => {
    const next = { ...entry };
    if (text === null) delete next.note;
    else next.note = text;
    return next;
  });
};

// Goes back to review `index`: it and every later review are erased, with
// their dates, so it is the next one to do. Reviews before it stay. Does
// nothing when that review is not done.
export const rewindReviews = (progress, list, problemId, index) => {
  if (!canRewindTo(progress[list]?.[problemId], index)) return progress;
  return updateEntry(progress, list, problemId, (current) => {
    const reviews = current.reviews.map((done, i) => (i >= index ? false : done));
    const dates = { ...current.dates };
    for (let i = index; i < reviews.length; i++) delete dates[`review${i + 1}`];
    return { ...withoutOverride(current), reviews, dates };
  });
};

// Adds an attempt to the problem's history: which review (0..4) was tried, how
// much help it needed (see HELP) and on what day. Only a solved problem has
// reviews, so anything else does nothing, and so does an invalid review or
// help. Existing attempts are never changed or removed by this or by any other
// action except "Clear all".
export const recordAttempt = (progress, list, problemId, review, help, today) => {
  const current = progress[list]?.[problemId];
  const validReview = Number.isInteger(review) && review >= 0 && review < 5;
  if (!current?.solved || !validReview || !isHelp(help)) return progress;
  return updateEntry(progress, list, problemId, (entry) => ({
    ...entry,
    attempts: [...attemptsOf(entry), { date: today, review, help }],
  }));
};

// Remembers that the note (or solution) of a solved problem was opened on
// `today`. Nothing else changes. Does nothing for a problem that is not solved,
// an unknown kind, or when that day is already saved.
export const markHelpViewed = (progress, list, problemId, kind, today) => {
  const current = progress[list]?.[problemId];
  if (!current?.solved || !Object.values(VIEW_KINDS).includes(kind)) return progress;
  if (current.helpViewed?.[kind] === today) return progress;
  return updateEntry(progress, list, problemId, (entry) => ({
    ...entry,
    helpViewed: { ...entry.helpViewed, [kind]: today },
  }));
};

// The question "how did it go?" has been answered: what was opened before it
// no longer counts.
const withoutHelpViewed = (entry) => {
  const { helpViewed, ...rest } = entry;
  void helpViewed;
  return rest;
};

// Chooses the due date of a pending review (see `dueOverride` in getSchedule).
// Does nothing unless the problem is solved, the review is not done yet and
// `date` is a real day.
export const setDueOverride = (progress, list, problemId, review, date) => {
  const current = progress[list]?.[problemId];
  const pending =
    current?.solved &&
    Number.isInteger(review) &&
    review >= 0 &&
    review < GAPS.length &&
    !current.reviews?.[review];
  if (!pending || !isDateString(date)) return progress;
  return updateEntry(progress, list, problemId, (entry) => ({
    ...entry,
    dueOverride: { review, date },
  }));
};

// Completes the next review saying how much help it needed. Every outcome is
// written in the attempt history. What happens to the calendar:
// - HELP.ALONE: the review is done, as with completeReview.
// - HELP.NOTE: it is not done; the same review comes back in REPEAT_DAYS days.
// - HELP.SOLUTION: one step back. The previous review is pending again, due
//   after its own gap counted from today (R4 -> R3 in 4 days). At R1 there is
//   nothing before it, so R1 comes back tomorrow. Not a full reset.
// Only the next pending review can be completed (see canCompleteReview);
// anything else, or an unknown help level, does nothing.
export const completeReviewWithHelp = (
  progress,
  list,
  problemId,
  index,
  help,
  today
) => {
  if (!isHelp(help)) return progress;
  if (!canCompleteReview(progress[list]?.[problemId], index)) return progress;

  let next = progress;
  if (help === HELP.ALONE) {
    next = completeReview(next, list, problemId, index, today);
  } else if (help === HELP.NOTE) {
    next = setDueOverride(next, list, problemId, index, addDays(today, REPEAT_DAYS));
  } else {
    const back = Math.max(index - 1, 0);
    if (index > 0) next = rewindReviews(next, list, problemId, back);
    next = setDueOverride(next, list, problemId, back, addDays(today, GAPS[back]));
  }
  next = recordAttempt(next, list, problemId, index, help, today);
  return updateEntry(next, list, problemId, withoutHelpViewed);
};

// Puts a problem's saved entry back as it was (used by "Undo"). `entry` is
// undefined when the problem had no saved progress, and then it is removed.
// Only that problem changes.
export const restoreEntry = (progress, list, problemId, entry) => {
  const listProgress = { ...(progress[list] || {}) };
  if (entry === undefined) delete listProgress[problemId];
  else listProgress[problemId] = entry;
  return { ...progress, [list]: listProgress };
};

// Saves a manual order for problems (the In Progress column): each id gets its
// position in `orderedIds` as `order`. Ids without saved progress are skipped.
export const setOrder = (progress, list, orderedIds) => {
  const listProgress = { ...(progress[list] || {}) };
  orderedIds.forEach((id, position) => {
    if (listProgress[id]) listProgress[id] = { ...listProgress[id], order: position };
  });
  return { ...progress, [list]: listProgress };
};

// restoreEntry for several problems at once. `snapshot` is { [id]: entry } with
// `undefined` for problems that had no saved progress.
export const restoreEntries = (progress, list, snapshot) =>
  Object.entries(snapshot).reduce(
    (state, [id, entry]) => restoreEntry(state, list, id, entry),
    progress
  );

// Replaces everything with an imported file's content. Throws if the content
// is not an object (for example "null" or a list), so nothing gets replaced.
export const importData = (data) => {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid progress data");
  }
  return data;
};

// Clears all progress but keeps an empty entry for each list.
export const clearAll = () => emptyProgress();

export const DEFAULT_LIST = "Blind 75";

// Saved list name if it is a known list, otherwise the default one.
export const parseSelectedList = (raw) =>
  raw && Object.keys(emptyProgress()).includes(raw) ? raw : DEFAULT_LIST;
