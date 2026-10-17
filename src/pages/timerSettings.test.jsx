// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import { TimerSettingsProvider } from "../context/TimerSettingsProvider";
import Navbar from "../components/Navbar";
import BoardPage from "./BoardPage";

vi.setConfig({ testTimeout: 20000 });

// Two Sum (Easy, R3 pending) solved on 2026-10-01; Contains Duplicate is In
// Progress. Today is 2026-10-20.
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
const todo = () => ({ status: "todo", solved: false, reviews: [false, false, false, false, false], dates: {} });
const seed = (entries) =>
  localStorage.setItem(KEY, JSON.stringify({ version: 3, progress: { "Blind 75": entries } }));
const saved = (id = "blind75-1") => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"][id];

const renderApp = () =>
  render(
    <ThemeProvider>
      <TimerSettingsProvider>
        <ProgressProvider>
          <ConfirmProvider>
            <MemoryRouter initialEntries={["/board"]}>
              <Navbar />
              <BoardPage />
            </MemoryRouter>
          </ConfirmProvider>
        </ProgressProvider>
      </TimerSettingsProvider>
    </ThemeProvider>,
  );
const card = (title) => screen.getByText(title).closest("article");
const TS = "1 - Two Sum";
const CD = "2 - Contains Duplicate";
const openSettings = () => fireEvent.click(screen.getByRole("button", { name: "Timer settings" }));
const dialog = () => screen.getByRole("dialog", { hidden: true });
const input = (name) => within(dialog()).getByLabelText(name);
const click = (name) => fireEvent.click(within(dialog()).getByRole("button", { name }));
const timerBar = (title) => within(card(title)).queryByRole("timer");
const tick = (ms) => act(() => vi.advanceTimersByTime(ms));

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

describe("the limits", () => {
  it("opens with the defaults and Close changes nothing", () => {
    seed({ "blind75-1": twoSum() });
    renderApp();
    openSettings();
    expect(input("Review Easy limit in minutes").value).toBe("10");
    expect(input("First solve Hard limit in minutes").value).toBe("50");
    fireEvent.change(input("Review Easy limit in minutes"), { target: { value: "3" } });
    click("Close");
    expect(localStorage.getItem("leetcode-timer-limits")).toBeNull();
  });

  it("a new limit is saved, survives a remount and recolours a running card", async () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 4 * MIN, runningSince: Date.now() } }) });
    renderApp();
    // 4 minutes of a 10 minute limit: on time (blue bar)
    expect(within(card(TS)).getByRole("button", { name: /Pause timer/ }).className).toMatch(/blue/);
    openSettings();
    fireEvent.change(input("Review Easy limit in minutes"), { target: { value: "2" } });
    click("Save");
    expect(JSON.parse(localStorage.getItem("leetcode-timer-limits")).review.Easy).toBe(2);
    // 4 minutes of 2 is the cap: timed out (red)
    expect(within(card(TS)).getByRole("button", { name: /Pause timer/ }).className).toMatch(/red/);
    cleanup();
    renderApp();
    openSettings();
    expect(input("Review Easy limit in minutes").value).toBe("2");
  });

  it("the limit saved with the attempt is the one in the settings when it is completed", async () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 4 * MIN, runningSince: null } }) });
    renderApp();
    openSettings();
    fireEvent.change(input("Review Easy limit in minutes"), { target: { value: "15" } });
    click("Save");
    fireEvent.click(within(card(TS)).getByRole("button", { name: /^Complete R3/ }));
    await waitFor(() => expect(saved().attempts).toHaveLength(1));
    expect(saved().attempts[0]).toMatchObject({ ms: 4 * MIN, limitMs: 15 * MIN });
  });

  it("No limit keeps a long time on time and saves no limit", async () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 90 * MIN, runningSince: null } }) });
    renderApp();
    expect(within(card(TS)).getByRole("button", { name: /Resume timer/ }).className).toMatch(/red/);
    openSettings();
    fireEvent.click(within(dialog()).getByLabelText("No limit for review"));
    expect(input("Review Easy limit in minutes").disabled).toBe(true);
    click("Save");
    expect(JSON.parse(localStorage.getItem("leetcode-timer-limits")).review).toEqual({
      Easy: null,
      Medium: null,
      Hard: null,
    });
    expect(within(card(TS)).getByRole("button", { name: /Resume timer/ }).className).not.toMatch(/red|amber/);
    fireEvent.click(within(card(TS)).getByRole("button", { name: /^Complete R3/ }));
    await waitFor(() => expect(saved().attempts).toHaveLength(1));
    expect(saved().attempts[0].ms).toBe(90 * MIN);
    expect(saved().attempts[0]).not.toHaveProperty("limitMs");
  });

  it("an invalid value shows a message and disables Save", () => {
    seed({ "blind75-1": twoSum() });
    renderApp();
    openSettings();
    fireEvent.change(input("Review Easy limit in minutes"), { target: { value: "0" } });
    expect(within(dialog()).getByRole("alert").textContent).toMatch(/1 to 600/);
    expect(within(dialog()).getByRole("button", { name: "Save" }).disabled).toBe(true);
    fireEvent.change(input("Review Easy limit in minutes"), { target: { value: "12" } });
    expect(within(dialog()).queryByRole("alert")).toBeNull();
    expect(within(dialog()).getByRole("button", { name: "Save" }).disabled).toBe(false);
  });

  it("Reset limits brings the defaults back", () => {
    seed({ "blind75-1": twoSum() });
    localStorage.setItem(
      "leetcode-timer-limits",
      JSON.stringify({ first: { Easy: 1, Medium: 1, Hard: 1 }, review: { Easy: null, Medium: null, Hard: null } }),
    );
    renderApp();
    openSettings();
    expect(input("First solve Easy limit in minutes").value).toBe("1");
    click("Reset limits");
    expect(input("First solve Easy limit in minutes").value).toBe("20");
    expect(input("Review Easy limit in minutes").disabled).toBe(false);
    click("Save");
    expect(JSON.parse(localStorage.getItem("leetcode-timer-limits")).first.Easy).toBe(20);
  });

  it("a saved value that is not valid falls back to the default", () => {
    localStorage.setItem("leetcode-timer-limits", "garbage");
    seed({ "blind75-1": twoSum() });
    renderApp();
    openSettings();
    expect(input("Review Medium limit in minutes").value).toBe("20");
  });
});

