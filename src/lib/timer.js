// Pure helpers for the attempt timer: limits, tolerance, score and display.
// Nothing here touches saved data or the screen.
//
// A timer is `{ elapsedMs, runningSince }`: the time already counted, and the
// timestamp it has been running since (`null` when paused). It is kept as
// timestamps, not as a ticking counter, so it survives a reload and a closed
// tab: the real time between two moments is what counts.

// Minutes allowed for the first solve and for a review, by difficulty. Past
// the limit there is a tolerance, then the time is too long to count.
export const LIMITS_MIN = {
  first: { Easy: 20, Medium: 35, Hard: 50 },
  review: { Easy: 10, Medium: 20, Hard: 30 },
};
const DEFAULT_DIFFICULTY = "Medium";

// Up to GRACE_FACTOR times the limit is as good as on time (21 minutes on a 20
// minute limit is the same as 20). From there the score falls in a straight
// line to 50 at CAP_FACTOR times the limit. At CAP_FACTOR times the limit or
// more the problem counts as forgotten / not solved: the score is 0 and stays
// 0 however long it takes (it does not keep getting worse).
export const GRACE_FACTOR = 1.25;
export const CAP_FACTOR = 2;

const MINUTE = 60 * 1000;
const isCount = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

// The limit in milliseconds for a kind ("first" or "review") and a difficulty.
// An unknown difficulty is treated as Medium; an unknown kind has no limit
// (null). `limits` is the minutes table to use (the person's own, see
// timerSettings.js); a `null` cell means no limit.
export const limitMsFor = (kind, difficulty, limits = LIMITS_MIN) => {
  const byDifficulty = limits?.[kind];
  if (!byDifficulty) return null;
  const minutes = difficulty in byDifficulty ? byDifficulty[difficulty] : byDifficulty[DEFAULT_DIFFICULTY];
  return Number.isFinite(minutes) && minutes > 0 ? minutes * MINUTE : null;
};

// The timer saved in an entry, or null when there is none or it is not valid
// (bad data counts as no timer). `runningSince` must be a timestamp or null.
export const normalizeTimer = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  const { elapsedMs, runningSince } = raw;
  if (!isCount(elapsedMs)) return null;
  if (runningSince !== null && runningSince !== undefined && !isCount(runningSince)) return null;
  return { elapsedMs, runningSince: runningSince ?? null };
};

// The time counted so far at `now` (a timestamp). A clock that went backwards
// adds nothing; no valid timer is 0.
export const elapsedMs = (timer, now) => {
  const valid = normalizeTimer(timer);
  if (!valid) return 0;
  if (valid.runningSince === null) return valid.elapsedMs;
  return valid.elapsedMs + Math.max(0, now - valid.runningSince);
};

// The time counted for a problem's entry at `now`, or null when it has no timer.
export const timeCounted = (entry, now) => {
  const timer = normalizeTimer(entry?.timer);
  return timer ? elapsedMs(timer, now) : null;
};

// How a time compares with its limit:
// "ontime" (within the limit, or no limit), "grace" (a little over, same score),
// "late" (clearly over, lower score) or "timeout" (too long: forgotten).
export const timeState = (ms, limitMs) => {
  if (!isCount(ms) || !isCount(limitMs) || limitMs === 0) return "ontime";
  if (ms <= limitMs) return "ontime";
  if (ms <= limitMs * GRACE_FACTOR) return "grace";
  if (ms < limitMs * CAP_FACTOR) return "late";
  return "timeout";
};

// The score of a time, 100 down to 50, or 0 once it timed out. null when the
// time is unknown (never a made-up 0). No limit means full score. It is always
// computed from the time and the limit, never saved, so changing the rules
// above also re-scores old records.
export const timeScore = (ms, limitMs) => {
  if (!isCount(ms)) return null;
  const state = timeState(ms, limitMs);
  if (state === "timeout") return 0;
  if (state === "ontime" || state === "grace") return 100;
  const ratio = ms / limitMs;
  const progress = (ratio - GRACE_FACTOR) / (CAP_FACTOR - GRACE_FACTOR);
  return Math.round(100 - 50 * progress);
};

