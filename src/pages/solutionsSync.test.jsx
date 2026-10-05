// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import LeetCodeTracker from "./LeetCodeTracker";
import BoardPage from "./BoardPage";

// These render whole pages: give them room when the machine is busy.
vi.setConfig({ testTimeout: 20000 });

// Two Sum solved on 2026-10-01 with R1 and R2 done: R3 is overdue. Today is
// 2026-10-20 (only Date is faked). Tracker and board share one provider.
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

const renderBoth = () => {
  render(
    <ThemeProvider>
      <ProgressProvider>
        <ConfirmProvider>
          <div data-testid="tracker">
            <LeetCodeTracker />
          </div>
          <div data-testid="board">
            <BoardPage />
          </div>
        </ConfirmProvider>
      </ProgressProvider>
    </ThemeProvider>,
  );
  const tracker = () => within(screen.getByTestId("tracker"));
  const board = () => within(screen.getByTestId("board"));
  return {
    row: () => tracker().getByText("Two Sum").closest("tr"),
    card: () => board().getByText("1 - Two Sum").closest("article"),
  };
};

const showColumn = () =>
  fireEvent.click(screen.getByRole("button", { name: /show solutions/i }));
const openFromCard = (view) =>
  fireEvent.click(within(view.card()).getByRole("button", { name: /(Open|Add) solution/ }));
const openFromRow = (view) =>
  fireEvent.click(within(view.row()).getByRole("button", { name: /(Open|Add) solution for Two Sum/ }));
const openTwoFromRow = (view) =>
  fireEvent.click(within(view.row()).getByRole("button", { name: "Open Brute force for Two Sum" }));
const complete = (view) =>
  fireEvent.click(within(view.card()).getByRole("button", { name: /^Complete R3/ }));
const write = (code) => {
  fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: code } });
  fireEvent.click(screen.getByText("Save"));
};
const suggested = () =>
  within(screen.getByRole("dialog")).getByText("Suggested").closest("button").textContent;

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

describe("a solution is the same in the tracker and on the board", () => {
  it("one written on the card shows in the table", () => {
    seed();
    const view = renderBoth();
    showColumn();
    openFromCard(view);
    write("x = 1");
    expect(within(view.row()).getByRole("button", { name: "Open solution for Two Sum" })).toBeTruthy();
  });

  it("one written in the table shows on the card", () => {
    seed();
    const view = renderBoth();
    showColumn();
    openFromRow(view);
    write("x = 1");
    expect(within(view.card()).getByRole("button", { name: "Open solution" })).toBeTruthy();
  });

  it("the second solution added on the card opens from the table with both tabs", () => {
    seed({ solutions: [sol("one()", { name: "Brute force" })] });
    const view = renderBoth();
    showColumn();
    openFromCard(view);
    fireEvent.click(screen.getByText("Add another"));
    fireEvent.change(screen.getByLabelText("Label (optional)"), { target: { value: "Optimal" } });
    write("two()");
    openTwoFromRow(view);
    expect(screen.getByRole("tab", { name: "Brute force" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Optimal" })).toBeTruthy();
  });
});

describe("a solution and how a review went", () => {
  it("showing the solution today makes Complete ask, suggesting the solution", () => {
    seed({ solutions: [sol("secret()")] });
    const view = renderBoth();
    openFromCard(view);
    fireEvent.click(screen.getByText("Close"));
    complete(view);
    expect(screen.getByText("You opened the solution today.")).toBeTruthy();
    expect(suggested()).toMatch(/Needed the solution/);
  });

  it("the same from the table", () => {
    seed({ solutions: [sol("secret()")] });
    const view = renderBoth();
    showColumn();
    openFromRow(view);
    fireEvent.click(screen.getByText("Close"));
    complete(view);
    expect(suggested()).toMatch(/Needed the solution/);
  });

  it("reading it and then saving a changed version is your own work: solved alone is suggested", () => {
    seed({ solutions: [sol("secret()")] });
    const view = renderBoth();
    openFromCard(view);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "better()" } });
    fireEvent.click(screen.getByText("Save"));
    complete(view);
    expect(suggested()).toMatch(/Solved it myself/);
  });

  it("reading it and saving it unchanged is still help", () => {
    seed({ solutions: [sol("secret()")] });
    const view = renderBoth();
    openFromCard(view);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Save"));
    complete(view);
    expect(suggested()).toMatch(/Needed the solution/);
  });

  it("writing a solution today and looking at it is not help: solved alone is suggested", () => {
    seed();
    const view = renderBoth();
    openFromCard(view);
    write("x = 1");
    openFromCard(view);
    fireEvent.click(screen.getByText("Close"));
    complete(view);
    expect(
      screen.getByText("You wrote or edited the note or solution today, so it does not count as help."),
    ).toBeTruthy();
    expect(suggested()).toMatch(/Solved it myself/);
  });

  it("a solution edited on another day and shown today still counts as help", () => {
    seed({ solutions: [sol("secret()")], solutionEditedOn: "2026-10-01" });
    const view = renderBoth();
    openFromCard(view);
    fireEvent.click(screen.getByText("Close"));
    complete(view);
    expect(suggested()).toMatch(/Needed the solution/);
  });

  it("answering needed the solution steps the review back and keeps the solutions and the history", async () => {
    seed({ solutions: [sol("secret()")] });
    const view = renderBoth();
    openFromCard(view);
    fireEvent.click(screen.getByText("Close"));
    complete(view);
    fireEvent.click(within(screen.getByRole("dialog")).getByText(/Needed the solution/));
    expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 2 }]);
    expect(saved().solutions).toEqual([sol("secret()")]);
    expect(saved()).not.toHaveProperty("helpViewed");
  });
});
