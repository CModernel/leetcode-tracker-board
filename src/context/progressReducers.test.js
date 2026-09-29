import { describe, expect, it } from "vitest";
import {
  completeReview,
  markSolved,
  uncompleteReview,
  unsolve,
} from "./progressReducers";

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

describe("unsolve", () => {
  it("wipes reviews, dates and the solved date", () => {
    const next = unsolve(solvedState(), LIST, 1);
    expect(next[LIST][1]).toEqual({
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

  it("allows completing reviews out of order", () => {
    const state = markSolved({}, LIST, 1, "2026-10-01");
    const next = completeReview(state, LIST, 1, 3, "2026-10-04");
    expect(next[LIST][1].reviews).toEqual([false, false, false, true, false]);
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

  it("keeps the problem solved", () => {
    const next = uncompleteReview(solvedState(), LIST, 1, 0);
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
