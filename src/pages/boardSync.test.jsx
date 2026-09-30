// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import LeetCodeTracker from "./LeetCodeTracker";
import BoardPage from "./BoardPage";

// The tracker table and the board are two views of the same data: what you do
// in one must show in the other. Both are rendered together, in one provider.
const renderBoth = () => {
  render(
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
  );
  const tracker = () => within(screen.getByTestId("tracker"));
  const board = () => within(screen.getByTestId("board"));
  const PROBLEM = "Two Sum"; // in the table
  const CARD = "1 - Two Sum"; // on the board: number - title
  return {
    tracker,
    board,
    row: () => tracker().getByText(PROBLEM).closest("tr"),
    // The card of the problem, or null when it is not on the board
    card: () => board().queryByText(CARD)?.closest("article") ?? null,
    columnOfCard: () =>
      board().queryByText(CARD)?.closest("section")?.querySelector("h2")
        ?.textContent ?? null,
    menu: (name) => {
      const card = board().getByText(CARD).closest("article");
      fireEvent.click(within(card).getByLabelText("Card actions"));
      fireEvent.click(screen.getByRole("menuitem", { name }));
    },
  };
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("board and tracker share the same data", () => {
  it("starts with the problem in To Do on the board and not solved in the table", () => {
    const view = renderBoth();
    expect(view.columnOfCard()).toBe("To Do");
    expect(within(view.row()).getByText("Not Solved")).toBeTruthy();
  });

  it("marking solved on the board shows as solved in the table, with reviews", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    expect(view.columnOfCard()).toBe("Reviewing");
    expect(within(view.row()).getByText("Solved")).toBeTruthy();
    expect(within(view.row()).getByRole("button", { name: "R1" })).toBeTruthy();
    expect(within(view.card()).getByText("R1")).toBeTruthy();
  });

  it("starting a problem on the board moves its card to In Progress", () => {
    const view = renderBoth();
    view.menu("Start");
    expect(view.columnOfCard()).toBe("In Progress");
    expect(within(view.row()).getByText("Not Solved")).toBeTruthy();
  });

  it("solving in the table moves the card to Reviewing", () => {
    const view = renderBoth();
    fireEvent.click(within(view.row()).getByText("Not Solved"));
    expect(view.columnOfCard()).toBe("Reviewing");
  });

  it("completing a review in the table moves the card to the next review", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    fireEvent.click(within(view.row()).getByRole("button", { name: "R1" }));
    expect(within(view.card()).getByText("R2")).toBeTruthy();
  });

  it("completing a review on the board marks it in the table", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Complete R1");
    expect(within(view.card()).getByText("R2")).toBeTruthy();
    // R2 can now be completed in the table (it needs R1 done first)
    expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(false);
  });

  it("undoing a review on the board unmarks it in the table", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Complete R1");
    view.menu("Undo R1");
    expect(within(view.card()).getByText("R1")).toBeTruthy();
    expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(true);
  });

  it("completing all five reviews moves the card to Mastered", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    for (const name of ["R1", "R2", "R3", "R4", "R5"]) {
      view.menu(`Complete ${name}`);
    }
    expect(view.columnOfCard()).toBe("Mastered");
  });

  it("unsolving in the table moves the card back to To Do", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    fireEvent.click(within(view.row()).getByText("Solved"));
    expect(view.columnOfCard()).toBe("To Do");
  });

  it("unsolving on the board asks in a dialog first and clears the table", async () => {
    const view = renderBoth();
    view.menu("Mark as solved");

    // Cancel: nothing changes
    view.menu("Unsolve");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {});
    expect(screen.queryByRole("alertdialog")).toBe(null);
    expect(view.columnOfCard()).toBe("Reviewing");

    // Confirm: back to To Do, and not solved in the table
    view.menu("Unsolve");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await act(async () => {});
    expect(view.columnOfCard()).toBe("To Do");
    expect(within(view.row()).getByText("Not Solved")).toBeTruthy();
  });

  it("a filter chosen in one view applies to the other", () => {
    const view = renderBoth();
    // Two Sum is Easy: filtering by Hard from the board's header removes it
    // from the table and from the board.
    const select = view.board().getByTitle("Difficulty");
    fireEvent.change(select, { target: { value: "Hard" } });
    expect(view.tracker().queryByText("Two Sum")).toBe(null);
    expect(view.card()).toBe(null);
    fireEvent.change(select, { target: { value: "All" } });
    expect(view.tracker().getByText("Two Sum")).toBeTruthy();
    expect(view.card()).not.toBe(null);
  });

  it("grouping by urgency shows only problems waiting for a review, by due date", () => {
    const view = renderBoth();
    view.menu("Mark as solved"); // R1 is due tomorrow

    fireEvent.click(view.board().getByRole("button", { name: "Urgency" }));
    const titles = view
      .board()
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent)
      .filter((t) => ["Overdue", "Today", "This week", "Later"].includes(t));
    expect(titles).toEqual(["Overdue", "Today", "This week", "Later"]);
    expect(view.columnOfCard()).toBe("This week");
    // A problem that was never started is not shown in this view
    expect(view.board().queryByText("2 - Contains Duplicate")).toBe(null);

    // Completing the review from the card still changes the tracker
    view.menu("Complete R1");
    expect(within(view.card()).getByText("R2")).toBeTruthy();
    expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(false);

    // Back to stages: everything is shown again
    fireEvent.click(view.board().getByRole("button", { name: "Stage" }));
    expect(view.columnOfCard()).toBe("Reviewing");
    expect(view.board().getByText("2 - Contains Duplicate")).toBeTruthy();
  });

  describe("Review today", () => {
    // Two Sum solved long ago: its R1 is overdue
    const withOverdueReview = () =>
      localStorage.setItem(
        "leetcode-progress-v3",
        JSON.stringify({
          version: 3,
          progress: {
            "Blind 75": {
              "blind75-1": {
                status: "solved",
                solved: true,
                solvedDate: "2020-01-01",
                reviews: [false, false, false, false, false],
                dates: { initial: "2020-01-01" },
              },
            },
            "LeetCode 75": {},
            "NeetCode 150": {},
          },
        })
      );

    it("counts the reviews due today on its button", () => {
      withOverdueReview();
      const view = renderBoth();
      expect(
        view.board().getByRole("button", { name: /Review today/ }).textContent
      ).toContain("1");
    });

    it("lists what is due, and completing it empties the queue and updates the tracker", async () => {
      withOverdueReview();
      const view = renderBoth();
      fireEvent.click(view.board().getByRole("button", { name: /Review today/ }));
      const queue = within(screen.getByRole("region", { name: "Review today" }));
      expect(queue.getByText("1 - Two Sum")).toBeTruthy();
      expect(queue.getByText(/days late/)).toBeTruthy();

      fireEvent.click(queue.getByRole("button", { name: "Complete R1" }));
      expect(queue.getByText(/all caught up/)).toBeTruthy();
      expect(
        view.board().getByRole("button", { name: /Review today/ }).textContent
      ).toContain("0");
      // The tracker shows R2 as the next review to complete
      expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(false);
      expect(within(view.card()).getByText("R2")).toBeTruthy();
    });

    it("can be undone from the message", async () => {
      withOverdueReview();
      const view = renderBoth();
      fireEvent.click(view.board().getByRole("button", { name: /Review today/ }));
      const queue = within(screen.getByRole("region", { name: "Review today" }));
      fireEvent.click(queue.getByRole("button", { name: "Complete R1" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(queue.getByRole("button", { name: "Complete R1" })).toBeTruthy();
    });

    it("has no Due Today filter on the board, and the tracker's filter does not empty the board", () => {
      withOverdueReview();
      const view = renderBoth();
      expect(view.board().queryByLabelText("Show Only Due Today")).toBe(null);
      const checkbox = view.tracker().getByLabelText("Show Only Due Today");
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      // Other problems are still on the board
      expect(view.board().getByText("2 - Contains Duplicate")).toBeTruthy();
    });
  });

  it("the list chosen in one view applies to the other", () => {
    const view = renderBoth();
    fireEvent.change(view.tracker().getByTitle("Select a problem list"), {
      target: { value: "NeetCode 150" },
    });
    expect(
      view.board().getByTitle("Select a problem list").value
    ).toBe("NeetCode 150");
  });
});
