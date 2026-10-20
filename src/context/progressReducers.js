import {
  GAPS,
  addDays,
  canCompleteReview,
  canRewindTo,
  canUncompleteReview,
  isDateString,
} from "../lib/schedule";
import { HELP, REPEAT_DAYS, VIEW_KINDS, attemptsOf, isHelp, lastTimedRecord } from "../lib/attempts";
import { isStatus } from "../lib/status";
import { MAX_EDIT_MS, activityOf, elapsedMs, findRunningTimer, normalizeTimer } from "../lib/timer";

// Pure functions that return the next `progress` object. `progress` is
// { [listName]: { [problemId]: { status, solved, solvedDate, reviews, dates, note?, attempts?, helpViewed? } } }.
// `today` is passed in ("YYYY-MM-DD") so these stay easy to test.

export const emptyProgress = () => ({
  "Blind 75": {},
  "LeetCode 75": {},
  "NeetCode 150": {},
});

const emptyEntry = () => ({
  status: "todo",
  solved: false,
  reviews: Array(5).fill(false),
  dates: {},
});

// A chosen due date (`dueOverride`) belongs to the review that was pending
// when it was set. Whenever the reviews change, it is dropped so it can never
// land on a different review later. `masteredBy` (see markMastered) describes
// the reviews being all done, so it goes the same way as soon as they change.
const withoutOverride = (entry) => {
  const { dueOverride, masteredBy, ...rest } = entry;
  void dueOverride;
  void masteredBy;
  return rest;
};

// The time used by an entry's timer, as { ms, limitMs? }, or null when it has
// no (valid) timer. `time` is { now, limitMs? } from the caller: `now` is the
// timestamp the timer stops at (without it only the time already counted is
// used) and `limitMs` the limit that applied, saved so a later change of the
// limits does not rewrite history. `time.ms` is a time corrected by the person
// (see parseDuration) that replaces the one counted.
const validMs = (value) => Number.isFinite(value) && value >= 0 && value <= MAX_EDIT_MS;
const timeUsed = (entry, time) => {
  const timer = normalizeTimer(entry?.timer);
  if (!timer) return null;
  const stop = Number.isFinite(time?.now) ? time.now : timer.runningSince ?? 0;
  const used = { ms: validMs(time?.ms) ? time.ms : elapsedMs(timer, stop) };
  if (Number.isFinite(time?.limitMs) && time.limitMs > 0) used.limitMs = time.limitMs;
  return used;
};

// The timer belongs to what is being done (the first solve or one review), so
// it goes when that changes.
const withoutTimer = (entry) => {
  const { timer, ...rest } = entry;
  void timer;
  return rest;
};

const updateEntry = (progress, list, problemId, update) => {
  const listProgress = progress[list] || {};
  const current = listProgress[problemId] || emptyEntry();
  return {
    ...progress,
    [list]: { ...listProgress, [problemId]: update(current) },
  };
};

// With a timer, the time used is kept as `firstSolve: { date, ms, limitMs? }`
// (kept when the problem is un-solved later, like the attempts) and the timer
// is cleared. Without one nothing is saved: a missing `ms` is unknown, never 0.
export const markSolved = (progress, list, problemId, today, time) => {
  if (progress[list]?.[problemId]?.solved) return progress;
  return updateEntry(progress, list, problemId, (current) => {
    const used = timeUsed(current, time);
    const next = {
      ...withoutTimer(current),
      status: "solved",
      solved: true,
      solvedDate: today,
      dates: { ...current.dates, initial: today },
    };
    if (used) next.firstSolve = { date: today, ...used };
    return next;
  });
};

// Marks a problem as mastered without going through the five reviews (someone
// who already knows it). It becomes solved if it was not, every review is done
// (the ones still pending get `today` as their date) and `masteredBy: "manual"`
// tells it apart from one that earned it. Attempts are NOT invented: the
// history only holds real attempts. Notes and attempts stay; the chosen due
// date, the "opened today" reminders and the In Progress position go. Does
// nothing when all the reviews are already done.
export const markMastered = (progress, list, problemId, today) => {
  const current = progress[list]?.[problemId];
  if (current?.reviews?.length === 5 && current.reviews.every(Boolean)) return progress;
  return updateEntry(progress, list, problemId, (entry) => {
    const next = withoutTimer(withoutOverride(entry));
    delete next.helpViewed;
    delete next.startedAt;
    delete next.order;
    const solvedDate = entry.solvedDate || today;
    const dates = { ...entry.dates, initial: entry.dates?.initial || solvedDate };
    for (let i = 0; i < 5; i++) {
      if (!entry.reviews?.[i]) dates[`review${i + 1}`] = today;
    }
    return {
      ...next,
      status: "solved",
      solved: true,
      solvedDate,
      reviews: Array(5).fill(true),
      dates,
      masteredBy: "manual",
    };
  });
};

