import { describe, expect, it } from "vitest";
import { HELP } from "./attempts";
import { OUTCOME_LABELS, outcomeOptions, previewOutcome } from "./outcomes";

// Solved on 2026-10-01 with the first `done` reviews done on time
// (R1 10-02, R2 10-04, R3 10-08, R4 10-15, R5 10-31)
const DUE = ["2026-10-02", "2026-10-04", "2026-10-08", "2026-10-15", "2026-10-31"];
const after = (done) => ({
  status: "solved",
  solved: true,
  solvedDate: "2026-10-01",
  reviews: [0, 1, 2, 3, 4].map((i) => i < done),
  dates: {
    initial: "2026-10-01",
    ...Object.fromEntries(DUE.slice(0, done).map((d, i) => [`review${i + 1}`, d])),
  },
});
const TODAY = "2026-10-20";
const detail = (done, help) =>
  outcomeOptions(after(done), done, TODAY).find((o) => o.help === help).detail;

describe("outcomeOptions", () => {
  it("offers the three choices in order, with their names", () => {
    const options = outcomeOptions(after(2), 2, TODAY);
    expect(options.map((o) => o.help)).toEqual([0, 1, 2]);
    expect(options.map((o) => o.label)).toEqual([
      "Solved it myself",
      "Needed the note",
      "Needed the solution",
    ]);
    expect(OUTCOME_LABELS[HELP.NOTE]).toBe("Needed the note");
  });

  it("shows the consequences with real dates (R3, today 10-20)", () => {
    // alone: R4 is counted from today (R3 was late): +7
    expect(detail(2, HELP.ALONE)).toBe("Next review: R4 in 7 days (Oct 27)");
    expect(detail(2, HELP.NOTE)).toBe("Repeat R3 in 2 days (Oct 22)");
    expect(detail(2, HELP.SOLUTION)).toBe("Back to R2 in 2 days (Oct 22)");
  });

  it("R4: the solution goes back to R3 in 4 days", () => {
    expect(detail(3, HELP.SOLUTION)).toBe("Back to R3 in 4 days (Oct 24)");
    expect(detail(3, HELP.NOTE)).toBe("Repeat R4 in 2 days (Oct 22)");
    expect(detail(3, HELP.ALONE)).toBe("Next review: R5 in 16 days (Nov 5)");
  });

  it("R1: the solution has nothing before it, so R1 comes back tomorrow", () => {
    expect(detail(0, HELP.SOLUTION)).toBe("R1 again tomorrow (Oct 21)");
    expect(detail(0, HELP.NOTE)).toBe("Repeat R1 in 2 days (Oct 22)");
    expect(detail(0, HELP.ALONE)).toBe("Next review: R2 in 2 days (Oct 22)");
  });

  it("R5: alone means mastered; help does not", () => {
    expect(detail(4, HELP.ALONE)).toBe("Mastered: all reviews done");
    expect(detail(4, HELP.NOTE)).toBe("Repeat R5 in 2 days (Oct 22)");
    expect(detail(4, HELP.SOLUTION)).toBe("Back to R4 in 7 days (Oct 27)");
  });

  it("says tomorrow for one day and in N days otherwise", () => {
    expect(detail(1, HELP.SOLUTION)).toBe("Back to R1 tomorrow (Oct 21)");
    expect(detail(1, HELP.NOTE)).toBe("Repeat R2 in 2 days (Oct 22)");
  });

  it("gives a short message for after the choice", () => {
    const [alone, note, solution] = outcomeOptions(after(2), 2, TODAY);
    expect(alone.message).toBe("Completed R3");
    expect(note.message).toBe("R3 again in 2 days");
    expect(solution.message).toBe("Back to R2 in 2 days");
    expect(outcomeOptions(after(0), 0, TODAY)[2].message).toBe("R1 again tomorrow");
    expect(outcomeOptions(after(4), 4, TODAY)[0].message).toBe("Completed R5");
  });

  it("is empty when the review cannot be completed", () => {
    expect(outcomeOptions(after(1), 3, TODAY)).toEqual([]); // R2 is next, not R4
    expect(outcomeOptions(after(1), 0, TODAY)).toEqual([]); // R1 is done
    expect(outcomeOptions({ solved: false, reviews: [] }, 0, TODAY)).toEqual([]);
    expect(outcomeOptions(undefined, 0, TODAY)).toEqual([]);
  });
});

describe("previewOutcome", () => {
  it("reports the next pending review with its date and distance", () => {
    expect(previewOutcome(after(2), 2, HELP.NOTE, TODAY)).toEqual({
      mastered: false,
      review: 2,
      due: "2026-10-22",
      days: 2,
    });
  });

  it("reports mastered after R5 alone", () => {
    expect(previewOutcome(after(4), 4, HELP.ALONE, TODAY)).toEqual({ mastered: true });
  });

  it("does not change the entry it is given", () => {
    const entry = after(2);
    const copy = JSON.parse(JSON.stringify(entry));
    previewOutcome(entry, 2, HELP.SOLUTION, TODAY);
    previewOutcome(entry, 2, HELP.NOTE, TODAY);
    expect(entry).toEqual(copy);
  });

  it("uses the real date when the review is late", () => {
    // R3 was due 10-08 and is completed 10-20 alone: R4 is 7 days after today
    expect(previewOutcome(after(2), 2, HELP.ALONE, TODAY).due).toBe("2026-10-27");
  });

  it("matches what the real action does", () => {
    // the dialog must show what will happen: compare with the reducer result
    const preview = previewOutcome(after(3), 3, HELP.SOLUTION, TODAY);
    expect(preview.review).toBe(2);
    expect(preview.due).toBe("2026-10-24");
  });
});
