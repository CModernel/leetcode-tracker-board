// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import { TimerSettingsProvider } from "../context/TimerSettingsProvider";
import TimeLimitWatcher, { resetTimeLimitMemory } from "../components/TimeLimitWatcher";
import BoardPage from "./BoardPage";
import LeetCodeTracker from "./LeetCodeTracker";

vi.setConfig({ testTimeout: 20000 });

// Two Sum (Easy, R3 pending, review limit 10 min) and Contains Duplicate (In
// Progress). Today is 2026-10-20.
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
const working = (extra = {}) => ({
  status: "in-progress",
  solved: false,
  reviews: [false, false, false, false, false],
  dates: {},
  ...extra,
});
const seed = (entries) =>
  localStorage.setItem(KEY, JSON.stringify({ version: 3, progress: { "Blind 75": entries } }));
const saved = (id = "blind75-1") => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"][id];
const running = (elapsed = 0) => ({ timer: { elapsedMs: elapsed, runningSince: Date.now() } });

const Patterns = () => <p>Patterns page</p>;
const renderApp = (page = <BoardPage />, path = "/board") =>
  render(
    <ThemeProvider>
      <TimerSettingsProvider>
        <ProgressProvider>
          <ConfirmProvider>
            <MemoryRouter initialEntries={[path]}>
              <TimeLimitWatcher />
              <Routes>
                <Route path="/board" element={page} />
                <Route path="/" element={page} />
                <Route path="/patterns" element={<Patterns />} />
              </Routes>
            </MemoryRouter>
          </ConfirmProvider>
        </ProgressProvider>
      </TimerSettingsProvider>
    </ThemeProvider>,
  );
const tick = (ms) => act(() => vi.advanceTimersByTime(ms));
const message = () => screen.queryByText(/you have used the time you planned/);
const card = (title) => screen.getByText(title).closest("article");
const TS = "1 - Two Sum";
const CD = "2 - Contains Duplicate";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
  resetTimeLimitMemory();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the message past the limit", () => {
  it("appears once when the running timer crosses its limit, with the problem and the activity", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 9 * MIN, runningSince: Date.now() } }) });
    renderApp();
    expect(message()).toBeNull();
    tick(61_000);
    expect(message().textContent).toBe("Two Sum · R3: you have used the time you planned.");
    expect(screen.getByRole("button", { name: "Keep going" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Learn" })).toBeTruthy();
  });

  it("does not come back after Keep going, a pause and resume, or a remount", async () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 9 * MIN, runningSince: Date.now() } }) });
    renderApp();
    tick(61_000);
    fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
    tick(300);
    expect(message()).toBeNull();
    fireEvent.click(within(card(TS)).getByRole("button", { name: /Pause timer/ }));
    fireEvent.click(within(card(TS)).getByRole("button", { name: /Resume timer/ }));
    tick(5000);
    expect(message()).toBeNull();
    cleanup();
    renderApp();
    tick(5000);
    expect(message()).toBeNull();
  });

  it("is not said for a timer that is already past its limit when the page opens", () => {
    seed({ "blind75-1": twoSum(running(12 * MIN)) });
    renderApp();
    tick(5000);
    expect(message()).toBeNull();
  });

  it("is not said for a paused timer, with no limit, or with the timer off", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 9 * MIN, runningSince: null } }) });
    renderApp();
    tick(5 * MIN);
    expect(message()).toBeNull();
    cleanup();
    seed({ "blind75-1": twoSum(running(9 * MIN)) });
    localStorage.setItem(
      "leetcode-timer-limits",
      JSON.stringify({ first: { Easy: 20, Medium: 35, Hard: 50 }, review: { Easy: null, Medium: null, Hard: null } }),
    );
    renderApp();
    tick(5 * MIN);
    expect(message()).toBeNull();
    cleanup();
    localStorage.removeItem("leetcode-timer-limits");
    localStorage.setItem("leetcode-show-timer", "false");
    seed({ "blind75-1": twoSum(running(9 * MIN)) });
    renderApp();
    tick(5 * MIN);
    expect(message()).toBeNull();
  });

  it("closes by itself after a while", () => {
    seed({ "blind75-1": twoSum(running(9 * MIN)) });
    renderApp();
    tick(61_000);
    expect(message()).not.toBeNull();
    tick(16_000);
    expect(message()).toBeNull();
  });

  it("also appears on the tracker page", () => {
    seed({ "blind75-1": twoSum(running(9 * MIN)) });
    renderApp(<LeetCodeTracker />, "/");
    tick(61_000);
    expect(message()).not.toBeNull();
  });

  it("Learn goes to the patterns page", () => {
    seed({ "blind75-1": twoSum(running(9 * MIN)) });
    renderApp();
    tick(61_000);
    fireEvent.click(screen.getByRole("button", { name: "Learn" }));
    expect(screen.getByText("Patterns page")).toBeTruthy();
  });

  it("Read the note opens it and counts as help; it is not offered without a note", () => {
    seed({ "blind75-1": twoSum({ ...running(9 * MIN), note: "use a hash map" }) });
    renderApp();
    tick(61_000);
    fireEvent.click(screen.getByRole("button", { name: "Read the note" }));
    expect(document.body.textContent).toContain("use a hash map");
    expect(saved().helpViewed).toEqual({ note: "2026-10-20" });
    cleanup();
    resetTimeLimitMemory();
    seed({ "blind75-1": twoSum(running(9 * MIN)) });
    renderApp();
    tick(61_000);
    expect(message()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Read the note" })).toBeNull();
  });
});

