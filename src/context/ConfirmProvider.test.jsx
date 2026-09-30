// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmProvider } from "./ConfirmProvider";
import { useConfirm } from "./ConfirmContext";

const OPTIONS = {
  title: "Erase reviews?",
  message: "This cannot be undone.",
  confirmLabel: "Erase",
};

// Asks when the button is clicked and records the answers.
const Asker = ({ answers, options = OPTIONS }) => {
  const confirm = useConfirm();
  return (
    <button onClick={() => confirm(options).then((a) => answers.push(a))}>
      ask
    </button>
  );
};

const setup = (options) => {
  const answers = [];
  render(
    <ConfirmProvider>
      <Asker answers={answers} options={options} />
    </ConfirmProvider>
  );
  const ask = () => fireEvent.click(screen.getByText("ask"));
  const dialog = () => screen.queryByRole("alertdialog");
  const settle = () => act(async () => {});
  return { answers, ask, dialog, settle };
};

afterEach(cleanup);

describe("ConfirmProvider", () => {
  it("shows nothing until something is asked", () => {
    expect(setup().dialog()).toBe(null);
  });

  it("shows the title, message and button labels", () => {
    const { ask, dialog } = setup();
    ask();
    expect(dialog()).not.toBe(null);
    expect(screen.getByText("Erase reviews?")).toBeTruthy();
    expect(screen.getByText("This cannot be undone.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Erase" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("uses default labels when none are given", () => {
    const { ask } = setup({ title: "Sure?", message: "Really?" });
    ask();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
  });

  it("answers yes with the confirm button and closes", async () => {
    const { ask, dialog, answers, settle } = setup();
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Erase" }));
    await settle();
    expect(answers).toEqual([true]);
    expect(dialog()).toBe(null);
  });

  it("answers no with the cancel button and closes", async () => {
    const { ask, dialog, answers, settle } = setup();
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle();
    expect(answers).toEqual([false]);
    expect(dialog()).toBe(null);
  });

  it("answers no with Escape", async () => {
    const { ask, dialog, answers, settle } = setup();
    ask();
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    await settle();
    expect(answers).toEqual([false]);
    expect(dialog()).toBe(null);
  });

  it("answers no when the backdrop is clicked, but not when the box is", async () => {
    const { ask, dialog, answers, settle } = setup();
    ask();
    fireEvent.click(screen.getByText("This cannot be undone."));
    await settle();
    expect(answers).toEqual([]);
    expect(dialog()).not.toBe(null);
    fireEvent.click(dialog());
    await settle();
    expect(answers).toEqual([false]);
  });

  it("puts the focus on Cancel, so Enter does not confirm by accident", () => {
    const { ask } = setup();
    ask();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("can be asked again after it was answered", async () => {
    const { ask, answers, settle } = setup();
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Erase" }));
    await settle();
    ask();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await settle();
    expect(answers).toEqual([true, false]);
  });

  it("answers no to the open question when a new one arrives", async () => {
    const { ask, answers, settle } = setup();
    ask();
    ask();
    await settle();
    expect(answers).toEqual([false]);
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  });

  it("fails clearly when used without the provider", () => {
    const answers = [];
    const spy = console.error;
    console.error = () => {};
    expect(() => render(<Asker answers={answers} />)).toThrow(/ConfirmProvider/);
    console.error = spy;
  });
});
