// Attempt history: one record per review attempt, saved in the problem's entry
// as `attempts: [{ date, review, help }]`. It is separate from `reviews` (the
// current state of the calendar) and is never erased when a review is undone or
// the problem steps back, because it shows how much help each problem needed.

// How much help an attempt needed.
export const HELP = { ALONE: 0, NOTE: 1, SOLUTION: 2 };

// Days until a review is repeated after it needed the note.
export const REPEAT_DAYS = 2;

export const isHelp = (value) => Object.values(HELP).includes(value);

// The attempts of a saved entry, oldest first. Anything that is not a list
// (old data, a bad import) counts as no attempts.
export const attemptsOf = (entry) =>
  Array.isArray(entry?.attempts) ? entry.attempts : [];

// Opening a note or the solution of a solved problem is remembered as
// `helpViewed: { note?: day, solution?: day }` (the last day it was opened).
// It changes nothing in the calendar: it is only used to ask "how did it go?"
// when a review is completed the same day.
export const VIEW_KINDS = { note: "note", solution: "solution" };

// The help that completing a review today should suggest: the solution when it
// was opened today, else the note when it was, else null (nothing was opened,
// so the review is simply completed as solved alone).
export const suggestedHelp = (entry, today) => {
  if (entry?.helpViewed?.solution === today) return HELP.SOLUTION;
  if (entry?.helpViewed?.note === today) return HELP.NOTE;
  return null;
};
