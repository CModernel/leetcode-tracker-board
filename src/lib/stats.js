import { isDue } from "./schedule";

// Numbers for the stats cards. `progress` is the selected list's progress
// ({ [problemId]: entry }); `today` is "YYYY-MM-DD".
export const computeStats = (problems, progress, today) => {
  const solvedOf = (difficulty) =>
    problems.filter(
      (p) => p.difficulty === difficulty && progress[p.id]?.solved
    ).length;
  return {
    total: problems.length,
    solved: problems.filter((p) => progress[p.id]?.solved).length,
    easy: solvedOf("Easy"),
    medium: solvedOf("Medium"),
    hard: solvedOf("Hard"),
    dueToday: problems.filter((p) => isDue(progress[p.id], today)).length,
  };
};
