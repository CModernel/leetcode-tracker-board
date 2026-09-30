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
