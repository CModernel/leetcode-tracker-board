// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../context/ThemeProvider";
import Patterns from "./Patterns";
import { LANGUAGES } from "../lib/languages";
import { PATTERN_LANGUAGE_KEY } from "../lib/preferences";

vi.setConfig({ testTimeout: 20000 });

const renderPage = () =>
  render(
    <ThemeProvider>
      <Patterns />
    </ThemeProvider>,
  );
const button = (name) => screen.getByRole("button", { name });
const select = () => screen.getByLabelText("Select Language:", { selector: "select" });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "light");
});
afterEach(cleanup);

describe("the Patterns page languages", () => {
  it("starts in Python and has a button and an option for every listed language", () => {
    renderPage();
    expect(button("Python").getAttribute("aria-pressed")).toBe("true");
    for (const language of LANGUAGES) {
      expect(button(language.name)).toBeTruthy();
      expect(screen.getByRole("option", { name: language.name })).toBeTruthy();
    }
    expect(screen.getAllByText("Python Template").length).toBeGreaterThan(0);
  });

  it("choosing a language with its button shows its templates and remembers it", () => {
    renderPage();
    fireEvent.click(button("Go"));
    expect(button("Go").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText("Go Template").length).toBeGreaterThan(0);
    expect(localStorage.getItem(PATTERN_LANGUAGE_KEY)).toBe("go");
    cleanup();
    renderPage();
    expect(button("Go").getAttribute("aria-pressed")).toBe("true");
  });

  it("the select (phones) changes the language too", () => {
    renderPage();
    fireEvent.change(select(), { target: { value: "java" } });
    expect(screen.getAllByText("Java Template").length).toBeGreaterThan(0);
    expect(localStorage.getItem(PATTERN_LANGUAGE_KEY)).toBe("java");
  });

  it("an unknown saved language falls back to Python", () => {
    localStorage.setItem(PATTERN_LANGUAGE_KEY, "cobol");
    renderPage();
    expect(button("Python").getAttribute("aria-pressed")).toBe("true");
  });
});
