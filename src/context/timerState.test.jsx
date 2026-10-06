// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ProgressProvider } from "./ProgressProvider";
import { useProgress } from "./ProgressContext";

const KEY = "leetcode-progress-v3";
let api;
const Probe = () => {
  api = useProgress();
  return null;
};
const mount = () =>
  render(
    <ProgressProvider>
      <Probe />
    </ProgressProvider>,
  );
const saved = (id = "blind75-1") => JSON.parse(localStorage.getItem(KEY)).progress["Blind 75"][id];

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the timer in the saved progress", () => {
  it("starts, pauses and is saved with timestamps", () => {
    mount();
    const t0 = Date.now();
    act(() => api.startTimer("blind75-1"));
    expect(saved().timer).toEqual({ elapsedMs: 0, runningSince: t0 });
    vi.setSystemTime(t0 + 90_000);
    act(() => api.pauseTimer("blind75-1"));
    expect(saved().timer).toEqual({ elapsedMs: 90_000, runningSince: null });
  });

  it("keeps counting across a reload: it is real time, not a ticking counter", () => {
    mount();
    const t0 = Date.now();
    act(() => api.startTimer("blind75-1"));
    cleanup();
    vi.setSystemTime(t0 + 10 * 60_000);
    mount();
    expect(api.progress["Blind 75"]["blind75-1"].timer).toEqual({ elapsedMs: 0, runningSince: t0 });
  });

  it("only one runs at a time", () => {
    mount();
    act(() => api.startTimer("blind75-1"));
    vi.setSystemTime(Date.now() + 5000);
    act(() => api.startTimer("blind75-2"));
    expect(saved("blind75-1").timer).toEqual({ elapsedMs: 5000, runningSince: null });
    expect(saved("blind75-2").timer.runningSince).not.toBeNull();
  });

  it("goes with the export and comes back with the import", () => {
    mount();
    act(() => api.startTimer("blind75-1"));
    vi.setSystemTime(Date.now() + 2000);
    act(() => api.pauseTimer("blind75-1"));
    const exported = JSON.parse(localStorage.getItem(KEY));
    cleanup();
    localStorage.clear();
    mount();
    expect(api.progress["Blind 75"]["blind75-1"]).toBeUndefined();
    act(() => api.importData(exported));
    expect(saved().timer).toEqual({ elapsedMs: 2000, runningSince: null });
  });

  it("reset throws the time away, and an old save without a timer loads fine", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 3, progress: { "Blind 75": { "blind75-1": { status: "todo", solved: false, reviews: [false, false, false, false, false], dates: {} } } } }),
    );
    mount();
    expect(api.progress["Blind 75"]["blind75-1"]).not.toHaveProperty("timer");
    act(() => api.startTimer("blind75-1"));
    act(() => api.resetTimer("blind75-1"));
    expect(saved()).not.toHaveProperty("timer");
  });
});
