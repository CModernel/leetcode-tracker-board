// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import LeetCodeTracker from "../pages/LeetCodeTracker";
import { NOTE_MAX_LENGTH } from "../lib/notes";
import { SHOW_NOTES_KEY } from "../lib/preferences";
import { V3_KEY, serializeProgress } from "../lib/migrate";

const withNote = (note) =>
  serializeProgress({
    "Blind 75": {
      "blind75-1": { status: "todo", solved: false, reviews: [], dates: {}, note },
    },
    "LeetCode 75": {},
    "NeetCode 150": {},
  });

const renderTracker = () =>
  render(
    <ProgressProvider>
      <ConfirmProvider>
        <LeetCodeTracker />
      </ConfirmProvider>
    </ProgressProvider>
  );

const row = () => screen.getByText("Two Sum").closest("tr");
const toggle = () =>
  screen.getByRole("button", { name: /(show|hide) notes/i });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(V3_KEY, withNote("Use a hash map"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Notes column", () => {
  it("is hidden by default", () => {
    renderTracker();
    expect(screen.queryByRole("columnheader", { name: "Notes" })).toBeNull();
    expect(screen.queryByText("Use a hash map")).toBeNull();
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the notes when the toggle is pressed, and hides them again", () => {
    renderTracker();
    fireEvent.click(toggle());
    expect(screen.getByRole("columnheader", { name: "Notes" })).toBeTruthy();
    expect(within(row()).getByText("Use a hash map")).toBeTruthy();
    expect(toggle().textContent).toBe("Hide notes");
    fireEvent.click(toggle());
    expect(screen.queryByText("Use a hash map")).toBeNull();
  });

  it("offers Add note for problems without one", () => {
    renderTracker();
    fireEvent.click(toggle());
    const other = screen.getByText("Contains Duplicate").closest("tr");
    expect(within(other).getByRole("button", { name: /add note for contains duplicate/i })).toBeTruthy();
  });

  it("remembers the choice after reloading", () => {
    renderTracker();
    fireEvent.click(toggle());
    expect(localStorage.getItem(SHOW_NOTES_KEY)).toBe("true");
    cleanup();
    renderTracker();
    expect(within(row()).getByText("Use a hash map")).toBeTruthy();
    fireEvent.click(toggle());
    expect(localStorage.getItem(SHOW_NOTES_KEY)).toBe("false");
  });

  it("keeps working when the browser refuses to save the choice", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderTracker();
    fireEvent.click(toggle());
    expect(within(row()).getByText("Use a hash map")).toBeTruthy();
  });

  it("keeps the whole note in the tooltip when the text is long", () => {
    localStorage.setItem(V3_KEY, withNote("line one\nline two\nline three\nline four"));
    renderTracker();
    fireEvent.click(toggle());
    const button = within(row()).getByRole("button", { name: /edit note/i });
    expect(button.getAttribute("title")).toContain("line four");
  });
});

const savedNote = (id = "blind75-1") =>
  JSON.parse(localStorage.getItem(V3_KEY)).progress["Blind 75"][id]?.note;

