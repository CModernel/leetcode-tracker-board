// Analytics for the Insights page. Pure functions over one list's problems and
// its saved progress ({ [problemId]: entry }); nothing here is saved. Problems
// are grouped by their category (the list's section, like "Arrays & Hashing"):
// there is one per problem and it is the same in every list's own data, while
// LeetCode topics differ from list to list.
import { HELP, REPEAT_DAYS, attemptsOf } from "./attempts";
import { timeScore, timeState } from "./timer";
import { GAPS, addDays, daysBetween } from "./schedule";
import { getNextDue, getStage } from "./board";

// A category needs this many review attempts before it is judged at all, so one
// bad day does not decide.
export const MIN_ATTEMPTS = 3;
// Share of attempts that needed help from which a category
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
// help they needed (alone or helped); and the time: how many timed records, the average time as a
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
        helped: 0,
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
      else if (attempt?.help === HELP.NOTE) stats.helped += 1;
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
    helpRate: share(stats.helped, stats.attempts),
    averageRatio: average(ratios),
    averageScore: average(scores),
    overLimitShare: share(stats.overLimit, stats.timed),
  }));
};

// The times of the whole list at once: how many records have a time and a limit,
// the average of `ms / limitMs` (below 1 = quicker than the limit) and the
// average time and limit. Records with no limit are left out (nothing to
// compare with); null averages when there are none.
export const timeSummary = (problems, progress = {}) => {
  const records = problems
    .flatMap((problem) => timedRecords(progress[problem.id]))
    .filter((record) => Number.isFinite(record.limitMs) && record.limitMs > 0);
  return {
    count: records.length,
    averageRatio: average(records.map((record) => record.ms / record.limitMs)),
    averageMs: average(records.map((record) => record.ms)),
    averageLimitMs: average(records.map((record) => record.limitMs)),
  };
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
// group by how often they needed help and how often they went over the limit.
// Categories with no data keep the list order at the end.
export const rankCategories = (stats) =>
  stats
    .map((item, index) => ({ ...item, ...classifyCategory(item), index }))
    .sort((a, b) => {
      const weight = (item) =>
        item.weak && item.slow ? 4 : item.weak ? 3 : item.slow ? 2 : item.enough ? 1 : 0;
      return (
        weight(b) - weight(a) ||
        (b.helpRate ?? -1) - (a.helpRate ?? -1) ||
        (b.overLimitShare ?? -1) - (a.overLimitShare ?? -1) ||
        a.index - b.index
      );
    })
    .map(({ index, ...item }) => {
      void index;
      return item;
    });

// --- Retention and punctuality ------------------------------------------

// How each review (R1..R5) went: the attempts at it, how many were solved alone
// and the share solved alone (`rate`, null with fewer than MIN_ATTEMPTS, so one
// bad day does not decide). Shows whether an interval is too long.
export const retentionByReview = (problems, progress = {}) => {
  const rows = Array.from({ length: GAPS.length }, () => ({ attempts: 0, alone: 0 }));
  for (const problem of problems) {
    for (const attempt of attemptsOf(progress[problem.id])) {
      const row = rows[attempt?.review];
      if (!row) continue;
      if (attempt.help === HELP.ALONE) row.alone += 1;
      else if (attempt.help !== HELP.NOTE) continue;
      row.attempts += 1;
    }
  }
  return rows.map((row) => ({ ...row, rate: row.attempts >= MIN_ATTEMPTS ? row.alone / row.attempts : null }));
};

// The day an attempt was due, rebuilt from the history (nothing extra is saved):
// a review repeated after needing help was due REPEAT_DAYS after that attempt;
// otherwise R1 is due GAPS[0] days after solving and each next review GAPS[n]
// days after the one before was completed. `index` is the place of the attempt
// in `attempts`. null when a date it needs is missing.
export const attemptDue = (entry, index) => {
  const attempts = attemptsOf(entry);
  const attempt = attempts[index];
  if (!attempt || !Number.isInteger(attempt.review) || attempt.review < 0 || attempt.review >= GAPS.length) return null;
  for (let before = index - 1; before >= 0; before -= 1) {
    const earlier = attempts[before];
    if (earlier?.review === attempt.review && earlier.help === HELP.NOTE && isDay(earlier.date)) {
      return addDays(earlier.date, REPEAT_DAYS);
    }
  }
  const from = attempt.review === 0 ? entry?.solvedDate : entry?.dates?.[`review${attempt.review}`];
  return isDay(from) ? addDays(from, GAPS[attempt.review]) : null;
};

// Reviews done on time against late (a review is late when it was done after the
// day it was due) and how much help each group needed. `onTimeRate` and the help
// rates are null with fewer than MIN_ATTEMPTS in the group. Attempts whose due
// day cannot be rebuilt are left out.
export const punctuality = (problems, progress = {}) => {
  const group = () => ({ attempts: 0, helped: 0 });
  const onTime = group();
  const late = group();
  for (const problem of problems) {
    const entry = progress[problem.id];
    attemptsOf(entry).forEach((attempt, index) => {
      if (attempt?.help !== HELP.ALONE && attempt?.help !== HELP.NOTE) return;
      const due = attemptDue(entry, index);
      if (!due || !isDay(attempt.date)) return;
      const target = attempt.date > due ? late : onTime;
      target.attempts += 1;
      if (attempt.help === HELP.NOTE) target.helped += 1;
    });
  }
  const count = onTime.attempts + late.attempts;
  const helpRate = (g) => (g.attempts >= MIN_ATTEMPTS ? g.helped / g.attempts : null);
  return {
    count,
    onTime: onTime.attempts,
    late: late.attempts,
    onTimeRate: count >= MIN_ATTEMPTS ? onTime.attempts / count : null,
    helpOnTime: helpRate(onTime),
    helpLate: helpRate(late),
  };
};

// --- Activity, load and suggestions -------------------------------------

const isDay = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// How many things were done each day ({ "YYYY-MM-DD": count }): review attempts,
// first solves (the solved date) and completed reviews that have no attempt of
// their own (older data, or a review completed from the menu without the
// outcome). A review with its attempt counts once.
// The days something was done on one problem (see activityDays), one item per
// thing done, so a day can repeat.
const entryDays = (entry) => {
  const days = [];
  if (!entry || typeof entry !== "object") return days;
  const attempts = attemptsOf(entry);
  attempts.forEach((a) => days.push(a?.date));
  if (entry.solved) days.push(entry.firstSolve?.date ?? entry.solvedDate);
  for (let index = 0; index < 5; index += 1) {
    const day = entry.reviews?.[index] && entry.dates?.[`review${index + 1}`];
    if (day && !attempts.some((a) => a?.review === index && a?.date === day)) days.push(day);
  }
  return days.filter(isDay);
};

export const activityDays = (progress = {}) => {
  const days = {};
  for (const entry of Object.values(progress)) {
    for (const day of entryDays(entry)) days[day] = (days[day] ?? 0) + 1;
  }
  return days;
};

// Days in a row with something done, ending today, or yesterday when nothing
// was done yet today (the streak is not lost before the day is over).
export const streak = (days, today) => {
  let day = days[today] ? today : addDays(today, -1);
  let count = 0;
  while (days[day]) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
};

// Active days in the week of `today` (weeks start on Monday).
export const activeDaysThisWeek = (days, today) => {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = (new Date(year, month - 1, day).getDay() + 6) % 7;
  let count = 0;
  for (let back = 0; back <= weekday; back += 1) if (days[addDays(today, -back)]) count += 1;
  return count;
};

// The heat map: `weeks` columns of 7 days (Monday to Sunday), the last one being
// the week of `today`; days after today are null.
export const heatMap = (days, today, weeks = 12) => {
  const [year, month, day] = today.split("-").map(Number);
  const weekday = (new Date(year, month - 1, day).getDay() + 6) % 7;
  const start = addDays(today, -weekday - 7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return date > today ? null : { date, count: days[date] ?? 0 };
    }),
  );
};