const pad = (value) => String(value).padStart(2, "0");

// "m:ss", or "h:mm:ss" from one hour. Negative or invalid is 0:00.
export const formatDuration = (ms) => {
  const seconds = Math.floor((isCount(ms) ? ms : 0) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
};

// The most a corrected time can be: a day. Anything longer is a typo.
export const MAX_EDIT_MS = 24 * 60 * 60 * 1000;

// A time typed by the person -> milliseconds, or null when it is not a valid
// time. Accepts "7:20" (minutes:seconds), "1:05:30" (hours:minutes:seconds) and
// "7" (minutes). Seconds and minutes after a colon go up to 59; no decimals, no
// negatives; up to MAX_EDIT_MS.
export const parseDuration = (text) => {
  const value = String(text ?? "").trim();
  let ms = null;
  let match;
  if ((match = /^(\d{1,4})$/.exec(value))) {
    ms = Number(match[1]) * MINUTE;
  } else if ((match = /^(\d{1,4}):([0-5]?\d)$/.exec(value))) {
    ms = (Number(match[1]) * 60 + Number(match[2])) * 1000;
  } else if ((match = /^(\d{1,3}):([0-5]?\d):([0-5]?\d)$/.exec(value))) {
    ms = (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000;
  }
  return ms !== null && ms <= MAX_EDIT_MS ? ms : null;
};

// What the person is doing when they time a problem: the first solve (not
// solved yet) or the next review that is pending (R1..R5). Null when there is
// nothing left to do (every review is done).
export const activityOf = (entry) => {
  if (!entry?.solved) return { kind: "first", label: "First solve" };
  const reviews = Array.isArray(entry.reviews) ? entry.reviews : [];
  const next = Array.from({ length: 5 }, (_, i) => i).find((i) => !reviews[i]);
  if (next === undefined) return null;
  return { kind: "review", review: next + 1, label: `R${next + 1}` };
};

// The problem whose timer is running, as { list, problemId }, or null. Only one
// timer runs at a time (starting another pauses it), so the first one found is
// the one; `progress` is the whole saved object ({ [list]: { [problemId]: entry } }).
export const findRunningTimer = (progress) => {
  for (const [list, entries] of Object.entries(progress || {})) {
    for (const [problemId, entry] of Object.entries(entries || {})) {
      if (normalizeTimer(entry?.timer)?.runningSince != null) return { list, problemId };
    }
  }
  return null;
};

// A running timer that is past its limit at `now`: `{ crossed, overBy }` with
// `overBy` the milliseconds past the limit. Nothing is crossed for a paused or
// missing timer, or when there is no limit.
export const limitCrossing = (entry, limitMs, now) => {
  const timer = normalizeTimer(entry?.timer);
  if (!timer || timer.runningSince === null || !isCount(limitMs) || limitMs === 0) {
    return { crossed: false, overBy: 0 };
  }
  const overBy = elapsedMs(timer, now) - limitMs;
  return overBy > 0 ? { crossed: true, overBy } : { crossed: false, overBy: 0 };
};

// Whether the time on this problem's REVIEW timer has run out (timed out: at
// least CAP_FACTOR times the limit) at `now`, paused or running. A first solve
// is only recorded, never suggests anything; no timer or no limit is never
// timed out. `limits` is the person's table (see timerSettings.js).
export const isTimedOut = (entry, difficulty, limits, now) => {
  const activity = activityOf(entry);
  const timer = normalizeTimer(entry?.timer);
  if (!timer || activity?.kind !== "review") return false;
  return timeState(elapsedMs(timer, now), limitMsFor("review", difficulty, limits)) === "timeout";
};
