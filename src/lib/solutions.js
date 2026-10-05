// A solution is the code of a problem, read like a note.
// The edit field is limited; saved solutions are never cut.
export const SOLUTION_MAX_LENGTH = 10000;

// A problem can hold up to two solutions (e.g. brute force and optimal), each
// with an optional short name.
export const MAX_SOLUTIONS = 2;
export const SOLUTION_NAME_MAX_LENGTH = 40;

// The saved solutions of an entry, always a list.
export const solutionsOf = (entry) =>
  Array.isArray(entry?.solutions) ? entry.solutions : [];

export const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "go", label: "Go" },
  { id: "rust", label: "Rust" },
  { id: "kotlin", label: "Kotlin" },
  { id: "swift", label: "Swift" },
  { id: "sql", label: "SQL" },
  { id: "other", label: "Other" },
];

export const SOLUTION_SOURCES = {
  manual: "manual",
  leetcodeApi: "leetcode-api",
  extension: "extension",
  importFile: "import-file",
};

const LANGUAGE_IDS = LANGUAGES.map((language) => language.id);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Every source (the editor, an import, an API, an extension) goes through this:
// { code, language, source, savedAt, name?, meta? }, or null when there is no code.
// Unknown languages become "other", an unknown source "manual", and a missing
// or wrong date is left out of the result by using `fallbackDate`.
export const normalizeSolution = (raw, fallbackDate) => {
  if (typeof raw !== "object" || raw === null) return null;
  if (typeof raw.code !== "string" || raw.code.trim() === "") return null;
  const solution = {
    code: raw.code.replace(/\s+$/, ""),
    language: LANGUAGE_IDS.includes(raw.language) ? raw.language : "other",
    source:
      typeof raw.source === "string" && raw.source.trim() !== ""
        ? raw.source
        : SOLUTION_SOURCES.manual,
    savedAt: DATE.test(raw.savedAt) ? raw.savedAt : fallbackDate,
  };
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, SOLUTION_NAME_MAX_LENGTH) : "";
  if (name !== "") solution.name = name;
  if (typeof raw.meta === "object" && raw.meta !== null && !Array.isArray(raw.meta)) {
    solution.meta = raw.meta;
  }
  return solution;
};

// A solution written by hand is never replaced by an automatic source. An
// automatic one can be replaced by anything.
export const canReplace = (current, incoming) => {
  if (!current) return true;
  if (current.source === SOLUTION_SOURCES.manual) {
    return incoming?.source === SOLUTION_SOURCES.manual;
  }
  return true;
};
