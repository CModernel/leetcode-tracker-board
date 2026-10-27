// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ProgressProvider } from "../context/ProgressProvider";
import { ConfirmProvider } from "../context/ConfirmProvider";
import { ThemeProvider } from "../context/ThemeProvider";
import { TimerSettingsProvider } from "../context/TimerSettingsProvider";
import LeetCodeTracker from "./LeetCodeTracker";
import BoardPage from "./BoardPage";

vi.setConfig({ testTimeout: 20000 });

// Blind 75: Two Sum is "Arrays & Hashing" (hint: Hashing), Valid Parentheses is
// "Stack" (no clear pattern, no hint).
const KEY = "leetcode-progress-v3";
const renderBoth = () => {
  render(
    <ThemeProvider>
      <TimerSettingsProvider>
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
      </TimerSettingsProvider>
    </ThemeProvider>,
  );
  return {
    card: (title) => within(screen.getByTestId("board")).getByText(title).closest("article"),
    row: (title) => within(screen.getByTestId("tracker")).getByText(title).closest("tr"),
  };
};
const HINT = { name: "Hint: Hashing (Set / Dictionary)" };

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
});
afterEach(cleanup);

describe("the hint magnifier", () => {
  it("on a card it links to the pattern, between the menu and the note", () => {
    const view = renderBoth();
    const card = view.card("1 - Two Sum");
    const link = within(card).getByRole("link", HINT);
    expect(link.getAttribute("href")).toBe("#/patterns?pattern=hashing");
    const menu = within(card).getByLabelText("Card actions");
    const note = within(card).getByLabelText("Add note");
    expect(menu.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("in the tracker it sits next to the problem title", () => {
    const view = renderBoth();
    const row = view.row("Two Sum");
    const link = within(row).getByRole("link", HINT);
    const title = within(row).getByText("Two Sum").closest("a");
    expect(title.parentElement).toBe(link.parentElement);
  });

  it("a problem with no clear pattern has no magnifier, on the card or in the table", () => {
    const view = renderBoth();
    expect(within(view.card("16 - Valid Parentheses")).queryByRole("link", { name: /^Hint:/ })).toBeNull();
    expect(within(view.row("Valid Parentheses")).queryByRole("link", { name: /^Hint:/ })).toBeNull();
  });

  it("opening it changes nothing in the progress: no timer, no help, nothing saved", () => {
    const view = renderBoth();
    const before = localStorage.getItem(KEY);
    fireEvent.click(within(view.card("1 - Two Sum")).getByRole("link", HINT));
    expect(localStorage.getItem(KEY)).toBe(before);
    expect(before === null || !JSON.stringify(JSON.parse(before)).includes("timer")).toBe(true);
  });
});