// The timer of a problem is `timer: { elapsedMs, runningSince }` (see
// lib/timer.js). `now` is a timestamp in milliseconds. Only one timer runs at a
// time: starting one pauses the other, wherever it is.
const pausedAt = (entry, now) => ({
  ...entry,
  timer: { elapsedMs: elapsedMs(entry.timer, now), runningSince: null },
});

// Pauses the running timer, if any (in any list).
const pauseRunning = (progress, now) => {
  const running = findRunningTimer(progress);
  if (!running) return progress;
  return updateEntry(progress, running.list, running.problemId, (entry) => pausedAt(entry, now));
};

// Starts (or resumes) the timer of a problem, keeping the time already counted
// and pausing any other timer. A problem with nothing left to time (every
// review done) and one that is already running do nothing.
export const startTimer = (progress, list, problemId, now) => {
  if (!Number.isFinite(now) || now < 0) return progress;
  const current = progress[list]?.[problemId];
  if (activityOf(current) === null) return progress;
  if (normalizeTimer(current?.timer)?.runningSince != null) return progress;
  const paused = pauseRunning(progress, now);
  return updateEntry(paused, list, problemId, (entry) => ({
    ...entry,
    timer: { elapsedMs: elapsedMs(entry.timer, now), runningSince: now },
  }));
};

// Pauses the timer of a problem (the time so far is kept). Does nothing when
// it is not running.
export const pauseTimer = (progress, list, problemId, now) => {
  const current = progress[list]?.[problemId];
  if (normalizeTimer(current?.timer)?.runningSince == null) return progress;
  return updateEntry(progress, list, problemId, (entry) => pausedAt(entry, now));
};

// Corrects the time of the timer of a problem to `ms` (as the person says it
// should be). A running timer keeps running from that value; a paused one stays
// paused. Does nothing without a timer, with an invalid `ms` (not 0 to a day)
// or when the time already is that.
export const setTimerElapsed = (progress, list, problemId, ms, now) => {
  const timer = normalizeTimer(progress[list]?.[problemId]?.timer);
  if (!timer || !validMs(ms)) return progress;
  const running = timer.runningSince !== null;
  if (running && !Number.isFinite(now)) return progress;
  if (elapsedMs(timer, running ? now : 0) === ms) return progress;
  return updateEntry(progress, list, problemId, (entry) => ({
    ...entry,
    timer: { elapsedMs: ms, runningSince: running ? now : null },
  }));
};

// Corrects the last time recorded for a problem (see lastTimedRecord: the last
// review attempt with a time, else the first solve's) to `ms`, or removes it
// with `null` (the time becomes unknown, never 0, and its limit goes too). The
// score follows by itself, it is computed. A time can only be lowered, never
// raised. Does nothing when there is no time recorded, `ms` is invalid, higher
// than the recorded one or already that.
export const setRecordedTime = (progress, list, problemId, ms) => {
  const entry = progress[list]?.[problemId];
  const target = lastTimedRecord(entry);
  if (!target) return progress;
  if (ms !== null && !validMs(ms)) return progress;
  if (ms === target.ms || (ms !== null && ms > target.ms)) return progress;
  const fix = (record) => {
    const { ms: oldMs, limitMs, ...rest } = record;
    void oldMs;
    return ms === null ? rest : { ...rest, ms, ...(limitMs === undefined ? {} : { limitMs }) };
  };
  return updateEntry(progress, list, problemId, (current) =>
    target.kind === "first"
      ? { ...current, firstSolve: fix(current.firstSolve) }
      : {
          ...current,
          attempts: attemptsOf(current).map((attempt, index) =>
            index === target.index ? fix(attempt) : attempt
          ),
        }
  );
};

// Throws the time counted away (running or not). Does nothing without a timer.
export const resetTimer = (progress, list, problemId) => {
  if (!progress[list]?.[problemId] || !("timer" in progress[list][problemId])) return progress;
  return updateEntry(progress, list, problemId, (entry) => {
    const { timer, ...rest } = entry;
    void timer;
    return rest;
  });
};

// Un-solving wipes the reviews and their dates.
export const unsolve = (progress, list, problemId) =>
  updateEntry(progress, list, problemId, (current) => ({
    ...withoutTimer(withoutOverride(current)),
    status: "todo",
    solved: false,
    solvedDate: null,
    reviews: Array(5).fill(false),
    dates: {},
  }));

