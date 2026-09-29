import { describe, expect, it } from "vitest";
import { STATUSES, getStatus, isStatus } from "./status";

describe("isStatus", () => {
  it("accepts the three statuses only", () => {
    expect(STATUSES).toEqual(["todo", "in-progress", "solved"]);
    for (const status of STATUSES) expect(isStatus(status)).toBe(true);
    for (const bad of ["done", "", null, undefined, 1]) {
      expect(isStatus(bad)).toBe(false);
    }
  });
});

describe("getStatus", () => {
  it("returns the saved status when it is valid", () => {
    expect(getStatus({ status: "in-progress", solved: false })).toBe("in-progress");
  });

  it("falls back to solved or todo for entries without a status", () => {
    expect(getStatus({ solved: true })).toBe("solved");
    expect(getStatus({ solved: false })).toBe("todo");
    expect(getStatus({})).toBe("todo");
    expect(getStatus(undefined)).toBe("todo");
  });

  it("ignores an invalid status", () => {
    expect(getStatus({ status: "done", solved: true })).toBe("solved");
  });
});