// Reviews coming: for each problem waiting for a review only that next one
// (the later dates depend on when it is done): how many are overdue, and how
// many fall on each of the next `span` days starting today.
export const upcomingLoad = (problems, progress = {}, today, span = 14) => {
  const days = Array.from({ length: span }, (_, i) => ({ date: addDays(today, i), count: 0 }));
  let overdue = 0;
  for (const problem of problems) {
    const due = getNextDue(progress[problem.id]);
    if (!due) continue;
    const offset = daysBetween(today, due);
    if (offset < 0) overdue += 1;
    else if (offset < span) days[offset].count += 1;
  }
  return { overdue, days };
};

const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };
const listOrder = (problem) => problem.listMeta?.originalIndex ?? Infinity;

// What to do today: the reviews due today or overdue, those of weak categories
// first, then the most overdue, then list order. `weakCategories` is a Set.
export const todayList = (problems, progress = {}, today, weakCategories = new Set(), limit = 5) =>
  problems
    .map((problem) => ({ problem, entry: progress[problem.id], due: getNextDue(progress[problem.id]) }))
    .filter((item) => item.due && item.due <= today)
    .map((item) => ({
      ...item,
      stage: getStage(item.entry),
      daysLate: daysBetween(item.due, today),
      weak: weakCategories.has(categoryOf(item.problem)),
    }))
    .sort(
      (a, b) =>
        Number(b.weak) - Number(a.weak) ||
        b.daysLate - a.daysLate ||
        listOrder(a.problem) - listOrder(b.problem),
    )
    .slice(0, limit);

