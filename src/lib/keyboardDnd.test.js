import { describe, expect, it } from "vitest";
import { DRAG_INSTRUCTIONS, dragAnnouncements, moveToColumn } from "./keyboardDnd";

// Four columns 200 wide, 16 apart, starting at x = 0.
const rect = (index) => ({ left: index * 216, top: 100, width: 200, height: 600 });
const columns = [
  { id: "todo", rect: rect(0) },
  { id: "in-progress", rect: rect(1) },
  { id: "reviewing", rect: rect(2) },
  { id: "mastered", rect: rect(3) },
];
// A card 180 wide sitting in a given column
const cardIn = (index) => ({
  left: index * 216 + 10,
  top: 300,
  width: 180,
  height: 90,
});

describe("moveToColumn", () => {
  it("moves right to the next column, centered, near its top", () => {
    const to = moveToColumn(1, cardIn(0), columns);
    expect(to).toEqual({ x: 216 + 10, y: 108 });
  });

  it("moves left to the previous column", () => {
    const to = moveToColumn(-1, cardIn(2), columns);
    expect(to).toEqual({ x: 216 + 10, y: 108 });
  });

  it("does nothing past the first or last column", () => {
    expect(moveToColumn(-1, cardIn(0), columns)).toBeUndefined();
    expect(moveToColumn(1, cardIn(3), columns)).toBeUndefined();
  });

  it("works with the columns in any order", () => {
    const shuffled = [columns[2], columns[0], columns[3], columns[1]];
    expect(moveToColumn(1, cardIn(1), shuffled)).toEqual({ x: 2 * 216 + 10, y: 108 });
  });

  it("picks the closest column when the card is between two", () => {
    const between = { left: 100, top: 300, width: 180, height: 90 }; // center 190: nearer column 0
    expect(moveToColumn(1, between, columns).x).toBe(216 + 10);
    const nearer1 = { left: 200, top: 300, width: 180, height: 90 }; // center 290 -> column 1
    expect(moveToColumn(1, nearer1, columns).x).toBe(2 * 216 + 10);
  });

  it("ignores other directions and no columns", () => {
    expect(moveToColumn(0, cardIn(0), columns)).toBeUndefined();
    expect(moveToColumn(2, cardIn(0), columns)).toBeUndefined();
    expect(moveToColumn(1, cardIn(0), [])).toBeUndefined();
  });

  it("reaches every column one step at a time", () => {
    let card = cardIn(0);
    const visited = [];
    for (let i = 0; i < 3; i++) {
      const to = moveToColumn(1, card, columns);
      visited.push(to.x);
      card = { ...card, left: to.x, top: to.y };
    }
    expect(visited).toEqual([226, 442, 658]);
  });
});

describe("dragAnnouncements", () => {
  const titles = { 1: "Two Sum" };
  const columnNames = { todo: "To Do", reviewing: "Reviewing" };
  const say = dragAnnouncements((id) => titles[id], (id) => columnNames[id]);
  const active = { id: 1 };

  it("uses titles, not ids", () => {
    expect(say.onDragStart({ active })).toBe("Picked up Two Sum.");
    expect(say.onDragOver({ active, over: { id: "reviewing" } })).toBe(
      "Two Sum is over Reviewing."
    );
    expect(say.onDragEnd({ active, over: { id: "todo" } })).toBe(
      "Dropped Two Sum on To Do."
    );
    expect(say.onDragCancel({ active })).toBe("Moving Two Sum was cancelled.");
  });

  it("says so when the card is not over a column", () => {
    expect(say.onDragOver({ active, over: null })).toBe("Two Sum is not over a column.");
    expect(say.onDragEnd({ active, over: null })).toBe(
      "Two Sum was dropped outside the columns."
    );
  });

  it("has instructions that mention the keys", () => {
    for (const key of ["space", "arrow", "escape"]) {
      expect(DRAG_INSTRUCTIONS.toLowerCase()).toContain(key);
    }
  });
});
