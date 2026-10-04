// Small choices kept in the browser (not part of the progress data).
import { LANGUAGES } from "./solutions";

// Whether the Notes column is shown in the tracker table. Hidden by default.
export const SHOW_NOTES_KEY = "leetcode-show-notes";

export const parseShowNotes = (raw) => raw === "true";

// The language last used to save a solution, offered first the next time.
export const SOLUTION_LANGUAGE_KEY = "leetcode-solution-language";
export const DEFAULT_SOLUTION_LANGUAGE = "python";

// A saved language id if it is a known one, otherwise the default.
export const parseSolutionLanguage = (raw) =>
  LANGUAGES.some((language) => language.id === raw) ? raw : DEFAULT_SOLUTION_LANGUAGE;
