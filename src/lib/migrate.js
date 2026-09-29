import { emptyProgress, importData } from "../context/progressReducers";
import { getStatus } from "./status";

// Saved data:
// - v2 (old key): the progress object itself, { [listName]: { [problemId]: entry } }.
// - v3 (new key): { version: 3, progress: <same object> }.
// The v2 key is never deleted or changed, so it stays as a backup.
export const SCHEMA_VERSION = 3;
export const V2_KEY = "leetcode-progress-v2";
export const V3_KEY = "leetcode-progress-v3";

// Gives every saved problem a status (v3 data saved before statuses existed
// has none): solved problems become "solved", the rest "todo". An existing
// valid status is kept, so running it again changes nothing.
const addStatuses = (progress) => {
  const result = {};
  for (const [list, entries] of Object.entries(progress)) {
    if (typeof entries !== "object" || entries === null) {
      result[list] = entries;
      continue;
    }
    result[list] = {};
    for (const [id, entry] of Object.entries(entries)) {
      result[list][id] =
        typeof entry === "object" && entry !== null
          ? { ...entry, status: getStatus(entry) }
          : entry;
    }
  }
  return result;
};

// Any supported shape -> { version: 3, progress }. Later schema changes go
// here and must be safe to run more than once. Throws on invalid content.
export const migrate = (data) => {
  const parsed = importData(data);
  const progress =
    parsed.version === SCHEMA_VERSION ? importData(parsed.progress) : parsed;
  return { version: SCHEMA_VERSION, progress: addStatuses(progress) };
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
