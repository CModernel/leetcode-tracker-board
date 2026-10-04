// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import LeetCodeTracker from "./LeetCodeTracker";
import { SHOW_SOLUTIONS_KEY } from "../lib/preferences";

// These render whole pages: give them room when the machine is busy.
vi.setConfig({ testTimeout: 20000 });

const KEY = "leetcode-progress-v3";
const sol = (code, extra = {}) => ({
  code,
  language: "python",
  source: "manual",
  savedAt: "2026-10-01",
  ...extra,
});
const seed = (extra = {}) =>
  localStorage.setItem(
    KEY,
    JSON.stringify({
      version: 3,
      progress: {
        "Blind 75": {
          "blind75-1": {
            status: "solved",
            solved: true,
            solvedDate: "2026-10-01",
            reviews: [true, true, false, false, false],
            dates: { initial: "2026-10-01", review1: "2026-10-02", review2: "2026-10-04" },
            ...extra,
          },
        },
      },
    }),
  );
const saved = () => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"]["blind75-1"];

const renderTracker = () =>
  render(
    <ThemeProvider>
      <ProgressProvider>
        <ConfirmProvider>
          <LeetCodeTracker />
        </ConfirmProvider>
      </ProgressProvider>
    </ThemeProvider>,
  );
const row = () => screen.getByText("Two Sum").closest("tr");
const toggle = () => screen.getByRole("button", { name: /(show|hide) solutions/i });

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

describe("Solutions column", () => {
  it("is hidden by default, and the code is nowhere", () => {
    seed({ solutions: [sol("secret_code()")] });
    renderTracker();
    expect(screen.queryByRole("columnheader", { name: "Solutions" })).toBeNull();
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    expect(document.body.textContent).not.toContain("secret_code");
  });

  it("shows a plain View solution button, never the code", () => {
    seed({ solutions: [sol("secret_code()", { name: "Optimal" }), sol("other()", { language: "go" })] });
    renderTracker();
    fireEvent.click(toggle());
    expect(screen.getByRole("columnheader", { name: "Solutions" })).toBeTruthy();
    expect(within(row()).getByRole("button", { name: "Open solution for Two Sum" }).textContent).toBe(
      "View solution",
    );
    expect(document.body.textContent).not.toContain("secret_code");
    expect(toggle().textContent).toBe("Hide solutions");
  });

  it("offers Add solution for a problem without one", () => {
    renderTracker();
    fireEvent.click(toggle());
    const other = screen.getByText("Contains Duplicate").closest("tr");
    expect(within(other).getByRole("button", { name: "Add solution for Contains Duplicate" })).toBeTruthy();
  });

  it("remembers the choice, and is independent from the notes toggle", () => {
    renderTracker();
    fireEvent.click(toggle());
    expect(localStorage.getItem(SHOW_SOLUTIONS_KEY)).toBe("true");
    expect(screen.queryByRole("columnheader", { name: "Notes" })).toBeNull();
    cleanup();
    renderTracker();
    expect(screen.getByRole("columnheader", { name: "Solutions" })).toBeTruthy();
    fireEvent.click(toggle());
    expect(localStorage.getItem(SHOW_SOLUTIONS_KEY)).toBe("false");
  });

  it("opening hides the code and is not help; showing it is remembered as looking it up", () => {
    seed({ solutions: [sol("secret_code()")] });
    renderTracker();
    fireEvent.click(toggle());
    fireEvent.click(within(row()).getByRole("button", { name: "Open solution for Two Sum" }));
    expect(document.body.textContent).not.toContain("secret_code");
    expect(saved()).not.toHaveProperty("helpViewed");
    fireEvent.click(screen.getByText("Show solution"));
    expect(document.body.textContent).toContain("secret_code");
    expect(saved().helpViewed).toEqual({ solution: "2026-10-20" });
  });

  it("a solution written in the table is saved as written today, not as help", () => {
    seed();
    renderTracker();
    fireEvent.click(toggle());
    fireEvent.click(within(row()).getByRole("button", { name: "Add solution for Two Sum" }));
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "x = 1" } });
    fireEvent.click(screen.getByText("Save"));
    expect(saved().solutions[0].code).toBe("x = 1");
    expect(saved().solutionEditedOn).toBe("2026-10-20");
    expect(saved()).not.toHaveProperty("helpViewed");
    fireEvent.click(screen.getByText("Close"));
    expect(within(row()).getByRole("button", { name: "Open solution for Two Sum" }).textContent).toBe(
      "View solution",
    );
  });
});