// Moves a problem to a status. Going to "solved" is markSolved. Leaving
// "solved" is unsolve, so its reviews and dates are wiped. Between "todo" and
// "in-progress" only the status changes. An unknown status does nothing.
// Entering "in-progress" saves `startedAt` (`now`, a timestamp; it defaults to
// `today`), which the board uses to keep the latest started at the bottom.
// Going back to "todo" removes it.
export const setStatus = (
  progress,
  list,
  problemId,
  status,
  today,
  now = today
) => {
  if (!isStatus(status)) return progress;
  const current = progress[list]?.[problemId];
  if (status === "solved") return markSolved(progress, list, problemId, today);

  // A problem that (re)enters In Progress goes to the bottom, so any manual
  // position from an earlier time in this column is dropped.
  const change = (entry) => {
    const next = { ...entry, status };
    delete next.order;
    if (status === "in-progress") next.startedAt = now;
    else delete next.startedAt;
    return next;
  };
  if (current?.solved) {
    return updateEntry(unsolve(progress, list, problemId), list, problemId, change);
  }
  if (current?.status === status) return progress;
  return updateEntry(progress, list, problemId, change);
};

// Reviews go in order (see canCompleteReview); anything else does nothing.
export const completeReview = (progress, list, problemId, index, today) => {
  if (!canCompleteReview(progress[list]?.[problemId], index)) return progress;
  return updateEntry(progress, list, problemId, (current) => {
    const reviews = [...current.reviews];
    reviews[index] = true;
    return {
      ...withoutTimer(withoutOverride(current)),
      reviews,
      dates: { ...current.dates, [`review${index + 1}`]: today },
    };
  });
};

// Only the last completed review can be undone; anything else does nothing.
export const uncompleteReview = (progress, list, problemId, index) => {
  if (!canUncompleteReview(progress[list]?.[problemId], index)) return progress;
  return updateEntry(progress, list, problemId, (current) => {
    const reviews = [...current.reviews];
    reviews[index] = false;
    const dates = { ...current.dates };
    delete dates[`review${index + 1}`];
    return { ...withoutTimer(withoutOverride(current)), reviews, dates };
  });
};

// Saves the note of a problem (one note per problem, plain text). A note with
// only spaces removes it, so the entry has no empty `note`. The note is not
// part of the schedule: unsolving and moving the problem keep it. Nothing else
// in the entry changes, and nothing is created for an empty note.
// When `today` is given, every change to the text (a new note or an edit)
// saves that day as `noteEditedOn`: someone who wrote or edited a note today
// is not reading it as help (see suggestedHelp). Saving the same text changes
// nothing; removing the note removes the day.
export const setNote = (progress, list, problemId, note, today) => {
  const text = typeof note === "string" && note.trim() !== "" ? note : null;
  const current = progress[list]?.[problemId];
  if (text === null && current?.note === undefined) return progress;
  if (text !== null && current?.note === text) return progress;
  return updateEntry(progress, list, problemId, (entry) => {
    const next = { ...entry };
    if (text === null) {
      delete next.note;
      delete next.noteEditedOn;
    } else {
      if (today) next.noteEditedOn = today;
      next.note = text;
    }
    return next;
  });
};

// Goes back to review `index`: it and every later review are erased, with
// their dates, so it is the next one to do. Reviews before it stay. Does
// nothing when that review is not done.
export const rewindReviews = (progress, list, problemId, index) => {
  if (!canRewindTo(progress[list]?.[problemId], index)) return progress;
  return updateEntry(progress, list, problemId, (current) => {
    const reviews = current.reviews.map((done, i) => (i >= index ? false : done));
    const dates = { ...current.dates };
    for (let i = index; i < reviews.length; i++) delete dates[`review${i + 1}`];
    return { ...withoutTimer(withoutOverride(current)), reviews, dates };
  });
};

const validUsed = (used) => {
  if (!used || !Number.isFinite(used.ms) || used.ms < 0) return {};
  return Number.isFinite(used.limitMs) && used.limitMs > 0
    ? { ms: used.ms, limitMs: used.limitMs }
    : { ms: used.ms };
};

// Adds an attempt to the problem's history: which review (0..4) was tried, how
// much help it needed (see HELP) and on what day. Only a solved problem has
// reviews, so anything else does nothing, and so does an invalid review or
// help. Existing attempts are never changed or removed by this or by any other
// action except "Clear all". `used` ({ ms, limitMs? }, the time the attempt
// took) is saved with it when it is valid; without it the time is unknown.
export const recordAttempt = (progress, list, problemId, review, help, today, used) => {
  const current = progress[list]?.[problemId];
  const validReview = Number.isInteger(review) && review >= 0 && review < 5;
  if (!current?.solved || !validReview || !isHelp(help)) return progress;
  return updateEntry(progress, list, problemId, (entry) => ({
    ...entry,
    attempts: [...attemptsOf(entry), { date: today, review, help, ...validUsed(used) }],
  }));
};

