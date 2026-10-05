// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CodeEditor from "./CodeEditor";

afterEach(cleanup);

const Harness = ({ initial = "", rows = 3 }) => {
  const [value, setValue] = useState(initial);
  return <CodeEditor value={value} onChange={setValue} ariaLabel="Code" rows={rows} />;
};
const numbers = () =>
  [...screen.getByTestId("line-numbers").children].map((n) => n.textContent);

describe("CodeEditor", () => {
  it("shows at least the minimum number of lines, numbered from 1", () => {
    render(<Harness rows={3} />);
    expect(numbers()).toEqual(["1", "2", "3"]);
  });

  it("adds a number for every line typed", () => {
    render(<Harness rows={2} />);
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "a\nb\nc\nd\ne" } });
    expect(numbers()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("widens the gutter for more digits", () => {
    render(<Harness rows={3} />);
    const before = screen.getByTestId("line-numbers").style.width;
    fireEvent.change(screen.getByLabelText("Code"), {
      target: { value: Array.from({ length: 120 }, (_, i) => i).join("\n") },
    });
    expect(screen.getByTestId("line-numbers").style.width).not.toBe(before);
  });

  it("does not wrap lines, so every number is one real line, and does not check spelling", () => {
    render(<Harness />);
    const field = screen.getByLabelText("Code");
    expect(field.getAttribute("wrap")).toBe("off");
    expect(field.getAttribute("spellcheck")).toBe("false");
  });

  it("the numbers follow the vertical scroll of the text", () => {
    render(<Harness initial={"a\n".repeat(40)} />);
    const field = screen.getByLabelText("Code");
    field.scrollTop = 120;
    fireEvent.scroll(field);
    expect(screen.getByTestId("line-numbers").scrollTop).toBe(120);
  });

  it("the gutter is hidden from screen readers and cannot be selected", () => {
    render(<Harness />);
    const gutter = screen.getByTestId("line-numbers");
    expect(gutter.getAttribute("aria-hidden")).toBe("true");
    expect(gutter.className).toMatch(/select-none/);
  });

  describe("Tab", () => {
    const press = (field, start, end, shiftKey = false) => {
      field.setSelectionRange(start, end);
      return fireEvent.keyDown(field, { key: "Tab", shiftKey });
    };

    it("indents instead of leaving the field", () => {
      render(<Harness initial="ab" />);
      const field = screen.getByLabelText("Code");
      const notCancelled = press(field, 1, 1);
      expect(notCancelled).toBe(false);
      expect(field.value).toBe("a    b");
    });

    it("indents every line of a selection", () => {
      render(<Harness initial={"a\n\nb\nc"} />);
      const field = screen.getByLabelText("Code");
      press(field, 0, 4);
      expect(field.value).toBe("    a\n\n    b\nc");
    });

    it("outdents with Shift+Tab, at most one level", () => {
      render(<Harness initial={"      a"} />);
      const field = screen.getByLabelText("Code");
      press(field, 7, 7, true);
      expect(field.value).toBe("  a");
      press(field, 3, 3, true);
      expect(field.value).toBe("a");
    });

    it("leaves Ctrl+Tab to the browser", () => {
      render(<Harness initial="ab" />);
      const field = screen.getByLabelText("Code");
      field.setSelectionRange(1, 1);
      expect(fireEvent.keyDown(field, { key: "Tab", ctrlKey: true })).toBe(true);
      expect(field.value).toBe("ab");
    });
  });
});
