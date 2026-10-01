import { describe, expect, it } from "vitest";
import {
  clearAll,
  completeReview,
  completeReviewWithHelp,
  DEFAULT_LIST,
  importData,
  markHelpViewed,
  markSolved,
  parseSelectedList,
  restoreEntries,
  recordAttempt,
  restoreEntry,
  setDueOverride,
  setNote,
  rewindReviews,
  setOrder,
  setStatus,
  uncompleteReview,
  unsolve,
} from "./progressReducers";
import { getSchedule } from "../lib/schedule";
import { HELP } from "../lib/attempts";

const LIST = "NeetCode 150";
const OTHER = "Blind 75";
const noReviews = [false, false, false, false, false];

const solvedState = () => ({
  [LIST]: {
    1: {
      solved: true,
      solvedDate: "2026-10-01",
      reviews: [true, true, false, false, false],
      dates: {
        initial: "2026-10-01",
        review1: "2026-10-02",
        review2: "2026-10-05",
      },
    },
  },
  [OTHER]: { 7: { solved: true, solvedDate: "2026-09-01", reviews: noReviews, dates: {} } },
});

describe("markSolved", () => {
  it("creates the entry with today's date and empty reviews", () => {
    const next = markSolved({ [LIST]: {} }, LIST, 1, "2026-10-01");
    expect(next[LIST][1]).toEqual({
      status: "solved",
      solved: true,
      solvedDate: "2026-10-01",
      reviews: noReviews,
      dates: { initial: "2026-10-01" },
    });
  });

  it("works when the list has no progress yet", () => {
    const next = markSolved({}, LIST, 1, "2026-10-01");
    expect(next[LIST][1].solved).toBe(true);
  });

  it("does nothing when the problem is already solved", () => {
    const state = solvedState();
    expect(markSolved(state, LIST, 1, "2026-10-09")).toBe(state);
  });

  it("does not touch other problems or lists", () => {
    const state = solvedState();
    const next = markSolved(state, LIST, 2, "2026-10-09");
    expect(next[LIST][1]).toBe(state[LIST][1]);
    expect(next[OTHER]).toBe(state[OTHER]);
  });

  it("does not mutate the previous state", () => {
    const state = { [LIST]: {} };
    markSolved(state, LIST, 1, "2026-10-01");
    expect(state).toEqual({ [LIST]: {} });
  });
});

describe("setStatus", () => {
  const entry = (state, id = 1) => state[LIST][id];

  it("starts a problem: todo -> in-progress without touching anything else", () => {
    const next = setStatus({}, LIST, 1, "in-progress", "2026-10-01");
    expect(entry(next)).toMatchObject({ status: "in-progress", solved: false });
    expect(entry(next).reviews).toEqual(noReviews);
  });

  it("goes back from in-progress to todo", () => {
    const started = setStatus({}, LIST, 1, "in-progress", "2026-10-01");
    const back = setStatus(started, LIST, 1, "todo", "2026-10-02");
    expect(entry(back).status).toBe("todo");
  });

  it("solves like markSolved, from todo or in-progress", () => {
    const started = setStatus({}, LIST, 1, "in-progress", "2026-10-01");
    const solved = setStatus(started, LIST, 1, "solved", "2026-10-03");
    expect(entry(solved)).toMatchObject({
      status: "solved",
      solved: true,
      solvedDate: "2026-10-03",
    });
    expect(solved).toEqual(markSolved(started, LIST, 1, "2026-10-03"));
  });

  it("leaving solved wipes reviews and dates, like unsolve", () => {
    const next = setStatus(solvedState(), LIST, 1, "in-progress", "2026-10-09");
    expect(entry(next)).toEqual({
      status: "in-progress",
      startedAt: "2026-10-09",
      solved: false,
      solvedDate: null,
      reviews: noReviews,
      dates: {},
    });
    const todo = setStatus(solvedState(), LIST, 1, "todo", "2026-10-09");
    expect(entry(todo).status).toBe("todo");
    expect(entry(todo).solved).toBe(false);
  });

  it("does nothing for an unknown status or the same status", () => {
    const state = solvedState();
    expect(setStatus(state, LIST, 1, "done", "2026-10-09")).toBe(state);
    expect(setStatus(state, LIST, 1, undefined, "2026-10-09")).toBe(state);
    expect(setStatus(state, LIST, 1, "solved", "2026-10-09")).toBe(state);
    const started = setStatus({}, LIST, 1, "in-progress", "2026-10-01");
    expect(setStatus(started, LIST, 1, "in-progress", "2026-10-02")).toBe(started);
  });

  it("does not touch other problems or lists", () => {
    const state = solvedState();
    const next = setStatus(state, LIST, 1, "todo", "2026-10-09");
    expect(next[OTHER]).toBe(state[OTHER]);
    expect(entry(setStatus(state, LIST, 2, "in-progress", "2026-10-09"), 1)).toBe(
      state[LIST][1]
    );
  });

  it("keeps solved equal to (status === solved) through any sequence", () => {
    const steps = ["in-progress", "solved", "todo", "solved", "in-progress", "in-progress", "todo", "solved"];
    let state = {};
    steps.forEach((status, n) => {
      state = setStatus(state, LIST, 1, status, `2026-10-${10 + n}`);
      expect(entry(state).solved).toBe(entry(state).status === "solved");
      expect(entry(state).status).toBe(status);
    });
  });

  it("keeps the sync with markSolved, unsolve and reviews too", () => {
    let state = markSolved({}, LIST, 1, "2026-10-01");
    expect(entry(state)).toMatchObject({ status: "solved", solved: true });
    state = completeReview(state, LIST, 1, 0, "2026-10-02");
    expect(entry(state).status).toBe("solved");
    state = unsolve(state, LIST, 1);
    expect(entry(state)).toMatchObject({ status: "todo", solved: false });
  });
});

