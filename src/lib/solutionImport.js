import { problemLists } from "./lists";
import { setSolution } from "../context/progressReducers";
import { MAX_SOLUTIONS, SOLUTION_SOURCES, normalizeSolution, solutionsOf } from "./solutions";

// The contract for solutions that come from outside the app (a file today; an
// API, an import from LeetCode or an extension later). Nothing here talks to
// the network: whoever fetches the data builds this payload and calls
// `importSolutions`.
//
//   { version: 1, solutions: [{ slug, code, language?, name?, source?,
//                               submittedAt?: "YYYY-MM-DD", meta? }] }
//
// `slug` is LeetCode's `titleSlug` ("two-sum"), the only thing every source
// knows. A problem can be in several lists, so one item can fill several.
export const IMPORT_VERSION = 1;

// Every { list, id } of the lists that has a problem with this slug.
export const problemIdsForSlug = (slug, lists = problemLists) => {
  const found = [];
  for (const [list, problems] of Object.entries(lists)) {
    for (const problem of problems) {
      if (problem.slug === slug) found.push({ list, id: problem.id });
    }
  }
  return found;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Where an incoming solution goes in a problem that already has some: the next
// free slot, else the first automatic one (a solution written by hand is never
// replaced), else nowhere (-1).
const slotFor = (current) => {
  if (current.length < MAX_SOLUTIONS) return current.length;
  return current.findIndex((solution) => solution.source !== SOLUTION_SOURCES.manual);
};

// Adds the solutions of a payload to the progress. Returns
// `{ progress, imported, skipped }`: `imported` counts the problems that got a
// solution, `skipped` lists `{ slug, reason }` ("unknown problem", "no code",
// "already saved", "no free slot"). The same code is never saved twice in a
// problem, so importing a file again changes nothing. An import is not
// something the person wrote today, so `solutionEditedOn` is not set (showing
// an imported solution still counts as looking it up). Throws on a payload that
// is not this format.
export const importSolutions = (progress, payload, today, lists = problemLists) => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    payload.version !== IMPORT_VERSION ||
    !Array.isArray(payload.solutions)
  ) {
    throw new Error("Invalid solutions file");
  }
  let next = progress;
  let imported = 0;
  const skipped = [];
  for (const item of payload.solutions) {
    const slug = item?.slug;
    const targets = typeof slug === "string" ? problemIdsForSlug(slug, lists) : [];
    if (targets.length === 0) {
      skipped.push({ slug, reason: "unknown problem" });
      continue;
    }
    const submitted = DATE.test(item.submittedAt) ? item.submittedAt : today;
    const solution = normalizeSolution(
      {
        ...item,
        source: item.source || SOLUTION_SOURCES.importFile,
        savedAt: submitted,
        meta: item.submittedAt ? { ...item.meta, submittedAt: item.submittedAt } : item.meta,
      },
      today,
    );
    if (solution === null) {
      skipped.push({ slug, reason: "no code" });
      continue;
    }
    for (const { list, id } of targets) {
      const current = solutionsOf(next[list]?.[id]);
      if (current.some((existing) => existing.code === solution.code)) {
        skipped.push({ slug, reason: "already saved" });
        continue;
      }
      const index = slotFor(current);
      const result =
        index === -1 ? next : setSolution(next, list, id, index, solution, undefined);
      if (result === next) {
        skipped.push({ slug, reason: "no free slot" });
        continue;
      }
      next = result;
      imported++;
    }
  }
  return { progress: next, imported, skipped };
};
