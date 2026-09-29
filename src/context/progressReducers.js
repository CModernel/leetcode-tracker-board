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

export const completeReview = (progress, list, problemId, index, today) =>
  updateEntry(progress, list, problemId, (current) => {
    const reviews = [...current.reviews];
    reviews[index] = true;
    return {
      ...current,
      reviews,
      dates: { ...current.dates, [`review${index + 1}`]: today },
    };
  });

export const uncompleteReview = (progress, list, problemId, index) =>
  updateEntry(progress, list, problemId, (current) => {
    const reviews = [...current.reviews];
    reviews[index] = false;
    const dates = { ...current.dates };
    delete dates[`review${index + 1}`];
    return { ...current, reviews, dates };
  });

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

// Turns the raw localStorage text into progress. Missing text means no saved
// progress yet. Throws on invalid JSON or content that is not an object.
export const parseProgress = (raw) =>
  raw === null || raw === undefined
    ? emptyProgress()
    : importData(JSON.parse(raw));
