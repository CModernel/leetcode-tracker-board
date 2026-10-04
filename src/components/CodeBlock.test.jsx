// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import CodeBlock from "./CodeBlock";
import { ThemeContext } from "../context/ThemeContext";

const renderBlock = (props) =>
  render(
    <ThemeContext.Provider value={{ isDark: false }}>
      <CodeBlock {...props} />
    </ThemeContext.Provider>,
  );

afterEach(cleanup);

describe("CodeBlock", () => {
  it("shows the code at once as plain text and then highlighted", async () => {
    const { container } = renderBlock({ code: "x = 1\ny = 2", language: "python" });
    expect(container.textContent).toContain("x = 1");
    // the highlighter replaces the plain block once it has loaded
    await vi.waitFor(() => expect(container.querySelector("span.token")).not.toBeNull());
    expect(container.textContent).toContain("y = 2");
  });

  it("shows unknown languages without colours but with the code", async () => {
    const { container } = renderBlock({ code: "whatever", language: "other" });
    expect(container.textContent).toContain("whatever");
  });
});

describe("CodeBlock when the highlighter fails to load", () => {
  it("still shows the code as plain text", async () => {
    vi.resetModules();
    vi.doMock("./HighlightedCode", () => {
      throw new Error("chunk failed");
    });
    const { default: Block } = await import("./CodeBlock");
    const { ThemeContext: FreshTheme } = await import("../context/ThemeContext");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FreshTheme.Provider value={{ isDark: true }}>
        <Block code="fallback code" language="python" />
      </FreshTheme.Provider>,
    );
    expect(await screen.findByText("fallback code")).toBeTruthy();
    spy.mockRestore();
    vi.doUnmock("./HighlightedCode");
  });
});
