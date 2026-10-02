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
    expect(within(view.card()).getByText(/^R1 ·/)).toBeTruthy();
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
    expect(within(view.card()).getByText(/^R2 ·/)).toBeTruthy();
  });

  it("completing a review on the board marks it in the table", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Complete R1");
    expect(within(view.card()).getByText(/^R2 ·/)).toBeTruthy();
    // R2 can now be completed in the table (it needs R1 done first)
    expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(false);
  });

  it("undoing a review on the board unmarks it in the table", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Complete R1");
    view.menu("Undo R1");
    expect(within(view.card()).getByText(/^R1 ·/)).toBeTruthy();
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

  it("an action from the card menu shows a message, and Undo brings the problem back", () => {
    const view = renderBoth();
    view.menu("Start");
    expect(screen.getByText("Moved to In Progress")).toBeTruthy();
    view.menu("Mark as solved");
    expect(screen.getByText("Marked as solved")).toBeTruthy();
    expect(view.columnOfCard()).toBe("Reviewing");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(view.columnOfCard()).toBe("In Progress");
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
    expect(within(view.card()).getByText(/^R2 ·/)).toBeTruthy();
    expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(false);

    // Back to stages: everything is shown again
    fireEvent.click(view.board().getByRole("button", { name: "Stage" }));
    expect(view.columnOfCard()).toBe("Reviewing");
    expect(view.board().getByText("2 - Contains Duplicate")).toBeTruthy();
  });

  describe("Complete button on the cards", () => {
    it("has no button on a card in To Do or In Progress", () => {
      const view = renderBoth();
      expect(within(view.card()).queryByRole("button", { name: /Complete/ })).toBe(null);
      view.menu("Start");
      expect(within(view.card()).queryByRole("button", { name: /Complete/ })).toBe(null);
    });

    it("says early for a review that is not due yet, and completing it moves the card on", async () => {
      const view = renderBoth();
      view.menu("Mark as solved"); // R1 is due tomorrow
      const button = within(view.card()).getByRole("button", { name: "Complete R1 early" });
      expect(button.title).toMatch(/before the due date/);
      fireEvent.click(button);
      expect(within(view.card()).getByText(/^R2 ·/)).toBeTruthy();
      expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(false);
      expect(screen.getByText("Completed R1")).toBeTruthy();
    });

    it("can be undone from the message", () => {
      const view = renderBoth();
      view.menu("Mark as solved");
      fireEvent.click(within(view.card()).getByRole("button", { name: "Complete R1 early" }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(within(view.card()).getByRole("button", { name: "Complete R1 early" })).toBeTruthy();
      expect(within(view.row()).getByRole("button", { name: "R2" }).disabled).toBe(true);
    });

    it("is a plain Complete button, without early, when the review is overdue", () => {
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
                dates: {},
              },
            },
          },
        })
      );
      const view = renderBoth();
      const button = within(view.card()).getByRole("button", { name: "Complete R1" });
      expect(button.title).toMatch(/late/);
      expect(button.textContent).toMatch(/^R1 · \d+d late$/);
    });

    it("goes through all five reviews with the button, ending in Mastered", () => {
      const view = renderBoth();
      view.menu("Mark as solved");
      for (const n of [1, 2, 3, 4, 5]) {
        fireEvent.click(
          within(view.card()).getByRole("button", { name: new RegExp(`^Complete R${n}`) })
        );
      }
      expect(view.columnOfCard()).toBe("Mastered");
      expect(within(view.card()).queryByRole("button", { name: /Complete/ })).toBe(null);
    });

    it("also works in the by-urgency view", () => {
      const view = renderBoth();
      view.menu("Mark as solved");
      fireEvent.click(view.board().getByRole("button", { name: "Urgency" }));
      fireEvent.click(within(view.card()).getByRole("button", { name: "Complete R1 early" }));
      expect(within(view.card()).getByText(/^R2 ·/)).toBeTruthy();
    });
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
      expect(within(view.card()).getByText(/^R2 ·/)).toBeTruthy();
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

  describe("tab title", () => {
    const overdue = () =>
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
                dates: {},
              },
            },
          },
        })
      );

    it("shows how many reviews are due, and the plain title when none", () => {
      document.title = "CodeTrack Pro";
      overdue();
      const view = renderBoth();
      expect(document.title).toBe("(1) CodeTrack Pro");
      // Completing the review in the table clears the number
      fireEvent.click(within(view.row()).getByRole("button", { name: "R1" }));
      expect(document.title).toBe("CodeTrack Pro");
      // Undoing it brings the number back
      fireEvent.click(within(view.row()).getByRole("button", { name: "R1" }));
      expect(document.title).toBe("(1) CodeTrack Pro");
    });

    it("has no number when nothing is due", () => {
      document.title = "CodeTrack Pro";
      renderBoth();
      expect(document.title).toBe("CodeTrack Pro");
    });

    it("gives the plain title back when the app closes", () => {
      document.title = "CodeTrack Pro";
      overdue();
      renderBoth();
      expect(document.title).toBe("(1) CodeTrack Pro");
      cleanup();
      expect(document.title).toBe("CodeTrack Pro");
    });

    it("counts the selected list", () => {
      document.title = "CodeTrack Pro";
      overdue();
      const view = renderBoth();
      fireEvent.change(view.tracker().getByTitle("Select a problem list"), {
        target: { value: "NeetCode 150" },
      });
      expect(document.title).toBe("CodeTrack Pro"); // nothing due in that list
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

describe("notes are shared between the table and the board", () => {
  const showNotes = (view) =>
    fireEvent.click(view.tracker().getByRole("button", { name: /show notes/i }));
  const cardNote = (view) =>
    within(view.card()).getByRole("button", { name: /(add|read) note/i });
  // A note that exists opens to be read: press Edit to change it
  const openEditor = (view) => {
    fireEvent.click(cardNote(view));
    const edit = screen.queryByRole("button", { name: "Edit" });
    if (edit) fireEvent.click(edit);
  };
  const editOnBoard = (view, text) => {
    openEditor(view);
    fireEvent.change(screen.getByRole("textbox", { name: /note for two sum/i }), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  };

  it("a note written in the table shows on the card", () => {
    const view = renderBoth();
    showNotes(view);
    fireEvent.click(within(view.row()).getByRole("button", { name: /add note/i }));
    const field = within(view.row()).getByRole("textbox");
    fireEvent.change(field, { target: { value: "Use a hash map" } });
    fireEvent.blur(field);
    const button = cardNote(view);
    expect(button.getAttribute("aria-label")).toBe("Read note");
    expect(button.getAttribute("title")).toBe("Use a hash map");
  });

  it("a note written on the card shows in the table", () => {
    const view = renderBoth();
    showNotes(view);
    editOnBoard(view, "Two pointers");
    expect(within(view.row()).getByText("Two pointers")).toBeTruthy();
  });

  it("the card offers to add a note when there is none", () => {
    const view = renderBoth();
    expect(cardNote(view).getAttribute("aria-label")).toBe("Add note");
  });

  it("the dialog opens with the current note and Cancel keeps it", () => {
    const view = renderBoth();
    editOnBoard(view, "keep");
    openEditor(view);
    const field = screen.getByRole("textbox", { name: /note for two sum/i });
    expect(field.value).toBe("keep");
    fireEvent.change(field, { target: { value: "discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: /note for two sum/i })).toBeNull();
    expect(cardNote(view).getAttribute("title")).toBe("keep");
  });

  it("Ctrl+Enter saves and emptying the text removes the note", () => {
    const view = renderBoth();
    editOnBoard(view, "first");
    openEditor(view);
    const field = screen.getByRole("textbox", { name: /note for two sum/i });
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    expect(cardNote(view).getAttribute("aria-label")).toBe("Add note");
  });

  it("the note stays when the problem moves, is solved and unsolved", () => {
    const view = renderBoth();
    editOnBoard(view, "remember");
    view.menu("Mark as solved");
    expect(cardNote(view).getAttribute("title")).toBe("remember");
    view.menu("Complete R1");
    fireEvent.click(within(view.row()).getByText("Solved"));
    // un-solving from the table keeps it
    expect(cardNote(view).getAttribute("title")).toBe("remember");
  });

  describe("reading a note on the card", () => {
    const withNote = (view) => editOnBoard(view, "Use a hash map\nthen check twice");

    it("opens to read it: the text is shown, not an editor", () => {
      const view = renderBoth();
      withNote(view);
      fireEvent.click(cardNote(view));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText(/Use a hash map/)).toBeTruthy();
      expect(within(dialog).queryByRole("textbox")).toBeNull();
      expect(within(dialog).queryByRole("button", { name: "Save" })).toBeNull();
      expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "Edit" })).toBeTruthy();
    });

    it("keeps the line breaks of the note", () => {
      const view = renderBoth();
      withNote(view);
      fireEvent.click(cardNote(view));
      const text = screen.getByRole("dialog").querySelector("p.whitespace-pre-wrap");
      expect(text.textContent).toBe("Use a hash map\nthen check twice");
    });

    it("Close changes nothing", () => {
      const view = renderBoth();
      withNote(view);
      fireEvent.click(cardNote(view));
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(cardNote(view).getAttribute("title")).toMatch(/Use a hash map/);
    });

    it("Edit switches to the editor with the same text, and Save keeps the change", () => {
      const view = renderBoth();
      withNote(view);
      fireEvent.click(cardNote(view));
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const field = screen.getByRole("textbox", { name: /note for two sum/i });
      expect(field.value).toBe("Use a hash map\nthen check twice");
      fireEvent.change(field, { target: { value: "new text" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect(cardNote(view).getAttribute("title")).toBe("new text");
    });

    it("Escape closes it, and a problem with no note opens straight in the editor", () => {
      const view = renderBoth();
      fireEvent.click(cardNote(view));
      expect(screen.getByRole("textbox", { name: /note for two sum/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    });

    it("Ctrl+Enter does nothing while only reading", () => {
      const view = renderBoth();
      withNote(view);
      fireEvent.click(cardNote(view));
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter", ctrlKey: true });
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  it("typing in the dialog does not start a drag (keys stay in the dialog)", () => {
    const view = renderBoth();
    fireEvent.click(cardNote(view));
    const field = screen.getByRole("textbox", { name: /note for two sum/i });
    fireEvent.keyDown(field, { key: " ", code: "Space" });
    fireEvent.keyDown(field, { key: "Enter", code: "Enter" });
    expect(field).toBeTruthy();
    expect(screen.queryByText(/dragging|picked up/i)).toBeNull();
  });
});

describe("going back more than one review", () => {
  // Solved with R1, R2 and R3 done, using the board menu (same data as the table)
  const threeDone = () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Complete R1");
    view.menu("Complete R2");
    view.menu("Complete R3");
    return view;
  };
  const rButton = (view, name) =>
    within(view.row()).getByRole("button", { name });

  it("in the table, going back one review asks nothing", () => {
    const view = threeDone();
    fireEvent.click(rButton(view, "R3"));
    expect(screen.queryByRole("alertdialog")).toBe(null);
    expect(within(view.card()).getByText(/^R3 ·/)).toBeTruthy();
    expect(rButton(view, "R3").disabled).toBe(false);
    expect(rButton(view, "R2").disabled).toBe(false);
  });

  it("in the table, an earlier review is enabled and asks before erasing the later ones", async () => {
    const view = threeDone();
    expect(rButton(view, "R1").disabled).toBe(false);
    fireEvent.click(rButton(view, "R1"));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Go back to R1?")).toBeTruthy();
    expect(within(dialog).getByText(/R1, R2 and R3 and their dates will be erased/)).toBeTruthy();

    // Cancel: nothing changes
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {});
    expect(within(view.card()).getByText(/^R4 ·/)).toBeTruthy();

    // Confirm: back at R1, in the table and on the board
    fireEvent.click(rButton(view, "R1"));
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await act(async () => {});
    expect(within(view.card()).getByText(/^R1 ·/)).toBeTruthy();
    expect(rButton(view, "R2").disabled).toBe(true);
    expect(view.columnOfCard()).toBe("Reviewing");
  });

  it("on the board, the menu offers going back and asks first", async () => {
    const view = threeDone();
    view.menu("Go back to R2");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    await act(async () => {});
    // R1 is still done, R2 and R3 are not: R2 is the next review
    expect(within(view.card()).getByText(/^R2 ·/)).toBeTruthy();
    expect(rButton(view, "R2").disabled).toBe(false);
    expect(rButton(view, "R3").disabled).toBe(true);
  });

  it("the board menu does not offer going back with only one review done", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Complete R1");
    const card = view.board().getByText("1 - Two Sum").closest("article");
    fireEvent.click(within(card).getByLabelText("Card actions"));
    expect(screen.queryByRole("menuitem", { name: /Go back to/ })).toBe(null);
    expect(screen.getByRole("menuitem", { name: "Undo R1" })).toBeTruthy();
  });
});

describe("the review button and how it went", () => {
  // Two Sum solved on 2026-10-01 with R1 and R2 done on time, today 2026-10-20
  // (R3 was due 10-08: overdue). Only Date is faked, so timers still run.
  const seed = (extra = {}) =>
    localStorage.setItem(
      "leetcode-progress-v3",
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
              note: "Use a hash map",
              ...extra,
            },
          },
        },
      })
    );
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
    seed();
  });
  afterEach(() => vi.useRealTimers());

  const completeButton = (view) =>
    within(view.card()).getByRole("button", { name: /^Complete R3/ });
  const saved = () =>
    JSON.parse(localStorage.getItem("leetcode-progress-v3")).progress["Blind 75"]["blind75-1"];
  const openNoteOnCard = (view) =>
    fireEvent.click(within(view.card()).getByRole("button", { name: "Read note" }));
  const closeNote = () => fireEvent.click(screen.getByRole("button", { name: "Close" }));

  describe("the solved date", () => {
    it("is on the card, so the date of R1 makes sense", () => {
      const view = renderBoth();
      expect(within(view.card()).getByText("Solved Oct 1")).toBeTruthy();
    });

    it("is in the tracker under Solved", () => {
      const view = renderBoth();
      expect(within(view.row()).getByTitle("Solved on Oct 1").textContent).toBe("Oct 1");
    });

    it("is not shown for a problem that is not solved", () => {
      localStorage.clear();
      const view = renderBoth();
      expect(within(view.card()).queryByText(/^Solved /)).toBeNull();
      expect(within(view.row()).queryByTitle(/Solved on/)).toBeNull();
    });

    it("follows the problem when it is solved from the board", () => {
      localStorage.clear();
      const view = renderBoth();
      view.menu("Mark as solved");
      const now = new Date();
      const label = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      expect(within(view.card()).getByText(`Solved ${label}`)).toBeTruthy();
      expect(within(view.row()).getByTitle(`Solved on ${label}`)).toBeTruthy();
    });
  });

  describe("the button", () => {
    it("is the review and the action in one: no separate chip, date or help link", () => {
      const view = renderBoth();
      const card = view.card();
      expect(completeButton(view).textContent).toBe("R3 · 12d late");
      expect(within(card).queryByRole("button", { name: /help/i })).toBeNull();
      expect(within(card).queryByText("Sep 8")).toBeNull();
    });

    it("overdue says how late, with the date in the tooltip", () => {
      const view = renderBoth();
      expect(completeButton(view).getAttribute("title")).toBe("Due Oct 8 · 12 days late");
    });

    it("due today says today", () => {
      seed({ dates: { initial: "2026-10-01", review1: "2026-10-02", review2: "2026-10-04" }, solvedDate: "2026-10-01", dueOverride: { review: 2, date: "2026-10-20" } });
      const view = renderBoth();
      expect(completeButton(view).textContent).toBe("R3 · today");
      expect(completeButton(view).getAttribute("title")).toBe("Due today");
    });

    it("not due yet shows the date, says early in its name and warns in the tooltip", () => {
      seed({ dueOverride: { review: 2, date: "2026-10-25" } });
      const view = renderBoth();
      const button = within(view.card()).getByRole("button", { name: "Complete R3 early" });
      expect(button.textContent).toBe("R3 · Oct 25");
      expect(button.getAttribute("title")).toMatch(/^Due Oct 25\. Reviewing before/);
    });

    it("is red when overdue, yellow today, and a dashed outline when not due yet", () => {
      let view = renderBoth();
      expect(completeButton(view).className).toMatch(/bg-red/);
      cleanup();
      seed({ dueOverride: { review: 2, date: "2026-10-20" } });
      view = renderBoth();
      expect(completeButton(view).className).toMatch(/bg-yellow/);
      expect(completeButton(view).className).not.toMatch(/dashed/);
      cleanup();
      seed({ dueOverride: { review: 2, date: "2026-10-25" } });
      view = renderBoth();
      expect(completeButton(view).className).toMatch(/border-dashed/);
    });

    it("shows a clock when the review can wait and a check when it is due", () => {
      const icon = (view) => completeButton(view).querySelector("svg").getAttribute("class");
      let view = renderBoth();
      expect(icon(view)).toMatch(/lucide-check/);
      cleanup();
      seed({ dueOverride: { review: 2, date: "2026-10-25" } });
      view = renderBoth();
      expect(icon(view)).toMatch(/lucide-clock/);
    });
  });

  describe("completing without opening anything", () => {
    it("completes at once as solved alone, and writes it in the history", () => {
      const view = renderBoth();
      fireEvent.click(completeButton(view));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByText("Completed R3")).toBeTruthy();
      expect(saved().reviews).toEqual([true, true, true, false, false]);
      expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 0 }]);
    });

    it("Undo brings the review and the history back", () => {
      const view = renderBoth();
      fireEvent.click(completeButton(view));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(saved().reviews).toEqual([true, true, false, false, false]);
      expect(saved().attempts).toBeUndefined();
    });

    it("the Review today queue completes the same way", () => {
      const view = renderBoth();
      fireEvent.click(view.board().getByRole("button", { name: /Review today/ }));
      const queue = screen.getByRole("region", { name: "Review today" });
      fireEvent.click(within(queue).getByRole("button", { name: "Complete R3" }));
      expect(saved().reviews).toEqual([true, true, true, false, false]);
      expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 0 }]);
    });

    it("the queue asks too when the note was opened today", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(view.board().getByRole("button", { name: /Review today/ }));
      const queue = screen.getByRole("region", { name: "Review today" });
      fireEvent.click(within(queue).getByRole("button", { name: "Complete R3" }));
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
  });

  describe("after opening the note", () => {
    it("opening a note that is there remembers it, and changes nothing else", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      expect(saved().helpViewed).toEqual({ note: "2026-10-20" });
      expect(saved().reviews).toEqual([true, true, false, false, false]);
    });

    it("then Complete asks how it went, with the note suggested and focused", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(completeButton(view));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("How did it go?")).toBeTruthy();
      expect(within(dialog).getByText("You opened the note today.")).toBeTruthy();
      // Only the suggested option is marked, with a badge and not a ring
      const badges = within(dialog).getAllByText("Suggested");
      expect(badges).toHaveLength(1);
      expect(badges[0].closest("button").textContent).toMatch(/Needed the note/);
      expect(dialog.innerHTML).not.toMatch(/ring-2 ring-blue-400/);
      expect(within(dialog).getByText("Next review: R4 in 7 days (Oct 27)")).toBeTruthy();
      expect(within(dialog).getByText("Repeat R3 in 2 days (Oct 22)")).toBeTruthy();
      expect(within(dialog).getByText("Back to R2 in 2 days (Oct 22)")).toBeTruthy();
      expect(saved().reviews).toEqual([true, true, false, false, false]);
    });

    it("Cancel changes nothing and asks again next time", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(completeButton(view));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(saved().reviews).toEqual([true, true, false, false, false]);
      expect(saved().attempts).toBeUndefined();
      fireEvent.click(completeButton(view));
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("solved it myself completes the review", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(completeButton(view));
      fireEvent.click(screen.getByRole("button", { name: /Solved it myself/ }));
      expect(screen.getByText("Completed R3")).toBeTruthy();
      expect(saved().reviews).toEqual([true, true, true, false, false]);
      expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 0 }]);
      expect(saved()).not.toHaveProperty("helpViewed");
    });

    it("needed the note repeats R3 in 2 days, and the table shows that date", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(completeButton(view));
      fireEvent.click(screen.getByRole("button", { name: /Needed the note/ }));
      expect(screen.getByText("R3 again in 2 days")).toBeTruthy();
      expect(saved().reviews).toEqual([true, true, false, false, false]);
      expect(saved().attempts[0]).toEqual({ date: "2026-10-20", review: 2, help: 1 });
      expect(completeButton(view).textContent).toBe("R3 · Oct 22");
      expect(within(view.row()).getByText("Oct 22")).toBeTruthy();
    });

    it("needed the solution goes one review back, not a reset", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(completeButton(view));
      fireEvent.click(screen.getByRole("button", { name: /Needed the solution/ }));
      expect(screen.getByText("Back to R2 in 2 days")).toBeTruthy();
      expect(saved().reviews).toEqual([true, false, false, false, false]);
      expect(saved().solved).toBe(true);
      expect(saved().attempts[0]).toEqual({ date: "2026-10-20", review: 2, help: 2 });
    });

    it("Undo brings back the review, the history and the reminder that the note was opened", () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(completeButton(view));
      fireEvent.click(screen.getByRole("button", { name: /Needed the solution/ }));
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
      expect(saved().reviews).toEqual([true, true, false, false, false]);
      expect(saved().attempts).toBeUndefined();
      expect(saved().helpViewed).toEqual({ note: "2026-10-20" });
    });

    it("reading the note in the tracker counts too", () => {
      const view = renderBoth();
      fireEvent.click(view.tracker().getByRole("button", { name: /show notes/i }));
      fireEvent.click(within(view.row()).getByRole("button", { name: /edit note for two sum/i }));
      fireEvent.keyDown(within(view.row()).getByRole("textbox"), { key: "Escape" });
      fireEvent.click(completeButton(view));
      expect(screen.getByRole("dialog")).toBeTruthy();
    });

    it("the note opened on another day does not ask", () => {
      seed({ helpViewed: { note: "2026-10-19" } });
      const view = renderBoth();
      fireEvent.click(completeButton(view));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(saved().reviews).toEqual([true, true, true, false, false]);
    });

    it("opening the note of a problem that has none asks nothing later", () => {
      seed({ note: undefined });
      const view = renderBoth();
      fireEvent.click(within(view.card()).getByRole("button", { name: "Add note" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(completeButton(view));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("the solution opened today is suggested instead", () => {
      seed({ helpViewed: { solution: "2026-10-20" } });
      const view = renderBoth();
      fireEvent.click(completeButton(view));
      expect(screen.getByText("You opened the solution today.")).toBeTruthy();
    });
  });

  // A real drag (mouse down, move, up) onto the green "done" zone of the
  // by-urgency view. jsdom has no layout, so only the zone gets a rectangle
  // and the pointer is moved inside it.
  describe("dropping a card on the done zone", () => {
    const dropOnDoneZone = (view) => {
      fireEvent.click(view.board().getByRole("button", { name: "Urgency" }));
      const zone = screen.getByText("Drop a card here to complete its review").closest("div");
      const rect = { left: 0, top: 2000, right: 500, bottom: 2050, width: 500, height: 50, x: 0, y: 2000 };
      vi.spyOn(zone, "getBoundingClientRect").mockReturnValue(rect);
      const handle = view.card().parentElement;
      fireEvent.mouseDown(handle, { button: 0, clientX: 5, clientY: 5 });
      fireEvent.mouseMove(document, { clientX: 5, clientY: 30 });
      fireEvent.mouseMove(document, { clientX: 100, clientY: 2025 });
      fireEvent.mouseUp(document, { clientX: 100, clientY: 2025 });
    };
    // dnd-kit swallows the click that follows a drop until the next tick
    const afterDrop = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    it("completes the review as solved alone and writes it in the history", async () => {
      const view = renderBoth();
      dropOnDoneZone(view);
      await afterDrop();
      expect(saved().reviews).toEqual([true, true, true, false, false]);
      expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 0 }]);
      expect(screen.getByText("Completed R3")).toBeTruthy();
    });

    it("asks how it went when the note was opened today, and nothing changes until answered", async () => {
      const view = renderBoth();
      openNoteOnCard(view);
      closeNote();
      dropOnDoneZone(view);
      await afterDrop();
      expect(screen.getByText("How did it go?")).toBeTruthy();
      expect(saved().reviews).toEqual([true, true, false, false, false]);
      fireEvent.click(screen.getByRole("button", { name: /Needed the note/ }));
      expect(saved().reviews).toEqual([true, true, false, false, false]);
      expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 1 }]);
    });
  });

  describe("what a help outcome changes in both views", () => {
    const answerWithNote = (view, option) => {
      openNoteOnCard(view);
      closeNote();
      fireEvent.click(completeButton(view));
      fireEvent.click(screen.getByRole("button", { name: option }));
    };
    const queueButton = (view) => view.board().getByRole("button", { name: /Review today/ });

    it("needed the note takes the review out of the Review today queue until its new date", () => {
      const view = renderBoth();
      expect(queueButton(view).textContent).toContain("1");
      answerWithNote(view, /Needed the note/);
      expect(queueButton(view).textContent).toContain("0");
      expect(saved().dueOverride).toEqual({ review: 2, date: "2026-10-22" });
    });

    it("needed the solution puts the card back on R2 and the table shows it pending", () => {
      const view = renderBoth();
      answerWithNote(view, /Needed the solution/);
      expect(view.columnOfCard()).toBe("Reviewing");
      expect(within(view.card()).getByRole("button", { name: /^Complete R2/ })).toBeTruthy();
      expect(saved().dueOverride).toEqual({ review: 1, date: "2026-10-22" });
      expect(within(view.row()).getByText("Oct 22")).toBeTruthy();
    });

    it("the history is kept when the problem is unsolved", async () => {
      const view = renderBoth();
      answerWithNote(view, /Needed the note/);
      view.menu("Unsolve");
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      await act(async () => {});
      expect(view.columnOfCard()).toBe("To Do");
      expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 1 }]);
      expect(saved()).not.toHaveProperty("dueOverride");
    });

    it("each attempt adds to the history, in order", () => {
      const view = renderBoth();
      answerWithNote(view, /Needed the note/);
      // R3 now waits for Oct 22, so completing it today is early
      fireEvent.click(completeButton(view));
      expect(saved().attempts.map((a) => a.help)).toEqual([1, 0]);
      expect(saved().reviews).toEqual([true, true, true, false, false]);
    });
  });

  it("the card menu has no Complete with help entry", () => {
    const view = renderBoth();
    const card = view.card();
    fireEvent.click(within(card).getByLabelText("Card actions"));
    expect(screen.getByRole("menuitem", { name: "Complete R3" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /with help/i })).toBeNull();
  });

  it("keys typed in the dialog do not lift the card", () => {
    const view = renderBoth();
    openNoteOnCard(view);
    closeNote();
    fireEvent.click(completeButton(view));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: " ", code: "Space" });
    fireEvent.keyDown(dialog, { key: "Enter", code: "Enter" });
    expect(screen.queryByText(/picked up|dragging/i)).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("marking a problem as mastered", () => {
  const entry = () =>
    JSON.parse(localStorage.getItem("leetcode-progress-v3")).progress["Blind 75"]["blind75-1"];
  const trophy = (view) => within(view.row()).queryByRole("button", { name: "Mark as mastered" });
  // The dialog's own button: the table has a trophy button with the same name on every row
  const cancelOrConfirm = async (name) => {
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name }));
    await act(async () => {});
  };

  it("from To Do, the card menu masters it at once, with a message and Undo, and no dialog", () => {
    const view = renderBoth();
    view.menu("Mark as mastered");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("Marked as mastered")).toBeTruthy();
    expect(view.columnOfCard()).toBe("Mastered");
    expect(entry().masteredBy).toBe("manual");
    expect(entry().attempts).toBeUndefined();
    // The tracker shows it too: the button is gone, replaced by the Mastered label
    expect(trophy(view)).toBeNull();
    expect(within(view.row()).getByText("Mastered")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(view.columnOfCard()).toBe("To Do");
    expect(entry().masteredBy).toBeUndefined();
  });

  it("from In Progress it is the same: no dialog", () => {
    const view = renderBoth();
    view.menu("Start");
    view.menu("Mark as mastered");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(view.columnOfCard()).toBe("Mastered");
  });

  it("solved but with no review done yet, it masters at once: there is nothing to lose", () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Mark as mastered");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(view.columnOfCard()).toBe("Mastered");
  });

  it("with a review done it asks first, in a neutral dialog, and Cancel changes nothing", async () => {
    const view = renderBoth();
    view.menu("Mark as solved");
    view.menu("Complete R1");
    view.menu("Mark as mastered");
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Mark as mastered?")).toBeTruthy();
    expect(within(dialog).getByText(/dates of the reviews you completed will be lost/)).toBeTruthy();
    // Not a warning: no red anywhere in it, and a blue confirm button
    expect(dialog.innerHTML).not.toMatch(/red-/);
    expect(within(dialog).getByRole("button", { name: "Mark as mastered" }).className).toMatch(/bg-blue-600/);
    await cancelOrConfirm("Cancel");
    expect(view.columnOfCard()).toBe("Reviewing");
    expect(entry().masteredBy).toBeUndefined();

    view.menu("Mark as mastered");
    await cancelOrConfirm("Mark as mastered");
    expect(view.columnOfCard()).toBe("Mastered");
    expect(entry().reviews).toEqual([true, true, true, true, true]);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(view.columnOfCard()).toBe("Reviewing");
    expect(entry().reviews).toEqual([true, false, false, false, false]);
  });

  it("the tracker button on a problem never solved masters it with a message and Undo", () => {
    const view = renderBoth();
    fireEvent.click(trophy(view));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(view.columnOfCard()).toBe("Mastered");
    expect(screen.getByText("Marked as mastered")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(view.columnOfCard()).toBe("To Do");
    expect(trophy(view)).not.toBeNull();
  });

  it("the tracker button asks first only when a review is done", async () => {
    const view = renderBoth();
    fireEvent.click(within(view.row()).getByText("Not Solved"));
    fireEvent.click(within(view.row()).getByRole("button", { name: "R1" }));
    fireEvent.click(trophy(view));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await cancelOrConfirm("Cancel");
    expect(view.columnOfCard()).toBe("Reviewing");
    fireEvent.click(trophy(view));
    await cancelOrConfirm("Mark as mastered");
    expect(view.columnOfCard()).toBe("Mastered");
  });

  it("a mastered row is shown as Mastered with a very light green, and only that row", () => {
    const view = renderBoth();
    expect(view.row().className).not.toMatch(/green/);
    view.menu("Mark as mastered");
    expect(within(view.row()).getByText("Mastered")).toBeTruthy();
    expect(view.row().className).toMatch(/bg-green-50\/25/);
    expect(within(view.row()).queryByText("Solved")).toBeNull();
  });

  it("going back with an R button after a manual Mastered starts the reviews again", async () => {
    const view = renderBoth();
    view.menu("Mark as mastered");
    fireEvent.click(within(view.row()).getByRole("button", { name: "R1" }));
    // Going back to R1 erases all five reviews, so it asks first
    await cancelOrConfirm("Go back");
    expect(view.columnOfCard()).toBe("Reviewing");
    expect(entry().masteredBy).toBeUndefined();
    expect(entry().reviews).toEqual([false, false, false, false, false]);
  });

  it("dragging a card from To Do onto the Mastered column masters it, without a dialog", async () => {
    const view = renderBoth();
    const column = [...document.querySelectorAll("section")].find(
      (s) => s.querySelector("h2")?.textContent === "Mastered"
    );
    const rect = { left: 0, top: 3000, right: 400, bottom: 3400, width: 400, height: 400, x: 0, y: 3000 };
    vi.spyOn(column, "getBoundingClientRect").mockReturnValue(rect);
    const handle = view.card().parentElement;
    fireEvent.mouseDown(handle, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.mouseMove(document, { clientX: 5, clientY: 30 });
    fireEvent.mouseMove(document, { clientX: 100, clientY: 3100 });
    fireEvent.mouseUp(document, { clientX: 100, clientY: 3100 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByText("Marked as mastered")).toBeTruthy();
    expect(view.columnOfCard()).toBe("Mastered");
  });

  describe("from R5", () => {
    // Two Sum solved long ago, with R1 to R4 done: only R5 is left
    const seedR5 = () =>
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
                reviews: [true, true, true, true, false],
                dates: { initial: "2020-01-01" },
              },
            },
            "LeetCode 75": {},
            "NeetCode 150": {},
          },
        })
      );

    it("the tracker button completes R5 like the review button: no question, and the attempt is written", () => {
      seedR5();
      const view = renderBoth();
      fireEvent.click(trophy(view));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(view.columnOfCard()).toBe("Mastered");
      expect(entry().reviews).toEqual([true, true, true, true, true]);
      expect(entry().attempts).toHaveLength(1);
      expect(entry().attempts[0]).toMatchObject({ review: 4, help: 0 });
      expect(entry().masteredBy).toBeUndefined();
    });

    it("dragging the card onto Mastered does the same", async () => {
      seedR5();
      const view = renderBoth();
      const column = [...document.querySelectorAll("section")].find(
        (s) => s.querySelector("h2")?.textContent === "Mastered"
      );
      vi.spyOn(column, "getBoundingClientRect").mockReturnValue({
        left: 0, top: 3000, right: 400, bottom: 3400, width: 400, height: 400, x: 0, y: 3000,
      });
      const handle = view.card().parentElement;
      fireEvent.mouseDown(handle, { button: 0, clientX: 5, clientY: 5 });
      fireEvent.mouseMove(document, { clientX: 5, clientY: 30 });
      fireEvent.mouseMove(document, { clientX: 100, clientY: 3100 });
      fireEvent.mouseUp(document, { clientX: 100, clientY: 3100 });
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(view.columnOfCard()).toBe("Mastered");
      expect(entry().attempts[0]).toMatchObject({ review: 4, help: 0 });
      expect(entry().masteredBy).toBeUndefined();
    });
  });
});
