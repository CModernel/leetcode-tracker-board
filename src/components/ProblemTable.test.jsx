// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import LeetCodeTracker from "../pages/LeetCodeTracker";
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
      <LeetCodeTracker />
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

  it("says 'No note' for problems without one", () => {
    renderTracker();
    fireEvent.click(toggle());
    const other = screen.getByText("Contains Duplicate").closest("tr");
    expect(within(other).getByText("No note")).toBeTruthy();
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
    const cell = within(row()).getByText(/line one/);
    expect(cell.getAttribute("title")).toContain("line four");
  });
});
