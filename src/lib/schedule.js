// Spaced repetition helpers. Dates are "YYYY-MM-DD" strings in local time.

// Days after the solved date for R1..R5 (fixed schedule).
export const INTERVALS = [1, 3, 7, 14, 30];

// Days between one review and the next, used when a review is completed late.
// On time it reproduces INTERVALS: 1, 1+2, 3+4, 7+7, 14+16.
export const GAPS = [1, 2, 4, 7, 16];

const pad = (n) => String(n).padStart(2, "0");

const formatDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Whole days from `fromDate` to `toDate` ("YYYY-MM-DD"); negative when `toDate`
// is earlier. Plain calendar days, so daylight saving does not matter.
export const daysBetween = (fromDate, toDate) => {
  const toUtc = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(toDate) - toUtc(fromDate)) / 86400000);
};

export const localToday = () => formatDate(new Date());

export const addDays = (dateStr, days) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return formatDate(new Date(year, month - 1, day + days));
};

// A solved problem is due when any pending review date is today or earlier.
export const isDue = (prob, today) => {
  if (!prob || !prob.solved) return false;
  return getSchedule(prob).some(
    (date, idx) => !prob.reviews?.[idx] && date <= today
  );
};

// "2026-10-05" -> "Oct 5". Built from local parts, so the day never shifts.
export const formatShortDate = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// A real calendar day written "YYYY-MM-DD" ("2026-02-30" is not one).
const isDateString = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return formatDate(new Date(year, month - 1, day)) === value;
};
export { isDateString };

// A chosen due date for a review, saved as `dueOverride: { review, date }`
// (`review` is the 0-based index). It replaces the usual date of that review
// while the review is still pending, for example to repeat it in two days. A
// bad value (wrong index, not a date, review already done) is ignored.
export const dueOverrideFor = (prob, index) => {
  const override = prob?.dueOverride;
  if (!override || override.review !== index) return null;
  if (prob.reviews?.[index] || !isDateString(override.date)) return null;
  return override.date;
};

// Review due dates that follow the real review dates: R1 is GAPS[0] days after
// solving, and each next one is GAPS[n] days after the previous review was
// completed (or after its projected due date while it is still pending).
// On time this gives the same 1/3/7/14/30 days as INTERVALS. A pending review
// with a chosen date (`dueOverride`) uses it, and the reviews after it follow.
export const getSchedule = (prob) => {
  if (!prob?.solvedDate) return [];
  const schedule = [];
  let previous = prob.solvedDate;
  GAPS.forEach((gap, idx) => {
    const due = dueOverrideFor(prob, idx) ?? addDays(previous, gap);
    schedule.push(due);
    const completedOn = prob.dates?.[`review${idx + 1}`];
    previous = prob.reviews?.[idx] && completedOn ? completedOn : due;
  });
  return schedule;
};

// Reviews must go in order: R(n) can be completed only when R1..R(n-1) are
// done, and only the last completed review can be undone.
const isReviewIndex = (index) =>
  Number.isInteger(index) && index >= 0 && index < GAPS.length;

export const canCompleteReview = (prob, index) =>
  Boolean(prob?.solved) &&
  isReviewIndex(index) &&
  !prob.reviews?.[index] &&
  GAPS.slice(0, index).every((_, i) => prob.reviews?.[i]);

export const canUncompleteReview = (prob, index) =>
  isReviewIndex(index) &&
  Boolean(prob?.reviews?.[index]) &&
  !prob.reviews.slice(index + 1).some(Boolean);

// Going back to review `index` erases it and every review after it, so that
// review is the next one to do again. Possible for any review that is done.
export const canRewindTo = (prob, index) =>
  Boolean(prob?.solved) && isReviewIndex(index) && Boolean(prob.reviews?.[index]);

// The done reviews (0-based indexes) that going back to `index` erases.
export const reviewsErasedBy = (prob, index) =>
  canRewindTo(prob, index)
    ? prob.reviews.map((done, i) => (done && i >= index ? i : -1)).filter((i) => i >= 0)
    : [];
