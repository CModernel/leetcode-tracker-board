// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SolutionDialog from "./SolutionDialog";
import { ThemeContext } from "../context/ThemeContext";

afterEach(cleanup);

const one = { code: "print(1)", language: "python", source: "manual", savedAt: "2026-10-04" };
const two = { code: "print(2)", language: "go", source: "leetcode-api", savedAt: "2026-10-05", name: "Optimal" };

const setup = (solutions, extra = {}) => {
  const props = {
    label: "Two Sum",
    solutions,
    defaultLanguage: "kotlin",
    onSave: vi.fn(),
    onRead: vi.fn(),
    onClose: vi.fn(),
    ...extra,
  };
  render(
    <ThemeContext.Provider value={{ isDark: false }}>
      <SolutionDialog {...props} />
    </ThemeContext.Provider>,
  );
  return props;
};

const text = () => document.body.textContent;

describe("SolutionDialog reading", () => {
  it("shows the code right away, like a note, and reports the reading once", () => {
    const props = setup([one]);
    expect(text()).toContain("print(1)");
    expect(text()).not.toContain("Show solution");
    expect(text()).not.toContain("counts as help");
    expect(props.onRead).toHaveBeenCalledTimes(1);
    expect(text()).toContain("Python · Written by you · 2026-10-04");
    expect(document.activeElement).toBe(screen.getByText("Close"));
  });

  it("closing without editing changes nothing", () => {
    const props = setup([one]);
    fireEvent.click(screen.getByText("Close"));
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("has tabs for two solutions, named or numbered, and switches between them", () => {
    setup([one, two]);
    expect(screen.getByRole("tab", { name: "Solution 1" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Optimal" }));
    expect(text()).toContain("print(2)");
    expect(text()).not.toContain("print(1)");
    expect(text()).toContain("Go · From LeetCode");
  });

  it("copies the shown code", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup([one]);
    fireEvent.click(screen.getByText("Copy"));
    expect(writeText).toHaveBeenCalledWith("print(1)");
    expect(await screen.findByText("Copied")).toBeTruthy();
  });
});

describe("SolutionDialog writing", () => {
  it("opens in the editor when there is no solution, with the default language, and does not count help", () => {
    const props = setup([]);
    expect(screen.getByLabelText("Language").value).toBe("kotlin");
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "fun a() {}" } });
    fireEvent.change(screen.getByLabelText("Label (optional)"), { target: { value: "Brute force" } });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "swift" } });
    fireEvent.click(screen.getByText("Save"));
    expect(props.onSave).toHaveBeenCalledWith(0, {
      code: "fun a() {}",
      language: "swift",
      name: "Brute force",
      source: "manual",
    });
    expect(props.onRead).not.toHaveBeenCalled();
  });

  it("puts the focus on the code field, not on the name, when the editor opens", () => {
    setup([]);
    expect(document.activeElement).toBe(screen.getByLabelText("Code for Two Sum"));
  });

  it("puts the focus on the code field when Edit or Add another is pressed", () => {
    setup([one]);
    fireEvent.click(screen.getByText("Edit"));
    expect(document.activeElement).toBe(screen.getByLabelText("Code for Two Sum"));
    cleanup();
    setup([one]);
    fireEvent.click(screen.getByText("Add another"));
    expect(document.activeElement).toBe(screen.getByLabelText("Code for Two Sum"));
  });

  it("has the code first and the name and language below it, with line numbers", () => {
    setup([]);
    const code = screen.getByLabelText("Code for Two Sum");
    const name = screen.getByLabelText("Label (optional)");
    const language = screen.getByLabelText("Language");
    const before = (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(before(code, name)).toBeTruthy();
    expect(before(name, language)).toBeTruthy();
    expect(screen.getByTestId("line-numbers").children.length).toBeGreaterThan(1);
  });

  it("the line numbers grow with the code typed", () => {
    setup([]);
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), {
      target: { value: Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n") },
    });
    expect(screen.getByTestId("line-numbers").children.length).toBe(30);
  });

  it("saves with Ctrl+Enter", () => {
    const props = setup([]);
    const field = screen.getByLabelText("Code for Two Sum");
    fireEvent.change(field, { target: { value: "x" } });
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("an empty new solution saves nothing and closes", () => {
    const props = setup([]);
    fireEvent.click(screen.getByText("Save"));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("closing a new solution closes without saving", () => {
    const props = setup([]);
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "x" } });
    fireEvent.click(screen.getByText("Close"));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("an existing solution is edited from the reading view, with its own language, and Save closes", () => {
    const props = setup([two]);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByLabelText("Language").value).toBe("go");
    expect(screen.getByLabelText("Label (optional)").value).toBe("Optimal");
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "new" } });
    fireEvent.click(screen.getByText("Save"));
    expect(props.onSave).toHaveBeenCalledWith(0, {
      code: "new",
      language: "go",
      name: "Optimal",
      source: "manual",
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("Close in the editor discards the changes and writing never reports a reading", () => {
    const props = setup([two], { onRead: undefined });
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "changed" } });
    fireEvent.click(screen.getByText("Close"));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("uses Close and Save in the editor, with a short label field", () => {
    setup([]);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByText("Cancel")).toBeNull();
    expect(screen.getByPlaceholderText("Label (optional)")).toBeTruthy();
  });

  it("adds a second solution with the default language, and the button is gone with two", () => {
    const props = setup([one]);
    fireEvent.click(screen.getByText("Add another"));
    expect(screen.getByLabelText("Language").value).toBe("kotlin");
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "b" } });
    fireEvent.click(screen.getByText("Save"));
    expect(props.onSave).toHaveBeenCalledWith(1, expect.objectContaining({ code: "b" }));
    cleanup();
    setup([one, two]);
    expect(screen.queryByText("Add another")).toBeNull();
  });

  it("removing asks to confirm first", () => {
    const props = setup([one, two]);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Remove"));
    expect(props.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Yes, remove it"));
    expect(props.onSave).toHaveBeenCalledWith(0, null);
  });

  it("emptying the code of an existing solution removes it", () => {
    const props = setup([one, two]);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByLabelText("Code for Two Sum"), { target: { value: "  " } });
    fireEvent.click(screen.getByText("Save"));
    expect(props.onSave).toHaveBeenCalledWith(0, null);
  });

  it("stops mouse and key events from reaching a draggable card", () => {
    const outer = vi.fn();
    render(
      <div onMouseDown={outer} onKeyDown={outer}>
        <ThemeContext.Provider value={{ isDark: false }}>
          <SolutionDialog label="x" solutions={[]} defaultLanguage="python" onSave={vi.fn()} onClose={vi.fn()} />
        </ThemeContext.Provider>
      </div>,
    );
    fireEvent.mouseDown(screen.getByLabelText("Code for x"));
    fireEvent.keyDown(screen.getByLabelText("Code for x"), { key: " " });
    expect(outer).not.toHaveBeenCalled();
  });
});
