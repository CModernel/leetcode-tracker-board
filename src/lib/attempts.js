// Attempt history: one record per review attempt, saved in the problem's entry
// as `attempts: [{ date, review, help }]`. It is separate from `reviews` (the
// current state of the calendar) and is never erased when a review is undone or
// the problem steps back, because it shows how much help each problem needed.

// How much help an attempt needed.
export const HELP = { ALONE: 0, NOTE: 1, SOLUTION: 2 };

export const isHelp = (value) => Object.values(HELP).includes(value);

// The attempts of a saved entry, oldest first. Anything that is not a list
// (old data, a bad import) counts as no attempts.
export const attemptsOf = (entry) =>
  Array.isArray(entry?.attempts) ? entry.attempts : [];
