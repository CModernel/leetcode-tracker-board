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
// The numbers next to the heat map, by their label
const stat = (label) => screen.getByText(label).previousSibling.textContent;
const heat = () => screen.getByRole("img", { name: "Activity of the last weeks" });
const categoryRow = (name) => within(section("Categories")).getByText(name).closest("tr");

// Arrays & Hashing: 3 reviews, 2 needed help, all timed over the limit
const weakArrays = () => ({
  "blind75-1": solved({
    attempts: [
      attempt(1, { ms: 15 * MIN, limitMs: 10 * MIN }),
      attempt(1, { ms: 25 * MIN, limitMs: 10 * MIN }),
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
    expect(within(section("Categories")).getByText(/Nothing to analyse yet/)).toBeTruthy();
    expect(within(section("What to do today")).getByText("No reviews due today.")).toBeTruthy();
    expect(within(section("Try next")).getByText("1 - Two Sum")).toBeTruthy();
    expect(stat("Current streak")).toBe("0 days");
    expect(stat("Reviews overdue")).toBe("0");
    expect(stat("Mastered")).toBe("0/75");
    // no timer data yet: the slot stays, with the reason
    expect(stat("Average time")).toBe("-");
    expect(screen.getByText(/Needs 3 timed attempts \(0\)/)).toBeTruthy();
  });

  it("shows the table with the weak and slow category first, and every number", () => {
    seed({
      ...weakArrays(),
      // Trees: 3 reviews, all alone, no time: fine
      "blind75-30": solved({ attempts: [attempt(0), attempt(0), attempt(0)] }),
    });
    renderPage();
    const rows = within(section("Categories")).getAllByRole("row");
    expect(within(rows[1]).getByText("Arrays & Hashing")).toBeTruthy();
    const row = categoryRow("Arrays & Hashing");
    expect(row.textContent).toContain("1/8");
    expect(row.textContent).toContain("67% needed help");
    expect(row.textContent).toContain("Needs practice · slow");
    expect(row.textContent).toContain("1.8x the limit");
    expect(row.textContent).toContain("100% over · 3 timed");
    expect(within(row).getByRole("img").getAttribute("aria-label")).toBe(
      "1 alone, 2 needed help",
    );
    expect(categoryRow("Trees").textContent).toContain("Doing well");
    // Two Pointers has nothing done: it is only named below the table
    expect(within(section("Categories")).queryByRole("cell", { name: "Two Pointers" })).toBeNull();
    expect(within(section("Categories")).getByText(/Not started yet: .*Two Pointers/)).toBeTruthy();
  });

  it("shows five categories and Show more opens the rest", () => {
    const entries = {};
    // one problem started in each of 7 categories (ids from the list's own sections)
    [1, 9, 12, 16, 21, 23, 29].forEach((n) => {
      entries[`blind75-${n}`] = solved({ attempts: [attempt(0)] });
    });
    seed(entries);
    renderPage();
    const table = within(section("Categories"));
    expect(table.getAllByRole("row")).toHaveLength(1 + 5);
    fireEvent.click(table.getByRole("button", { name: "Show 2 more" }));
    expect(table.getAllByRole("row")).toHaveLength(1 + 7);
    fireEvent.click(table.getByRole("button", { name: "Show less" }));
    expect(table.getAllByRole("row")).toHaveLength(1 + 5);
  });

  it("suggests new problems of the weak category, easiest first", () => {
    seed(weakArrays());
    renderPage();
    const tryNext = section("Try next");
    expect(tryNext.textContent).toContain("categories that need practice");
    const titles = within(tryNext).getAllByRole("link").map((a) => a.textContent);
    expect(titles).toHaveLength(3);
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
    expect(within(section("What to do today")).getAllByRole("listitem")).toHaveLength(3);
    expect(section("What to do today").textContent).toContain("Showing 3 of 7");
    expect(within(section("What to do today")).getByRole("link", { name: "see all on the Board" })).toBeTruthy();
  });

  it("a category with something solved but few reviews says there is not enough data", () => {
    seed({ "blind75-9": solved({ attempts: [attempt(0)] }) });
    renderPage();
    expect(categoryRow("Two Pointers").textContent).toContain("Not enough data yet");
  });

  it("shows the heat map at the top with the streak, the week, the reviews coming and the total", () => {
    seed({
      "blind75-1": solved({ attempts: [attempt(0, { date: "2026-10-18" }), attempt(0, { date: "2026-10-19" })] }),
    });
    renderPage();
    expect(within(heat()).getByLabelText("Oct 19: 1 action")).toBeTruthy();
    expect(stat("Current streak")).toBe("2 days");
    expect(stat("Active days this week")).toBe("1/7");
    // R2 of Two Sum was due Oct 4: overdue
    expect(stat("Reviews overdue")).toBe("1");
    expect(stat("Due tomorrow")).toBe("0");
  });

  it("counts the mastered problems", () => {
    seed({ "blind75-1": solved({ reviews: [true, true, true, true, true] }), "blind75-2": solved() });
    renderPage();
    expect(stat("Mastered")).toBe("1/75");
  });

  it("compares the average time with the limit: under in green, over in amber", () => {
    const timed = (ms) => ({ attempts: [attempt(0, { ms: ms * MIN, limitMs: 10 * MIN }), attempt(0, { ms: ms * MIN, limitMs: 10 * MIN }), attempt(0, { ms: ms * MIN, limitMs: 10 * MIN })] });
    seed({ "blind75-1": solved(timed(8)) });
    renderPage();
    expect(stat("Average time")).toBe("20% under limit");
    expect(screen.getByText("avg 8:00 of 10:00")).toBeTruthy();
    expect(screen.getByText("20% under limit").className).toMatch(/green/);
    cleanup();
    seed({ "blind75-1": solved(timed(12)) });
    renderPage();
    expect(stat("Average time")).toBe("20% over limit");
    expect(screen.getByText("20% over limit").className).toMatch(/amber/);
  });

  it("says why there is no average time: too few attempts, or the timer is off", () => {
    seed({ "blind75-1": solved({ attempts: [attempt(0, { ms: 5 * MIN, limitMs: 10 * MIN })] }) });
    renderPage();
    expect(stat("Average time")).toBe("-");
    expect(screen.getByText("Needs 3 timed attempts (1)")).toBeTruthy();
    cleanup();
    localStorage.setItem("leetcode-show-timer", "false");
    renderPage();
    expect(stat("Average time")).toBe("-");
    expect(screen.getByText("Timer is off")).toBeTruthy();
  });

  it("the activity comes before the lists, not after", () => {
    renderPage();
    const heatBefore = heat().compareDocumentPosition(section("What to do today"));
    expect(heatBefore & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Activity" })).toBeNull();
  });

  it("changes with the selected list", () => {
    seed(weakArrays());
    renderPage();
    fireEvent.change(screen.getByLabelText("Problem list"), { target: { value: "NeetCode 150" } });
    expect(screen.getByRole("heading", { name: "Insights - NeetCode 150" })).toBeTruthy();
    expect(within(section("Categories")).getByText(/Nothing to analyse yet/)).toBeTruthy();
  });
});

describe("the Patterns card", () => {
  const withHistory = () =>
    seed({
      // Two Sum: R1 needed help then repeated on its day (50% help, both on time)
      "blind75-1": solved({
        dates: { initial: "2026-10-01" },
        attempts: [
          { date: "2026-10-02", review: 0, help: 1 },
          { date: "2026-10-04", review: 0, help: 0 },
        ],
      }),
      // Contains Duplicate: needed help twice, the first one late
      "blind75-2": solved({
        dates: { initial: "2026-10-01" },
        note: "use a set",
        attempts: [
          { date: "2026-10-10", review: 0, help: 1 },
          { date: "2026-10-12", review: 0, help: 1 },
        ],
      }),
    });
  const patterns = () => within(section("Patterns"));

  it("with no reviews says what will appear instead of four empty panels", () => {
    renderPage();
    expect(patterns().getByText(/Complete some reviews/)).toBeTruthy();
    expect(patterns().queryByText("Retention by review")).toBeNull();
  });

  it("shows retention by review: the share solved alone, a dash where there is too little data", () => {
    withHistory();
    renderPage();
    expect(patterns().getByRole("img", { name: "R1: 25% solved alone" })).toBeTruthy();
    expect(patterns().getByRole("img", { name: "R2: not enough data" })).toBeTruthy();
  });

  it("shows punctuality with the late count and the help on time", () => {
    withHistory();
    renderPage();
    expect(patterns().getByText("on time", { selector: "span" }).parentElement.textContent).toContain("75%");
    expect(patterns().getByText(/1 of 4 reviews was late/)).toBeTruthy();
    expect(patterns().getByText("Needed help: on time 67%")).toBeTruthy();
  });

  it("lists the problems harder than they look, worst first, and the notes effect line", () => {
    withHistory();
    renderPage();
    const titles = patterns()
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(titles.slice(0, 2)).toEqual(["2 - Contains Duplicate", "1 - Two Sum"]);
    expect(patterns().getByText((_, el) => el.tagName === "P" && el.textContent === "Easy · needed help in 2 of 2 reviews")).toBeTruthy();
    expect(patterns().getByText(/Notes: needs 3 reviews with and without a note/)).toBeTruthy();
  });

  it("names the categories not practiced for the longest time", () => {
    withHistory();
    renderPage();
    const panel = patterns().getByText("Not practiced lately").parentElement;
    expect(within(panel).getByText("Arrays & Hashing")).toBeTruthy();
    expect(within(panel).getByText("7 days ago")).toBeTruthy();
  });

  it("opening a problem of the list starts working on it", () => {
    withHistory();
    renderPage();
    fireEvent.click(patterns().getByText("2 - Contains Duplicate"));
    const entry = JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"]["blind75-2"];
    expect(entry.timer.runningSince).not.toBeNull();
  });
});
