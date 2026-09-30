// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Toast, { FADE_MS } from "./Toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toast", () => {
  it("shows the message", () => {
    render(<Toast message="Not allowed" onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Not allowed");
  });

  it("closes by itself after the duration", () => {
    const onClose = vi.fn();
    render(<Toast message="Hi" onClose={onClose} duration={3000} />);
    act(() => vi.advanceTimersByTime(2999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fades out just before it goes, then closes at the duration", () => {
    render(<Toast message="Hi" onClose={() => {}} duration={3000} />);
    const toast = screen.getByRole("status");
    expect(toast.dataset.leaving).toBe("false");
    act(() => vi.advanceTimersByTime(3000 - FADE_MS - 1));
    expect(toast.dataset.leaving).toBe("false");
    act(() => vi.advanceTimersByTime(1));
    expect(toast.dataset.leaving).toBe("true");
  });

  it("closes with the button after the fade", () => {
    const onClose = vi.fn();
    render(<Toast message="Hi" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close message"));
    expect(screen.getByRole("status").dataset.leaving).toBe("true");
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(FADE_MS));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close twice when dismissed and the timer ends", () => {
    const onClose = vi.fn();
    render(<Toast message="Hi" onClose={onClose} duration={1000} />);
    fireEvent.click(screen.getByLabelText("Close message"));
    act(() => vi.advanceTimersByTime(FADE_MS));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles a duration shorter than the fade", () => {
    const onClose = vi.fn();
    render(<Toast message="Hi" onClose={onClose} duration={100} />);
    act(() => vi.advanceTimersByTime(100));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is a plain message by default and amber with an extra icon as a warning", () => {
    const { rerender } = render(<Toast message="Moved" onClose={() => {}} />);
    expect(screen.getByRole("status").dataset.variant).toBe("info");
    // Only the icon of the close button
    expect(screen.getByRole("status").querySelectorAll("svg")).toHaveLength(1);
    rerender(<Toast message="Not allowed" variant="warning" onClose={() => {}} />);
    const toast = screen.getByRole("status");
    expect(toast.dataset.variant).toBe("warning");
    // The warning icon plus the close button's
    expect(toast.querySelectorAll("svg")).toHaveLength(2);
  });

  it("has no action button unless one is given", () => {
    render(<Toast message="Hi" onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Undo" })).toBe(null);
  });

  it("runs the action and closes when its button is pressed", () => {
    const onClose = vi.fn();
    const onAction = vi.fn();
    render(
      <Toast message="Moved" onClose={onClose} actionLabel="Undo" onAction={onAction} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(FADE_MS));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close after it is removed", () => {
    const onClose = vi.fn();
    const { unmount } = render(<Toast message="Hi" onClose={onClose} />);
    unmount();
    act(() => vi.advanceTimersByTime(10000));
    expect(onClose).not.toHaveBeenCalled();
  });
});
