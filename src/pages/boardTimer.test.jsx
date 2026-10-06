// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import BoardPage from "./BoardPage";

// These render whole pages: give them room when the machine is busy.
vi.setConfig({ testTimeout: 20000 });

// Two Sum (Easy) solved on 2026-10-01 with R1 and R2 done, so R3 is the review
// being timed (limit 10 minutes for an Easy review). Today is 2026-10-20.
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
const seed = (entries = { "blind75-1": twoSum() }) =>
  localStorage.setItem(KEY, JSON.stringify({ version: 3, progress: { "Blind 75": entries } }));
const saved = (id = "blind75-1") => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"][id];

const renderBoard = () => {
  render(
    <ThemeProvider>
      <ProgressProvider>
        <ConfirmProvider>
          <BoardPage />
        </ConfirmProvider>
      </ProgressProvider>
    </ThemeProvider>,
  );
};
const card = (title = "1 - Two Sum") => screen.getByText(title).closest("article");
const CD = "2 - Contains Duplicate";
const openProblem = (title) => fireEvent.click(within(card(title)).getByTitle(/^Open /));
const tapTime = (title) => fireEvent.click(within(card(title)).getByRole("button", { name: /timer \(/ }));
const menu = (title, name) => {
  fireEvent.click(within(card(title)).getByLabelText("Card actions"));
  fireEvent.click(screen.getByRole("menuitem", { name }));
};
const tick = (ms) => act(() => vi.advanceTimersByTime(ms));
const readout = (title) => within(card(title)).queryByRole("timer");

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the timer starts by itself", () => {
  it("before it starts there is no timer bar: only a small play button at the left of the review button", () => {
    seed();
    renderBoard();
    expect(readout()).toBeNull();
    expect(within(card()).queryByRole("button", { name: /^(Pause|Resume) timer/ })).toBeNull();
    const play = within(card()).getByRole("button", { name: "Start timer" });
    const complete = within(card()).getByRole("button", { name: /^Complete R3/ });
    expect(play.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(play.parentElement).toBe(complete.parentElement);
  });

  it("the small play button starts the timer, and the bar then sits above the review button", () => {
    seed();
    renderBoard();
    fireEvent.click(within(card()).getByRole("button", { name: "Start timer" }));
    expect(saved().timer.runningSince).toBe(Date.now());
    expect(within(card()).queryByRole("button", { name: "Start timer" })).toBeNull();
    const bar = within(card()).getByRole("button", { name: "Pause timer (R3)" });
    const complete = within(card()).getByRole("button", { name: /^Complete R3/ });
    expect(bar.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the pause / resume control stays at the left of the bar and reset at the right", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 5000, runningSince: null } }) });
    renderBoard();
    const toggle = within(card()).getByRole("button", { name: "Resume timer (R3)" });
    const reset = within(card()).getByRole("button", { name: "Reset timer" });
    expect(toggle.compareDocumentPosition(reset) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the bars are compact and the same small height", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 5000, runningSince: null } }) });
    renderBoard();
    for (const name of [/timer \(/, "Reset timer", /^Complete R3/]) {
      expect(within(card()).getByRole("button", { name }).className).toMatch(/\bh-6\b/);
    }
  });

  it("opening the problem starts the timer on the review that is pending, and the link still opens", () => {
    seed();
    renderBoard();
    const link = within(card()).getByTitle("Open Two Sum");
    expect(link.getAttribute("href")).toMatch(/leetcode\.com/);
    expect(link.getAttribute("target")).toBe("_blank");
    fireEvent.click(link);
    expect(saved().timer).toEqual({ elapsedMs: 0, runningSince: Date.now() });
    expect(readout().textContent).toBe("0:00");
    expect(card().textContent).toContain("· R3");
    tick(65_000);
    expect(readout().textContent).toBe("1:05");
  });

  it("opening it again while it runs changes nothing", () => {
    seed();
    renderBoard();
    openProblem("1 - Two Sum");
    tick(10_000);
    openProblem("1 - Two Sum");
    expect(saved().timer.runningSince).toBe(Date.now() - 10_000);
  });

  it("opening a To Do problem starts the first solve and moves it to In Progress", () => {
    seed({ "blind75-2": todo() });
    renderBoard();
    openProblem(CD);
    expect(saved("blind75-2").status).toBe("in-progress");
    expect(saved("blind75-2").timer.runningSince).not.toBeNull();
    expect(readout(CD).textContent).toBe("0:00");
    expect(card(CD).textContent).toContain("First solve");
  });

  it("the Start item of the menu starts it too, and Undo puts the card back without the timer", () => {
    seed({ "blind75-2": todo() });
    renderBoard();
    menu(CD, "Start");
    expect(saved("blind75-2").status).toBe("in-progress");
    expect(saved("blind75-2").timer.runningSince).not.toBeNull();
    expect(screen.getByText("Moved to In Progress")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved("blind75-2").status).toBe("todo");
    expect(saved("blind75-2")).not.toHaveProperty("timer");
  });

  it("a mastered problem has nothing to time", () => {
    seed({ "blind75-1": twoSum({ reviews: [true, true, true, true, true] }) });
    renderBoard();
    openProblem("1 - Two Sum");
    expect(saved()).not.toHaveProperty("timer");
    expect(readout()).toBeNull();
  });
});

describe("pausing, resuming and resetting", () => {
  it("tapping the time pauses it and keeps the time; tapping again resumes from it", () => {
    seed();
    renderBoard();
    openProblem("1 - Two Sum");
    tick(30_000);
    tapTime();
    expect(saved().timer).toEqual({ elapsedMs: 30_000, runningSince: null });
    tick(60_000);
    expect(readout().textContent).toBe("0:30");
    tapTime();
    tick(10_000);
    expect(readout().textContent).toBe("0:40");
  });

  it("says what a tap will do", () => {
    seed();
    renderBoard();
    openProblem("1 - Two Sum");
    expect(within(card()).getByRole("button", { name: "Pause timer (R3)" })).toBeTruthy();
    tapTime();
    expect(within(card()).getByRole("button", { name: "Resume timer (R3)" })).toBeTruthy();
  });

  it("opening the problem again resumes a paused timer", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 20_000, runningSince: null } }) });
    renderBoard();
    openProblem("1 - Two Sum");
    expect(saved().timer).toEqual({ elapsedMs: 20_000, runningSince: Date.now() });
  });

  it("Reset timer is in the menu only when there is a timer, throws the time away, and Undo brings it back", () => {
    seed();
    renderBoard();
    fireEvent.click(within(card()).getByLabelText("Card actions"));
    expect(screen.queryByRole("menuitem", { name: "Reset timer" })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    openProblem("1 - Two Sum");
    tick(20_000);
    tapTime();
    menu("1 - Two Sum", "Reset timer");
    expect(readout()).toBeNull();
    expect(saved()).not.toHaveProperty("timer");
    expect(screen.getByText("Timer reset")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().timer).toEqual({ elapsedMs: 20_000, runningSince: null });
  });

  it("keeps counting real time after a reload", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 0, runningSince: Date.now() } }) });
    vi.setSystemTime(Date.now() + 5 * MIN);
    renderBoard();
    expect(readout().textContent).toBe("5:00");
  });
});

