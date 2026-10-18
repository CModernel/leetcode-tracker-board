// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import { TimerSettingsProvider } from "../context/TimerSettingsProvider";
import InsightsPage from "./InsightsPage";

vi.setConfig({ testTimeout: 20000 });

// Blind 75: 1 Two Sum, 2 Contains Duplicate, 3 Valid Anagram (Arrays & Hashing);
// 10 3Sum ... (Two Pointers). Today is 2026-10-19 (a Monday).
const KEY = "leetcode-progress-v3";
const MIN = 60_000;
const solved = (extra = {}) => ({
  status: "solved",
  solved: true,
  solvedDate: "2026-10-01",
  reviews: [true, false, false, false, false],
  dates: { initial: "2026-10-01", review1: "2026-10-02" },
  ...extra,
});
const attempt = (help, extra = {}) => ({ date: "2026-10-18", review: 0, help, ...extra });
const seed = (entries) =>
  localStorage.setItem(KEY, JSON.stringify({ version: 3, progress: { "Blind 75": entries } }));

const renderPage = () =>
  render(
    <ThemeProvider>
      <TimerSettingsProvider>
        <ProgressProvider>
          <ConfirmProvider>
            <MemoryRouter>
              <InsightsPage />
            </MemoryRouter>
          </ConfirmProvider>
        </ProgressProvider>
      </TimerSettingsProvider>
    </ThemeProvider>,
  );
const section = (title) => screen.getByRole("heading", { name: title }).closest("section");
const categoryRow = (name) => within(section("By category")).getByText(name).closest("tr");

// Arrays & Hashing: 3 reviews, 2 with help (one solution), all timed over the limit
const weakArrays = () => ({
  "blind75-1": solved({
    attempts: [
      attempt(1, { ms: 15 * MIN, limitMs: 10 * MIN }),
      attempt(2, { ms: 25 * MIN, limitMs: 10 * MIN }),
      attempt(0, { ms: 14 * MIN, limitMs: 10 * MIN }),
    ],
  }),
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 19, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the Insights page", () => {
  it("with no history says what will appear and still suggests the first problems", () => {
    renderPage();
    expect(within(section("By category")).getByText(/Nothing to analyse yet/)).toBeTruthy();
    expect(within(section("What to do today")).getByText("No reviews due today.")).toBeTruthy();
    expect(within(section("Try next")).getByText("1 - Two Sum")).toBeTruthy();
    expect(within(section("Activity")).getByText("0 days")).toBeTruthy();
  });

  it("shows the numbers of each category and marks the weak and slow one first", () => {
    seed(weakArrays());
    renderPage();
    const rows = within(section("By category")).getAllByRole("row");
    expect(within(rows[1]).getByText("Arrays & Hashing")).toBeTruthy();
    const row = categoryRow("Arrays & Hashing");
    expect(row.textContent).toContain("1/8");
    expect(row.textContent).toContain("67% needed help");
    expect(row.textContent).toContain("Needs practice · slow");
    expect(row.textContent).toContain("1.8x the limit");
    expect(row.textContent).toContain("100% over · 3 timed");
    expect(within(row).getByRole("img").getAttribute("aria-label")).toBe(
      "1 alone, 1 with the note, 1 with the solution",
    );
    // Two Pointers has nothing done: it is only named below the table
    expect(within(section("By category")).queryByRole("cell", { name: "Two Pointers" })).toBeNull();
    expect(within(section("By category")).getByText(/Not started yet: .*Two Pointers/)).toBeTruthy();
  });

  it("hides the time column when the timer is switched off", () => {
    seed(weakArrays());
    localStorage.setItem("leetcode-show-timer", "false");
    renderPage();
    expect(within(section("By category")).queryByRole("columnheader", { name: "Time" })).toBeNull();
  });

  it("suggests new problems of the weak category, easiest first", () => {
    seed(weakArrays());
    renderPage();
    const tryNext = section("Try next");
    expect(tryNext.textContent).toContain("categories that need practice");
    const titles = within(tryNext).getAllByRole("link").map((a) => a.textContent);
    expect(titles[0]).toBe("2 - Contains Duplicate");
    expect(titles).not.toContain("1 - Two Sum");
  });

  it("lists today's reviews with the weak ones first and how late they are", () => {
    seed({
      ...weakArrays(),
      // Two Pointers problem with R1 overdue by more days, but not weak
      "blind75-10": solved({ solvedDate: "2026-09-01", reviews: [false, false, false, false, false], dates: { initial: "2026-09-01" } }),
    });
    renderPage();
    const items = within(section("What to do today")).getAllByRole("listitem");
    expect(items[0].textContent).toContain("Two Sum");
    expect(items[0].textContent).toContain("Needs practice");
    expect(items[1].textContent).toMatch(/R1 · \d+ days late/);
  });

  it("opening a suggested problem starts working on it", () => {
    renderPage();
    fireEvent.click(within(section("Try next")).getByText("1 - Two Sum"));
    const entry = JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"]["blind75-1"];
    expect(entry.status).toBe("in-progress");
    expect(entry.timer.runningSince).not.toBeNull();
  });

  it("says when there are more reviews due than the ones listed", () => {
    const due = (n) =>
      solved({ solvedDate: "2026-09-01", reviews: [false, false, false, false, false], dates: { initial: "2026-09-01" } });
    seed(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [`blind75-${n}`, due(n)])));
    renderPage();
    expect(within(section("What to do today")).getAllByRole("listitem")).toHaveLength(5);
    expect(section("What to do today").textContent).toContain("Showing 5 of 7");
    expect(within(section("What to do today")).getByRole("link", { name: "see all on the Board" })).toBeTruthy();
  });

  it("a category with something solved but few reviews says there is not enough data", () => {
    seed({ "blind75-9": solved({ attempts: [attempt(0)] }) });
    renderPage();
    expect(categoryRow("Two Pointers").textContent).toContain("Not enough data yet");
  });

  it("shows the streak, the week and the reviews coming", () => {
    seed({
      "blind75-1": solved({ attempts: [attempt(0, { date: "2026-10-18" }), attempt(0, { date: "2026-10-19" })] }),
    });
    renderPage();
    expect(within(section("Activity")).getByText("2 days")).toBeTruthy();
    expect(within(section("Activity")).getByText("1/7")).toBeTruthy();
    expect(within(section("Activity")).getByLabelText("Oct 19: 1 action")).toBeTruthy();
    // R2 of Two Sum was due Oct 4: overdue
    expect(within(section("Coming up")).getByText("1 review overdue")).toBeTruthy();
  });

  it("changes with the selected list", () => {
    seed(weakArrays());
    renderPage();
    fireEvent.change(screen.getByLabelText("Problem list"), { target: { value: "NeetCode 150" } });
    expect(screen.getByRole("heading", { name: "Insights - NeetCode 150" })).toBeTruthy();
    expect(within(section("By category")).getByText(/Nothing to analyse yet/)).toBeTruthy();
  });
});
