import { useState } from "react";
import { Info, ExternalLink, Map } from "lucide-react";
import Filters from "./Filters";
import CircularStatsCard from "./CircularStatsCard";
import ExportImportControls from "./ExportImportControls";
import { problemLists, roadmapLinks, getProblems } from "../lib/lists";
import { computeStats } from "../lib/stats";
import { localToday } from "../lib/schedule";
import { useProgress } from "../context/ProgressContext";

// Everything above the problem list: list selector, spaced repetition help,
// stats, export/import and filters. Shared by the tracker and the board.
const TrackerHeader = ({ title, showDueToday = true }) => {
  const { progress, selectedList, setSelectedList, filters, setFilter } =
    useProgress();

  const [showExplanation, setShowExplanation] = useState(false);

  const problems = getProblems(selectedList);
  const currentProgress = progress[selectedList] || {};
  const stats = computeStats(problems, currentProgress, localToday());

  const categories = [
    "All",
    ...Array.from(new Set(problems.flatMap((p) => p.topics || []))),
  ];
  const difficulties = ["All", "Easy", "Medium", "Hard"];

  return (
    <>
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
            {title}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Track your progress with spaced repetition
          </p>
        </div>
        <div className="flex sm:flex-row gap-2 items-start sm:items-center">
          {/* Dropdown for problem list */}
          <select
            id="problem-list"
            value={selectedList}
            title="Select a problem list"
            onChange={(e) => setSelectedList(e.target.value)}
            className="px-4 py-2 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none"
          >
            <option value="" disabled>
              Select List
            </option>
            {Object.keys(problemLists).map((listName) => (
              <option key={listName} value={listName}>
                {listName}
              </option>
            ))}
          </select>

          {/* Official Roadmap */}
          <a
            href={roadmapLinks[selectedList]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
            title="View the official NeetCode roadmap"
          >
            <Map size={16} /> Roadmap <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Toggle Explanation */}
      <div className="mt-4">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm transition-colors"
        >
          <Info size={16} />
          {showExplanation ? "Hide" : "Show"} Spaced Repetition Info
        </button>
      </div>
    </div>

    {/* Explanation Section */}
    {showExplanation && (
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6 transition-colors">
        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-3">
          How Spaced Repetition Works
        </h3>
        <div className="text-blue-700 dark:text-blue-200 space-y-2">
          <p>
            This tracker uses spaced repetition to help you retain coding
            problems long-term.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-semibold mb-2">Review Schedule:</h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <strong>R1:</strong> 1 day after solving
                </li>
                <li>
                  <strong>R2:</strong> 2 days after you complete R1
                </li>
                <li>
                  <strong>R3:</strong> 4 days after you complete R2
                </li>
                <li>
                  <strong>R4:</strong> 7 days after you complete R3
                </li>
                <li>
                  <strong>R5:</strong> 16 days after you complete R4
                </li>
              </ul>
              <p className="text-sm mt-2">
                Done on time, that is 1, 3, 7, 14 and 30 days after
                solving. If you review late, the next dates move from the
                day you actually reviewed.
              </p>
              <h4 className="font-semibold mt-4 mb-2">
                If you needed help:
              </h4>
              <ul className="space-y-1 text-sm">
                <li>
                  <strong>Solved it myself:</strong> the next review
                  follows the schedule
                </li>
                <li>
                  <strong>Needed the note:</strong> the same review is
                  repeated in 2 days
                </li>
                <li>
                  <strong>Needed the solution:</strong> the problem goes
                  one review back (never a full reset)
                </li>
              </ul>
              <p className="text-sm mt-2">
                Reading a note or a solution is free. When you complete a
                review after opening one today, you are asked how it went.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">How to Use:</h4>
              <ul className="space-y-1 text-sm">
                <li>1. Mark a problem as solved when you complete it</li>
                <li>2. Review buttons (R1-R5) will show required dates</li>
                <li>
                  3. Click review buttons when you successfully review
                </li>
                <li>4. Use "Due Today" filter to see what needs review</li>
                <li>5. Check the Official Roadmap for study guidance</li>
                <li>
                  6. Already know one? Use the double check next to Solved to mark it as mastered
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Stats */}
    <CircularStatsCard
      stats={stats}
      problems={problems}
    />

    {/* Export / Import / Clear */}
    <ExportImportControls />

    {/* Filters */}
    <Filters
      categories={categories}
      difficulties={difficulties}
      filterCategory={filters.category}
      setFilterCategory={(value) => setFilter("category", value)}
      filterDifficulty={filters.difficulty}
      setFilterDifficulty={(value) => setFilter("difficulty", value)}
      showOnlyDueToday={filters.dueToday}
      showDueToday={showDueToday}
      setShowOnlyDueToday={(value) => setFilter("dueToday", value)}
    />
    </>
  );
};

export default TrackerHeader;
