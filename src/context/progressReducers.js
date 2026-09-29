import { canCompleteReview, canUncompleteReview } from "../lib/schedule";

// Pure functions that return the next `progress` object. `progress` is
// { [listName]: { [problemId]: { solved, solvedDate, reviews, dates } } }.
// `today` is passed in ("YYYY-MM-DD") so these stay easy to test.

export const emptyProgress = () => ({
  "Blind 75": {},
  "LeetCode 75": {},
  "NeetCode 150": {},
});

const emptyEntry = () => ({
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
    solved: true,
    solvedDate: today,
    dates: { ...current.dates, initial: today },
  }));
};

// Un-solving wipes the reviews and their dates.
export const unsolve = (progress, list, problemId) =>
  updateEntry(progress, list, problemId, (current) => ({
    ...current,
    solved: false,
    solvedDate: null,
    reviews: Array(5).fill(false),
    dates: {},
  }));

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