describe("the buttons on an In Progress card", () => {
  const working = (extra = {}) => ({ ...todo(), status: "in-progress", ...extra });

  it("has Mark as solved, with the timer bar above it once the timer runs", () => {
    seed({ "blind75-2": working({ timer: { elapsedMs: 3 * MIN, runningSince: null } }) });
    renderBoard();
    const bar = within(card(CD)).getByRole("button", { name: "Resume timer (First solve)" });
    const solve = within(card(CD)).getByRole("button", { name: "Mark as solved" });
    expect(bar.compareDocumentPosition(solve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("without a timer it has the small play button at the left of Mark as solved", () => {
    seed({ "blind75-2": working() });
    renderBoard();
    const play = within(card(CD)).getByRole("button", { name: "Start timer" });
    const solve = within(card(CD)).getByRole("button", { name: "Mark as solved" });
    expect(play.compareDocumentPosition(solve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Mark as solved records the time of the first solve with the limit, and Undo brings the timer back", () => {
    seed({ "blind75-2": working({ timer: { elapsedMs: 4 * MIN, runningSince: Date.now() } }) });
    vi.setSystemTime(Date.now() + 3 * MIN);
    renderBoard();
    fireEvent.click(within(card(CD)).getByRole("button", { name: "Mark as solved" }));
    expect(saved("blind75-2").solved).toBe(true);
    expect(saved("blind75-2").firstSolve).toEqual({ date: "2026-10-20", ms: 7 * MIN, limitMs: 20 * MIN });
    expect(saved("blind75-2")).not.toHaveProperty("timer");
    expect(screen.getByText("Marked as solved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved("blind75-2").solved).toBe(false);
    expect(saved("blind75-2").timer).toEqual({ elapsedMs: 4 * MIN, runningSince: expect.any(Number) });
  });

  it("a To Do card has no completing button", () => {
    seed({ "blind75-2": todo() });
    renderBoard();
    expect(within(card(CD)).queryByRole("button", { name: "Mark as solved" })).toBeNull();
  });
});

describe("skipping the timer", () => {
  it("completing without starting it records no time (unknown, not 0)", () => {
    seed();
    renderBoard();
    fireEvent.click(within(card()).getByRole("button", { name: /^Complete R3/ }));
    expect(saved().attempts.at(-1)).toEqual({ date: "2026-10-20", review: 2, help: 0 });
  });

  it("Reset in the bar throws the time away, so completing afterwards records none", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 4 * MIN, runningSince: null } }) });
    renderBoard();
    fireEvent.click(within(card()).getByRole("button", { name: "Reset timer" }));
    expect(saved()).not.toHaveProperty("timer");
    expect(within(card()).getByRole("button", { name: "Start timer" })).toBeTruthy();
    fireEvent.click(within(card()).getByRole("button", { name: /^Complete R3/ }));
    expect(saved().attempts.at(-1)).toEqual({ date: "2026-10-20", review: 2, help: 0 });
  });
});

describe("only one timer runs, and it is said", () => {
  const twoTimers = () =>
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 0, runningSince: Date.now() } }), "blind75-2": todo() });

  it("opening another problem pauses the first and says so, with Undo", () => {
    twoTimers();
    renderBoard();
    tick(15_000);
    openProblem(CD);
    expect(saved().timer).toEqual({ elapsedMs: 15_000, runningSince: null });
    expect(saved("blind75-2").timer.runningSince).not.toBeNull();
    expect(screen.getByText("Paused Two Sum at 0:15")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().timer.runningSince).not.toBeNull();
    expect(saved("blind75-2").timer.runningSince).toBeNull();
  });

  it("starting from the menu says it in the same message, and Undo restores both", () => {
    twoTimers();
    renderBoard();
    tick(15_000);
    menu(CD, "Start");
    expect(screen.getByText("Moved to In Progress. Paused Two Sum at 0:15.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved("blind75-2").status).toBe("todo");
    expect(saved("blind75-2")).not.toHaveProperty("timer");
    expect(saved().timer.runningSince).not.toBeNull();
  });
});

