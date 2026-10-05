import { describe, expect, it } from "vitest";
import { IMPORT_VERSION, importSolutions, problemIdsForSlug } from "./solutionImport";
import { problemLists } from "./lists";
import { solutionsOf } from "./solutions";

const lists = {
  A: [{ id: "a-1", slug: "two-sum" }, { id: "a-2", slug: "valid-anagram" }],
  B: [{ id: "b-9", slug: "two-sum" }],
};
const payload = (...solutions) => ({ version: IMPORT_VERSION, solutions });
const run = (progress, ...solutions) =>
  importSolutions(progress, payload(...solutions), "2026-10-20", lists);

describe("problemIdsForSlug", () => {
  it("finds the problem in every list that has it", () => {
    expect(problemIdsForSlug("two-sum", lists)).toEqual([
      { list: "A", id: "a-1" },
      { list: "B", id: "b-9" },
    ]);
    expect(problemIdsForSlug("nope", lists)).toEqual([]);
  });

  it("works with the real lists: a slug in several lists gives several ids", () => {
    const counts = {};
    for (const problems of Object.values(problemLists)) {
      for (const { slug } of problems) counts[slug] = (counts[slug] ?? 0) + 1;
    }
    const shared = Object.keys(counts).find((slug) => counts[slug] > 1);
    expect(problemIdsForSlug(shared)).toHaveLength(counts[shared]);
  });
});

describe("importSolutions", () => {
  it("fills every list that has the problem, as an imported solution", () => {
    const { progress, imported, skipped } = run({}, { slug: "two-sum", code: "x", language: "go" });
    expect(imported).toBe(2);
    expect(skipped).toEqual([]);
    expect(solutionsOf(progress.A["a-1"])).toEqual([
      { code: "x", language: "go", source: "import-file", savedAt: "2026-10-20" },
    ]);
    expect(solutionsOf(progress.B["b-9"])).toHaveLength(1);
  });

  it("does not mark the day as written today, so showing it still counts as help", () => {
    const { progress } = run({}, { slug: "two-sum", code: "x" });
    expect(progress.A["a-1"]).not.toHaveProperty("solutionEditedOn");
  });

  it("uses the submission date and keeps the source and meta it brings", () => {
    const { progress } = run(
      {},
      { slug: "valid-anagram", code: "y", source: "leetcode-api", submittedAt: "2026-09-01", meta: { submissionId: 7 } },
    );
    expect(solutionsOf(progress.A["a-2"])[0]).toEqual({
      code: "y",
      language: "other",
      source: "leetcode-api",
      savedAt: "2026-09-01",
      meta: { submissionId: 7, submittedAt: "2026-09-01" },
    });
  });

  it("skips unknown problems and items with no code, and says why", () => {
    const { progress, imported, skipped } = run(
      {},
      { slug: "nope", code: "x" },
      { slug: "valid-anagram", code: "  " },
      null,
    );
    expect(imported).toBe(0);
    expect(progress).toEqual({});
    expect(skipped).toEqual([
      { slug: "nope", reason: "unknown problem" },
      { slug: "valid-anagram", reason: "no code" },
      { slug: undefined, reason: "unknown problem" },
    ]);
  });

  it("importing the same file again changes nothing", () => {
    const first = run({}, { slug: "two-sum", code: "x" }).progress;
    const again = run(first, { slug: "two-sum", code: "x" });
    expect(again.progress).toBe(first);
    expect(again.imported).toBe(0);
    expect(again.skipped.every((s) => s.reason === "already saved")).toBe(true);
  });

  it("adds a second solution next to a hand-written one", () => {
    const start = { A: { "a-2": { status: "todo", solved: false, reviews: [], dates: {}, solutions: [{ code: "mine", language: "python", source: "manual", savedAt: "2026-10-01" }] } } };
    const { progress } = run(start, { slug: "valid-anagram", code: "theirs" });
    expect(solutionsOf(progress.A["a-2"]).map((s) => s.code)).toEqual(["mine", "theirs"]);
  });

  it("when there are two, replaces an automatic one but never a hand-written one", () => {
    const manual = (code) => ({ code, language: "python", source: "manual", savedAt: "2026-10-01" });
    const auto = (code) => ({ ...manual(code), source: "extension" });
    const entry = (solutions) => ({ A: { "a-2": { status: "todo", solved: false, reviews: [], dates: {}, solutions } } });

    const replaced = run(entry([manual("m"), auto("old")]), { slug: "valid-anagram", code: "new" });
    expect(solutionsOf(replaced.progress.A["a-2"]).map((s) => s.code)).toEqual(["m", "new"]);

    const full = entry([manual("m1"), manual("m2")]);
    const refused = run(full, { slug: "valid-anagram", code: "new" });
    expect(refused.progress).toBe(full);
    expect(refused.skipped).toEqual([{ slug: "valid-anagram", reason: "no free slot" }]);
  });

  it("throws on anything that is not this format", () => {
    for (const bad of [null, [], {}, { version: 2, solutions: [] }, { version: 1 }, { version: 1, solutions: "x" }]) {
      expect(() => importSolutions({}, bad, "2026-10-20", lists)).toThrow("Invalid solutions file");
    }
  });

  it("an empty list imports nothing", () => {
    const start = {};
    expect(run(start).progress).toBe(start);
  });
});
