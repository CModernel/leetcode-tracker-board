import { describe, expect, it } from "vitest";
import {
  V2_KEY,
  V3_KEY,
  loadProgress,
  migrate,
  parseStored,
  serializeProgress,
} from "./migrate";

const v2Data = () => ({
  "Blind 75": {
    1: {
      solved: true,
      solvedDate: "2026-10-01",
      reviews: [true, false, false, false, false],
      dates: { initial: "2026-10-01", review1: "2026-10-02" },
    },
  },
  "LeetCode 75": {},
  "NeetCode 150": {},
});

// The same data after migration: every problem has a status.
const v3Data = () => {
  const data = v2Data();
  data["Blind 75"][1].status = "solved";
  return data;
};

const emptyLists = { "Blind 75": {}, "LeetCode 75": {}, "NeetCode 150": {} };

// A fake localStorage.getItem.
const reader = (saved) => (key) => (key in saved ? saved[key] : null);

describe("migrate", () => {
  it("wraps v2 data in v3 without changing it", () => {
    const data = v2Data();
    expect(migrate(data)).toEqual({ version: 3, progress: v3Data() });
  });

  it("keeps v3 data as is", () => {
    const v3 = { version: 3, progress: v3Data() };
    expect(migrate(v3)).toEqual(v3);
  });

  it("is safe to run more than once", () => {
    const once = migrate(v2Data());
    expect(migrate(once)).toEqual(once);
  });

  it("does not mutate the input", () => {
    const data = v2Data();
    migrate(data);
    expect(data).toEqual(v2Data());
  });

  it("accepts an old cleared state ({})", () => {
    expect(migrate({})).toEqual({ version: 3, progress: {} });
  });

  it("throws on content that is not an object", () => {
    for (const bad of [null, undefined, [], "text", 5]) {
      expect(() => migrate(bad)).toThrow();
    }
  });

  it("throws on a v3 wrapper without progress", () => {
    expect(() => migrate({ version: 3 })).toThrow();
  });
});

describe("statuses", () => {
  const migrated = (entry) =>
    migrate({ "Blind 75": { 1: entry } }).progress["Blind 75"][1];

  it("solved problems become solved and the rest todo", () => {
    expect(migrated({ solved: true }).status).toBe("solved");
    expect(migrated({ solved: false }).status).toBe("todo");
    expect(migrated({}).status).toBe("todo");
  });

  it("keeps a valid status", () => {
    expect(migrated({ solved: false, status: "in-progress" }).status).toBe(
      "in-progress"
    );
    expect(migrated({ solved: true, status: "solved" }).status).toBe("solved");
  });

  it("replaces an invalid status", () => {
    expect(migrated({ solved: true, status: "done" }).status).toBe("solved");
    expect(migrated({ solved: false, status: 3 }).status).toBe("todo");
  });

  it("adds statuses to v3 data saved before statuses existed", () => {
    const oldV3 = { version: 3, progress: v2Data() };
    expect(migrate(oldV3).progress).toEqual(v3Data());
  });

  it("keeps every other field of the entry", () => {
    const entry = migrated({
      solved: true,
      solvedDate: "2026-10-01",
      reviews: [true, false, false, false, false],
      dates: { initial: "2026-10-01" },
    });
    expect(entry).toEqual({
      status: "solved",
      solved: true,
      solvedDate: "2026-10-01",
      reviews: [true, false, false, false, false],
      dates: { initial: "2026-10-01" },
    });
  });

  it("keeps startedAt and adds nothing to problems saved before it existed", () => {
    const withDate = migrated({
      solved: false,
      status: "in-progress",
      startedAt: "2026-10-01T09:00:00.000Z",
    });
    expect(withDate.startedAt).toBe("2026-10-01T09:00:00.000Z");
    const without = migrated({ solved: false, status: "in-progress" });
    expect(without).not.toHaveProperty("startedAt");
  });

  it("is safe to run again", () => {
    const once = migrate(v2Data());
    expect(migrate(once)).toEqual(once);
    expect(migrate(migrate(once))).toEqual(once);
  });

  it("does not fail on odd entries", () => {
    const result = migrate({ "Blind 75": { 1: null, 2: 5 }, other: null });
    expect(result.progress["Blind 75"]).toEqual({ 1: null, 2: 5 });
    expect(result.progress.other).toBe(null);
  });
});

describe("parseStored", () => {
  it("returns empty lists when nothing is saved", () => {
    expect(parseStored(null)).toEqual(emptyLists);
    expect(parseStored(undefined)).toEqual(emptyLists);
  });

  it("reads both saved shapes", () => {
    expect(parseStored(JSON.stringify(v2Data()))).toEqual(v3Data());
    expect(parseStored(serializeProgress(v3Data()))).toEqual(v3Data());
  });

  it("throws on invalid JSON", () => {
    expect(() => parseStored("{oops")).toThrow();
    expect(() => parseStored("null")).toThrow();
  });
});

describe("loadProgress", () => {
  it("starts empty on a fresh browser", () => {
    expect(loadProgress(reader({}))).toEqual(emptyLists);
  });

  it("migrates old v2 data when there is no v3 yet", () => {
    const saved = { [V2_KEY]: JSON.stringify(v2Data()) };
    expect(loadProgress(reader(saved))).toEqual(v3Data());
  });

  it("prefers v3 over v2 when both exist", () => {
    const newer = { ...emptyLists, "Blind 75": { 9: { solved: false } } };
    const saved = {
      [V2_KEY]: JSON.stringify(v2Data()),
      [V3_KEY]: serializeProgress(newer),
    };
    expect(loadProgress(reader(saved))).toEqual({
      ...emptyLists,
      "Blind 75": { 9: { solved: false, status: "todo" } },
    });
  });

  it("never writes or removes anything while loading", () => {
    const calls = [];
    const saved = { [V2_KEY]: JSON.stringify(v2Data()) };
    loadProgress((key) => {
      calls.push(key);
      return key in saved ? saved[key] : null;
    });
    expect(calls).toEqual([V3_KEY, V2_KEY]);
  });
});

describe("importing a file", () => {
  // The app exports the plain progress object (same shape as v2), so files
  // exported before this version must still import.
  it("accepts an old export file", () => {
    const fileText = JSON.stringify(v2Data(), null, 2);
    expect(migrate(JSON.parse(fileText)).progress).toEqual(v3Data());
  });

  it("accepts a v3 file", () => {
    const fileText = serializeProgress(v3Data());
    expect(migrate(JSON.parse(fileText)).progress).toEqual(v3Data());
  });

  it("rejects a file that is not progress data", () => {
    expect(() => migrate(JSON.parse("[1, 2]"))).toThrow();
    expect(() => migrate(JSON.parse("null"))).toThrow();
  });
});

describe("serializeProgress", () => {
  it("writes the v3 wrapper", () => {
    expect(JSON.parse(serializeProgress(v2Data()))).toEqual({
      version: 3,
      progress: v2Data(),
    });
  });
});
