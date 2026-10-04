// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import BoardPage from "./BoardPage";

// These render whole pages: give them room when the machine is busy.
vi.setConfig({ testTimeout: 20000 });

// Two Sum solved on 2026-10-01, today 2026-10-20 (only Date is faked).
const KEY = "leetcode-progress-v3";
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
  return {
    card: () => screen.getByText("1 - Two Sum").closest("article"),
    open: () => {
      const card = screen.getByText("1 - Two Sum").closest("article");
      fireEvent.click(within(card).getByRole("button", { name: /(Open|Add) solution/ }));
    },
  };
};

const sol = (code, extra = {}) => ({
  code,
  language: "python",
  source: "manual",
  savedAt: "2026-10-01",
  ...extra,
});

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

describe("the solution icon on the card", () => {
  it("offers to add one when there is none, and says nothing about code", () => {
    seed();
    const view = renderBoard();
    const button = within(view.card()).getByRole("button", { name: "Add solution" });
    expect(button.getAttribute("title")).toBe("Add solution");
    expect(button.querySelector("svg").getAttribute("fill")).toBe("none");
  });

  it("is grey and filled with a solution, and neither the icon nor the tooltip shows the code", () => {
    seed({ solutions: [sol("secret_code()")] });
    const view = renderBoard();
    const button = within(view.card()).getByRole("button", { name: "Open solution" });
    expect(button.className).not.toMatch(/purple/);
    expect(button.querySelector("svg").getAttribute("fill")).toBe("currentColor");
    expect(view.card().textContent).not.toContain("secret_code");
    expect(button.getAttribute("title")).not.toContain("secret_code");
  });

  it("opening the dialog hides the code and does not count as help", () => {
    seed({ solutions: [sol("secret_code()")] });
    const view = renderBoard();
    view.open();
    expect(screen.getByText("Show solution")).toBeTruthy();
    expect(document.body.textContent).not.toContain("secret_code");
    fireEvent.click(screen.getByText("Close"));
    expect(saved()).not.toHaveProperty("helpViewed");
  });

  it("showing the solution is remembered as looking it up today, and nothing else changes", () => {
    seed({ solutions: [sol("secret_code()")] });
    const view = renderBoard();
    view.open();
    fireEvent.click(screen.getByText("Show solution"));
    expect(document.body.textContent).toContain("secret_code");
    expect(saved().helpViewed).toEqual({ solution: "2026-10-20" });
    expect(saved().reviews).toEqual([true, true, false, false, false]);
    expect(saved().solutions).toEqual([sol("secret_code()")]);
  });
});

describe("writing a solution on the card", () => {
  const write = (code, language) => {
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: code } });
    if (language) fireEvent.change(screen.getByLabelText("Language"), { target: { value: language } });
    fireEvent.click(screen.getByText("Save"));
  };

  it("saves it with today as the edited day, without counting help, and turns the icon on", () => {
    seed();
    const view = renderBoard();
    view.open();
    expect(screen.getByLabelText("Language").value).toBe("python");
    write("x = 1");
    expect(saved().solutions).toEqual([
      { code: "x = 1", language: "python", source: "manual", savedAt: "2026-10-20" },
    ]);
    expect(saved().solutionEditedOn).toBe("2026-10-20");
    expect(saved()).not.toHaveProperty("helpViewed");
    expect(within(view.card()).getByRole("button", { name: "Open solution" })).toBeTruthy();
  });

  it("remembers the language of the last solution saved as the default", () => {
    seed();
    let view = renderBoard();
    view.open();
    write("fun a() {}", "kotlin");
    expect(localStorage.getItem("leetcode-solution-language")).toBe("kotlin");
    cleanup();
    seed();
    view = renderBoard();
    view.open();
    expect(screen.getByLabelText("Language").value).toBe("kotlin");
  });

  it("ignores a saved language that does not exist", () => {
    seed();
    localStorage.setItem("leetcode-solution-language", "cobol");
    renderBoard().open();
    expect(screen.getByLabelText("Language").value).toBe("python");
  });

  it("keeps two named solutions, and removing the first moves the second up", () => {
    seed({ solutions: [sol("one()", { name: "Brute force" })] });
    const view = renderBoard();
    view.open();
    fireEvent.click(screen.getByText("Show solution"));
    fireEvent.click(screen.getByText("Add another"));
    fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "Optimal" } });
    write("two()");
    expect(saved().solutions.map((s) => s.name)).toEqual(["Brute force", "Optimal"]);
    fireEvent.click(screen.getByRole("tab", { name: "Brute force" }));
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Remove"));
    fireEvent.click(screen.getByText("Yes, remove it"));
    expect(saved().solutions.map((s) => s.code)).toEqual(["two()"]);
  });

  it("unsolving the problem keeps its solutions", async () => {
    seed({ solutions: [sol("keep()")] });
    renderBoard();
    const card = screen.getByText("1 - Two Sum").closest("article");
    fireEvent.click(within(card).getByLabelText("Card actions"));
    fireEvent.click(screen.getByRole("menuitem", { name: /unsolve/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await act(async () => {});
    expect(saved().solved).toBe(false);
    expect(saved().solutions).toEqual([sol("keep()")]);
  });
});
