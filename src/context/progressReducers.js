// Pure functions that return the next `progress` object. `progress` is
// { [listName]: { [problemId]: { solved, solvedDate, reviews, dates } } }.
// `today` is passed in ("YYYY-MM-DD") so these stay easy to test.

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
