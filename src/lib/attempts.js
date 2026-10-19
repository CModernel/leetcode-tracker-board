// Attempt history: one record per review attempt, saved in the problem's entry
// as `attempts: [{ date, review, help }]`. It is separate from `reviews` (the
// current state of the calendar) and is never erased when a review is undone,
// because it shows how much help each problem needed.

// How much help an attempt needed: none, or "needed help" (the name NOTE comes
// from when it meant "needed the note"; it is the same level, saved as 1).
export const HELP = { ALONE: 0, NOTE: 1 };

// Days until a review is repeated after it needed help.
export const REPEAT_DAYS = 2;

export const isHelp = (value) => Object.values(HELP).includes(value);

// The attempts of a saved entry, oldest first. Anything that is not a list
// (old data, a bad import) counts as no attempts.
export const attemptsOf = (entry) =>
  Array.isArray(entry?.attempts) ? entry.attempts : [];

// Opening the note of a solved problem is remembered as `helpViewed: { note?: day }`
// (the last day it was opened). It changes nothing in the calendar: it is only
// used to ask "how did it go?" when a review is completed the same day.
export const VIEW_KINDS = { note: "note" };

// The help that completing a review today should suggest: "needed help" when the
// note was opened today, else null (nothing was opened, so the review is simply
// completed as solved alone). A note that was written or edited today
// (`noteEditedOn`) was opened to write, not to read as help, so it suggests
// "solved alone" instead. A review whose timer ran out (`timedOut`, see
// isTimedOut in timer.js) suggests "needed help", whatever was opened.
export const suggestedHelp = (entry, today, { timedOut = false } = {}) => {
  if (timedOut) return HELP.NOTE;
  if (entry?.helpViewed?.note === today) {
    return entry.noteEditedOn === today ? HELP.ALONE : HELP.NOTE;
  }
  return null;
};
