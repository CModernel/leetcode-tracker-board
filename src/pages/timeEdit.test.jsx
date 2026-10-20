// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import { TimerSettingsProvider } from "../context/TimerSettingsProvider";
import LeetCodeTracker from "./LeetCodeTracker";

vi.setConfig({ testTimeout: 20000 });

// Two Sum: solved in 7:20 (limit 15:00), R1 done in 3:00. Today is 2026-10-20.
const KEY = "leetcode-progress-v3";
const MIN = 60_000;
const solved = (extra = {}) => ({
  status: "solved",
  solved: true,
  solvedDate: "2026-10-18",
  reviews: [false, false, false, false, false],
  dates: { initial: "2026-10-18" },
  firstSolve: { date: "2026-10-18", ms: 7 * MIN + 20_000, limitMs: 15 * MIN },
  ...extra,
});
const seed = (entry = solved()) =>
  localStorage.setItem(KEY, JSON.stringify({ version: 3, progress: { "Blind 75": { "blind75-1": entry } } }));
const saved = () => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"]["blind75-1"];

const renderTracker = () =>
  render(
    <ThemeProvider>
      <TimerSettingsProvider>
        <ProgressProvider>
          <ConfirmProvider>
            <LeetCodeTracker />
          </ConfirmProvider>
        </ProgressProvider>
      </TimerSettingsProvider>
    </ThemeProvider>,
  );
const row = () => screen.getByText("Two Sum").closest("tr");
const pencil = () => within(row()).getByRole("button", { name: /Edit recorded time/ });
const dialog = () => screen.getByRole("dialog");
const field = () => within(dialog()).getByLabelText("Time (m:ss)");
const click = (name) => fireEvent.click(within(dialog()).getByRole("button", { name }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
  localStorage.setItem("leetcode-show-time", "true");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("correcting the recorded time in the tracker", () => {
  it("opens with the recorded time and saves a new one, keeping the limit", () => {
    seed();
    renderTracker();
    fireEvent.click(pencil());
    expect(field().value).toBe("7:20");
    fireEvent.change(field(), { target: { value: "5:05" } });
    click("Save");
    expect(saved().firstSolve).toEqual({ date: "2026-10-18", ms: 5 * MIN + 5_000, limitMs: 15 * MIN });
    expect(within(row()).getByText("5:05")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("corrects the last review attempt when there is one", () => {
    seed(
      solved({
        reviews: [true, false, false, false, false],
        attempts: [{ date: "2026-10-19", review: 0, help: 0, ms: 3 * MIN, limitMs: 10 * MIN }],
      }),
    );
    renderTracker();
    fireEvent.click(pencil());
    expect(field().value).toBe("3:00");
    fireEvent.change(field(), { target: { value: "2" } });
    click("Save");
    expect(saved().attempts[0].ms).toBe(2 * MIN);
    expect(saved().firstSolve.ms).toBe(7 * MIN + 20_000);
  });

  it("shows an error for a bad time and keeps the dialog open", () => {
    seed();
    renderTracker();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "7:99" } });
    click("Save");
    expect(within(dialog()).getByRole("alert")).toBeTruthy();
    expect(saved().firstSolve.ms).toBe(7 * MIN + 20_000);
    fireEvent.change(field(), { target: { value: "8:00" } });
    expect(within(dialog()).queryByRole("alert")).toBeNull();
  });

  it("a time can be lowered but not raised", () => {
    seed();
    renderTracker();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "8:00" } });
    click("Save");
    expect(within(dialog()).getByRole("alert").textContent).toContain("only be lowered");
    expect(saved().firstSolve.ms).toBe(7 * MIN + 20_000);
    fireEvent.change(field(), { target: { value: "7:20" } });
    click("Save");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cancel changes nothing", () => {
    seed();
    renderTracker();
    fireEvent.click(pencil());
    fireEvent.change(field(), { target: { value: "1:00" } });
    click("Cancel");
    expect(saved().firstSolve.ms).toBe(7 * MIN + 20_000);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Remove time makes it unknown (never 0)", () => {
    seed();
    renderTracker();
    fireEvent.click(pencil());
    click("Remove time");
    expect(saved().firstSolve).toEqual({ date: "2026-10-18" });
    expect(screen.queryByRole("button", { name: /Edit recorded time/ })).toBeNull();
  });

  it("Undo brings the old time back, with its limit", () => {
    seed();
    renderTracker();
    fireEvent.click(pencil());
    click("Remove time");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(saved().firstSolve).toEqual({ date: "2026-10-18", ms: 7 * MIN + 20_000, limitMs: 15 * MIN });
  });
});

describe("the Time field of the outcome dialog in the tracker", () => {
  it("a lowered time is the one recorded", () => {
    seed(
      solved({
        reviews: [true, true, false, false, false],
        dates: { initial: "2026-10-18", review1: "2026-10-19", review2: "2026-10-19" },
        helpViewed: { note: "2026-10-20" },
        timer: { elapsedMs: 6 * MIN, runningSince: null },
      }),
    );
    renderTracker();
    fireEvent.click(within(row()).getByRole("button", { name: /^R3/ }));
    const time = within(dialog()).getByLabelText("Time (optional)");
    expect(time.value).toBe("6:00");
    fireEvent.change(time, { target: { value: "3:30" } });
    click(/Solved it myself/);
    expect(saved().attempts.at(-1)).toMatchObject({ review: 2, help: 0, ms: 3 * MIN + 30_000 });
  });
});
