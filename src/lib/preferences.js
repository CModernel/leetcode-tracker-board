import { DEFAULT_LANGUAGE, isLanguage } from "./languages";

// Small choices kept in the browser (not part of the progress data).

// Whether the Notes column is shown in the tracker table. Hidden by default.
export const SHOW_NOTES_KEY = "leetcode-show-notes";

export const parseShowNotes = (raw) => raw === "true";

// Whether the Time column is shown in the tracker table. Hidden by default.
export const SHOW_TIME_KEY = "leetcode-show-time";

export const parseShowTime = (raw) => raw === "true";

// The language last chosen on the Patterns page. A saved value that is not a
// listed language (removed, or damaged) falls back to the default.
export const PATTERN_LANGUAGE_KEY = "leetcode-pattern-language";

export const parsePatternLanguage = (raw) => (isLanguage(raw) ? raw : DEFAULT_LANGUAGE);