describe("unsolve", () => {
  it("wipes reviews, dates and the solved date", () => {
    const next = unsolve(solvedState(), LIST, 1);
    expect(next[LIST][1]).toEqual({
      status: "todo",
      solved: false,
      solvedDate: null,
      reviews: noReviews,
      dates: {},
    });
  });

  it("solving again starts from today, not from the old date", () => {
    const unsolved = unsolve(solvedState(), LIST, 1);
    const again = markSolved(unsolved, LIST, 1, "2026-10-20");
    expect(again[LIST][1].solvedDate).toBe("2026-10-20");
    expect(again[LIST][1].reviews).toEqual(noReviews);
    expect(again[LIST][1].dates).toEqual({ initial: "2026-10-20" });
  });

  it("does not touch other lists", () => {
    const state = solvedState();
    expect(unsolve(state, LIST, 1)[OTHER]).toBe(state[OTHER]);
  });
});

describe("completeReview", () => {
  it("marks the review and stamps today's date", () => {
    const next = completeReview(solvedState(), LIST, 1, 2, "2026-10-08");
    expect(next[LIST][1].reviews).toEqual([true, true, true, false, false]);
    expect(next[LIST][1].dates.review3).toBe("2026-10-08");
  });

  it("keeps the other reviews and dates", () => {
    const next = completeReview(solvedState(), LIST, 1, 2, "2026-10-08");
    expect(next[LIST][1].dates).toMatchObject({
      initial: "2026-10-01",
      review1: "2026-10-02",
      review2: "2026-10-05",
    });
  });

  it("completes the reviews one after another", () => {
    let state = markSolved({}, LIST, 1, "2026-10-01");
    for (let i = 0; i < 5; i++) {
      state = completeReview(state, LIST, 1, i, `2026-10-0${i + 2}`);
    }
    expect(state[LIST][1].reviews).toEqual([true, true, true, true, true]);
    expect(state[LIST][1].dates.review5).toBe("2026-10-06");
  });

  it("ignores a review whose earlier reviews are not done", () => {
    const state = markSolved({}, LIST, 1, "2026-10-01");
    expect(completeReview(state, LIST, 1, 1, "2026-10-04")).toBe(state);
    expect(completeReview(state, LIST, 1, 3, "2026-10-04")).toBe(state);
  });

  it("ignores a review that is already done", () => {
    const state = solvedState();
    expect(completeReview(state, LIST, 1, 0, "2026-10-09")).toBe(state);
  });

  it("ignores reviews of a problem that is not solved or does not exist", () => {
    const state = { [LIST]: { 1: { solved: false, reviews: [false, false, false, false, false], dates: {} } } };
    expect(completeReview(state, LIST, 1, 0, "2026-10-09")).toBe(state);
    expect(completeReview(state, LIST, 99, 0, "2026-10-09")).toBe(state);
    expect(completeReview({}, LIST, 1, 0, "2026-10-09")).toEqual({});
  });

  it("ignores an index outside R1..R5", () => {
    const state = markSolved({}, LIST, 1, "2026-10-01");
    expect(completeReview(state, LIST, 1, -1, "2026-10-04")).toBe(state);
    expect(completeReview(state, LIST, 1, 5, "2026-10-04")).toBe(state);
  });

  it("does not mutate the previous state", () => {
    const state = solvedState();
    completeReview(state, LIST, 1, 2, "2026-10-08");
    expect(state[LIST][1].reviews).toEqual([true, true, false, false, false]);
    expect(state[LIST][1].dates.review3).toBeUndefined();
  });
});

describe("uncompleteReview", () => {
  it("clears the review and deletes its date", () => {
    const next = uncompleteReview(solvedState(), LIST, 1, 1);
    expect(next[LIST][1].reviews).toEqual([true, false, false, false, false]);
    expect(next[LIST][1].dates).toEqual({
      initial: "2026-10-01",
      review1: "2026-10-02",
    });
  });

  it("ignores a review that is not the last completed one", () => {
    const state = solvedState(); // R1 and R2 done
    expect(uncompleteReview(state, LIST, 1, 0)).toBe(state);
  });

  it("ignores a review that is not done", () => {
    const state = solvedState();
    expect(uncompleteReview(state, LIST, 1, 3)).toBe(state);
  });

  it("undoes the reviews from the last one backwards", () => {
    let state = solvedState(); // R1 and R2 done
    state = uncompleteReview(state, LIST, 1, 1);
    state = uncompleteReview(state, LIST, 1, 0);
    expect(state[LIST][1].reviews).toEqual(noReviews);
    expect(state[LIST][1].dates).toEqual({ initial: "2026-10-01" });
  });

  it("can unwind old data that is already out of order", () => {
    // Saved before the order rule: R1 and R4 done, R2 and R3 skipped.
    const old = {
      [LIST]: {
        1: {
          solved: true,
          solvedDate: "2026-10-01",
          reviews: [true, false, false, true, false],
          dates: { review1: "2026-10-02", review4: "2026-10-20" },
        },
      },
    };
    expect(uncompleteReview(old, LIST, 1, 0)).toBe(old); // R4 still done
    const next = uncompleteReview(old, LIST, 1, 3);
    expect(next[LIST][1].reviews).toEqual([true, false, false, false, false]);
    expect(uncompleteReview(next, LIST, 1, 0)[LIST][1].reviews).toEqual(noReviews);
  });

  it("keeps the problem solved", () => {
    const next = uncompleteReview(solvedState(), LIST, 1, 1);
    expect(next[LIST][1].solved).toBe(true);
    expect(next[LIST][1].solvedDate).toBe("2026-10-01");
  });

  it("does not mutate the previous state", () => {
    const state = solvedState();
    uncompleteReview(state, LIST, 1, 1);
    expect(state[LIST][1].reviews[1]).toBe(true);
    expect(state[LIST][1].dates.review2).toBe("2026-10-05");
  });
});

