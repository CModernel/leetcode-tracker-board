// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import Navbar from "../components/Navbar";
import BoardPage from "./BoardPage";
import LeetCodeTracker from "./LeetCodeTracker";

vi.setConfig({ testTimeout: 20000 });

// Two Sum (R3 pending) is being timed; Contains Duplicate is In Progress.
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
const working = () => ({
  status: "in-progress",
  solved: false,
  reviews: [false, false, false, false, false],
  dates: {},
});
const seed = (timer = { elapsedMs: 5 * MIN, runningSince: Date.now() }) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 3,
      progress: { "Blind 75": { "blind75-1": twoSum({ timer }), "blind75-2": working() } },
    }),
  );
const saved = (id = "blind75-1") => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"][id];

const renderPage = (page, path = "/board") =>
  render(
    <ThemeProvider>
      <ProgressProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Navbar />
            {page}
          </MemoryRouter>
        </ConfirmProvider>
      </ProgressProvider>
    </ThemeProvider>,
  );
const card = (title) => screen.getByText(title).closest("article");
const CD = "2 - Contains Duplicate";
const solveCd = () => fireEvent.click(within(card(CD)).getByRole("button", { name: "Mark as solved" }));
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

describe("completing another problem while a timer runs", () => {
  it("asks first and says which timer runs; Cancel changes nothing", async () => {
    seed();
    renderPage(<BoardPage />);
    solveCd();
    expect(await screen.findByText("A timer is running")).toBeTruthy();
    expect(screen.getByRole("alertdialog").textContent).toContain("Two Sum (R3) is being timed at 5:00");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(saved("blind75-2").solved).toBe(false);
    expect(saved().timer.runningSince).not.toBeNull();
  });

  it("Pause the timer and continue pauses it and then does it", async () => {
    seed();
    renderPage(<BoardPage />);
    solveCd();
    fireEvent.click(await screen.findByRole("button", { name: "Pause the timer and continue" }));
    await waitFor(() => expect(saved("blind75-2").solved).toBe(true));
    expect(saved().timer.runningSince).toBeNull();
    expect(saved().timer.elapsedMs).toBeGreaterThanOrEqual(5 * MIN);
  });

  it("is free on the problem being timed: completing it records its time without asking", async () => {
    seed();
    renderPage(<BoardPage />);
    fireEvent.click(within(card("1 - Two Sum")).getByRole("button", { name: /^Complete R3/ }));
    await waitFor(() => expect(saved().attempts).toHaveLength(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(saved().attempts[0].ms).toBeGreaterThanOrEqual(5 * MIN);
  });

  it("does not ask when the timer is paused", async () => {
    seed({ elapsedMs: 5 * MIN, runningSince: null });
    renderPage(<BoardPage />);
    solveCd();
    await waitFor(() => expect(saved("blind75-2").solved).toBe(true));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks from the card menu too", async () => {
    seed();
    renderPage(<BoardPage />);
    fireEvent.click(within(card(CD)).getByLabelText("Card actions"));
    fireEvent.click(screen.getByRole("menuitem", { name: /Mark as solved/i }));
    expect(await screen.findByText("A timer is running")).toBeTruthy();
    expect(saved("blind75-2").solved).toBe(false);
  });

  it("asks in the tracker table too", async () => {
    seed();
    renderPage(<LeetCodeTracker />, "/");
    const row = screen.getByText("Contains Duplicate").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: /solved/i }));
    expect(await screen.findByText("A timer is running")).toBeTruthy();
    expect(saved("blind75-2").solved).toBe(false);
  });
});

describe("the running pill in the navbar", () => {
  it("shows the time, the problem and the activity, and ticks", () => {
    seed();
    renderPage(<BoardPage />);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("timer").textContent).toBe("5:00");
    expect(nav.textContent).toContain("Two Sum · R3");
    tick(3000);
    expect(within(nav).getByRole("timer").textContent).toBe("5:03");
  });

  it("is on every page", () => {
    seed();
    renderPage(<LeetCodeTracker />, "/");
    expect(within(screen.getByRole("navigation")).getByRole("timer")).toBeTruthy();
  });

  it("pauses the timer and disappears", () => {
    seed();
    renderPage(<BoardPage />);
    fireEvent.click(within(screen.getByRole("navigation")).getByRole("button", { name: /Pause timer/ }));
    expect(saved().timer.runningSince).toBeNull();
    expect(within(screen.getByRole("navigation")).queryByRole("timer")).toBeNull();
  });

  it("is not there when no timer runs", () => {
    seed({ elapsedMs: 5 * MIN, runningSince: null });
    renderPage(<BoardPage />);
    expect(within(screen.getByRole("navigation")).queryByRole("timer")).toBeNull();
  });
});
