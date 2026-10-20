// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import TimeField, { stepTime } from "./TimeField";

const MIN = 60_000;

describe("stepTime", () => {
  it("carries over the minute in both directions", () => {
    expect(stepTime("0:59", 1)).toBe("1:00");
    expect(stepTime("1:00", -1)).toBe("0:59");
    expect(stepTime("59:59", 1)).toBe("1:00:00");
  });

  it("stays between 0 and the maximum", () => {
    expect(stepTime("0:00", -1)).toBe("0:00");
    expect(stepTime("7:20", 1, 7 * MIN + 20_000)).toBe("7:20");
    expect(stepTime("7:19", 1, 7 * MIN + 20_000)).toBe("7:20");
  });

  it("returns null for text that is not a time", () => {
    expect(stepTime("abc", 1)).toBeNull();
    expect(stepTime("", -1)).toBeNull();
  });
});

describe("TimeField", () => {
  afterEach(cleanup);
  const Harness = ({ start, maxMs }) => {
    const [value, setValue] = useState(start);
    return <TimeField id="t" value={value} onChange={setValue} maxMs={maxMs} />;
  };
  const input = () => screen.getByRole("textbox");

  it("the arrows move one second and stop at the maximum", () => {
    render(<Harness start="0:58" maxMs={MIN} />);
    fireEvent.click(screen.getByRole("button", { name: "One second more" }));
    fireEvent.click(screen.getByRole("button", { name: "One second more" }));
    expect(input().value).toBe("1:00");
    expect(screen.getByRole("button", { name: "One second more" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "One second less" }));
    expect(input().value).toBe("0:59");
  });

  it("the arrow keys do the same, and the down arrow stops at 0", () => {
    render(<Harness start="0:01" maxMs={MIN} />);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().value).toBe("0:00");
    expect(screen.getByRole("button", { name: "One second less" }).disabled).toBe(true);
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("0:01");
  });

  it("does nothing while the text is not a time", () => {
    render(<Harness start="abc" maxMs={MIN} />);
    expect(screen.getByRole("button", { name: "One second more" }).disabled).toBe(true);
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().value).toBe("abc");
  });
});
