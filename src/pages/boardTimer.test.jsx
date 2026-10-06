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
const press = (name, title) => fireEvent.click(within(card(title)).getByRole("button", { name }));
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

describe("the timer on a card", () => {
  it("offers to start it, shows no time until there is some, and says what is timed", () => {
    seed();
    renderBoard();
    const button = within(card()).getByRole("button", { name: "Start timer" });
    expect(button.getAttribute("title")).toBe("Start timer (R3)");
    expect(readout()).toBeNull();
  });

  it("starting it shows the time running, with the review it belongs to", () => {
    seed();
    renderBoard();
    press("Start timer");
    expect(saved().timer.runningSince).toBe(Date.now());
    expect(readout().textContent).toBe("0:00");
    expect(card().textContent).toContain("· R3");
    expect(within(card()).getByRole("button", { name: "Pause timer" })).toBeTruthy();
    tick(65_000);
    expect(readout().textContent).toBe("1:05");
  });

  it("pausing keeps the time and offers to reset it; reset throws it away", () => {
    seed();
    renderBoard();
    press("Start timer");
    tick(30_000);
    press("Pause timer");
    expect(saved().timer).toEqual({ elapsedMs: 30_000, runningSince: null });
    tick(60_000);
    expect(readout().textContent).toBe("0:30");
    press("Reset timer");
    expect(readout()).toBeNull();
    expect(saved()).not.toHaveProperty("timer");
    expect(within(card()).getByRole("button", { name: "Start timer" })).toBeTruthy();
  });

  it("resumes from the time already counted", () => {
    seed();
    renderBoard();
    press("Start timer");
    tick(20_000);
    press("Pause timer");
    press("Start timer");
    tick(10_000);
    expect(readout().textContent).toBe("0:30");
  });

  it("keeps counting real time after a reload", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 0, runningSince: Date.now() } }) });
    vi.setSystemTime(Date.now() + 5 * MIN);
    renderBoard();
    expect(readout().textContent).toBe("5:00");
  });

  it("turns amber past the limit and red once it timed out", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 9 * MIN, runningSince: null } }) });
    renderBoard();
    const line = () => readout().closest("p");
    expect(line().className).toMatch(/text-gray-500/);
    cleanup();
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 11 * MIN, runningSince: null } }) });
    renderBoard();
    expect(line().className).toMatch(/text-amber-600/);
    cleanup();
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 25 * MIN, runningSince: null } }) });
    renderBoard();
    expect(line().className).toMatch(/text-red-600/);
  });

  it("starting the first solve of a To Do problem moves it to In Progress", () => {
    seed({ "blind75-2": { status: "todo", solved: false, reviews: [false, false, false, false, false], dates: {} } });
    renderBoard();
    const title = "2 - Contains Duplicate";
    expect(within(card(title)).getByRole("button", { name: "Start timer" }).getAttribute("title")).toBe(
      "Start timer (First solve)",
    );
    press("Start timer", title);
    expect(saved("blind75-2").status).toBe("in-progress");
    expect(saved("blind75-2").timer.runningSince).not.toBeNull();
    expect(readout(title).textContent).toBe("0:00");
    expect(card(title).textContent).toContain("First solve");
  });

  it("only one runs at a time: starting another pauses the first", () => {
    seed({
      "blind75-1": twoSum(),
      "blind75-2": { status: "todo", solved: false, reviews: [false, false, false, false, false], dates: {} },
    });
    renderBoard();
    press("Start timer");
    tick(15_000);
    press("Start timer", "2 - Contains Duplicate");
    expect(saved().timer).toEqual({ elapsedMs: 15_000, runningSince: null });
    expect(within(card()).getByRole("button", { name: "Start timer" })).toBeTruthy();
    expect(within(card("2 - Contains Duplicate")).getByRole("button", { name: "Pause timer" })).toBeTruthy();
  });

  it("has no timer on a mastered problem", () => {
    seed({ "blind75-1": twoSum({ reviews: [true, true, true, true, true] }) });
    renderBoard();
    expect(within(card()).queryByRole("button", { name: /timer/i })).toBeNull();
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
    press("Start timer");
    expect(vi.getTimerCount()).toBe(idle + 1);
    press("Pause timer");
    expect(vi.getTimerCount()).toBe(idle);
  });

  it("does not re-render a card without a running timer when the clock ticks", () => {
    seed({
      "blind75-1": twoSum({ timer: { elapsedMs: 0, runningSince: Date.now() } }),
      "blind75-2": { status: "todo", solved: false, reviews: [false, false, false, false, false], dates: {} },
    });
    renderBoard();
    const other = card("2 - Contains Duplicate");
    tick(3000);
    expect(readout().textContent).toBe("0:03");
    expect(card("2 - Contains Duplicate")).toBe(other);
    expect(within(other).queryByRole("timer")).toBeNull();
  });
});