describe("importData", () => {
  it("returns the imported object as is", () => {
    const data = solvedState();
    expect(importData(data)).toBe(data);
  });

  it("rejects content that is not an object", () => {
    for (const bad of [null, undefined, [], "text", 5]) {
      expect(() => importData(bad)).toThrow();
    }
  });
});

describe("clearAll", () => {
  it("removes all progress but keeps an empty entry per list", () => {
    expect(clearAll()).toEqual({
      "Blind 75": {},
      "LeetCode 75": {},
      "NeetCode 150": {},
    });
  });

  it("returns a new object each time", () => {
    expect(clearAll()).not.toBe(clearAll());
  });
});

describe("parseSelectedList", () => {
  it("keeps a saved known list", () => {
    expect(parseSelectedList("Blind 75")).toBe("Blind 75");
    expect(parseSelectedList("LeetCode 75")).toBe("LeetCode 75");
  });

  it("falls back to the default list when nothing valid is saved", () => {
    expect(DEFAULT_LIST).toBe("Blind 75");
    expect(parseSelectedList(null)).toBe(DEFAULT_LIST);
    expect(parseSelectedList("")).toBe(DEFAULT_LIST);
    expect(parseSelectedList("Some old list")).toBe(DEFAULT_LIST);
  });
});

describe("restoreEntry", () => {
  it("puts the saved entry back", () => {
    const before = solvedState()[LIST][1];
    const changed = unsolve(solvedState(), LIST, 1);
    const restored = restoreEntry(changed, LIST, 1, before);
    expect(restored[LIST][1]).toEqual(before);
  });

  it("removes the problem when it had no saved progress", () => {
    const moved = markSolved({ [LIST]: {} }, LIST, 5, "2026-10-01");
    const restored = restoreEntry(moved, LIST, 5, undefined);
    expect(restored[LIST]).toEqual({});
  });

  it("only changes that problem", () => {
    const state = solvedState();
    const other = markSolved(state, LIST, 2, "2026-10-02");
    const restored = restoreEntry(other, LIST, 1, undefined);
    expect(restored[LIST][2]).toBe(other[LIST][2]);
    expect(restored[OTHER]).toBe(state[OTHER]);
    expect(restored[LIST][1]).toBeUndefined();
  });

  it("works when the list has no progress yet", () => {
    const entry = { status: "todo", solved: false };
    expect(restoreEntry({}, LIST, 1, entry)[LIST][1]).toBe(entry);
    expect(restoreEntry({}, LIST, 1, undefined)[LIST]).toEqual({});
  });

  it("does not mutate the previous state", () => {
    const state = solvedState();
    restoreEntry(state, LIST, 1, undefined);
    expect(state[LIST][1]).toBeTruthy();
  });

  it("undoes a drop that solved and started the schedule", () => {
    const before = { [LIST]: {} };
    const after = markSolved(before, LIST, 3, "2026-10-01");
    expect(restoreEntry(after, LIST, 3, before[LIST][3])).toEqual(before);
  });
});

describe("setStatus and startedAt", () => {
  const entry = (state, id = 1) => state[LIST][id];

  it("saves when a problem was started", () => {
    const next = setStatus({}, LIST, 1, "in-progress", "2026-10-01", "2026-10-01T09:30:00.000Z");
    expect(entry(next).startedAt).toBe("2026-10-01T09:30:00.000Z");
  });

  it("uses today when no timestamp is given", () => {
    const next = setStatus({}, LIST, 1, "in-progress", "2026-10-01");
    expect(entry(next).startedAt).toBe("2026-10-01");
  });

  it("starts again with a new time after going back to todo", () => {
    let state = setStatus({}, LIST, 1, "in-progress", "2026-10-01", "2026-10-01T09:00:00.000Z");
    state = setStatus(state, LIST, 1, "todo", "2026-10-02", "2026-10-02T09:00:00.000Z");
    expect(entry(state).startedAt).toBeUndefined();
    state = setStatus(state, LIST, 1, "in-progress", "2026-10-03", "2026-10-03T09:00:00.000Z");
    expect(entry(state).startedAt).toBe("2026-10-03T09:00:00.000Z");
  });

  it("keeps the first start time when it is already in progress", () => {
    const started = setStatus({}, LIST, 1, "in-progress", "2026-10-01", "2026-10-01T09:00:00.000Z");
    const again = setStatus(started, LIST, 1, "in-progress", "2026-10-05", "2026-10-05T09:00:00.000Z");
    expect(again).toBe(started);
  });

  it("gets a new start time when a solved problem is moved back to in progress", () => {
    const next = setStatus(solvedState(), LIST, 1, "in-progress", "2026-10-09", "2026-10-09T10:00:00.000Z");
    expect(entry(next).startedAt).toBe("2026-10-09T10:00:00.000Z");
    expect(entry(next).solved).toBe(false);
  });

  it("does not add startedAt for other statuses", () => {
    expect(entry(setStatus({}, LIST, 1, "todo", "2026-10-01"))).not.toHaveProperty("startedAt");
    expect(entry(markSolved({}, LIST, 1, "2026-10-01"))).not.toHaveProperty("startedAt");
  });

  it("is restored by restoreEntry, so Undo brings the old position back", () => {
    const before = setStatus({}, LIST, 1, "in-progress", "2026-10-01", "2026-10-01T09:00:00.000Z");
    const moved = setStatus(before, LIST, 1, "todo", "2026-10-02");
    const restored = restoreEntry(moved, LIST, 1, entry(before));
    expect(entry(restored).startedAt).toBe("2026-10-01T09:00:00.000Z");
  });
});

