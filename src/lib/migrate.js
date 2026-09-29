import { emptyProgress, importData } from "../context/progressReducers";

// Saved data:
// - v2 (old key): the progress object itself, { [listName]: { [problemId]: entry } }.
// - v3 (new key): { version: 3, progress: <same object> }.
// The v2 key is never deleted or changed, so it stays as a backup.
export const SCHEMA_VERSION = 3;
export const V2_KEY = "leetcode-progress-v2";
export const V3_KEY = "leetcode-progress-v3";

// Any supported shape -> { version: 3, progress }. Later schema changes go
// here and must be safe to run more than once. Throws on invalid content.
export const migrate = (data) => {
  const parsed = importData(data);
  if (parsed.version === SCHEMA_VERSION) {
    return { version: SCHEMA_VERSION, progress: importData(parsed.progress) };
  }
  return { version: SCHEMA_VERSION, progress: parsed };
};

// Raw saved text -> progress. Missing text means nothing saved yet.
export const parseStored = (raw) =>
  raw === null || raw === undefined
    ? emptyProgress()
    : migrate(JSON.parse(raw)).progress;

// Reads v3 if present, otherwise the old v2 data, otherwise starts empty.
// `read(key)` returns the saved text or null (for example localStorage.getItem).
export const loadProgress = (read) => {
  const v3 = read(V3_KEY);
  if (v3 !== null && v3 !== undefined) return parseStored(v3);
  return parseStored(read(V2_KEY));
};

export const serializeProgress = (progress) =>
  JSON.stringify({ version: SCHEMA_VERSION, progress });
