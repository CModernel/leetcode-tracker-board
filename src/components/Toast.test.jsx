// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import Toast from "./Toast";

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

  it("closes with the button", () => {
    const onClose = vi.fn();
    render(<Toast message="Hi" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close message"));
    expect(onClose).toHaveBeenCalledTimes(1);
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
