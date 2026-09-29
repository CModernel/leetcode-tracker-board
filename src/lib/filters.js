import { isDue } from "./schedule";

export const DEFAULT_FILTERS = {
  category: "All",
  difficulty: "All",
  dueToday: false,
};

// Problems that match the filters. `progress` is the selected list's progress
// ({ [problemId]: entry }); `today` is "YYYY-MM-DD".
export const filterProblems = (problems, progress, filters, today) =>
  problems.filter((problem) => {
    const categoryMatch =
      filters.category === "All" ||
      (problem.topics || []).includes(filters.category);
    const difficultyMatch =
      filters.difficulty === "All" || problem.difficulty === filters.difficulty;
    if (!categoryMatch || !difficultyMatch) return false;
    return !filters.dueToday || isDue(progress[problem.id], today);
  });

// Sets one filter. `value` can also be a function of the previous value, like
// a React state setter (the "Due Today" checkbox toggles that way).
export const applyFilter = (filters, key, value) => ({
  ...filters,
  [key]: typeof value === "function" ? value(filters[key]) : value,
});
