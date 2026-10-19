// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import { TimerSettingsProvider } from "../context/TimerSettingsProvider";
import LeetCodeTracker from "./LeetCodeTracker";
import BoardPage from "./BoardPage";

vi.setConfig({ testTimeout: 20000 });

// Two Sum is In Progress, Contains Duplicate is To Do. Today is 2026-10-20.
const KEY = "leetcode-progress-v3";
const working = (extra = {}) => ({
  status: "in-progress",
  solved: false,
  reviews: [false, false, false, false, false],
  dates: {},
  ...extra,
});
const todo = () => ({ status: "todo", solved: false, reviews: [false, false, false, false, false], dates: {} });
const seed = (entries = { "blind75-1": working(), "blind75-2": todo() }) =>
  localStorage.setItem(KEY, JSON.stringify({ version: 3, progress: { "Blind 75": entries } }));
const saved = (id = "blind75-1") => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"][id];

const renderBoth = () => {
  render(
    <ThemeProvider>
      <TimerSettingsProvider>
        <ProgressProvider>
          <ConfirmProvider>
            <div data-testid="tracker">
              <LeetCodeTracker />
            </div>
            <div data-testid="board">
              <BoardPage />
            </div>
          </ConfirmProvider>
        </ProgressProvider>
      </TimerSettingsProvider>
    </ThemeProvider>,
  );
  const tracker = () => within(screen.getByTestId("tracker"));
  const board = () => within(screen.getByTestId("board"));
  return {
    row: (name = "Two Sum") => tracker().getByText(name).closest("tr"),
    card: (title = "1 - Two Sum") => board().getByText(title).closest("article"),
  };
};
const prompt = () => screen.queryByRole("dialog");
const textarea = () => within(screen.getByRole("dialog")).getByRole("textbox");
const type = (text) => fireEvent.change(textarea(), { target: { value: text } });
const click = (name) => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the note is offered when a problem is marked as solved", () => {
  it("from the card's Mark as solved button: the dialog asks and Save keeps the note", () => {
    seed();
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByRole("button", { name: "Mark as solved" }));
    expect(saved().solved).toBe(true);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Solved. Anything to remember? (Recommended)")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Skip" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeTruthy();
    // the editor is open, not the reader
    expect(document.activeElement).toBe(textarea());
    type("use a hash map");
    click("Save");
    expect(prompt()).toBeNull();
    expect(saved().note).toBe("use a hash map");
    expect(saved().noteEditedOn).toBe("2026-10-20");
    expect(saved().solved).toBe(true);
    expect(screen.getByText("Marked as solved")).toBeTruthy();
  });

  it("Skip closes without a note, and the problem stays solved", () => {
    seed();
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByRole("button", { name: "Mark as solved" }));
    click("Skip");
    expect(prompt()).toBeNull();
    expect(saved().solved).toBe(true);
    expect(saved()).not.toHaveProperty("note");
  });

  it("from the card menu on a To Do card", () => {
    seed();
    const view = renderBoth();
    fireEvent.click(within(view.card("2 - Contains Duplicate")).getByLabelText("Card actions"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark as solved" }));
    expect(saved("blind75-2").solved).toBe(true);
    expect(screen.getByText("Solved. Anything to remember? (Recommended)")).toBeTruthy();
    type("two pointers");
    click("Save");
    expect(saved("blind75-2").note).toBe("two pointers");
  });

  it("from the tracker's Solved toggle, and the board shows the note", () => {
    seed();
    const view = renderBoth();
    fireEvent.click(within(view.row()).getByText("Not Solved"));
    expect(saved().solved).toBe(true);
    expect(screen.getByText("Solved. Anything to remember? (Recommended)")).toBeTruthy();
    type("sliding window");
    click("Save");
    expect(saved().note).toBe("sliding window");
    expect(within(view.card()).getByRole("button", { name: "Read note" })).toBeTruthy();
  });

  it("when dragging a card from In Progress to Reviewing", async () => {
    seed();
    const view = renderBoth();
    const column = [...document.querySelectorAll("section")].find(
      (s) => s.querySelector("h2")?.textContent === "Reviewing",
    );
    const rect = { left: 0, top: 3000, right: 400, bottom: 3400, width: 400, height: 400, x: 0, y: 3000 };
    vi.spyOn(column, "getBoundingClientRect").mockReturnValue(rect);
    const handle = view.card().parentElement;
    fireEvent.mouseDown(handle, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.mouseMove(document, { clientX: 5, clientY: 30 });
    fireEvent.mouseMove(document, { clientX: 100, clientY: 3100 });
    fireEvent.mouseUp(document, { clientX: 100, clientY: 3100 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(saved().solved).toBe(true);
    expect(screen.getByText("Solved. Anything to remember? (Recommended)")).toBeTruthy();
    type("binary search on the answer");
    click("Save");
    expect(saved().note).toBe("binary search on the answer");
    expect(screen.getByText("Moved to Reviewing")).toBeTruthy();
  });

  it("an existing note opens in the editor with its text, and Skip leaves it as it was", () => {
    seed({ "blind75-1": working({ note: "old idea", noteEditedOn: "2026-10-01" }), "blind75-2": todo() });
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByRole("button", { name: "Mark as solved" }));
    expect(textarea().value).toBe("old idea");
    type("something else");
    click("Skip");
    expect(saved().note).toBe("old idea");
    expect(saved().noteEditedOn).toBe("2026-10-01");
  });

  it("Save with the same text changes nothing", () => {
    seed({ "blind75-1": working({ note: "old idea", noteEditedOn: "2026-10-01" }), "blind75-2": todo() });
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByRole("button", { name: "Mark as solved" }));
    click("Save");
    expect(saved().note).toBe("old idea");
    expect(saved().noteEditedOn).toBe("2026-10-01");
  });

  it("Undo of the solve takes the problem back to In Progress", () => {
    seed();
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByRole("button", { name: "Mark as solved" }));
    click("Skip");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().solved).toBe(false);
    expect(saved().status).toBe("in-progress");
  });
});

describe("the note is not offered for anything else", () => {
  const solved = (extra = {}) => ({
    status: "solved",
    solved: true,
    solvedDate: "2026-10-01",
    reviews: [true, true, false, false, false],
    dates: { initial: "2026-10-01", review1: "2026-10-02", review2: "2026-10-04" },
    ...extra,
  });

  it("completing a review does not ask for a note", () => {
    seed({ "blind75-1": solved() });
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByRole("button", { name: /^Complete R3/ }));
    expect(prompt()).toBeNull();
    expect(saved().reviews[2]).toBe(true);
  });

  it("marking as mastered from the menu does not ask for a note", () => {
    seed();
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByLabelText("Card actions"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark as mastered" }));
    expect(prompt()).toBeNull();
  });

  it("starting a problem (title, Start) does not ask for a note", () => {
    seed();
    const view = renderBoth();
    fireEvent.click(within(view.card("2 - Contains Duplicate")).getByTitle(/^Open /));
    expect(prompt()).toBeNull();
  });

  it("if the timer guard is cancelled nothing is solved and no note is asked", async () => {
    const MIN = 60_000;
    seed({
      "blind75-1": solved({ timer: { elapsedMs: MIN, runningSince: Date.now() } }),
      "blind75-2": working(),
    });
    const view = renderBoth();
    fireEvent.click(within(view.card("2 - Contains Duplicate")).getByRole("button", { name: "Mark as solved" }));
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {});
    expect(saved("blind75-2").solved).toBe(false);
    expect(prompt()).toBeNull();
  });
});
