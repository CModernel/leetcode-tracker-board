import { describe, expect, it } from "vitest";
import { rewindConfirm } from "./rewind";

const solved = (reviews) => ({ solved: true, reviews });

describe("rewindConfirm", () => {
  it("does not ask when only one review is erased", () => {
    expect(rewindConfirm(solved([true, true, false, false, false]), 1)).toBeNull();
    expect(rewindConfirm(solved([true, false, false, false, false]), 0)).toBeNull();
  });

  it("does not ask when nothing is erased", () => {
    expect(rewindConfirm(solved([true, false, false, false, false]), 3)).toBeNull();
    expect(rewindConfirm(undefined, 0)).toBeNull();
  });

  it("names the reviews that will be erased", () => {
    const entry = solved([true, true, true, true, false]);
    expect(rewindConfirm(entry, 2)).toEqual({
      title: "Go back to R3?",
      message: "R3 and R4 and their dates will be erased.",
      confirmLabel: "Go back",
    });
    expect(rewindConfirm(entry, 0).message).toBe(
      "R1, R2, R3 and R4 and their dates will be erased."
    );
  });

  it("lists five reviews", () => {
    expect(rewindConfirm(solved([true, true, true, true, true]), 0).message).toBe(
      "R1, R2, R3, R4 and R5 and their dates will be erased."
    );
  });
});
