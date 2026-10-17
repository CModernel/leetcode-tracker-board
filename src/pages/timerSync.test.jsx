// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import { TimerSettingsProvider } from "../context/TimerSettingsProvider";
import LeetCodeTracker from "./LeetCodeTracker";
import BoardPage from "./BoardPage";

vi.setConfig({ testTimeout: 20000 });

// Two Sum (R3 pending, Easy: review limit 10 min) and Contains Duplicate (To
// Do). Tracker and board share one provider. Today is 2026-10-20.
const KEY = "leetcode-progress-v3";
const MIN = 60_000;
const twoSum = (extra = {}) => ({
  status: "solved",
  solved: true,
  solvedDate: "2026-10-01",
  reviews: [true, true, false, false, false],
  dates: { initial: "2026-10-01", review1: "2026-10-02", review2: "2026-10-04" },
  ...extra,
});
const todo = () => ({ status: "todo", solved: false, reviews: [false, false, false, false, false], dates: {} });
const seed = (entries) => {
  localStorage.setItem(KEY, JSON.stringify({ version: 3, progress: { "Blind 75": entries } }));
  localStorage.setItem("leetcode-show-time", "true");
};
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
const tick = (ms) => act(() => vi.advanceTimersByTime(ms));
const CD = "Contains Duplicate";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the timer in the tracker and on the board", () => {
  it("a timer started on the card shows in the row and both tick together", () => {
    seed({ "blind75-1": twoSum() });
    const view = renderBoth();
    expect(within(view.row()).queryByRole("timer")).toBeNull();
    fireEvent.click(within(view.card()).getByRole("button", { name: "Start timer" }));
    tick(3000);
    expect(within(view.row()).getByRole("timer").textContent).toBe("0:03");
    expect(within(view.card()).getByRole("timer").textContent).toBe("0:03");
  });

  it("pausing from the row pauses the card, and resuming from the card resumes the row", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: MIN, runningSince: Date.now() } }) });
    const view = renderBoth();
    fireEvent.click(within(view.row()).getByRole("button", { name: /Pause timer/ }));
    expect(saved().timer.runningSince).toBeNull();
    expect(within(view.card()).getByRole("button", { name: /Resume timer/ })).toBeTruthy();
    fireEvent.click(within(view.card()).getByRole("button", { name: /Resume timer/ }));
    expect(within(view.row()).getByRole("button", { name: /Pause timer/ })).toBeTruthy();
  });

  it("a row with no timer offers Start, and it starts", () => {
    seed({ "blind75-1": twoSum() });
    const view = renderBoth();
    fireEvent.click(within(view.row()).getByRole("button", { name: /Start timer \(R3\)/ }));
    expect(saved().timer.runningSince).not.toBeNull();
  });

  it("the title link in the table starts the timer and moves a To Do problem to In Progress", () => {
    seed({ "blind75-2": todo() });
    const view = renderBoth();
    fireEvent.click(within(view.row(CD)).getByTitle(/^Open /));
    expect(saved("blind75-2").status).toBe("in-progress");
    expect(saved("blind75-2").timer.runningSince).not.toBeNull();
    expect(within(view.card("2 - Contains Duplicate")).getByRole("timer")).toBeTruthy();
  });

  it("the title link of another problem pauses the first and says so, with Undo", () => {
    seed({
      "blind75-1": twoSum({ timer: { elapsedMs: 0, runningSince: Date.now() } }),
      "blind75-2": todo(),
    });
    const view = renderBoth();
    tick(15_000);
    fireEvent.click(within(view.row(CD)).getByTitle(/^Open /));
    expect(saved().timer).toEqual({ elapsedMs: 15_000, runningSince: null });
    expect(screen.getByText("Paused Two Sum at 0:15")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().timer.runningSince).not.toBeNull();
    expect(saved("blind75-2").timer.runningSince).toBeNull();
  });
});

describe("the time recorded", () => {
  it("completing a review on the board shows its time in the column", async () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 7 * MIN, runningSince: null } }) });
    const view = renderBoth();
    fireEvent.click(within(view.card()).getByRole("button", { name: /^Complete R3/ }));
    await waitFor(() => expect(saved().attempts).toHaveLength(1));
    const cell = within(view.row()).getByText(/Last review/);
    expect(cell.textContent).toContain("7:00");
    expect(cell.textContent).toContain("(R3)");
    expect(cell.getAttribute("title")).toBe("Limit 10:00 · Score 100");
  });

  it("a slow time is coloured and scored lower", () => {
    seed({
      "blind75-1": twoSum({
        attempts: [{ date: "2026-10-05", review: 1, help: 0, ms: 15 * MIN, limitMs: 10 * MIN }],
      }),
    });
    const view = renderBoth();
    const cell = within(view.row()).getByText(/Last review/);
    expect(cell.className).toMatch(/amber/);
    expect(cell.getAttribute("title")).toBe("Limit 10:00 · Score 83");
  });

  it("an attempt with no time shows nothing (unknown, not 0:00)", () => {
    seed({ "blind75-1": twoSum({ attempts: [{ date: "2026-10-05", review: 1, help: 0 }] }) });
    const view = renderBoth();
    expect(within(view.row()).queryByText(/Last review/)).toBeNull();
  });

  it("a first solve with a time shows 'Solved in'", () => {
    seed({
      "blind75-1": twoSum({ firstSolve: { date: "2026-10-01", ms: 12 * MIN, limitMs: 20 * MIN } }),
    });
    const view = renderBoth();
    expect(within(view.row()).getByText(/Solved in/).textContent).toContain("12:00");
  });
});

describe("Show timer off", () => {
  it("hides the column, its button and the start from the title", () => {
    seed({ "blind75-2": todo() });
    localStorage.setItem("leetcode-show-timer", "false");
    const view = renderBoth();
    expect(screen.queryByRole("columnheader", { name: "Time" })).toBeNull();
    expect(screen.queryByRole("button", { name: /(show|hide) time/i })).toBeNull();
    fireEvent.click(within(view.row(CD)).getByTitle(/^Open /));
    expect(saved("blind75-2").status).toBe("in-progress");
    expect(saved("blind75-2")).not.toHaveProperty("timer");
  });
});
