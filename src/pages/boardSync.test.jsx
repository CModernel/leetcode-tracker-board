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
  const PROBLEM = "Two Sum";
  return {
    tracker,
    board,
    row: () => tracker().getByText(PROBLEM).closest("tr"),
    // The card of the problem, or null when it is not on the board
    card: () => board().queryByText(PROBLEM)?.closest("article") ?? null,
    columnOfCard: () =>
      board().queryByText(PROBLEM)?.closest("section")?.querySelector("h2")
        ?.textContent ?? null,
    menu: (name) => {
      const card = board().getByText(PROBLEM).closest("article");
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
