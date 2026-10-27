import { describe, expect, it } from "vitest";
import { patterns, blind75, leetcode75, neetcode150 } from "../data";
import manualHints from "../data/hints.json";
import { CATEGORY_PATTERNS, TOPIC_PATTERNS, hintFor } from "./hints";

const problem = (extra = {}) => ({
  slug: "some-problem",
  topics: [],
  listMeta: { section: "Unmapped section" },
  ...extra,
});

describe("hintFor", () => {
  it("uses the pattern of the section", () => {
    expect(hintFor(problem({ listMeta: { section: "Two Pointers" } }), {})).toEqual({
      id: "two-pointers",
      title: "Two Pointers",
    });
    expect(hintFor(problem({ listMeta: { module: "Binary Tree - BFS" } }), {})?.id).toBe("bfs-trees");
  });

  it("falls back to the topics when the section has no pattern, in the fixed order", () => {
    expect(hintFor(problem({ topics: ["Array", "Hash Table"] }), {})?.id).toBe("hashing");
    expect(hintFor(problem({ topics: ["Hash Table", "Monotonic Stack"] }), {})?.id).toBe("monotonic-stack");
  });

  it("is null with no section pattern and no topic pattern", () => {
    expect(hintFor(problem({ topics: ["Array", "Greedy"] }), {})).toBeNull();
    expect(hintFor(undefined, {})).toBeNull();
  });

  it("a manual entry wins over the automatic hint, by slug", () => {
    const p = problem({ slug: "two-sum", listMeta: { section: "Two Pointers" } });
    expect(hintFor(p, { "two-sum": "hashing" })?.id).toBe("hashing");
  });

  it("a manual null hides the hint even when the section has a pattern", () => {
    const p = problem({ slug: "x", listMeta: { section: "Two Pointers" } });
    expect(hintFor(p, { x: null })).toBeNull();
  });

  it("an unknown manual pattern id gives no hint instead of a broken link", () => {
    expect(hintFor(problem({ slug: "x" }), { x: "nope" })).toBeNull();
  });
});

describe("the hint tables", () => {
  const ids = new Set(patterns.map((pattern) => pattern.id));

  it("only point at patterns that exist", () => {
    expect(Object.values(CATEGORY_PATTERNS).every((id) => ids.has(id))).toBe(true);
    expect(TOPIC_PATTERNS.every(([, id]) => ids.has(id))).toBe(true);
    expect(Object.values(manualHints).every((id) => id === null || ids.has(id))).toBe(true);
  });

  it("every problem of the three lists has a manual entry (a pattern or null)", () => {
    const missing = [...blind75, ...leetcode75, ...neetcode150]
      .filter((p) => !Object.hasOwn(manualHints, p.slug))
      .map((p) => p.slug);
    expect(missing).toEqual([]);
  });

  it("every slug of the manual hints belongs to a problem of a list", () => {
    const slugs = new Set([...blind75, ...leetcode75, ...neetcode150].map((p) => p.slug));
    expect(Object.keys(manualHints).every((slug) => slugs.has(slug))).toBe(true);
  });
});