describe("the limit", () => {
  it("turns amber past the limit and red once it timed out", () => {
    const line = () => readout().closest("button");
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 9 * MIN, runningSince: null } }) });
    renderBoard();
    expect(line().className).toMatch(/text-gray-700/);
    cleanup();
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 11 * MIN, runningSince: null } }) });
    renderBoard();
    expect(line().className).toMatch(/text-amber-700/);
    cleanup();
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 25 * MIN, runningSince: null } }) });
    renderBoard();
    expect(line().className).toMatch(/text-red-700/);
  });

  it("completing the review ends the timer and records the time with the limit", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 4 * MIN, runningSince: Date.now() } }) });
    vi.setSystemTime(Date.now() + 3 * MIN);
    renderBoard();
    fireEvent.click(within(card()).getByRole("button", { name: /^Complete R3/ }));
    expect(saved().attempts.at(-1)).toEqual({
      date: "2026-10-20",
      review: 2,
      help: 0,
      ms: 7 * MIN,
      limitMs: 10 * MIN,
    });
    expect(saved()).not.toHaveProperty("timer");
    expect(readout()).toBeNull();
  });
});

describe("the clock behind the running time", () => {
  it("is one interval only while something runs, and none otherwise", () => {
    seed();
    renderBoard();
    const idle = vi.getTimerCount();
    openProblem("1 - Two Sum");
    expect(vi.getTimerCount()).toBe(idle + 1);
    tapTime();
    expect(vi.getTimerCount()).toBe(idle);
  });

  it("does not re-render a card without a running timer when the clock ticks", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 0, runningSince: Date.now() } }), "blind75-2": todo() });
    renderBoard();
    const other = card(CD);
    tick(3000);
    expect(readout().textContent).toBe("0:03");
    expect(card(CD)).toBe(other);
    expect(within(other).queryByRole("timer")).toBeNull();
  });
});
