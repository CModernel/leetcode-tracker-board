// The pattern a problem is solved with, for the magnifier ("hint") on cards and
// table rows. It links to the Patterns page, and it is only a nudge: opening
// it is never help. `null` means there is no clear pattern, so no magnifier.
import { patterns } from "../data";
import hints from "../data/hints.json";
import { categoryOf } from "./insights";

// The list sections that have a pattern of their own. Sections with several
// patterns inside (Stack, Linked List, Greedy, Intervals, Math, Bit
// Manipulation, Array / String) are not here: only a manual hint covers them.
export const CATEGORY_PATTERNS = {
  "Arrays & Hashing": "hashing",
  "Hash Map / Set": "hashing",
  "Two Pointers": "two-pointers",
  "Sliding Window": "sliding-window",
  "Prefix Sum": "prefix-sum",
  "Binary Search": "binary-search",
  Backtracking: "backtracking",
  "Monotonic Stack": "monotonic-stack",
  Trees: "dfs-trees",
  "Binary Tree - DFS": "dfs-trees",
  "Binary Search Tree": "dfs-trees",
  "Binary Tree - BFS": "bfs-trees",
  Tries: "trie",
  Trie: "trie",
  Heap: "heap",
  "Heap / Priority Queue": "heap",
  "Heap/Priority Queue": "heap",
  Graphs: "dfs-graphs",
  "Graphs - DFS": "dfs-graphs",
  "Graphs - BFS": "bfs-graphs",
  "Advanced Graphs": "dijkstra",
  "1-D Dynamic Programming": "dp",
  "2-D Dynamic Programming": "dp",
  "1-D DP": "dp",
  "2-D DP": "dp",
  "DP - 1D": "dp",
  "DP - Multidimensional": "dp",
};

// LeetCode topics that name a pattern, in the order they are tried when the
// section has none.
export const TOPIC_PATTERNS = [
  ["Monotonic Stack", "monotonic-stack"],
  ["Topological Sort", "topological-sort"],
  ["Shortest Path", "dijkstra"],
  ["Union Find", "union-find"],
  ["Trie", "trie"],
  ["Heap (Priority Queue)", "heap"],
  ["Prefix Sum", "prefix-sum"],
  ["Sliding Window", "sliding-window"],
  ["Two Pointers", "two-pointers"],
  ["Binary Search", "binary-search"],
  ["Backtracking", "backtracking"],
  ["Dynamic Programming", "dp"],
  ["Hash Table", "hashing"],
];

const titleOf = (id) => patterns.find((pattern) => pattern.id === id)?.title ?? null;

// The hint of a problem as `{ id, title }`, or null. In this order: a manual
// entry by LeetCode slug (`manual`, from data/hints.json: a pattern id, or null
// for "no hint"), the pattern of its section, the pattern of its topics.
export const hintFor = (problem, manual = hints) => {
  const id = (() => {
    if (problem?.slug && Object.hasOwn(manual, problem.slug)) return manual[problem.slug];
    const byCategory = CATEGORY_PATTERNS[categoryOf(problem)];
    if (byCategory) return byCategory;
    const topics = problem?.topics ?? [];
    return TOPIC_PATTERNS.find(([topic]) => topics.includes(topic))?.[1] ?? null;
  })();
  const title = id ? titleOf(id) : null;
  return title ? { id, title } : null;
};