describe("Show timer off", () => {
  const off = () => {
    openSettings();
    fireEvent.click(within(dialog()).getByRole("switch"));
    click("Save");
  };

  it("hides the bar, the play button, the Reset timer item and the pill", () => {
    seed({
      "blind75-1": twoSum({ timer: { elapsedMs: MIN, runningSince: Date.now() } }),
      "blind75-2": working(),
    });
    renderApp();
    expect(timerBar(TS)).toBeTruthy();
    expect(within(screen.getByRole("navigation")).getByRole("timer")).toBeTruthy();
    off();
    expect(localStorage.getItem("leetcode-show-timer")).toBe("false");
    expect(timerBar(TS)).toBeNull();
    expect(within(card(CD)).queryByRole("button", { name: "Start timer" })).toBeNull();
    expect(within(screen.getByRole("navigation")).queryByRole("timer")).toBeNull();
    fireEvent.click(within(card(TS)).getByLabelText("Card actions"));
    expect(screen.queryByRole("menuitem", { name: "Reset timer" })).toBeNull();
    // the buttons that complete stay
    expect(within(card(TS)).getByRole("button", { name: /^Complete R3/ })).toBeTruthy();
    expect(within(card(CD)).getByRole("button", { name: "Mark as solved" })).toBeTruthy();
  });

  it("pauses the timer that was running, and keeps its time", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: MIN, runningSince: Date.now() } }) });
    renderApp();
    tick(5000);
    off();
    expect(saved().timer.runningSince).toBeNull();
    expect(saved().timer.elapsedMs).toBeGreaterThanOrEqual(MIN + 5000);
  });

  it("opening a To Do problem moves it to In Progress without starting a timer", () => {
    seed({ "blind75-2": todo() });
    renderApp();
    off();
    fireEvent.click(within(card(CD)).getByTitle(/^Open /));
    expect(saved("blind75-2").status).toBe("in-progress");
    expect(saved("blind75-2")).not.toHaveProperty("timer");
  });

  it("does not ask before completing another problem, and starts nothing", async () => {
    seed({
      "blind75-1": twoSum({ timer: { elapsedMs: MIN, runningSince: null } }),
      "blind75-2": working(),
    });
    renderApp();
    off();
    fireEvent.click(within(card(CD)).getByRole("button", { name: "Mark as solved" }));
    await waitFor(() => expect(saved("blind75-2").solved).toBe(true));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(saved("blind75-2")).not.toHaveProperty("firstSolve");
  });

  it("turning it back on shows the saved time again", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 3 * MIN, runningSince: null } }) });
    renderApp();
    off();
    expect(timerBar(TS)).toBeNull();
    openSettings();
    fireEvent.click(within(dialog()).getByRole("switch"));
    click("Save");
    expect(timerBar(TS).textContent).toBe("3:00");
  });

  it("survives a remount", () => {
    seed({ "blind75-1": twoSum({ timer: { elapsedMs: 3 * MIN, runningSince: null } }) });
    renderApp();
    off();
    cleanup();
    renderApp();
    expect(timerBar(TS)).toBeNull();
  });
});