// Remembers that the note of a solved problem was opened on
// `today`. Nothing else changes. Does nothing for a problem that is not solved,
// an unknown kind, or when that day is already saved.
export const markHelpViewed = (progress, list, problemId, kind, today) => {
  const current = progress[list]?.[problemId];
  if (!current?.solved || !Object.values(VIEW_KINDS).includes(kind)) return progress;
  if (current.helpViewed?.[kind] === today) return progress;
  return updateEntry(progress, list, problemId, (entry) => ({
    ...entry,
    helpViewed: { ...entry.helpViewed, [kind]: today },
  }));
};

// The question "how did it go?" has been answered: what was opened before it
// no longer counts.
const withoutHelpViewed = (entry) => {
  const { helpViewed, ...rest } = entry;
  void helpViewed;
  return rest;
};

// Chooses the due date of a pending review (see `dueOverride` in getSchedule).
// Does nothing unless the problem is solved, the review is not done yet and
// `date` is a real day.
export const setDueOverride = (progress, list, problemId, review, date) => {
  const current = progress[list]?.[problemId];
  const pending =
    current?.solved &&
    Number.isInteger(review) &&
    review >= 0 &&
    review < GAPS.length &&
    !current.reviews?.[review];
  if (!pending || !isDateString(date)) return progress;
  return updateEntry(progress, list, problemId, (entry) => ({
    ...entry,
    dueOverride: { review, date },
  }));
};

// Completes the next review saying how much help it needed. Every outcome is
// written in the attempt history. What happens to the calendar:
// - HELP.ALONE: the review is done, as with completeReview.
// - HELP.NOTE (needed help): it is not done; the same review comes back in
//   REPEAT_DAYS days.
// Only the next pending review can be completed (see canCompleteReview);
// anything else, or an unknown help level, does nothing.
export const completeReviewWithHelp = (
  progress,
  list,
  problemId,
  index,
  help,
  today,
  time
) => {
  if (!isHelp(help)) return progress;
  if (!canCompleteReview(progress[list]?.[problemId], index)) return progress;
  // read before the steps below clear the timer; whatever the answer, the
  // attempt took this long
  const used = timeUsed(progress[list][problemId], time);

  let next = progress;
  if (help === HELP.ALONE) {
    next = completeReview(next, list, problemId, index, today);
  } else {
    next = setDueOverride(next, list, problemId, index, addDays(today, REPEAT_DAYS));
  }
  next = recordAttempt(next, list, problemId, index, help, today, used);
  // the attempt is over whatever the answer: the same review starts a new one
  return updateEntry(next, list, problemId, (entry) => withoutHelpViewed(withoutTimer(entry)));
};

// Puts a problem's saved entry back as it was (used by "Undo"). `entry` is
// undefined when the problem had no saved progress, and then it is removed.
// Only that problem changes.
export const restoreEntry = (progress, list, problemId, entry) => {
  const listProgress = { ...(progress[list] || {}) };
  if (entry === undefined) delete listProgress[problemId];
  else listProgress[problemId] = entry;
  return { ...progress, [list]: listProgress };
};

// Saves a manual order for problems (the In Progress column): each id gets its
// position in `orderedIds` as `order`. Ids without saved progress are skipped.
export const setOrder = (progress, list, orderedIds) => {
  const listProgress = { ...(progress[list] || {}) };
  orderedIds.forEach((id, position) => {
    if (listProgress[id]) listProgress[id] = { ...listProgress[id], order: position };
  });
  return { ...progress, [list]: listProgress };
};

// restoreEntry for several problems at once. `snapshot` is { [id]: entry } with
// `undefined` for problems that had no saved progress.
export const restoreEntries = (progress, list, snapshot) =>
  Object.entries(snapshot).reduce(
    (state, [id, entry]) => restoreEntry(state, list, id, entry),
    progress
  );

// Replaces everything with an imported file's content. Throws if the content
// is not an object (for example "null" or a list), so nothing gets replaced.
export const importData = (data) => {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("Invalid progress data");
  }
  return data;
};

// Clears all progress but keeps an empty entry for each list.
export const clearAll = () => emptyProgress();

export const DEFAULT_LIST = "Blind 75";

// Saved list name if it is a known list, otherwise the default one.
export const parseSelectedList = (raw) =>
  raw && Object.keys(emptyProgress()).includes(raw) ? raw : DEFAULT_LIST;
