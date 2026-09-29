import { describe, expect, it } from "vitest";
import { COLUMNS } from "./board";

describe("COLUMNS", () => {
  it("has the four columns in order, each with an id and a title", () => {
    expect(COLUMNS.map((c) => c.id)).toEqual([
      "todo",
      "in-progress",
      "reviewing",
      "mastered",
    ]);
    for (const column of COLUMNS) expect(column.title).toBeTruthy();
  });

  it("has unique ids", () => {
    expect(new Set(COLUMNS.map((c) => c.id)).size).toBe(COLUMNS.length);
  });
});