describe("completing a review whose timer ran out", () => {
  const complete = () => fireEvent.click(within(card(TS)).getByRole("button", { name: /^Complete R3/ }));
  const timedOut = (extra = {}) => twoSum({ timer: { elapsedMs: 25 * MIN, runningSince: null }, ...extra });

  it("asks how it went and suggests the solution, even if nothing was opened", () => {
    seed({ "blind75-1": timedOut() });
    renderApp();
    complete();
    expect(screen.getByText("How did it go?")).toBeTruthy();
    expect(screen.getByText("The timer ran past twice the limit.")).toBeTruthy();
    const suggested = screen.getByText("Suggested").closest("button");
    expect(suggested.textContent).toContain("Needed the solution");
    expect(document.activeElement).toBe(suggested);
    expect(saved().reviews).toEqual([true, true, false, false, false]);
  });

  it("the person can still choose to have solved it alone: the time is recorded", async () => {
    seed({ "blind75-1": timedOut() });
    renderApp();
    complete();
    fireEvent.click(screen.getByRole("button", { name: /Solved it myself/ }));
    await waitFor(() => expect(saved().attempts).toHaveLength(1));
    expect(saved().attempts[0]).toMatchObject({ review: 2, help: 0, ms: 25 * MIN, limitMs: 10 * MIN });
    expect(saved().reviews[2]).toBe(true);
  });

  it("Cancel changes nothing", () => {
    seed({ "blind75-1": timedOut() });
    renderApp();
    complete();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saved().reviews).toEqual([true, true, false, false, false]);
    expect(saved().timer).toEqual({ elapsedMs: 25 * MIN, runningSince: null });
  });

  it("a time a little over the limit still completes at once", async () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 15 * MIN, runningSince: null } }) });
    renderApp();
    complete();
    await waitFor(() => expect(saved().reviews[2]).toBe(true));
    expect(screen.queryByText("How did it go?")).toBeNull();
  });

  it("with the timer switched off nothing is suggested", async () => {
    localStorage.setItem("leetcode-show-timer", "false");
    seed({ "blind75-1": timedOut() });
    renderApp();
    complete();
    await waitFor(() => expect(saved().reviews[2]).toBe(true));
    expect(screen.queryByText("How did it go?")).toBeNull();
  });

  it("asks from the card menu too", () => {
    seed({ "blind75-1": timedOut() });
    renderApp();
    fireEvent.click(within(card(TS)).getByLabelText("Card actions"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Complete R3/ }));
    expect(screen.getByText("The timer ran past twice the limit.")).toBeTruthy();
  });

  it("asks from the tracker table too", () => {
    seed({ "blind75-1": timedOut() });
    renderApp(<LeetCodeTracker />, "/");
    const row = screen.getByText("Two Sum").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "R3" }));
    expect(screen.getByText("The timer ran past twice the limit.")).toBeTruthy();
  });

  it("a first solve that timed out is only recorded, without asking", async () => {
    seed({
      "blind75-2": working({ timer: { elapsedMs: 90 * MIN, runningSince: null } }),
    });
    renderApp();
    fireEvent.click(within(card(CD)).getByRole("button", { name: "Mark as solved" }));
    await waitFor(() => expect(saved("blind75-2").solved).toBe(true));
    expect(screen.queryByText("How did it go?")).toBeNull();
    expect(saved("blind75-2").firstSolve).toMatchObject({ ms: 90 * MIN, limitMs: 20 * MIN });
  });
});