describe("editing a note in the table", () => {
  const field = (name = /note for two sum/i) => screen.getByLabelText(name);
  const openEditor = (name = /edit note for two sum/i) => {
    renderTracker();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name }));
  };

  it("opens a field with the current text", () => {
    openEditor();
    expect(field().value).toBe("Use a hash map");
  });

  it("saves the new text when the field loses focus", () => {
    openEditor();
    fireEvent.change(field(), { target: { value: "Hash map, O(n)" } });
    fireEvent.blur(field());
    expect(within(row()).getByText("Hash map, O(n)")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: /note for two sum/i })).toBeNull();
    expect(savedNote()).toBe("Hash map, O(n)");
  });

  it("saves with Ctrl+Enter and Cmd+Enter", () => {
    openEditor();
    fireEvent.change(field(), { target: { value: "first" } });
    fireEvent.keyDown(field(), { key: "Enter", ctrlKey: true });
    expect(savedNote()).toBe("first");
    fireEvent.click(screen.getByRole("button", { name: /edit note for two sum/i }));
    fireEvent.change(field(), { target: { value: "second" } });
    fireEvent.keyDown(field(), { key: "Enter", metaKey: true });
    expect(savedNote()).toBe("second");
  });

  it("saves with the Save button", () => {
    openEditor();
    fireEvent.change(field(), { target: { value: "via button" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(savedNote()).toBe("via button");
    expect(screen.queryByRole("textbox", { name: /note for two sum/i })).toBeNull();
  });

  it("discards with the Cancel button", () => {
    openEditor();
    fireEvent.change(field(), { target: { value: "never saved" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(savedNote()).toBe("Use a hash map");
    expect(within(row()).getByText("Use a hash map")).toBeTruthy();
  });

  it("the buttons keep the focus in the field, so pressing one does not save by losing it", () => {
    openEditor();
    for (const name of ["Save", "Cancel"]) {
      const notCancelled = fireEvent.mouseDown(screen.getByRole("button", { name }));
      expect(notCancelled).toBe(false); // preventDefault was called
    }
  });

  it("does not save with Enter alone (it adds a line)", () => {
    openEditor();
    fireEvent.change(field(), { target: { value: "changed" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(field()).toBeTruthy();
    expect(savedNote()).toBe("Use a hash map");
  });

  it("discards the changes with Escape, even though the field then loses focus", () => {
    openEditor();
    fireEvent.change(field(), { target: { value: "unsaved" } });
    // Escape and the blur that follows it happen before the field is removed
    const input = field();
    act(() => {
      fireEvent.keyDown(input, { key: "Escape" });
      fireEvent.blur(input);
    });
    expect(savedNote()).toBe("Use a hash map");
    expect(within(row()).getByText("Use a hash map")).toBeTruthy();
  });

  it("removes the note when the text is emptied", () => {
    openEditor();
    fireEvent.change(field(), { target: { value: "  " } });
    fireEvent.blur(field());
    expect(savedNote()).toBeUndefined();
    expect(
      within(row()).getByRole("button", { name: /add note for two sum/i })
    ).toBeTruthy();
  });

  it("adds a note to a problem that has none", () => {
    openEditor(/add note for contains duplicate/i);
    const input = field(/note for contains duplicate/i);
    expect(input.getAttribute("placeholder")).toMatch(/key idea/i);
    fireEvent.change(input, { target: { value: "Use a set" } });
    fireEvent.blur(input);
    expect(savedNote("blind75-2")).toBe("Use a set");
  });

  it("does not write anything when the text did not change", () => {
    openEditor();
    const save = vi.spyOn(Storage.prototype, "setItem");
    fireEvent.blur(field());
    expect(save).not.toHaveBeenCalledWith(V3_KEY, expect.anything());
  });

  it("limits the length of the field and shows how much is used", () => {
    openEditor();
    expect(Number(field().getAttribute("maxlength"))).toBe(NOTE_MAX_LENGTH);
    expect(screen.getByText(`14/${NOTE_MAX_LENGTH}`)).toBeTruthy();
    fireEvent.change(field(), { target: { value: "abc" } });
    expect(screen.getByText(`3/${NOTE_MAX_LENGTH}`)).toBeTruthy();
  });
});

describe("completing a review in the table", () => {
  // Two Sum solved on 2026-10-01 with R1 and R2 done, today 2026-10-20 (R3
  // overdue). Only Date is faked, so timers still run.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  const seed = (extra = {}) =>
    localStorage.setItem(
      V3_KEY,
      serializeProgress({
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
        "LeetCode 75": {},
        "NeetCode 150": {},
      })
    );
  const saved = () => JSON.parse(localStorage.getItem(V3_KEY)).progress["Blind 75"]["blind75-1"];
  const r3 = () => within(row()).getByRole("button", { name: "R3" });
  const readNote = () => {
    fireEvent.click(toggle());
    fireEvent.click(within(row()).getByRole("button", { name: /edit note for two sum/i }));
    fireEvent.keyDown(within(row()).getByRole("textbox"), { key: "Escape" });
  };

  it("completes at once as solved alone when nothing was opened, and writes the history", () => {
    seed();
    renderTracker();
    fireEvent.click(r3());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().reviews).toEqual([true, true, true, false, false]);
    expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 0 }]);
  });

  it("opening a note in the table counts, and then asks how it went", () => {
    seed();
    renderTracker();
    readNote();
    expect(saved().helpViewed).toEqual({ note: "2026-10-20" });
    fireEvent.click(r3());
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("You opened the note today.")).toBeTruthy();
    expect(within(dialog).getByText("Next review: R4 in 7 days (Oct 27)")).toBeTruthy();
    expect(within(dialog).getByText("Repeat R3 in 2 days (Oct 22)")).toBeTruthy();
    expect(within(dialog).getByText("Back to R2 in 2 days (Oct 22)")).toBeTruthy();
    expect(saved().reviews).toEqual([true, true, false, false, false]);
  });

  it("Cancel changes nothing", () => {
    seed();
    renderTracker();
    readNote();
    fireEvent.click(r3());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().reviews).toEqual([true, true, false, false, false]);
    expect(saved().attempts).toBeUndefined();
  });

  it("needed the note: R3 is repeated in 2 days and the row shows that date", () => {
    seed();
    renderTracker();
    readNote();
    fireEvent.click(r3());
    fireEvent.click(screen.getByRole("button", { name: /Needed the note/ }));
    expect(saved().reviews).toEqual([true, true, false, false, false]);
    expect(saved().attempts).toEqual([{ date: "2026-10-20", review: 2, help: 1 }]);
    expect(within(row()).getByText("Oct 22")).toBeTruthy();
  });

  it("needed the solution: one review back, the row shows R2 pending", () => {
    seed();
    renderTracker();
    readNote();
    fireEvent.click(r3());
    fireEvent.click(screen.getByRole("button", { name: /Needed the solution/ }));
    expect(saved().reviews).toEqual([true, false, false, false, false]);
    expect(saved().solved).toBe(true);
    expect(saved().attempts[0]).toMatchObject({ review: 2, help: 2 });
    expect(within(row()).getByRole("button", { name: "R2" }).disabled).toBe(false);
    expect(within(row()).getByRole("button", { name: "R3" }).disabled).toBe(true);
  });

  it("solved it myself completes and clears the reminder that the note was opened", () => {
    seed();
    renderTracker();
    readNote();
    fireEvent.click(r3());
    fireEvent.click(screen.getByRole("button", { name: /Solved it myself/ }));
    expect(saved().reviews).toEqual([true, true, true, false, false]);
    expect(saved()).not.toHaveProperty("helpViewed");
  });

  it("does not ask when the note was opened on another day", () => {
    seed({ helpViewed: { note: "2026-10-19" } });
    renderTracker();
    fireEvent.click(r3());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().reviews).toEqual([true, true, true, false, false]);
  });

  it("going back is not affected: a done review is still undone with one click", () => {
    seed();
    renderTracker();
    fireEvent.click(within(row()).getByRole("button", { name: "R2" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(saved().reviews).toEqual([true, false, false, false, false]);
    expect(saved().attempts).toBeUndefined();
  });
});
