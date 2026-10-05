// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./ThemeContext";

const Toggle = () => {
  const { toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>toggle</button>;
};

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#f9fafb" />';
  document.documentElement.className = "";
});
afterEach(cleanup);

const color = () => document.querySelector('meta[name="theme-color"]').getAttribute("content");

describe("ThemeProvider and the browser bar", () => {
  it("uses the light page colour in light mode and the dark one in dark mode", () => {
    localStorage.setItem("theme", "light");
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    );
    expect(color()).toBe("#f9fafb");
    fireEvent.click(screen.getByText("toggle"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(color()).toBe("#111827");
    fireEvent.click(screen.getByText("toggle"));
    expect(color()).toBe("#f9fafb");
  });
});
