import { canCompleteReview, canUncompleteReview } from "../lib/schedule";
import { isStatus } from "../lib/status";

// Pure functions that return the next `progress` object. `progress` is
// { [listName]: { [problemId]: { status, solved, solvedDate, reviews, dates } } }.
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

// Un-solving wipes the reviews and their dates.
export const unsolve = (progress, list, problemId) =>
  updateEntry(progress, list, problemId, (current) => ({
    ...current,
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

  const change = (entry) => {
    const next = { ...entry, status };
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
      ...current,
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
    return { ...current, reviews, dates };
  });
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
