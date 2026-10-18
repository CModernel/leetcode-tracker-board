// Analytics for the Insights page. Pure functions over one list's problems and
// its saved progress ({ [problemId]: entry }); nothing here is saved. Problems
// are grouped by their category (the list's section, like "Arrays & Hashing"):
// there is one per problem and it is the same in every list's own data, while
// LeetCode topics differ from list to list.
import { HELP, attemptsOf } from "./attempts";
import { timeScore, timeState } from "./timer";

// A category needs this many review attempts before it is judged at all, so one
// bad day does not decide.
export const MIN_ATTEMPTS = 3;
// Share of attempts that needed the note or the solution from which a category
// needs practice.
export const HELP_WEAK = 0.4;
// Timed records needed before the time says anything, and the share of them
// over the limit from which a category is slow.
export const MIN_TIMED = 3;
export const SLOW_SHARE = 0.5;

export const categoryOf = (problem) =>
  problem?.listMeta?.section || problem?.listMeta?.module || "Other";

const isMs = (value) => Number.isFinite(value) && value >= 0;

// The times saved for a problem: each attempt and the first solve that have
// `ms` (no time means unknown, so it is left out, never counted as 0).
const timedRecords = (entry) => {
  const records = attemptsOf(entry).filter((attempt) => isMs(attempt?.ms));
  if (isMs(entry?.firstSolve?.ms)) records.push(entry.firstSolve);
  return records;
};

const share = (part, whole) => (whole > 0 ? part / whole : null);
const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

// One summary per category, in the order the categories first appear in the
// list: how many problems, solved and mastered; the review attempts by the
// help they needed; the step-backs ("needed the solution" moves a problem one
// review back); and the time: how many timed records, the average time as a
// multiple of its limit, the share over the limit, the timed-out ones and the
// average score. Rates are null when there is nothing to divide.
export const categoryStats = (problems, progress = {}) => {
  const byCategory = new Map();
  for (const problem of problems) {
    const name = categoryOf(problem);
    if (!byCategory.has(name)) {
      byCategory.set(name, {
        category: name,
        problems: 0,
        solved: 0,
        mastered: 0,
        attempts: 0,
        alone: 0,
        note: 0,
        solution: 0,
        timed: 0,
        ratios: [],
        scores: [],
        overLimit: 0,
        timedOut: 0,
      });
    }
    const stats = byCategory.get(name);
    const entry = progress[problem.id];
    stats.problems += 1;
    if (entry?.solved) stats.solved += 1;
    if (entry?.solved && Array.isArray(entry.reviews) && entry.reviews.length >= 5 && entry.reviews.every(Boolean)) {
      stats.mastered += 1;
    }
    for (const attempt of attemptsOf(entry)) {
      if (attempt?.help === HELP.ALONE) stats.alone += 1;
      else if (attempt?.help === HELP.NOTE) stats.note += 1;
      else if (attempt?.help === HELP.SOLUTION) stats.solution += 1;
      else continue;
      stats.attempts += 1;
    }
    for (const record of timedRecords(entry)) {
      stats.timed += 1;
      const limit = Number.isFinite(record.limitMs) && record.limitMs > 0 ? record.limitMs : null;
      if (limit) stats.ratios.push(record.ms / limit);
      const score = timeScore(record.ms, limit);
      if (score !== null) stats.scores.push(score);
      const state = timeState(record.ms, limit);
      if (state !== "ontime") stats.overLimit += 1;
      if (state === "timeout") stats.timedOut += 1;
    }
  }

  return [...byCategory.values()].map(({ ratios, scores, ...stats }) => ({
    ...stats,
    stepBacks: stats.solution,
    helpRate: share(stats.note + stats.solution, stats.attempts),
    // 0 (always alone) to 1 (always the solution)
    helpLevel: share(stats.note + 2 * stats.solution, 2 * stats.attempts),
    averageRatio: average(ratios),
    averageScore: average(scores),
    overLimitShare: share(stats.overLimit, stats.timed),
  }));
};

// How a category stands: "unknown" with too few attempts, else whether it
// needs practice (help rate) and whether it is slow (time over the limit).
// `weak` is the same as needing practice; slow on top of it is the worst case.
export const classifyCategory = (stats) => {
  const enough = stats.attempts >= MIN_ATTEMPTS;
  const needsHelp = enough && stats.helpRate >= HELP_WEAK;
  const slow = stats.timed >= MIN_TIMED && stats.overLimitShare >= SLOW_SHARE;
  return { enough, needsHelp, slow, weak: needsHelp };
};

// The categories with their status: needing practice and slow first, then only
// needing practice, then only slow, then the rest with enough data; inside each
// group by how much help they needed and how often they went over the limit.
// Categories with no data keep the list order at the end.
export const rankCategories = (stats) =>
  stats
    .map((item, index) => ({ ...item, ...classifyCategory(item), index }))
    .sort((a, b) => {
      const weight = (item) =>
        item.weak && item.slow ? 4 : item.weak ? 3 : item.slow ? 2 : item.enough ? 1 : 0;
      return (
        weight(b) - weight(a) ||
        (b.helpLevel ?? -1) - (a.helpLevel ?? -1) ||
        (b.overLimitShare ?? -1) - (a.overLimitShare ?? -1) ||
        a.index - b.index
      );
    })
    .map(({ index, ...item }) => {
      void index;
      return item;
    });
