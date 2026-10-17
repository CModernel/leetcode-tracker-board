// Choices about the timer kept in the browser (not part of the progress data):
// whether it is shown, and the time limits.
import { LIMITS_MIN } from "./timer";

export const SHOW_TIMER_KEY = "leetcode-show-timer";
export const TIMER_LIMITS_KEY = "leetcode-timer-limits";

export const MIN_LIMIT = 1;
export const MAX_LIMIT = 600;
export const KINDS = ["first", "review"];
export const DIFFICULTIES = ["Easy", "Medium", "Hard"];

// The timer is shown unless it was switched off.
export const parseShowTimer = (raw) => raw !== "false";

const isMinutes = (value) =>
  Number.isInteger(value) && value >= MIN_LIMIT && value <= MAX_LIMIT;

// The limits saved as text, in minutes: `{ first: {Easy, Medium, Hard}, review: {...} }`.
// A cell is whole minutes (1 to 600) or null for "no limit". Always a complete
// object: a missing or bad cell (or bad JSON) gets its default.
export const parseTimerLimits = (raw) => {
  let saved = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  const limits = {};
  for (const kind of KINDS) {
    limits[kind] = {};
    for (const difficulty of DIFFICULTIES) {
      const value = saved?.[kind]?.[difficulty];
      limits[kind][difficulty] =
        value === null || isMinutes(value) ? value : LIMITS_MIN[kind][difficulty];
    }
  }
  return limits;
};

export const serializeLimits = (limits) => JSON.stringify(parseTimerLimits(JSON.stringify(limits)));

// The default limits as a fresh object.
export const defaultLimits = () => parseTimerLimits(null);

// For a text typed in the dialog: whole minutes as a number, or null when it is
// empty, not a whole number or outside 1 to 600.
export const validateMinutes = (text) => {
  const value = String(text ?? "").trim();
  if (!/^\d+$/.test(value)) return null;
  const minutes = Number(value);
  return isMinutes(minutes) ? minutes : null;
};