// A problem nothing was done with yet: no entry, or To Do / In Progress with no
// solve and no attempt.
const untouched = (entry) => !entry || (!entry.solved && attemptsOf(entry).length === 0);

// New problems to try: untouched problems of the weak categories, easiest
// first, then list order. With no weak category, the next untouched problems in
// list order (`fromWeak` says which one it is).
export const suggestNew = (problems, progress = {}, weakCategories = new Set(), limit = 5) => {
  const fresh = problems.filter((problem) => untouched(progress[problem.id]));
  const weak = fresh.filter((problem) => weakCategories.has(categoryOf(problem)));
  if (weak.length === 0) {
    return { fromWeak: false, problems: [...fresh].sort((a, b) => listOrder(a) - listOrder(b)).slice(0, limit) };
  }
  return {
    fromWeak: true,
    problems: weak
      .sort(
        (a, b) =>
          (DIFFICULTY_ORDER[a.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.difficulty] ?? 1) ||
          listOrder(a) - listOrder(b),
      )
      .slice(0, limit),
  };
};

// --- Real difficulty, coverage and notes ---------------------------------

// A problem is harder than its label says when, in at least HARDER_MIN review
// attempts, HARDER_SHARE or more needed help.
export const HARDER_MIN = 2;
export const HARDER_SHARE = 0.5;

const helpCounts = (entry) => {
  const counts = { attempts: 0, helped: 0 };
  for (const attempt of attemptsOf(entry)) {
    if (attempt?.help === HELP.ALONE) counts.attempts += 1;
    else if (attempt?.help === HELP.NOTE) {
      counts.attempts += 1;
      counts.helped += 1;
    }
  }
  return counts;
};

// Easy and Medium problems that cost more than their difficulty says (a Hard
// that needs help is expected, so Hard is left out): Easy first, then the ones
// that needed help most often, then list order. At most `limit`.
// Each item is `{ problem, attempts, helped }`.
export const harderThanTheyLook = (problems, progress = {}, limit = 3) =>
  problems
    .filter((problem) => problem.difficulty === "Easy" || problem.difficulty === "Medium")
    .map((problem) => ({ problem, ...helpCounts(progress[problem.id]) }))
    .filter((item) => item.attempts >= HARDER_MIN && item.helped / item.attempts >= HARDER_SHARE)
    .sort(
      (a, b) =>
        (DIFFICULTY_ORDER[a.problem.difficulty] ?? 1) - (DIFFICULTY_ORDER[b.problem.difficulty] ?? 1) ||
        b.helped / b.attempts - a.helped / a.attempts ||
        b.attempts - a.attempts ||
        listOrder(a.problem) - listOrder(b.problem),
    )
    .slice(0, limit);

// The categories with a solved problem that were practiced the longest time ago
// (the last day anything was done on any of their problems), oldest first, then
// list order. Each item is `{ category, daysAgo }`. At most `limit`.
export const notPracticedLately = (problems, progress = {}, today, limit = 3) => {
  const byCategory = new Map();
  for (const problem of problems) {
    const entry = progress[problem.id];
    if (!entry?.solved) continue;
    const name = categoryOf(problem);
    const last = entryDays(entry).sort().at(-1);
    const seen = byCategory.get(name);
    if (!seen) byCategory.set(name, { category: name, last: last ?? null, index: byCategory.size });
    else if (last && (!seen.last || last > seen.last)) seen.last = last;
  }
  return [...byCategory.values()]
    .filter((item) => item.last)
    .map((item) => ({ ...item, daysAgo: Math.max(0, daysBetween(item.last, today)) }))
    .sort((a, b) => b.daysAgo - a.daysAgo || a.index - b.index)
    .slice(0, limit)
    .map(({ category, daysAgo }) => ({ category, daysAgo }));
};

// Do problems with a note need help less often? The attempts of the problems
// that have a note now against those that do not, each `{ attempts, helped,
// rate }` with `rate` null below MIN_ATTEMPTS. The date a note was written is
// not kept, so this compares the problems as they are today.
export const notesEffect = (problems, progress = {}) => {
  const groups = { withNote: { attempts: 0, helped: 0 }, without: { attempts: 0, helped: 0 } };
  for (const problem of problems) {
    const entry = progress[problem.id];
    const group = groups[typeof entry?.note === "string" && entry.note.trim() ? "withNote" : "without"];
    const counts = helpCounts(entry);
    group.attempts += counts.attempts;
    group.helped += counts.helped;
  }
  const rate = (g) => ({ ...g, rate: g.attempts >= MIN_ATTEMPTS ? g.helped / g.attempts : null });
  return { withNote: rate(groups.withNote), without: rate(groups.without) };
};