describe("setOrder", () => {
  const inProgress = (state, id) =>
    setStatus(state, LIST, id, "in-progress", "2026-10-01", `2026-10-01T0${id}:00:00.000Z`);
  const three = () => inProgress(inProgress(inProgress({}, 1), 2), 3);

  it("gives each problem its position as order", () => {
    const next = setOrder(three(), LIST, [3, 1, 2]);
    expect(next[LIST][3].order).toBe(0);
    expect(next[LIST][1].order).toBe(1);
    expect(next[LIST][2].order).toBe(2);
  });

  it("keeps the rest of each entry", () => {
    const state = three();
    const next = setOrder(state, LIST, [2, 1, 3]);
    expect(next[LIST][2]).toEqual({ ...state[LIST][2], order: 0 });
  });

  it("skips ids that have no saved progress", () => {
    const next = setOrder(three(), LIST, [99, 1]);
    expect(next[LIST][99]).toBeUndefined();
    expect(next[LIST][1].order).toBe(1);
  });

  it("does not touch other problems or lists, or mutate the input", () => {
    const state = { ...three(), [OTHER]: { 7: { solved: false } } };
    const before = JSON.stringify(state);
    const next = setOrder(state, LIST, [2, 1]);
    expect(next[LIST][3]).toBe(state[LIST][3]);
    expect(next[OTHER]).toBe(state[OTHER]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("is dropped when the problem leaves In Progress and comes back", () => {
    let state = setOrder(three(), LIST, [3, 2, 1]);
    expect(state[LIST][3].order).toBe(0);
    state = setStatus(state, LIST, 3, "todo", "2026-10-02");
    expect(state[LIST][3]).not.toHaveProperty("order");
    state = setStatus(state, LIST, 3, "in-progress", "2026-10-03", "2026-10-03T09:00:00.000Z");
    expect(state[LIST][3]).not.toHaveProperty("order");
  });
});

describe("restoreEntries", () => {
  it("puts several entries back, including removing ones that did not exist", () => {
    const before = setOrder(
      setStatus(setStatus({}, LIST, 1, "in-progress", "2026-10-01"), LIST, 2, "in-progress", "2026-10-01"),
      LIST,
      [1, 2]
    );
    const changed = setOrder(before, LIST, [2, 1]);
    const restored = restoreEntries(changed, LIST, { 1: before[LIST][1], 2: before[LIST][2] });
    expect(restored).toEqual(before);

    const added = markSolved(before, LIST, 3, "2026-10-05");
    expect(restoreEntries(added, LIST, { 3: undefined })[LIST][3]).toBeUndefined();
  });

  it("does nothing with an empty snapshot", () => {
    const state = solvedState();
    expect(restoreEntries(state, LIST, {})).toBe(state);
  });
});

describe("setNote", () => {
  it("saves a note on a problem without touching the rest", () => {
    const start = solvedState();
    const next = setNote(start, LIST, 1, "Use a hash map");
    expect(next[LIST][1]).toEqual({ ...start[LIST][1], note: "Use a hash map" });
    expect(next[OTHER]).toBe(start[OTHER]);
  });

  it("creates an entry for a problem with no progress", () => {
    const next = setNote({ [LIST]: {} }, LIST, 5, "Sliding window");
    expect(next[LIST][5]).toEqual({
      status: "todo",
      solved: false,
      reviews: noReviews,
      dates: {},
      note: "Sliding window",
    });
  });

  it("replaces an older note", () => {
    const first = setNote(solvedState(), LIST, 1, "old");
    expect(setNote(first, LIST, 1, "new")[LIST][1].note).toBe("new");
  });

  it("removes the note when it is empty or only spaces", () => {
    const withNote = setNote(solvedState(), LIST, 1, "text");
    expect(setNote(withNote, LIST, 1, "")[LIST][1]).toEqual(solvedState()[LIST][1]);
    expect(setNote(withNote, LIST, 1, "  \n ")[LIST][1]).not.toHaveProperty("note");
  });

  it("creates nothing for an empty note on a problem with no progress", () => {
    const start = { [LIST]: {} };
    expect(setNote(start, LIST, 5, "")).toBe(start);
    expect(setNote(start, LIST, 5, "   ")).toBe(start);
  });

  it("returns the same object when nothing changes", () => {
    const withNote = setNote(solvedState(), LIST, 1, "text");
    expect(setNote(withNote, LIST, 1, "text")).toBe(withNote);
    const start = solvedState();
    expect(setNote(start, LIST, 1, "")).toBe(start);
  });

  it("ignores a note that is not text", () => {
    const start = solvedState();
    expect(setNote(start, LIST, 1, null)).toBe(start);
    expect(setNote(start, LIST, 1, 42)).toBe(start);
  });

  it("keeps the exact text, including line breaks", () => {
    const text = "Idea:\n- sort first\n- two pointers ";
    expect(setNote(solvedState(), LIST, 1, text)[LIST][1].note).toBe(text);
  });

  it("does not change a problem in another list", () => {
    const next = setNote(solvedState(), LIST, 7, "same id, other list");
    expect(next[OTHER][7]).not.toHaveProperty("note");
  });

  it("survives unsolving, changing status and undoing a review", () => {
    let state = setNote(solvedState(), LIST, 1, "keep me");
    state = uncompleteReview(state, LIST, 1, 1);
    expect(state[LIST][1].note).toBe("keep me");
    state = unsolve(state, LIST, 1);
    expect(state[LIST][1].note).toBe("keep me");
    state = setStatus(state, LIST, 1, "in-progress", "2026-10-10");
    expect(state[LIST][1].note).toBe("keep me");
    state = markSolved(state, LIST, 1, "2026-10-11");
    expect(state[LIST][1].note).toBe("keep me");
  });

  it("is restored by Undo together with the entry", () => {
    const before = setNote(solvedState(), LIST, 1, "kept")[LIST][1];
    const moved = setStatus(setNote(solvedState(), LIST, 1, "kept"), LIST, 1, "todo", "2026-10-10");
    expect(restoreEntry(moved, LIST, 1, before)[LIST][1].note).toBe("kept");
  });
});

describe("rewindReviews", () => {
  const threeDone = () => ({
    [LIST]: {
      1: {
        status: "solved",
        solved: true,
        solvedDate: "2026-10-01",
        reviews: [true, true, true, false, false],
        dates: {
          initial: "2026-10-01",
          review1: "2026-10-02",
          review2: "2026-10-05",
          review3: "2026-10-12",
        },
      },
    },
  });

  it("erases the review and the later ones with their dates", () => {
    const next = rewindReviews(threeDone(), LIST, 1, 1);
    expect(next[LIST][1].reviews).toEqual([true, false, false, false, false]);
    expect(next[LIST][1].dates).toEqual({
      initial: "2026-10-01",
      review1: "2026-10-02",
    });
  });

  it("goes back to the first review and keeps the solved date", () => {
    const next = rewindReviews(threeDone(), LIST, 1, 0);
    expect(next[LIST][1].reviews).toEqual(noReviews);
    expect(next[LIST][1].dates).toEqual({ initial: "2026-10-01" });
    expect(next[LIST][1].solvedDate).toBe("2026-10-01");
    expect(next[LIST][1].solved).toBe(true);
  });

  it("going back one review is the same as undoing the last one", () => {
    const start = threeDone();
    expect(rewindReviews(start, LIST, 1, 2)).toEqual(uncompleteReview(start, LIST, 1, 2));
  });

  it("does nothing for a review that is not done, or a bad index", () => {
    const start = threeDone();
    expect(rewindReviews(start, LIST, 1, 3)).toBe(start);
    expect(rewindReviews(start, LIST, 1, -1)).toBe(start);
    expect(rewindReviews(start, LIST, 1, 9)).toBe(start);
    expect(rewindReviews(start, LIST, 99, 0)).toBe(start);
  });

  it("keeps the note, the other problems and the other lists", () => {
    const start = threeDone();
    start[LIST][1].note = "remember";
    start[LIST][2] = { solved: false, reviews: noReviews, dates: {} };
    start[OTHER] = { 7: { solved: true, reviews: [true, false, false, false, false], dates: {} } };
    const next = rewindReviews(start, LIST, 1, 0);
    expect(next[LIST][1].note).toBe("remember");
    expect(next[LIST][2]).toBe(start[LIST][2]);
    expect(next[OTHER]).toBe(start[OTHER]);
  });
});

describe("recordAttempt", () => {
  const attempt = (review, help, date = "2026-10-06") => ({ date, review, help });

  it("adds an attempt with its date to a solved problem", () => {
    const start = solvedState();
    const next = recordAttempt(start, LIST, 1, 2, 1, "2026-10-06");
    expect(next[LIST][1].attempts).toEqual([attempt(2, 1)]);
    expect(next[LIST][1].reviews).toBe(start[LIST][1].reviews);
    expect(next[OTHER]).toBe(start[OTHER]);
  });

  it("keeps the attempts in order", () => {
    let state = recordAttempt(solvedState(), LIST, 1, 2, 1, "2026-10-06");
    state = recordAttempt(state, LIST, 1, 2, 0, "2026-10-08");
    expect(state[LIST][1].attempts).toEqual([
      attempt(2, 1, "2026-10-06"),
      attempt(2, 0, "2026-10-08"),
    ]);
  });

  it("does nothing for a problem that is not solved or has no entry", () => {
    const todo = { [LIST]: { 1: { status: "todo", solved: false, reviews: noReviews, dates: {} } } };
    expect(recordAttempt(todo, LIST, 1, 0, 0, "2026-10-06")).toBe(todo);
    expect(recordAttempt(todo, LIST, 99, 0, 0, "2026-10-06")).toBe(todo);
  });

  it("ignores an invalid review or help level", () => {
    const start = solvedState();
    for (const [review, help] of [[-1, 0], [5, 0], [1.5, 0], ["1", 0], [1, 3], [1, -1], [1, "0"], [1, undefined]]) {
      expect(recordAttempt(start, LIST, 1, review, help, "2026-10-06")).toBe(start);
    }
  });

  it("starts a new list when the saved value is not a list", () => {
    const start = solvedState();
    start[LIST][1].attempts = "broken";
    expect(recordAttempt(start, LIST, 1, 0, 0, "2026-10-06")[LIST][1].attempts).toEqual([attempt(0, 0)]);
  });

  it("is never erased by undoing, rewinding, unsolving or moving the problem", () => {
    let state = recordAttempt(solvedState(), LIST, 1, 1, 0, "2026-10-05");
    const history = state[LIST][1].attempts;
    state = uncompleteReview(state, LIST, 1, 1);
    expect(state[LIST][1].attempts).toBe(history);
    state = completeReview(state, LIST, 1, 1, "2026-10-06");
    state = rewindReviews(state, LIST, 1, 0);
    expect(state[LIST][1].attempts).toBe(history);
    state = unsolve(state, LIST, 1);
    expect(state[LIST][1].attempts).toBe(history);
    state = setStatus(state, LIST, 1, "in-progress", "2026-10-10");
    expect(state[LIST][1].attempts).toBe(history);
    state = markSolved(state, LIST, 1, "2026-10-11");
    expect(state[LIST][1].attempts).toBe(history);
  });

  it("is brought back by Undo together with the entry", () => {
    const before = solvedState()[LIST][1];
    const after = recordAttempt(solvedState(), LIST, 1, 2, 1, "2026-10-06");
    expect(restoreEntry(after, LIST, 1, before)[LIST][1]).not.toHaveProperty("attempts");
  });

  it("is cleared only by Clear all", () => {
    const state = recordAttempt(solvedState(), LIST, 1, 2, 1, "2026-10-06");
    expect(clearAll()[LIST]).toEqual({});
    expect(state[LIST][1].attempts).toHaveLength(1);
  });
});

describe("a chosen due date (dueOverride) follows its review", () => {
  const withOverride = (reviews, review) => ({
    [LIST]: {
      1: {
        status: "solved",
        solved: true,
        solvedDate: "2026-10-01",
        reviews,
        dates: { initial: "2026-10-01", review1: "2026-10-02" },
        dueOverride: { review, date: "2026-10-09" },
        note: "keep",
      },
    },
  });
  const R1done = [true, false, false, false, false];

  it("is dropped when the review it names is completed", () => {
    const next = completeReview(withOverride(R1done, 1), LIST, 1, 1, "2026-10-07");
    expect(next[LIST][1]).not.toHaveProperty("dueOverride");
    expect(next[LIST][1].reviews).toEqual([true, true, false, false, false]);
  });

  it("is dropped when a review is undone or the problem goes back", () => {
    const two = [true, true, false, false, false];
    expect(uncompleteReview(withOverride(two, 2), LIST, 1, 1)[LIST][1]).not.toHaveProperty("dueOverride");
    expect(rewindReviews(withOverride(two, 2), LIST, 1, 0)[LIST][1]).not.toHaveProperty("dueOverride");
  });

  it("is dropped when the problem is unsolved", () => {
    expect(unsolve(withOverride(R1done, 1), LIST, 1)[LIST][1]).not.toHaveProperty("dueOverride");
  });

  it("does not come back on a review later rewound to", () => {
    let state = completeReview(withOverride(R1done, 1), LIST, 1, 1, "2026-10-07");
    state = rewindReviews(state, LIST, 1, 1);
    expect(state[LIST][1]).not.toHaveProperty("dueOverride");
  });

  it("changing the note or the attempts keeps it", () => {
    let state = setNote(withOverride(R1done, 1), LIST, 1, "new note");
    state = recordAttempt(state, LIST, 1, 1, 1, "2026-10-07");
    expect(state[LIST][1].dueOverride).toEqual({ review: 1, date: "2026-10-09" });
  });

  it("the other fields of the entry stay", () => {
    const next = completeReview(withOverride(R1done, 1), LIST, 1, 1, "2026-10-07");
    expect(next[LIST][1].note).toBe("keep");
    expect(next[LIST][1].solvedDate).toBe("2026-10-01");
  });
});

describe("setDueOverride", () => {
  const solved2 = () => ({
    [LIST]: {
      1: {
        status: "solved",
        solved: true,
        solvedDate: "2026-10-01",
        reviews: [true, true, false, false, false],
        dates: { initial: "2026-10-01", review1: "2026-10-02", review2: "2026-10-04" },
      },
    },
  });

  it("sets the date of a pending review", () => {
    const next = setDueOverride(solved2(), LIST, 1, 2, "2026-10-06");
    expect(next[LIST][1].dueOverride).toEqual({ review: 2, date: "2026-10-06" });
    expect(getSchedule(next[LIST][1])[2]).toBe("2026-10-06");
  });

  it("replaces an earlier choice", () => {
    let state = setDueOverride(solved2(), LIST, 1, 2, "2026-10-06");
    state = setDueOverride(state, LIST, 1, 3, "2026-10-20");
    expect(state[LIST][1].dueOverride).toEqual({ review: 3, date: "2026-10-20" });
  });

  it("does nothing for a review that is done, a bad index, a bad date or an unsolved problem", () => {
    const start = solved2();
    expect(setDueOverride(start, LIST, 1, 1, "2026-10-06")).toBe(start);
    expect(setDueOverride(start, LIST, 1, 5, "2026-10-06")).toBe(start);
    expect(setDueOverride(start, LIST, 1, -1, "2026-10-06")).toBe(start);
    expect(setDueOverride(start, LIST, 1, 2, "2026-02-30")).toBe(start);
    expect(setDueOverride(start, LIST, 1, 2, undefined)).toBe(start);
    expect(setDueOverride(start, LIST, 99, 2, "2026-10-06")).toBe(start);
    const todo = { [LIST]: { 1: { status: "todo", solved: false, reviews: noReviews, dates: {} } } };
    expect(setDueOverride(todo, LIST, 1, 0, "2026-10-06")).toBe(todo);
  });
});

describe("completeReviewWithHelp", () => {
  // Solved on 2026-10-01 with the first `done` reviews completed on time:
  // R1 10-02, R2 10-04, R3 10-08, R4 10-15, R5 10-31
  const DUE = ["2026-10-02", "2026-10-04", "2026-10-08", "2026-10-15", "2026-10-31"];
  const after = (done) => ({
    [LIST]: {
      1: {
        status: "solved",
        solved: true,
        solvedDate: "2026-10-01",
        reviews: noReviews.map((_, i) => i < done),
        dates: {
          initial: "2026-10-01",
          ...Object.fromEntries(DUE.slice(0, done).map((d, i) => [`review${i + 1}`, d])),
        },
        note: "keep",
      },
    },
  });
  const TODAY = "2026-10-20"; // late for every review: the date rules show clearly
  const entry = (state) => state[LIST][1];
  const pendingReview = (state) => entry(state).reviews.indexOf(false); // 0-based, -1 none
  const dueOf = (state, i) => getSchedule(entry(state))[i];

  describe("solved alone", () => {
    it.each([0, 1, 2, 3, 4])("at R%i-index completes it like completeReview", (index) => {
      const next = completeReviewWithHelp(after(index), LIST, 1, index, HELP.ALONE, TODAY);
      const plain = completeReview(after(index), LIST, 1, index, TODAY);
      const { attempts, ...rest } = entry(next);
      expect(rest).toEqual(entry(plain));
      expect(attempts).toEqual([{ date: TODAY, review: index, help: 0 }]);
    });

    it("completing R5 leaves no review pending", () => {
      const next = completeReviewWithHelp(after(4), LIST, 1, 4, HELP.ALONE, TODAY);
      expect(pendingReview(next)).toBe(-1);
    });
  });

  describe("needed the note", () => {
    it.each([0, 1, 2, 3, 4])("at index %i repeats the same review in 2 days", (index) => {
      const next = completeReviewWithHelp(after(index), LIST, 1, index, HELP.NOTE, TODAY);
      expect(pendingReview(next)).toBe(index);
      expect(entry(next).reviews).toEqual(after(index)[LIST][1].reviews);
      expect(dueOf(next, index)).toBe("2026-10-22");
      expect(entry(next).attempts).toEqual([{ date: TODAY, review: index, help: 1 }]);
    });

    it("moves the later reviews after the repeated one", () => {
      const next = completeReviewWithHelp(after(2), LIST, 1, 2, HELP.NOTE, TODAY);
      // R3 10-22, R4 = +7, R5 = +16
      expect(getSchedule(entry(next)).slice(2)).toEqual(["2026-10-22", "2026-10-29", "2026-11-14"]);
    });

    it("keeps the dates of the reviews already done", () => {
      const next = completeReviewWithHelp(after(3), LIST, 1, 3, HELP.NOTE, TODAY);
      expect(entry(next).dates).toEqual(after(3)[LIST][1].dates);
    });
  });

  describe("needed the solution", () => {
    it("at R4 goes back to R3, due in R3's gap (4 days) from today", () => {
      const next = completeReviewWithHelp(after(3), LIST, 1, 3, HELP.SOLUTION, TODAY);
      expect(pendingReview(next)).toBe(2);
      expect(dueOf(next, 2)).toBe("2026-10-24");
      expect(entry(next).dates.review3).toBeUndefined();
      expect(entry(next).dates.review2).toBe("2026-10-04");
    });

    it("at R3 goes back to R2 in 2 days", () => {
      const next = completeReviewWithHelp(after(2), LIST, 1, 2, HELP.SOLUTION, TODAY);
      expect(pendingReview(next)).toBe(1);
      expect(dueOf(next, 1)).toBe("2026-10-22");
    });

    it("at R2 goes back to R1 in 1 day", () => {
      const next = completeReviewWithHelp(after(1), LIST, 1, 1, HELP.SOLUTION, TODAY);
      expect(pendingReview(next)).toBe(0);
      expect(dueOf(next, 0)).toBe("2026-10-21");
    });

    it("at R1 stays at R1, due tomorrow", () => {
      const next = completeReviewWithHelp(after(0), LIST, 1, 0, HELP.SOLUTION, TODAY);
      expect(pendingReview(next)).toBe(0);
      expect(dueOf(next, 0)).toBe("2026-10-21");
    });

    it("at R5 goes back to R4 in 7 days and is not mastered", () => {
      const next = completeReviewWithHelp(after(4), LIST, 1, 4, HELP.SOLUTION, TODAY);
      expect(pendingReview(next)).toBe(3);
      expect(dueOf(next, 3)).toBe("2026-10-27");
    });

    it("is one step back, not a reset: earlier reviews and the solved date stay", () => {
      const next = completeReviewWithHelp(after(3), LIST, 1, 3, HELP.SOLUTION, TODAY);
      expect(entry(next).reviews).toEqual([true, true, false, false, false]);
      expect(entry(next).solved).toBe(true);
      expect(entry(next).solvedDate).toBe("2026-10-01");
    });

    it.each([0, 1, 2, 3, 4])("at index %i writes the attempt for the review that was tried", (index) => {
      const next = completeReviewWithHelp(after(index), LIST, 1, index, HELP.SOLUTION, TODAY);
      expect(entry(next).attempts).toEqual([{ date: TODAY, review: index, help: 2 }]);
    });
  });

  describe("after the outcome", () => {
    it("the repeated review can be done alone and then the schedule goes on", () => {
      let state = completeReviewWithHelp(after(2), LIST, 1, 2, HELP.NOTE, TODAY);
      state = completeReviewWithHelp(state, LIST, 1, 2, HELP.ALONE, "2026-10-22");
      expect(entry(state).reviews).toEqual([true, true, true, false, false]);
      expect(entry(state)).not.toHaveProperty("dueOverride");
      expect(dueOf(state, 3)).toBe("2026-10-29"); // 10-22 + 7
      expect(entry(state).attempts.map((a) => a.help)).toEqual([1, 0]);
    });

    it("after a step back, the review before it must be done first", () => {
      let state = completeReviewWithHelp(after(3), LIST, 1, 3, HELP.SOLUTION, TODAY);
      expect(completeReviewWithHelp(state, LIST, 1, 3, HELP.ALONE, TODAY)).toBe(state);
      state = completeReviewWithHelp(state, LIST, 1, 2, HELP.ALONE, "2026-10-24");
      expect(pendingReview(state)).toBe(3);
      expect(dueOf(state, 3)).toBe("2026-10-31"); // 10-24 + 7
    });

    it("the history grows with every attempt and is never erased by a step back", () => {
      let state = completeReviewWithHelp(after(3), LIST, 1, 3, HELP.SOLUTION, TODAY);
      state = completeReviewWithHelp(state, LIST, 1, 2, HELP.ALONE, "2026-10-24");
      expect(entry(state).attempts).toEqual([
        { date: TODAY, review: 3, help: 2 },
        { date: "2026-10-24", review: 2, help: 0 },
      ]);
    });

    it("keeps the note", () => {
      for (const help of [0, 1, 2]) {
        expect(entry(completeReviewWithHelp(after(2), LIST, 1, 2, help, TODAY)).note).toBe("keep");
      }
    });
  });

  describe("what is not allowed", () => {
    it("does nothing for a review that cannot be completed yet", () => {
      const start = after(1);
      for (const help of [0, 1, 2]) {
        expect(completeReviewWithHelp(start, LIST, 1, 3, help, TODAY)).toBe(start);
        expect(completeReviewWithHelp(start, LIST, 1, 0, help, TODAY)).toBe(start); // done
      }
    });

    it("does nothing for an unknown help level or a bad review", () => {
      const start = after(1);
      expect(completeReviewWithHelp(start, LIST, 1, 1, 3, TODAY)).toBe(start);
      expect(completeReviewWithHelp(start, LIST, 1, 1, undefined, TODAY)).toBe(start);
      expect(completeReviewWithHelp(start, LIST, 1, 9, HELP.ALONE, TODAY)).toBe(start);
    });

    it("does nothing for a problem that is not solved or does not exist", () => {
      const todo = { [LIST]: { 1: { status: "todo", solved: false, reviews: noReviews, dates: {} } } };
      expect(completeReviewWithHelp(todo, LIST, 1, 0, HELP.ALONE, TODAY)).toBe(todo);
      expect(completeReviewWithHelp(todo, LIST, 99, 0, HELP.NOTE, TODAY)).toBe(todo);
    });

    it("does not change other problems or lists", () => {
      const start = after(2);
      start[LIST][2] = { solved: false, reviews: noReviews, dates: {} };
      start[OTHER] = { 7: { solved: true, solvedDate: "2026-09-01", reviews: noReviews, dates: {} } };
      const next = completeReviewWithHelp(start, LIST, 1, 2, HELP.SOLUTION, TODAY);
      expect(next[LIST][2]).toBe(start[LIST][2]);
      expect(next[OTHER]).toBe(start[OTHER]);
    });
  });

  it("is brought back by Undo together with the entry", () => {
    const before = after(2)[LIST][1];
    const done = completeReviewWithHelp(after(2), LIST, 1, 2, HELP.SOLUTION, TODAY);
    expect(restoreEntry(done, LIST, 1, before)[LIST][1]).toEqual(before);
  });
});

describe("markHelpViewed", () => {
  it("remembers the day the note was opened, without touching anything else", () => {
    const start = solvedState();
    const next = markHelpViewed(start, LIST, 1, "note", "2026-10-06");
    expect(next[LIST][1].helpViewed).toEqual({ note: "2026-10-06" });
    expect(next[LIST][1].reviews).toBe(start[LIST][1].reviews);
    expect(next[OTHER]).toBe(start[OTHER]);
  });

  it("keeps the other kind and updates the day", () => {
    let state = markHelpViewed(solvedState(), LIST, 1, "note", "2026-10-06");
    state = markHelpViewed(state, LIST, 1, "solution", "2026-10-06");
    state = markHelpViewed(state, LIST, 1, "note", "2026-10-08");
    expect(state[LIST][1].helpViewed).toEqual({ note: "2026-10-08", solution: "2026-10-06" });
  });

  it("returns the same object when that day is already saved", () => {
    const once = markHelpViewed(solvedState(), LIST, 1, "note", "2026-10-06");
    expect(markHelpViewed(once, LIST, 1, "note", "2026-10-06")).toBe(once);
  });

  it("does nothing for a problem that is not solved, has no entry, or an unknown kind", () => {
    const todo = { [LIST]: { 1: { status: "todo", solved: false, reviews: noReviews, dates: {} } } };
    expect(markHelpViewed(todo, LIST, 1, "note", "2026-10-06")).toBe(todo);
    expect(markHelpViewed(todo, LIST, 99, "note", "2026-10-06")).toBe(todo);
    const start = solvedState();
    expect(markHelpViewed(start, LIST, 1, "video", "2026-10-06")).toBe(start);
  });

  it("does not change the calendar or the history", () => {
    const start = solvedState();
    const next = markHelpViewed(start, LIST, 1, "solution", "2026-10-06");
    const { helpViewed, ...rest } = next[LIST][1];
    void helpViewed;
    expect(rest).toEqual(start[LIST][1]);
  });

  it("is cleared by any review outcome, so the question is asked once", () => {
    for (const help of [0, 1, 2]) {
      const viewed = markHelpViewed(solvedState(), LIST, 1, "note", "2026-10-06");
      const next = completeReviewWithHelp(viewed, LIST, 1, 2, help, "2026-10-06");
      expect(next[LIST][1]).not.toHaveProperty("helpViewed");
    }
  });

  it("is kept when an outcome is refused", () => {
    const viewed = markHelpViewed(solvedState(), LIST, 1, "note", "2026-10-06");
    expect(completeReviewWithHelp(viewed, LIST, 1, 4, 0, "2026-10-06")).toBe(viewed);
  });
});
