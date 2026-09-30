import { blind75, leetcode75, neetcode150 } from "../data";

export const problemLists = {
  "Blind 75": blind75,
  "LeetCode 75": leetcode75,
  "NeetCode 150": neetcode150,
};

// Roadmap URLs for each list
export const roadmapLinks = {
  "Blind 75": "https://leetcode.com/problem-list/oizxjoit/",
  "LeetCode 75": "https://leetcode.com/studyplan/leetcode-75/",
  "NeetCode 150": "https://neetcode.io/roadmap",
};

export const getProblems = (listName) => problemLists[listName] || [];

// "12 - Two Sum": the problem's number in its list, then its title. Just the
// title when the number is not known.
export const problemLabel = (problem) =>
  typeof problem.listMeta?.originalIndex === "number"
    ? `${problem.listMeta.originalIndex} - ${problem.title}`
    : problem.title;
