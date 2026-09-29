// Spaced repetition helpers. Dates are "YYYY-MM-DD" strings in local time.

// Days after the solved date for R1..R5 (fixed schedule).
export const INTERVALS = [1, 3, 7, 14, 30];

// Days between one review and the next, used when a review is completed late.
// On time it reproduces INTERVALS: 1, 1+2, 3+4, 7+7, 14+16.
export const GAPS = [1, 2, 4, 7, 16];

const pad = (n) => String(n).padStart(2, "0");

const formatDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const localToday = () => formatDate(new Date());

export const addDays = (dateStr, days) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return formatDate(new Date(year, month - 1, day + days));
};

// Fixed review dates (R1..R5) counted from the solved date.
export const calculateNextReviews = (solvedDate) => {
  if (!solvedDate) return [];
  return INTERVALS.map((days) => addDays(solvedDate, days));
};
